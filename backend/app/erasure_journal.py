"""Validate the private operator journal before starting a replay transaction."""

import json
from pathlib import Path
from uuid import UUID


class InvalidErasureJournal(ValueError):
    """A safe operator-facing error; never includes journal contents."""


INVALID_JOURNAL = "Invalid erasure journal; no changes were applied."
FIELDS = {"id", "target_type", "target_id", "action"}
ACTIONS = {"thread": {"delete"}, "reply": {"delete"}, "user": {"clear_bio", "deactivate"}}


def _unique_fields(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise InvalidErasureJournal(INVALID_JOURNAL)
        result[key] = value
    return result


def parse_erasure_journal(text: str) -> list[dict[str, str]]:
    """Accept only the complete bare-array format emitted by export-erasure.

    Duplicate event IDs are rejected, including identical repeats. All records
    are checked before any are returned, so callers cannot partially apply one.
    """
    try:
        rows = json.loads(text, object_pairs_hook=_unique_fields)
    except (ValueError, RecursionError):
        raise InvalidErasureJournal(INVALID_JOURNAL) from None
    if not isinstance(rows, list):
        raise InvalidErasureJournal(INVALID_JOURNAL)

    validated = []
    seen = set()
    for marker in rows:
        if (
            not isinstance(marker, dict)
            or set(marker) != FIELDS
            or any(not isinstance(value, str) for value in marker.values())
            or marker["action"] not in ACTIONS.get(marker["target_type"], set())
        ):
            raise InvalidErasureJournal(INVALID_JOURNAL)
        try:
            event_id = str(UUID(marker["id"]))
            target_id = str(UUID(marker["target_id"]))
        except ValueError:
            raise InvalidErasureJournal(INVALID_JOURNAL) from None
        if event_id in seen:
            raise InvalidErasureJournal(INVALID_JOURNAL)
        seen.add(event_id)
        validated.append({**marker, "id": event_id, "target_id": target_id})
    return validated


def load_erasure_journal(path: str | Path) -> list[dict[str, str]]:
    try:
        text = Path(path).read_text(encoding="utf-8")
    except (OSError, UnicodeError):
        raise InvalidErasureJournal("Cannot read erasure journal; no changes were applied.") from None
    return parse_erasure_journal(text)
