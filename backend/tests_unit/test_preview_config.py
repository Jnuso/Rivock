import pytest

from app.config import Settings


def preview(**changes):
    return Settings(_env_file=None, **(dict(
        environment="preview",
        moderation_mode="pending",
        clerk_issuer="https://synthetic.clerk.accounts.dev",
        clerk_authorized_parties="https://rivock.synthetic.canadacentral.azurecontainerapps.io",
        rate_hmac_secret="synthetic-only-" + "s" * 32,
        database_url="postgresql+psycopg://synthetic@db.example.com/rivock?sslmode=verify-full",
    ) | changes))


def test_preview_accepts_real_development_issuer_but_production_still_refuses_it():
    preview().validate_production()
    with pytest.raises(RuntimeError, match="production instance"):
        preview(environment="production").validate_production()


@pytest.mark.parametrize("change", [
    {"moderation_mode": "fixture"},
    {"clerk_issuer": ""},
    {"clerk_authorized_parties": ""},
    {"clerk_authorized_parties": "http://localhost:5173"},
    {"clerk_authorized_parties": "https://*.azurecontainerapps.io"},
    {"rate_hmac_secret": "short"},
    {"rate_hmac_secret": "local-only-change-before-deployment"},
    {"database_url": "postgresql+psycopg://synthetic@db.example.com/rivock?sslmode=require"},
])
def test_preview_retains_hosted_security_requirements(change):
    with pytest.raises(RuntimeError):
        preview(**change).validate_production()
