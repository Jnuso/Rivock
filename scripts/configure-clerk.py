"""Configure local Rivock login using only Clerk's public publishable key."""

import argparse
from pathlib import Path
from clerk_config import issuer_from_key, update_env

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--publishable-key", help="Public pk_test_/pk_live_ key; otherwise prompt interactively."
    )
    args = parser.parse_args()
    key = (args.publishable_key or input("Clerk publishable key (pk_test_...): ")).strip()
    try:
        issuer = issuer_from_key(key)
    except ValueError as error:
        raise SystemExit(str(error)) from None
    backend = {
        "CLERK_ISSUER": issuer,
        "CLERK_AUTHORIZED_PARTIES": "http://localhost:5173,http://127.0.0.1:5173",
    }
    frontend = {"VITE_CLERK_PUBLISHABLE_KEY": key}
    # These are the local development files only. No cloud or provider settings are changed.
    update_env(ROOT / ".env", backend | frontend)
    update_env(ROOT / "backend/.env", backend)
    update_env(ROOT / "frontend/.env", frontend)
    print("Updated the three ignored local .env files; unrelated settings were preserved.")
    print(
        "Restart the API and frontend, then test sign-in. This does not verify provider access or deploy anything."
    )


if __name__ == "__main__":
    main()
