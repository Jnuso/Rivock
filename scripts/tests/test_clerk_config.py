import base64
import importlib.util
from pathlib import Path
import pytest

spec = importlib.util.spec_from_file_location(
    "clerk_setup_helpers", Path(__file__).parents[1] / "clerk_config.py"
)
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)


def public_key(value):
    return "pk_test_" + base64.b64encode(value.encode()).decode().rstrip("=")


def test_public_key_derivation_and_invalid_hostnames():
    assert (
        helpers.issuer_from_key(public_key("synthetic.clerk.accounts.dev$"))
        == "https://synthetic.clerk.accounts.dev"
    )
    for value in [
        "evil.invalid/path$",
        "evil.invalid;unsafe-inline$",
        "user@evil.invalid$",
        "evil.invalid:443$",
        "evil.invalid",
    ]:
        with pytest.raises(ValueError):
            helpers.issuer_from_key(public_key(value))
    with pytest.raises(ValueError):
        helpers.issuer_from_key("not_a_publishable_key")


def test_local_environment_updates_preserve_unrelated_settings(tmp_path):
    path = tmp_path / ".env"
    original = "# Keep this comment\nDATABASE_URL=synthetic-database\nAI_API_KEY=synthetic-private-placeholder\nENTRA_TENANT_ID=old\nCLERK_ISSUER=old\nCLERK_ISSUER=duplicate\n"
    path.write_text(original)
    helpers.update_env(path, {"CLERK_ISSUER": "https://clerk.example.com"})
    value = path.read_text()
    assert "AI_API_KEY=synthetic-private-placeholder" in value
    assert "DATABASE_URL=synthetic-database" in value
    assert "# Keep this comment" in value
    assert "ENTRA_TENANT_ID" not in value
    assert value.count("CLERK_ISSUER=") == 1
    assert "CLERK_ISSUER=https://clerk.example.com" in value
