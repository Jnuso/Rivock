"""Report project setup without printing configuration values or credentials."""

import argparse
import json
import pathlib
import shutil
import subprocess
import sys
from clerk_config import issuer_from_key

ROOT = pathlib.Path(__file__).resolve().parents[1]


def read_env(path):
    values = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                values[key.strip()] = value.strip().strip("\"'")
    return values


def provided(value):
    return bool(
        value and "<" not in value and not value.lower().startswith(("your-", "replace-", "change-me"))
    )


def inspect(compose=False):
    back = read_env(ROOT / (".env" if compose else "backend/.env"))
    front = back if compose else read_env(ROOT / "frontend/.env")
    required_back = ["CLERK_ISSUER", "CLERK_AUTHORIZED_PARTIES"]
    required_front = ["VITE_CLERK_PUBLISHABLE_KEY"]
    checks = []
    for label, values, fields in [
        ("Backend Clerk configuration", back, required_back),
        ("Frontend Clerk configuration", front, required_front),
    ]:
        missing = [field for field in fields if not provided(values.get(field))]
        checks.append(
            {
                "check": label,
                "status": "missing" if missing else "configured; live sign-in unverified",
                "missing_fields": missing,
            }
        )
    if provided(front.get("VITE_CLERK_PUBLISHABLE_KEY")):
        try:
            issuer = issuer_from_key(front["VITE_CLERK_PUBLISHABLE_KEY"])
            matching = issuer == back.get("CLERK_ISSUER")
            checks.append(
                {
                    "check": "Matching Clerk instance",
                    "status": "matches; live sign-in unverified" if matching else "mismatch",
                }
            )
        except ValueError:
            checks.append({"check": "Clerk publishable key", "status": "invalid"})
    checks.append(
        {
            "check": "Python",
            "status": "available" if sys.version_info >= (3, 12) else "needs Python 3.12+",
        }
    )
    for tool in ["node", "docker", "az"]:
        checks.append(
            {
                "check": tool,
                "status": "installed" if shutil.which(tool) else "not installed",
            }
        )
    if shutil.which("docker"):
        try:
            result = subprocess.run(
                ["docker", "info", "--format", "{{.OSType}}"],
                check=False,
                capture_output=True,
                text=True,
                timeout=8,
            )
            healthy = result.returncode == 0 and result.stdout.strip() == "linux"
        except (OSError, subprocess.TimeoutExpired):
            healthy = False
        checks.append(
            {
                "check": "Docker Linux engine (optional for native development)",
                "status": "available" if healthy else "unavailable; start/configure Docker Desktop",
            }
        )
    model_ready = all(provided(back.get(field)) for field in ["AI_MODEL", "AI_API_KEY"])
    checks.append(
        {
            "check": "Real AI moderation",
            "status": "configured; model/prices/quality unverified"
            if model_ready
            else "disabled; pending moderation remains available",
        }
    )
    checks.append(
        {
            "check": "Cloud and browser verification",
            "status": "requires actual account setup and authorized browser checks",
        }
    )
    return checks


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--compose",
        action="store_true",
        help="Inspect root .env used by Compose instead of the two native .env files.",
    )
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    checks = inspect(args.compose)
    if args.json:
        print(json.dumps(checks, indent=2))
    else:
        for check in checks:
            print(check["check"] + ": " + check["status"])
            if check.get("missing_fields"):
                print("  Missing: " + ", ".join(check["missing_fields"]))
    return 2 if any(check["status"] in {"missing", "invalid", "mismatch"} for check in checks) else 0


if __name__ == "__main__":
    raise SystemExit(main())
