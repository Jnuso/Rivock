"""Public Clerk configuration helpers; never accept an API secret."""

import base64
import re
from pathlib import Path


def issuer_from_key(key: str) -> str:
    match = re.fullmatch(r"pk_(test|live)_([A-Za-z0-9_-]+={0,2})", key.strip())
    if not match:
        raise ValueError("Use a Clerk publishable key starting pk_test_ or pk_live_.")
    try:
        encoded = match[2]
        decoded = base64.b64decode(encoded + "=" * (-len(encoded) % 4), altchars=b"-_", validate=True).decode(
            "ascii"
        )
    except (ValueError, UnicodeError):
        raise ValueError("The publishable key is not a valid public Clerk key.") from None
    if not decoded.endswith("$") or not re.fullmatch(
        r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}", decoded[:-1]
    ):
        raise ValueError("The publishable key does not contain a valid Frontend API hostname.")
    return "https://" + decoded[:-1]


def update_env(path: Path, values: dict[str, str]):
    """Preserve other settings verbatim, remove obsolete Entra keys, update duplicates safely."""
    lines = path.read_text(encoding="utf-8-sig").splitlines() if path.exists() else []
    result, written = [], set()
    for line in lines:
        name = line.split("=", 1)[0].strip() if "=" in line else ""
        if name.startswith(("ENTRA_", "VITE_ENTRA_")):
            continue
        if name in values:
            if name not in written:
                result.append(name + "=" + values[name])
                written.add(name)
        else:
            result.append(line)
    result.extend(name + "=" + value for name, value in values.items() if name not in written)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".rivock-tmp")
    temporary.write_text("\n".join(result) + "\n", encoding="utf-8")
    temporary.replace(path)
