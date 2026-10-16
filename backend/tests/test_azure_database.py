from dataclasses import replace
import os
import secrets
from uuid import uuid4

import psycopg
from psycopg import sql
import pytest
from sqlalchemy.engine import make_url

from app import azure_database as setup


@pytest.fixture
def isolated_setup():
    url = make_url(os.environ["TEST_DATABASE_URL"])
    assert url.database.endswith("_test") and url.host in {"db", "localhost", "127.0.0.1", "postgres"}
    options = dict(host=url.host, port=url.port or 5432, user=url.username,
                   password=url.password, dbname="postgres", autocommit=True)
    suffix = uuid4().hex[:16]
    admin_name = "rivock_setup_admin_" + suffix
    admin_password = secrets.token_urlsafe(36)
    plan = setup.Plan("rivock_" + suffix + "_test", "rivock_migrate_" + suffix,
                      "rivock_app_" + suffix, secrets.token_urlsafe(36), secrets.token_urlsafe(36), uuid4().hex)
    with psycopg.connect(**options) as control:
        control.execute(sql.SQL("CREATE ROLE {} LOGIN NOSUPERUSER CREATEDB CREATEROLE PASSWORD {}").format(
            sql.Identifier(admin_name), sql.Literal(admin_password)
        ))

    def connect_database(kind):
        user, password = {
            "admin": (admin_name, admin_password),
            "migration": (plan.migration_user, plan.migration_password),
            "runtime": (plan.runtime_user, plan.runtime_password),
        }[kind]
        return psycopg.connect(**(options | {"dbname": plan.database, "user": user, "password": password}))

    try:
        with psycopg.connect(**(options | {"user": admin_name, "password": admin_password})) as admin:
            assert not admin.execute("SELECT rolsuper FROM pg_roles WHERE rolname=current_user").fetchone()[0]
            yield admin, plan, connect_database
    finally:
        # Only this fixture's generated database and roles are cleanup targets.
        assert plan.database.startswith("rivock_") and plan.database.endswith("_test")
        with psycopg.connect(**options) as control:
            control.execute(sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(
                sql.Identifier(plan.database)
            ))
            for name in (plan.migration_user, plan.runtime_user, admin_name):
                assert name.endswith(suffix)
                control.execute(sql.SQL("DROP ROLE IF EXISTS {}").format(sql.Identifier(name)))


def test_non_superuser_bootstrap_migrates_and_enforces_runtime_privileges(isolated_setup):
    admin, plan, connect = isolated_setup
    report = setup.initialize(admin, plan, connect)
    assert report == {"database": plan.database, "schema_revision": "31c7a48a90c1", "topics": 7,
                      "runtime_permissions": "restricted", "local_data_copied": False}
    with connect("runtime") as runtime:
        runtime.execute("INSERT INTO public.runtime_controls (key,value) VALUES ('test-check',true)")
        runtime.execute("UPDATE public.runtime_controls SET value=false WHERE key='test-check'")
        assert runtime.execute("SELECT value FROM public.runtime_controls WHERE key='test-check'").fetchone() == (False,)
        runtime.execute("DELETE FROM public.runtime_controls WHERE key='test-check'")
        for query in (
            "CREATE TABLE public.must_not_create (id integer)",
            "ALTER TABLE public.topics ADD COLUMN must_not_add integer",
            "TRUNCATE TABLE public.topics CASCADE",
            "SELECT * FROM public.alembic_version",
            "UPDATE public.alembic_version SET version_num='invalid'",
            sql.SQL("SET ROLE {}").format(sql.Identifier(plan.migration_user)),
        ):
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                with runtime.transaction():
                    runtime.execute(query)
    with connect("migration") as migration:
        migration.execute("CREATE TABLE public.future_permissions_check (id integer)")
        migration.execute("CREATE SEQUENCE public.future_sequence_check")
    with connect("runtime") as runtime:
        runtime.execute("INSERT INTO public.future_permissions_check VALUES (1)")
        assert runtime.execute("SELECT id FROM public.future_permissions_check").fetchone() == (1,)
        assert runtime.execute("SELECT nextval('public.future_sequence_check')").fetchone() == (1,)


