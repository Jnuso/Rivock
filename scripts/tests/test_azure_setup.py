import importlib.util
from pathlib import Path
import secrets
from uuid import uuid4

import pytest

spec = importlib.util.spec_from_file_location("azure_setup", Path(__file__).parents[1] / "setup-azure-db.py")
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)

HOST = "synthetic-rivock.postgres.database.azure.com"


def plan():
    return helper.Plan("rivock", "rivock_migrate", "rivock_app", secrets.token_urlsafe(36),
                       secrets.token_urlsafe(36), uuid4().hex)


def test_credentials_file_private_roundtrip_and_never_overwritten(tmp_path):
    original = plan()
    path = tmp_path / ".env.azure"
    values = helper.credentials(HOST, "testadmin", original)
    helper.save_credentials(path, values)
    assert helper.load_plan(path, HOST, "testadmin") == original
    assert "sslmode=verify-full" in values["DATABASE_URL"]
    assert "sslrootcert=system" in values["DATABASE_URL"]
    with pytest.raises(FileExistsError):
        helper.save_credentials(path, helper.credentials(HOST, "testadmin", plan()))
    assert helper.load_plan(path, HOST, "testadmin") == original


def test_credentials_for_other_host_or_login_are_refused(tmp_path):
    path = tmp_path / ".env.azure"
    helper.save_credentials(path, helper.credentials(HOST, "testadmin", plan()))
    with pytest.raises(helper.SetupError, match="does not match"):
        helper.load_plan(path, HOST, "differentadmin")
    with pytest.raises(helper.SetupError, match="does not match"):
        helper.load_plan(path, "other-rivock.postgres.database.azure.com", "testadmin")


def test_secret_file_permission_failure_occurs_before_any_secret_write(tmp_path, monkeypatch):
    path = tmp_path / ".env.azure"

    def fail_permissions(_):
        raise PermissionError("synthetic ACL failure")

    monkeypatch.setattr(helper, "restrict_file", fail_permissions)
    with pytest.raises(PermissionError):
        helper.save_credentials(path, helper.credentials(HOST, "testadmin", plan()))
    assert path.read_text() == ""


@pytest.mark.parametrize("error_type", [RuntimeError, ValueError, OSError])
def test_setup_never_prints_raw_driver_secrets(monkeypatch, capsys, error_type):
    password = "synthetic-not-a-real-password"
    monkeypatch.setattr(helper.checker, "prompt_password", lambda: password)

    def failure(*_args, **_kwargs):
        raise error_type("postgresql://testadmin:" + password + "@" + HOST + "/rivock")

    monkeypatch.setattr(helper, "run", failure)
    assert helper.main(["--host", HOST, "--user", "testadmin"]) == 1
    captured = capsys.readouterr()
    assert password not in captured.out + captured.err
    assert "postgresql://" not in captured.out + captured.err
