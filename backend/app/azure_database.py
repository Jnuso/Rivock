"""Operator-only initialization of a marked Rivock database and restricted roles."""

from dataclasses import dataclass, field
from pathlib import Path
import re

from psycopg import sql


class SetupError(ValueError):
    """A safe operator message; never include credentials or raw database errors."""


@dataclass(frozen=True)
class Plan:
    database: str
    migration_user: str
    runtime_user: str
    migration_password: str = field(repr=False)
    runtime_password: str = field(repr=False)
    setup_id: str

    def validate(self):
        if not re.fullmatch(r"rivock(?:_[a-z0-9]+_test)?", self.database):
            raise SetupError("The target must be rivock or an isolated Rivock test database.")
        for role, prefix in ((self.migration_user, "rivock_migrate"), (self.runtime_user, "rivock_app")):
            if not re.fullmatch(prefix + r"(?:_[a-z0-9]+)?", role) or len(role) > 63:
                raise SetupError("Unexpected Rivock role name.")
        if not re.fullmatch(r"[a-f0-9]{32}", self.setup_id):
            raise SetupError("The setup identifier is invalid.")
        for password in (self.migration_password, self.runtime_password):
            if not re.fullmatch(r"[A-Za-z0-9_-]{40,100}", password):
                raise SetupError("Generated database credentials are invalid.")

    @property
    def marker(self):
        return "Rivock bootstrap " + self.setup_id


def role_state(admin, name):
    return admin.execute(
        "SELECT rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls, "
        "rolcanlogin, rolinherit, shobj_description(oid, 'pg_authid') "
        "FROM pg_catalog.pg_roles WHERE rolname = %s", (name,),
    ).fetchone()


def database_state(admin, name):
    return admin.execute(
        "SELECT pg_get_userbyid(datdba), shobj_description(oid, 'pg_database') "
        "FROM pg_catalog.pg_database WHERE datname = %s", (name,),
    ).fetchone()


def preflight(admin, plan):
    plan.validate()
    administrator, createdb, createrole, version = admin.execute(
        "SELECT current_user, rolcreatedb, rolcreaterole, current_setting('server_version_num') "
        "FROM pg_catalog.pg_roles WHERE rolname = current_user"
    ).fetchone()
    if not createdb or not createrole or not 170000 <= int(version) < 180000:
        raise SetupError("A PostgreSQL 17 administrator with CREATEDB and CREATEROLE is required.")
    for name, kind in ((plan.migration_user, "migration"), (plan.runtime_user, "runtime")):
        row = role_state(admin, name)
        if row is not None and row != (False, False, False, False, False, True, False, plan.marker + ":" + kind):
            raise SetupError("An existing role does not match this setup. Nothing will be overwritten.")
        if row is not None and admin.execute(
            "SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_auth_members "
            "WHERE member = (SELECT oid FROM pg_catalog.pg_roles WHERE rolname = %s))", (name,),
        ).fetchone()[0]:
            raise SetupError("An application role has unexpected memberships. Inspect it before retrying.")
    row = database_state(admin, plan.database)
    if row is not None and row != (administrator, plan.marker):
        raise SetupError("The database already exists without this setup marker. It will not be changed.")
    return administrator


def ensure_roles(admin, plan):
    for name, kind, password, limit in (
        (plan.migration_user, "migration", plan.migration_password, 2),
        (plan.runtime_user, "runtime", plan.runtime_password, 12),
    ):
        if role_state(admin, name) is not None:
            continue
        # libpq computes a SCRAM verifier locally. The plaintext password is never SQL text.
        verifier = admin.pgconn.encrypt_password(
            password.encode("utf-8"), name.encode("utf-8"), b"scram-sha-256"
        ).decode("ascii")
        with admin.transaction():
            admin.execute(sql.SQL(
                "CREATE ROLE {} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE "
                "NOREPLICATION NOBYPASSRLS NOINHERIT CONNECTION LIMIT {} PASSWORD {}"
            ).format(sql.Identifier(name), sql.Literal(limit), sql.Literal(verifier)))
            admin.execute(sql.SQL("COMMENT ON ROLE {} IS {}").format(
                sql.Identifier(name), sql.Literal(plan.marker + ":" + kind)
            ))


