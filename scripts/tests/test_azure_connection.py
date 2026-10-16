import importlib.util
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import MagicMock
import warnings

import pytest

spec = importlib.util.spec_from_file_location(
    "azure_connection_check", Path(__file__).parents[1] / "check-azure-db.py"
)
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)

HOST = "synthetic-rivock.postgres.database.azure.com"
PASSWORD = "synthetic-password-not-a-real-secret"
ROW = ("postgres", "test-admin", "17.11", "170011", "on", True, "TLSv1.3")


def fake_connection(row=ROW):
    connect = MagicMock()
    connection = connect.return_value.__enter__.return_value
    connection.execute.return_value.fetchone.return_value = row
    return connect


def test_host_rejects_urls_connection_parameters_and_non_azure_targets():
    assert helper.validate_host(f" {HOST.upper()} ") == HOST
    for value in ("localhost", HOST + ":5432", "https://" + HOST, HOST + " sslmode=disable", HOST + "/db"):
        with pytest.raises(ValueError):
            helper.validate_host(value)


def test_connection_requires_verified_tls_and_read_only_query(monkeypatch):
    monkeypatch.setattr(helper, "trusted_ca_bundle", lambda: "synthetic-public-roots")
    connect = fake_connection()

    def inspect_file(**kwargs):
        assert Path(kwargs["sslrootcert"]).read_text() == "synthetic-public-roots"
        return connect.return_value

    connect.side_effect = inspect_file
    report = helper.check_connection(HOST, "test-admin", PASSWORD, connect)
    kwargs = connect.call_args.kwargs
    assert kwargs["password"] == PASSWORD
    assert kwargs["sslmode"] == "verify-full"
    assert kwargs["ssl_min_protocol_version"] == "TLSv1.2"
    assert kwargs["dbname"] == "postgres"
    assert kwargs["connect_timeout"] == 10
    assert "default_transaction_read_only=on" in kwargs["options"]
    assert not Path(kwargs["sslrootcert"]).exists()
    query = connect.return_value.__enter__.return_value.execute.call_args.args[0]
    assert query.startswith("SELECT ")
    assert "INSERT" not in query and "CREATE" not in query
    assert report["connection"] == "ok" and report["read_only"] is True
    assert PASSWORD not in str(report)


@pytest.mark.parametrize(
    "row",
    [None, ROW[:5] + (False, "TLSv1.3"), ROW[:6] + ("TLSv1.1",), ROW[:4] + ("off",) + ROW[5:],
     ROW[:2] + ("18.0", "180000") + ROW[4:]],
)
def test_rejects_missing_tls_wrong_version_or_writable_session(monkeypatch, row):
    monkeypatch.setattr(helper, "trusted_ca_bundle", lambda: "synthetic-public-roots")
    with pytest.raises(ValueError):
        helper.check_connection(HOST, "test-admin", PASSWORD, fake_connection(row))


def test_temporary_certificate_file_removed_after_failure(monkeypatch):
    monkeypatch.setattr(helper, "trusted_ca_bundle", lambda: "synthetic-public-roots")
    files = []

    def connect(**kwargs):
        files.append(Path(kwargs["sslrootcert"]))
        raise RuntimeError("synthetic failure")

    with pytest.raises(RuntimeError):
        helper.check_connection(HOST, "test-admin", PASSWORD, connect)
    assert len(files) == 1 and not files[0].exists()


def test_getpass_never_falls_back_to_echo(monkeypatch):
    def insecure_prompt(_):
        warnings.warn("synthetic echo fallback", helper.getpass.GetPassWarning)
        pytest.fail("Echo fallback was allowed")

    monkeypatch.setattr(helper.getpass, "getpass", insecure_prompt)
    with pytest.raises(helper.getpass.GetPassWarning):
        helper.prompt_password()


def test_no_trusted_roots_fails_closed(monkeypatch):
    context = SimpleNamespace(get_ca_certs=lambda **_: [])
    monkeypatch.setattr(helper.ssl, "create_default_context", lambda: context)
    with pytest.raises(ValueError, match="No trusted root"):
        helper.trusted_ca_bundle()


@pytest.mark.parametrize("error_type", [RuntimeError, ValueError, OSError])
def test_driver_exception_output_never_contains_password(monkeypatch, capsys, error_type):
    monkeypatch.setattr(helper, "prompt_password", lambda: PASSWORD)
    monkeypatch.setattr(helper, "trusted_ca_bundle", lambda: "synthetic-public-roots")

    def connect(**_):
        raise error_type(f"postgresql://test-admin:{PASSWORD}@{HOST}/postgres")

    monkeypatch.setitem(sys.modules, "psycopg", SimpleNamespace(connect=connect))
    assert helper.main(["--host", HOST, "--user", "test-admin"]) == 1
    output = capsys.readouterr().out
    assert "Connection failed" in output
    assert PASSWORD not in output and "postgresql://" not in output


def test_success_report_does_not_save_or_echo_password(monkeypatch, capsys):
    monkeypatch.setattr(helper, "prompt_password", lambda: PASSWORD)
    monkeypatch.setattr(helper, "trusted_ca_bundle", lambda: "synthetic-public-roots")
    monkeypatch.setitem(sys.modules, "psycopg", SimpleNamespace(connect=fake_connection()))
    assert helper.main(["--host", HOST, "--user", "test-admin"]) == 0
    output = capsys.readouterr().out
    assert '"connection": "ok"' in output
    assert PASSWORD not in output
