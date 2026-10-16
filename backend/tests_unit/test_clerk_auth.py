from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException
from app import auth
from app.config import Settings, settings


@pytest.fixture
def signed(monkeypatch):
    cfg = settings()
    cfg.clerk_issuer = "https://synthetic.clerk.accounts.dev"
    cfg.clerk_authorized_parties = "http://localhost:5173"
    private = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    client = SimpleNamespace(get_signing_key_from_jwt=lambda token: SimpleNamespace(key=private.public_key()))
    monkeypatch.setattr(auth, "jwks_client", lambda url: client)
    now = int(datetime.now(timezone.utc).timestamp())
    claims = dict(
        sub="user_synthetic1",
        sid="sess_synthetic1",
        iss=cfg.clerk_issuer,
        azp="http://localhost:5173",
        v=2,
        exp=now + 60,
        iat=now,
        nbf=now - 1,
    )

    def token(overrides=None, remove=()):
        payload = claims | (overrides or {})
        for field in remove:
            payload.pop(field)
        return jwt.encode(payload, private, algorithm="RS256")

    return token


def test_valid_clerk_session(signed):
    assert auth.validate_token(signed()) == auth.Principal(settings().clerk_issuer, "user_synthetic1")


@pytest.mark.parametrize(
    "overrides",
    [
        {"aud": "unexpected-api"},
        {"iss": "https://evil.invalid"},
        {"azp": "https://evil.invalid"},
        {"azp": "http://localhost:5173.evil.invalid"},
        {"azp": ["http://localhost:5173"]},
        {"azp": None},
        {"sub": "m2m_synthetic"},
        {"sub": None},
        {"sub": "user_" + "x" * 250},
        {"sid": "machine_session"},
        {"sid": None},
        {"sid": ["sess_synthetic1"]},
        {"v": 1},
        {"v": "2"},
        {"v": True},
        {"sts": "pending"},
        {"sts": "revoked"},
        {"sts": ["active"]},
        {"act": {"sub": "user_operator"}},
        {"iat": "123"},
        {"iat": int(datetime.now(timezone.utc).timestamp()) + 300},
        {"exp": datetime.now(timezone.utc) - timedelta(minutes=5)},
        {"nbf": datetime.now(timezone.utc) + timedelta(minutes=5)},
    ],
)
def test_invalid_claims_rejected(signed, overrides):
    with pytest.raises(HTTPException) as error:
        auth.validate_token(signed(overrides))
    assert error.value.status_code == 401


@pytest.mark.parametrize("missing", ["iss", "sub", "sid", "azp", "v", "exp", "iat", "nbf"])
def test_missing_required_claims(signed, missing):
    with pytest.raises(HTTPException) as error:
        auth.validate_token(signed(remove=[missing]))
    assert error.value.status_code == 401


def test_optional_configured_audience_is_required_and_checked(signed):
    settings().clerk_audience = "rivock-api"
    assert auth.validate_token(signed({"aud": "rivock-api"})).subject == "user_synthetic1"
    for token in [signed(), signed({"aud": "other-api"})]:
        with pytest.raises(HTTPException) as error:
            auth.validate_token(token)
        assert error.value.status_code == 401


def test_bad_signature_and_algorithm(signed):
    tokens = [
        jwt.encode({"sub": "user_test"}, key="", algorithm="none"),
        jwt.encode({"sub": "user_test"}, key="synthetic-not-a-real-secret-value", algorithm="HS256"),
    ]
    token = signed()
    tokens.append(token.rsplit(".", 1)[0] + "." + "A" * len(token.rsplit(".", 1)[1]))
    for token in tokens:
        with pytest.raises(HTTPException) as error:
            auth.validate_token(token)
        assert error.value.status_code == 401


def test_missing_configuration_and_key_service_failure_are_honest(signed, monkeypatch):
    cfg = settings()
    issuer, cfg.clerk_issuer = cfg.clerk_issuer, ""
    with pytest.raises(HTTPException) as error:
        auth.validate_token(signed())
    assert error.value.status_code == 503
    cfg.clerk_issuer = issuer
    endpoints = []

    def unreachable(url):
        endpoints.append(url)
        raise jwt.PyJWKClientConnectionError("Synthetic connection failure")

    monkeypatch.setattr(auth, "jwks_client", unreachable)
    with pytest.raises(HTTPException) as error:
        auth.validate_token(signed({"iss": "https://evil.invalid"}))
    assert error.value.status_code == 503
    assert endpoints == [issuer + "/.well-known/jwks.json"]


def test_production_rejects_fixture_missing_or_development_identity():
    with pytest.raises(RuntimeError):
        Settings(environment="production").validate_production()
    valid = dict(
        environment="production",
        moderation_mode="pending",
        clerk_issuer="https://clerk.example.com",
        clerk_authorized_parties="https://rivock.example.com",
        rate_hmac_secret="s" * 32,
        database_url="postgresql+psycopg://synthetic@db.example.com/rivock?sslmode=verify-full",
    )
    Settings(**valid).validate_production()
    with pytest.raises(RuntimeError, match="Fixture"):
        Settings(**(valid | {"moderation_mode": "fixture"})).validate_production()
    with pytest.raises(RuntimeError, match="production instance"):
        Settings(**(valid | {"clerk_issuer": "https://synthetic.clerk.accounts.dev"})).validate_production()


@pytest.mark.parametrize(
    "change",
    [
        {"clerk_issuer": "http://clerk.example.com"},
        {"clerk_issuer": "https://clerk.example.com/"},
        {"clerk_issuer": "https://clerk.example.com/path"},
        {"clerk_issuer": "https://user:password@clerk.example.com"},
        {"clerk_authorized_parties": ""},
        {"clerk_authorized_parties": "https://*.example.com"},
        {"clerk_authorized_parties": "https://rivock.example.com/"},
        {"clerk_authorized_parties": "http://remote.example.com"},
    ],
)
def test_invalid_identity_configuration_rejected(change):
    with pytest.raises(RuntimeError):
        Settings(**({"clerk_issuer": "https://clerk.example.com"} | change)).validate_identity()