def configure_database(admin, plan, connect_database):
    if database_state(admin, plan.database) is None:
        admin.execute(sql.SQL("CREATE DATABASE {} TEMPLATE template0 ENCODING 'UTF8'").format(
            sql.Identifier(plan.database)
        ))
        admin.execute(sql.SQL("COMMENT ON DATABASE {} IS {}").format(
            sql.Identifier(plan.database), sql.Literal(plan.marker)
        ))
    with admin.transaction():
        admin.execute(sql.SQL("REVOKE ALL ON DATABASE {} FROM PUBLIC").format(sql.Identifier(plan.database)))
        admin.execute(sql.SQL("GRANT CONNECT ON DATABASE {} TO {}, {}").format(
            sql.Identifier(plan.database), sql.Identifier(plan.migration_user), sql.Identifier(plan.runtime_user)
        ))
        for role in (plan.migration_user, plan.runtime_user):
            admin.execute(sql.SQL("ALTER ROLE {} IN DATABASE {} SET search_path = public").format(
                sql.Identifier(role), sql.Identifier(plan.database)
            ))
    with connect_database("admin") as connection, connection.transaction():
        connection.execute("REVOKE ALL ON SCHEMA public FROM PUBLIC")
        connection.execute(sql.SQL("GRANT USAGE, CREATE ON SCHEMA public TO {}").format(
            sql.Identifier(plan.migration_user)
        ))
        connection.execute(sql.SQL("GRANT USAGE ON SCHEMA public TO {}").format(
            sql.Identifier(plan.runtime_user)
        ))


def migrate_connection(connection, backend_directory=None):
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import create_engine, pool

    directory = backend_directory or Path(__file__).resolve().parents[1]
    connection.autocommit = False
    engine = create_engine("postgresql+psycopg://", creator=lambda: connection,
                           poolclass=pool.NullPool, hide_parameters=True)
    config = Config(str(directory / "alembic.ini"))
    config.set_main_option("script_location", str(directory / "migrations"))
    try:
        with engine.begin() as supplied:
            config.attributes["connection"] = supplied
            command.upgrade(config, "head")
    finally:
        engine.dispose()


def grant_runtime(connection, plan):
    with connection.transaction():
        tables = connection.execute(
            "SELECT c.relname, pg_get_userbyid(c.relowner) FROM pg_catalog.pg_class c "
            "JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace "
            "WHERE n.nspname='public' AND c.relkind IN ('r','p')"
        ).fetchall()
        if not tables or any(owner != plan.migration_user for _, owner in tables):
            raise SetupError("Unexpected table ownership; runtime privileges were not granted.")
        for name, _ in tables:
            if name == "alembic_version":
                continue
            connection.execute(sql.SQL("GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.{} TO {}").format(
                sql.Identifier(name), sql.Identifier(plan.runtime_user)
            ))
        connection.execute(sql.SQL("REVOKE ALL ON TABLE public.alembic_version FROM {}").format(
            sql.Identifier(plan.runtime_user)
        ))
        connection.execute(sql.SQL("GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO {}").format(
            sql.Identifier(plan.runtime_user)
        ))
        connection.execute(sql.SQL(
            "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {}"
        ).format(sql.Identifier(plan.runtime_user)))
        connection.execute(sql.SQL(
            "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE ON SEQUENCES TO {}"
        ).format(sql.Identifier(plan.runtime_user)))


def verify_runtime(connection, plan):
    privileges = connection.execute(
        "SELECT has_database_privilege(current_database(), 'CREATE,TEMP'), "
        "has_schema_privilege('public', 'CREATE'), "
        "has_table_privilege('public.alembic_version', 'SELECT,INSERT,UPDATE,DELETE'), "
        "pg_has_role(current_user, %s, 'SET')", (plan.migration_user,),
    ).fetchone()
    if any(privileges):
        raise SetupError("The runtime role has unexpected administrative or migration privileges.")
    return connection.execute("SELECT count(*) FROM public.topics").fetchone()[0]


def initialize(admin, plan, connect_database, persist_credentials=lambda: None):
    """Resume only objects with matching markers; never drop data or rotate existing passwords."""
    if not admin.autocommit:
        raise SetupError("Bootstrap needs an autocommit administrator connection.")
    if not admin.execute("SELECT pg_try_advisory_lock(74696202)").fetchone()[0]:
        raise SetupError("Another database setup is in progress. Wait for it to finish.")
    try:
        preflight(admin, plan)
        persist_credentials()
        ensure_roles(admin, plan)
        configure_database(admin, plan, connect_database)
        with connect_database("migration") as connection:
            migrate_connection(connection)
        with connect_database("migration") as connection:
            grant_runtime(connection, plan)
            revision = connection.execute("SELECT version_num FROM public.alembic_version").fetchone()[0]
        with connect_database("runtime") as connection:
            topics = verify_runtime(connection, plan)
        return {"database": plan.database, "schema_revision": revision, "topics": topics,
                "runtime_permissions": "restricted", "local_data_copied": False}
    finally:
        admin.execute("SELECT pg_advisory_unlock(74696202)")
