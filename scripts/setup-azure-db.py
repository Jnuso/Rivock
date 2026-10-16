"""Create the reviewed Rivock database/roles and apply migrations using a private prompt."""

import argparse
import csv
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import tempfile
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app.azure_database import Plan, SetupError, initialize  # noqa: E402

spec = importlib.util.spec_from_file_location("azure_connection_check", ROOT / "scripts/check-azure-db.py")
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


def cloud_url(host, database, user, password):
    from sqlalchemy.engine import URL

    return URL.create(
        "postgresql+psycopg", username=user, password=password, host=host, port=5432,
        database=database, query={"sslmode": "verify-full", "sslrootcert": "system"},
    ).render_as_string(hide_password=False)


def credentials(host, administrator, plan):
    return {
        "AZURE_PG_HOST": host,
        "AZURE_PG_ADMIN": administrator,
        "AZURE_PG_DATABASE": plan.database,
        "AZURE_PG_SETUP_ID": plan.setup_id,
        "AZURE_PG_MIGRATION_USER": plan.migration_user,
        "AZURE_PG_MIGRATION_PASSWORD": plan.migration_password,
        "AZURE_PG_RUNTIME_USER": plan.runtime_user,
        "AZURE_PG_RUNTIME_PASSWORD": plan.runtime_password,
        "DATABASE_URL": cloud_url(host, plan.database, plan.runtime_user, plan.runtime_password),
        "MIGRATION_DATABASE_URL": cloud_url(host, plan.database, plan.migration_user, plan.migration_password),
    }


def load_plan(path, host, administrator):
    if path.is_symlink() or path.stat().st_nlink != 1:
        raise SetupError("The cloud credential file must be a regular unlinked local file.")
    pairs = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip() and not line.startswith("#"):
            key, separator, value = line.partition("=")
            if not separator:
                raise SetupError("The cloud credential file format is invalid.")
            pairs.append((key, value))
    values = dict(pairs)
    if len(values) != len(pairs):
        raise SetupError("The cloud credential file has duplicate fields.")
    try:
        plan = Plan(values["AZURE_PG_DATABASE"], values["AZURE_PG_MIGRATION_USER"],
                    values["AZURE_PG_RUNTIME_USER"], values["AZURE_PG_MIGRATION_PASSWORD"],
                    values["AZURE_PG_RUNTIME_PASSWORD"], values["AZURE_PG_SETUP_ID"])
    except KeyError:
        raise SetupError("The cloud credential file is incomplete.") from None
    plan.validate()
    if (plan.database, plan.migration_user, plan.runtime_user) != ("rivock", "rivock_migrate", "rivock_app"):
        raise SetupError("The credential file targets unexpected database or role names.")
    if values != credentials(host, administrator, plan):
        raise SetupError("The cloud credential file does not match this server/login. It was not changed.")
    return plan


def restrict_file(path):
    if os.name != "nt":
        path.chmod(0o600)
        return
    identity = subprocess.run(
        ["whoami.exe", "/user", "/fo", "csv", "/nh"], check=True, capture_output=True, text=True
    )
    row = next(csv.reader(io.StringIO(identity.stdout)))
    sid = row[-1]
    if not re.fullmatch(r"S-\d+(?:-\d+)+", sid):
        raise SetupError("Windows could not identify the current account for private-file permissions.")
    subprocess.run(
        ["icacls.exe", str(path), "/inheritance:r", "/grant:r", f"*{sid}:(F)"],
        check=True, capture_output=True, text=True,
    )


def save_credentials(path, values):
    # Exclusive creation preserves any existing file. Windows permissions are set while it is empty.
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as stream:
            restrict_file(path)
            stream.write("# Private generated cloud credentials. Never commit or paste this file.\n")
            stream.writelines(f"{key}={value}\n" for key, value in values.items())
            stream.flush()
            os.fsync(stream.fileno())
    except BaseException:
        # If writing fails, retain a possibly partial file for explicit inspection; no DB changes started.
        raise


def run(host, administrator, password, path):
    import psycopg

    existed = path.exists()
    if existed:
        plan = load_plan(path, host, administrator)
        restrict_file(path)
    else:
        plan = Plan("rivock", "rivock_migrate", "rivock_app", secrets.token_urlsafe(36),
                    secrets.token_urlsafe(36), uuid4().hex)
    values = credentials(host, administrator, plan)
    with tempfile.TemporaryDirectory(prefix="rivock-db-setup-") as directory:
        ca_file = Path(directory) / "trusted-roots.pem"
        ca_file.write_text(checker.trusted_ca_bundle(), encoding="ascii")

        def connect(user, secret, database):
            return psycopg.connect(
                host=host, port=5432, dbname=database, user=user, password=secret,
                sslmode="verify-full", sslrootcert=str(ca_file), ssl_min_protocol_version="TLSv1.2",
                connect_timeout=10, autocommit=True, application_name="rivock-database-setup",
                options="-c statement_timeout=60000 -c lock_timeout=5000 -c search_path=public",
            )

        def connect_database(kind):
            if kind == "admin":
                return connect(administrator, password, plan.database)
            if kind == "migration":
                return connect(plan.migration_user, plan.migration_password, plan.database)
            if kind == "runtime":
                return connect(plan.runtime_user, plan.runtime_password, plan.database)
            raise SetupError("Unknown connection purpose.")

        with connect(administrator, password, "postgres") as admin:
            return initialize(admin, plan, connect_database,
                              (lambda: None) if existed else lambda: save_credentials(path, values))


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", required=True)
    parser.add_argument("--user", required=True)
    args = parser.parse_args(argv)
    path = ROOT / ".env.azure"
    try:
        host = checker.validate_host(args.host)
        if not re.fullmatch(r"[A-Za-z0-9]{1,63}", args.user):
            raise SetupError("Use the administrator login shown in the Azure Overview page.")
        password = checker.prompt_password()
        print("Preparing the Rivock database, restricted roles and schema; this may take a moment.")
        report = run(host, args.user, password, path)
    except (SetupError, checker.CheckError) as error:
        print(str(error))
        print("Any existing cloud credential file was preserved. Keep it private for a safe retry.")
        return 1
    except (checker.getpass.GetPassWarning, EOFError, KeyboardInterrupt):
        print("Stopped. Keep any existing .env.azure file; rerun in an interactive PowerShell terminal.")
        return 1
    except Exception as error:
        # Raw SQL/driver/validation tracebacks can contain generated secrets or SCRAM verifiers.
        print("Setup could not finish. Keep .env.azure private and rerun this command to resume.")
        state = getattr(error, "sqlstate", None) or getattr(getattr(error, "orig", None), "sqlstate", None)
        if isinstance(state, str) and re.fullmatch(r"[A-Z0-9]{5}", state):
            print("Database error code: " + state)
        print("No existing database or role is dropped, and existing passwords are not rotated.")
        return 1
    print(json.dumps({"setup": "ok", "host": host, **report}, indent=2))
    print("Generated app/migration credentials are in ignored .env.azure with restricted file permissions.")
    print("Your administrator password was not saved. The local app still uses its existing database.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
