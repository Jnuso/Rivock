import importlib.util
from pathlib import Path
from uuid import uuid4
import pytest
from alembic.operations import Operations
from alembic.runtime.migration import MigrationContext
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from app.db import engine


def test_identity_migration_preserves_legacy_ownership_and_constraints():
    path = Path(__file__).parents[1] / "migrations/versions/31c7a48a90c1_provider_identity.py"
    spec = importlib.util.spec_from_file_location("identity_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    schema = "migration_" + uuid4().hex
    with engine.begin() as conn:
        conn.execute(text(f'CREATE SCHEMA "{schema}"'))
        conn.execute(text(f'SET LOCAL search_path TO "{schema}"'))
        conn.execute(
            text(
                "CREATE TABLE users (id integer PRIMARY KEY, entra_tenant_id varchar(100), entra_object_id varchar(100), kind text NOT NULL, username text UNIQUE, UNIQUE(entra_tenant_id,entra_object_id), CHECK(kind = 'bot' OR (entra_tenant_id IS NOT NULL AND entra_object_id IS NOT NULL)))"
            )
        )
        conn.execute(text("CREATE TABLE contributions (author_id integer REFERENCES users(id), body text)"))
        conn.execute(
            text(
                "INSERT INTO users VALUES (1,'old-tenant','user_same','human','alice'),(2,NULL,NULL,'bot','demo')"
            )
        )
        conn.execute(text("INSERT INTO contributions VALUES (1,'Existing contribution')"))
        with Operations.context(MigrationContext.configure(conn)):
            migration.upgrade()
            assert conn.execute(text("SELECT auth_issuer,auth_subject FROM users WHERE id=1")).one() == (
                "legacy-entra:old-tenant",
                "user_same",
            )
            assert (
                conn.scalar(text("SELECT body FROM contributions WHERE author_id=1"))
                == "Existing contribution"
            )
            assert conn.execute(text("SELECT auth_issuer,auth_subject FROM users WHERE id=2")).one() == (
                None,
                None,
            )
            migration.downgrade()
            assert conn.scalar(text("SELECT entra_tenant_id FROM users WHERE id=1")) == "old-tenant"
            migration.upgrade()
            conn.execute(
                text(
                    "INSERT INTO users VALUES (3,'https://clerk.example.com','user_same','human','newperson')"
                )
            )
            assert conn.scalar(text("SELECT count(*) FROM users WHERE auth_subject='user_same'")) == 2
            with pytest.raises(IntegrityError), conn.begin_nested():
                conn.execute(
                    text(
                        "INSERT INTO users VALUES (4,'https://clerk.example.com','user_same','human','duplicate')"
                    )
                )
            with pytest.raises(IntegrityError), conn.begin_nested():
                conn.execute(text("INSERT INTO users VALUES (5,NULL,NULL,'human','invalid')"))
            with pytest.raises(RuntimeError, match="Cannot downgrade"):
                migration.downgrade()
        conn.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
