from dataclasses import dataclass
from functools import lru_cache
import re
import jwt
from fastapi import Depends, Request
from sqlalchemy import text
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import select
from .config import settings
from .db import get_db
from .errors import fail
from .models import User

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    issuer: str
    subject: str


@lru_cache(maxsize=4)
def jwks_client(url):
    return jwt.PyJWKClient(url, cache_jwk_set=True, lifespan=3600, timeout=5)


def validate_token(token: str) -> Principal:
    cfg = settings()
    if not cfg.clerk_issuer or not cfg.authorized_parties:
        fail(503, "auth_not_configured", "Sign-in is not configured yet.")
    try:
        # Never derive this endpoint from unverified JWT claims or headers.
        key = jwks_client(cfg.clerk_issuer + "/.well-known/jwks.json").get_signing_key_from_jwt(token).key
        required = ["exp", "iat", "nbf", "iss", "sub", "sid", "azp", "v"]
        if cfg.clerk_audience:
            required.append("aud")
        claims = jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            audience=cfg.clerk_audience or None,
            issuer=cfg.clerk_issuer,
            leeway=5,
            options={"require": required},
        )
        if (
            not isinstance(claims["sub"], str)
            or not re.fullmatch(r"user_[A-Za-z0-9]{1,195}", claims["sub"])
            or not isinstance(claims["sid"], str)
            or not re.fullmatch(r"sess_[A-Za-z0-9]{1,195}", claims["sid"])
            or not isinstance(claims["azp"], str)
            or claims["azp"] not in cfg.authorized_parties
            or type(claims["v"]) is not int
            or claims["v"] != 2
            or any(type(claims[field]) is not int for field in ["exp", "iat", "nbf"])
            or claims.get("sts") not in {None, "active"}
            or "act" in claims
            or claims["exp"] <= claims["iat"]
        ):
            raise jwt.InvalidTokenError("Invalid user session claims")
        return Principal(claims["iss"], claims["sub"])
    except jwt.PyJWKClientConnectionError:
        fail(503, "identity_unavailable", "Sign-in is temporarily unavailable. Please try again.")
    except (jwt.PyJWTError, TypeError, ValueError):
        fail(401, "invalid_token", "Please sign in again.")


def principal(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if credentials is None:
        return None
    return validate_token(credentials.credentials)


def required_principal(value=Depends(principal)):
    if value is None:
        fail(401, "sign_in_required", "Sign in to continue.")
    return value


def viewer(identity=Depends(principal), db=Depends(get_db)):
    if identity is None:
        return None
    return db.scalar(
        select(User).where(User.auth_issuer == identity.issuer, User.auth_subject == identity.subject)
    )


def member(request: Request, identity=Depends(required_principal), db=Depends(get_db)):
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        db.execute(text("SELECT pg_advisory_xact_lock(74696201)"))
    user = db.scalar(
        select(User)
        .where(User.auth_issuer == identity.issuer, User.auth_subject == identity.subject)
        .execution_options(populate_existing=True)
    )
    if user is None:
        fail(403, "onboarding_required", "Choose a Rivock username first.")
    if user.status != "active":
        fail(403, "account_inactive", "This account cannot participate.")
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        from .db import Session
        from .services import rate

        with Session() as counters:
            rate(counters, user.id, "member_request", 120, 60)
            counters.commit()
    return user


def admin(user=Depends(member)):
    if user.role != "admin":
        fail(403, "admin_required", "Admin access is required.")
    return user
