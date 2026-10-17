from functools import lru_cache
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    environment: Literal["local", "test", "preview", "production", "migration"] = "local"
    database_url: str = "postgresql+psycopg://rivock:rivock_local@localhost:5432/rivock"
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    clerk_issuer: str = ""
    clerk_authorized_parties: str = "http://localhost:5173,http://127.0.0.1:5173"
    clerk_audience: str = ""
    moderation_mode: str = "off"
    ai_model: str = ""
    ai_api_key: str = ""
    ai_billing_mode: Literal["metered", "free"] = "metered"
    ai_input_usd_per_million: float = 0
    ai_output_usd_per_million: float = 0
    ai_max_input_tokens: int = 16000
    ai_max_output_tokens: int = 256
    ai_monthly_budget_usd: float = Field(default=2, ge=0)
    ai_daily_call_cap: int = Field(default=100, ge=0)
    ai_paused: bool = False
    rate_hmac_secret: str = "local-only-change-before-deployment"
    trusted_proxy_ips: str = ""
    static_files_directory: str = ""

    @property
    def authorized_parties(self):
        return [value.strip() for value in self.clerk_authorized_parties.split(",") if value.strip()]

    def validate_identity(self):
        from urllib.parse import urlparse

        if self.clerk_issuer:
            issuer = urlparse(self.clerk_issuer)
            if (
                issuer.scheme != "https"
                or not issuer.hostname
                or issuer.username
                or issuer.password
                or issuer.port
                or issuer.path
                or issuer.query
                or issuer.fragment
            ):
                raise RuntimeError(
                    "CLERK_ISSUER must be the exact HTTPS Frontend API origin without a trailing slash"
                )
            if not self.authorized_parties:
                raise RuntimeError("Clerk requires explicit authorized frontend origins")
        for value in self.authorized_parties:
            origin = urlparse(value)
            local = origin.hostname in {"localhost", "127.0.0.1"}
            if (
                not origin.hostname
                or origin.username
                or origin.password
                or origin.path
                or origin.query
                or origin.fragment
                or "*" in value
                or (
                    origin.scheme != "https"
                    and not (
                        self.environment not in {"preview", "production"}
                        and local and origin.scheme == "http"
                    )
                )
            ):
                raise RuntimeError(
                    "Clerk authorized parties must be exact HTTPS origins (HTTP localhost is local/test only)"
                )

    def validate_production(self):
        self.validate_identity()
        if self.environment in {"preview", "production"}:
            if self.moderation_mode == "fixture":
                raise RuntimeError("Fixture moderation is forbidden in production")
            required = [self.clerk_issuer, self.authorized_parties]
            if (
                not all(required)
                or len(self.rate_hmac_secret) < 32
                or self.rate_hmac_secret == "local-only-change-before-deployment"
            ):
                raise RuntimeError("Production identity and HMAC configuration are required")
            if self.environment == "production" and self.clerk_issuer.endswith(".accounts.dev"):
                raise RuntimeError("Production requires a Clerk production instance")
            from sqlalchemy.engine import make_url

            if make_url(self.database_url).query.get("sslmode") != "verify-full":
                raise RuntimeError("Production PostgreSQL requires sslmode=verify-full")
        if self.moderation_mode not in {"off", "pending", "fixture", "google"}:
            raise RuntimeError("Unknown moderation adapter")


@lru_cache
def settings():
    value = Settings()
    value.validate_production()
    return value
