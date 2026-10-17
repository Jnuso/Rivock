import json
import sys
from unittest.mock import Mock

import pytest

from app import cli
from app.erasure_journal import InvalidErasureJournal, load_erasure_journal, parse_erasure_journal


EVENT = "8f0496a8-2c4b-4bf2-8f50-f47977d8260a"
TARGET = "efc70ee2-e5ef-4e91-9fb2-9e3a6d39e250"


def marker(**changes):
    return {"id": EVENT, "target_type": "thread", "target_id": TARGET, "action": "delete", **changes}


@pytest.mark.parametrize(
    "target_type,action",
    [
        ("thread", "delete"),
        ("reply", "delete"),
        ("user", "clear_bio"),
        ("user", "deactivate"),
    ],
)
def test_existing_export_record_is_accepted(target_type, action):
    record = marker(target_type=target_type, action=action)
    assert parse_erasure_journal(json.dumps([record])) == [record]


def test_empty_export_is_valid():
    assert parse_erasure_journal("[]") == []


@pytest.mark.parametrize(
    "data",
    [
        None,
        {},
        {"events": []},
        "private journal content",
        4,
        True,
        [None],
        [True],
        [3],
        ["private marker"],
        [[]],
        [{"target_type": "thread", "target_id": TARGET, "action": "delete"}],
        [marker(extra="private content")],
        [marker(id=None)],
        [marker(target_id=3)],
        [marker(action=["delete"])],
        [marker(id="private invalid identifier")],
        [marker(target_id="not-a-uuid")],
        [marker(target_type="unsupported")],
        [marker(target_type="Thread")],
        [marker(action="restore")],
        [marker(action="deactivate")],
        [marker(target_type="reply", action="clear_bio")],
        [marker(target_type="user", action="delete")],
        [marker(target_type="user", action="unexpected")],
        [marker(), marker()],
        [marker(), marker(action="clear_bio", target_type="user")],
        [marker(), marker(id=EVENT.upper())],
    ],
)
def test_unsupported_or_ambiguous_journal_is_rejected_without_content(data):
    with pytest.raises(InvalidErasureJournal) as error:
        parse_erasure_journal(json.dumps(data))
    assert str(error.value) == "Invalid erasure journal; no changes were applied."


@pytest.mark.parametrize(
    "text",
    [
        "",
        "[",
        "[] trailing private text",
        json.dumps([marker()]).replace('"action": "delete"', '"action": "restore", "action": "delete"'),
        "[" * 2000,
    ],
)
def test_malformed_or_duplicate_field_json_is_rejected(text):
    with pytest.raises(InvalidErasureJournal):
        parse_erasure_journal(text)


def test_uuid_normalization_cannot_bypass_duplicate_event_guard():
    record = marker(id=EVENT.upper(), target_id=TARGET.upper())
    assert parse_erasure_journal(json.dumps([record])) == [marker()]


@pytest.mark.parametrize(
    "raw",
    [
        "[",
        json.dumps([marker(), marker(id="bad", target_type="user", action="clear_bio")]),
        json.dumps([marker(), marker(id="740c07b5-893c-4d7b-86b1-d82f8ea7566b", action="unsupported")]),
    ],
)
def test_cli_validates_entire_file_before_opening_session(monkeypatch, tmp_path, capsys, raw):
    journal = tmp_path / "synthetic.json"
    journal.write_text(raw, encoding="utf-8")
    session = Mock(side_effect=AssertionError("An invalid journal must not open a session"))
    monkeypatch.setattr(cli, "Session", session)
    monkeypatch.setattr(sys, "argv", ["cli", "replay-erasure", str(journal)])

    with pytest.raises(SystemExit) as error:
        cli.main()

    assert str(error.value) == "Invalid erasure journal; no changes were applied."
    session.assert_not_called()
    assert "Applied erasure markers" not in capsys.readouterr().out


@pytest.mark.parametrize("unreadable", ["missing", "directory", "invalid-utf8"])
def test_unreadable_input_fails_safely_before_session(monkeypatch, tmp_path, unreadable):
    journal = tmp_path / "private-filename.json"
    if unreadable == "directory":
        journal.mkdir()
    elif unreadable == "invalid-utf8":
        journal.write_bytes(b"\xff\xfe")
    session = Mock(side_effect=AssertionError("Unreadable journal must not open a session"))
    monkeypatch.setattr(cli, "Session", session)
    monkeypatch.setattr(sys, "argv", ["cli", "replay-erasure", str(journal)])

    with pytest.raises(SystemExit) as error:
        cli.main()

    assert str(error.value) == "Cannot read erasure journal; no changes were applied."
    assert str(journal) not in str(error.value)
    session.assert_not_called()


def test_loader_accepts_existing_utf8_export(tmp_path):
    journal = tmp_path / "synthetic.json"
    journal.write_text(json.dumps([marker()], indent=2) + "\n", encoding="utf-8")
    assert load_erasure_journal(journal) == [marker()]
