"""Check an Azure PostgreSQL connection without storing a password or changing data."""

import argparse
import getpass
import json
from pathlib import Path
import re
import ssl
import tempfile
import warnings


class CheckError(ValueError):
    """A safe, deliberately written message that contains no connection secrets."""


def validate_host(value):
    host = value.strip().lower()
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\.postgres\.database\.azure\.com", host):
        raise CheckError("Use the server's full public Azure PostgreSQL hostname, without a URL or port.")
    return host


def trusted_ca_bundle():
    """Export public CA certificates from Python's platform trust store for libpq."""
    certificates = ssl.create_default_context().get_ca_certs(binary_form=True)
    if not certificates:
        raise CheckError("No trusted root certificates were found. Update the system trust store first.")
    return "".join(ssl.DER_cert_to_PEM_cert(cert) for cert in certificates)


def prompt_password():
    # getpass otherwise warns and falls back to echoing input when no secure terminal is available.
    with warnings.catch_warnings():
        warnings.simplefilter("error", getpass.GetPassWarning)
        password = getpass.getpass("Azure database password (hidden; not saved): ")
    if not password:
        raise CheckError("A password is required. Run again in an interactive PowerShell terminal.")
    return password


def check_connection(host, user, password, connect):
    host = validate_host(host)
    if not user or any(ord(char) < 32 for char in user):
        raise CheckError("An administrator login without control characters is required.")
    # Only public root certificates are written. The password stays in process memory.
    with tempfile.TemporaryDirectory(prefix="rivock-db-check-") as directory:
        ca_file = Path(directory) / "trusted-roots.pem"
        ca_file.write_text(trusted_ca_bundle(), encoding="ascii")
        with connect(
            host=host,
            port=5432,
            dbname="postgres",
            user=user,
            password=password,
            sslmode="verify-full",
            sslrootcert=str(ca_file),
            ssl_min_protocol_version="TLSv1.2",
            connect_timeout=10,
            autocommit=True,
            application_name="rivock-connection-check",
            options="-c default_transaction_read_only=on -c statement_timeout=10000 -c search_path=pg_catalog",
        ) as connection:
            row = connection.execute(
                "SELECT current_database(), current_user, current_setting('server_version'), "
                "current_setting('server_version_num'), current_setting('transaction_read_only'), "
                "ssl, version FROM pg_catalog.pg_stat_ssl WHERE pid = pg_catalog.pg_backend_pid()"
            ).fetchone()
            if not row or row[5] is not True or row[6] not in {"TLSv1.2", "TLSv1.3"}:
                raise CheckError("The server did not confirm a supported encrypted session.")
            if row[4] != "on":
                raise CheckError("The connection did not confirm read-only mode.")
            if not 170000 <= int(row[3]) < 180000:
                raise CheckError("This setup expects PostgreSQL 17. Check the selected Azure server.")
            return {
                "connection": "ok",
                "host": host,
                "database": row[0],
                "user": row[1],
                "server_version": row[2],
                "tls": row[6],
                "read_only": True,
            }


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", required=True, help="Full *.postgres.database.azure.com hostname")
    parser.add_argument("--user", required=True, help="Administrator login from the Azure Overview page")
    args = parser.parse_args(argv)
    try:
        host = validate_host(args.host)
        import psycopg

        password = prompt_password()
        report = check_connection(host, args.user, password, psycopg.connect)
    except ImportError:
        print("Use Rivock's backend Python environment; the PostgreSQL driver is required.")
        return 1
    except (getpass.GetPassWarning, EOFError, KeyboardInterrupt):
        print("No secure password was entered. Run again in an interactive PowerShell terminal.")
        return 1
    except CheckError as error:
        print(str(error))
        return 1
    except Exception as error:
        # Driver errors can contain connection details. Never print raw exceptions or a connection URL.
        state = getattr(error, "sqlstate", None)
        if state == "28P01":
            print("Authentication failed. Check the administrator login and password locally.")
        elif state == "28000":
            print("Access was refused. Check the login and Azure's current-client-IP firewall rule.")
        else:
            print("Connection failed. Check the hostname, current-client-IP firewall rule and trusted roots.")
        print("No database changes were requested; no password or connection URL was saved.")
        return 1
    print(json.dumps(report, indent=2))
    print("Read-only check passed. Rivock's cloud database and tables have not been created by this check.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