def test_rerun_preserves_passwords_and_existing_app_rows(isolated_setup):
    admin, plan, connect = isolated_setup
    setup.initialize(admin, plan, connect)
    with connect("runtime") as runtime:
        runtime.execute("INSERT INTO public.runtime_controls (key,value) VALUES ('preserve-check',true)")
    assert setup.initialize(admin, plan, connect)["topics"] == 7
    with connect("runtime") as runtime:
        assert runtime.execute("SELECT value FROM public.runtime_controls WHERE key='preserve-check'").fetchone() == (True,)


def test_unmarked_existing_database_refused_before_credentials_or_roles(isolated_setup):
    admin, plan, connect = isolated_setup
    admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(plan.database)))
    saved = []
    with pytest.raises(setup.SetupError, match="already exists"):
        setup.initialize(admin, plan, connect, lambda: saved.append(True))
    assert not saved and setup.role_state(admin, plan.runtime_user) is None


def test_existing_role_is_not_adopted_or_modified(isolated_setup):
    admin, plan, connect = isolated_setup
    admin.execute(sql.SQL("CREATE ROLE {} LOGIN CREATEDB").format(sql.Identifier(plan.runtime_user)))
    with pytest.raises(setup.SetupError, match="existing role"):
        setup.initialize(admin, plan, connect)
    assert setup.role_state(admin, plan.runtime_user)[1] is True
    assert setup.database_state(admin, plan.database) is None


def test_failed_migration_rolls_back_ddl_and_resume_works(isolated_setup, monkeypatch):
    from alembic import command

    admin, plan, connect = isolated_setup
    real_upgrade = command.upgrade

    def interrupted_upgrade(config, _revision):
        config.attributes["connection"].exec_driver_sql("CREATE TABLE public.must_roll_back (id integer)")
        raise RuntimeError("synthetic interrupted migration")

    monkeypatch.setattr(command, "upgrade", interrupted_upgrade)
    with pytest.raises(RuntimeError, match="synthetic interrupted"):
        setup.initialize(admin, plan, connect)
    with connect("migration") as migration:
        assert migration.execute("SELECT to_regclass('public.must_roll_back')").fetchone() == (None,)
    monkeypatch.setattr(command, "upgrade", real_upgrade)
    assert setup.initialize(admin, plan, connect)["schema_revision"] == "31c7a48a90c1"


def test_runtime_privilege_drift_refused_on_rerun(isolated_setup):
    admin, plan, connect = isolated_setup
    setup.initialize(admin, plan, connect)
    admin.execute(sql.SQL("ALTER ROLE {} CREATEDB").format(sql.Identifier(plan.runtime_user)))
    with pytest.raises(setup.SetupError, match="existing role"):
        setup.initialize(admin, plan, connect)


def test_secret_file_failure_prevents_database_changes(isolated_setup):
    admin, plan, connect = isolated_setup

    def failed_write():
        raise PermissionError("synthetic private file denied")

    with pytest.raises(PermissionError):
        setup.initialize(admin, plan, connect, failed_write)
    assert setup.database_state(admin, plan.database) is None
    assert setup.role_state(admin, plan.migration_user) is None


def test_plan_never_renders_passwords_and_rejects_non_rivock_database(isolated_setup):
    _, plan, _ = isolated_setup
    assert plan.runtime_password not in repr(plan) and plan.migration_password not in repr(plan)
    with pytest.raises(setup.SetupError):
        replace(plan, database="postgres").validate()


def test_external_migration_connection_does_not_read_app_settings(isolated_setup, monkeypatch):
    from app import config

    def forbidden_settings_read():
        pytest.fail("Operator migrations tried to load unrelated application configuration")

    monkeypatch.setattr(config, "settings", forbidden_settings_read)
    admin, plan, connect = isolated_setup
    assert setup.initialize(admin, plan, connect)["topics"] == 7
