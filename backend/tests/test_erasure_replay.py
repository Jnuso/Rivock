import json
import sys
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from app import cli, models as m
from app.db import Session
from .conftest import create_reply, create_thread, headers


def run_cli(monkeypatch, command, path):
    monkeypatch.setattr(sys, "argv", ["cli", command, str(path)])
    cli.main()


def event(target_id, target_type="thread", action="delete"):
    return {"id": str(uuid4()), "target_type": target_type, "target_id": target_id, "action": action}


def test_export_then_replay_erases_thread_but_preserves_other_author_reply(
    client, people, topic, monkeypatch, tmp_path, capsys
):
    thread = create_thread(client, topic)
    reply = create_reply(client, thread)
    assert (
        client.put(
            f"/api/v1/threads/{thread['id']}/accepted-answer",
            json={"reply_id": reply["id"]},
            headers=headers("alice"),
        ).status_code
        == 200
    )
    with Session() as db:
        marker = m.Erasure(target_type="thread", target_id=thread["id"], action="delete")
        db.add(marker)
        db.commit()
        marker_id = marker.id
    journal = tmp_path / "synthetic.json"
    run_cli(monkeypatch, "export-erasure", journal)
    exported = json.loads(journal.read_text(encoding="utf-8"))
    assert exported == [
        {"id": marker_id, "target_type": "thread", "target_id": thread["id"], "action": "delete"}
    ]

    run_cli(monkeypatch, "replay-erasure", journal)

    with Session() as db:
        row = db.get(m.Thread, thread["id"])
        assert row.state == "deleted" and row.body_markdown is None and row.title is None
        assert row.accepted_reply_id is None and row.search_text == ""
        own = db.scalar(
            select(m.Submission).where(
                m.Submission.thread_id == row.id,
                m.Submission.action == "create_thread",
            )
        )
        assert own.snapshot is None
        other = db.scalar(select(m.Submission).where(m.Submission.reply_id == reply["id"]))
        assert other.snapshot["body_markdown"] == reply["body_markdown"]
        survivor = db.get(m.Reply, reply["id"])
        assert survivor.state == "published" and survivor.body_markdown == reply["body_markdown"]
    assert "Applied erasure markers" in capsys.readouterr().out


def test_replay_reply_erases_only_target_and_clears_acceptance(client, people, topic, monkeypatch, tmp_path):
    thread = create_thread(client, topic)
    reply = create_reply(client, thread)
    child = create_reply(
        client, thread, user="claire", response_to_reply_id=reply["id"], body_markdown="Synthetic child"
    )
    assert (
        client.put(
            f"/api/v1/threads/{thread['id']}/accepted-answer",
            json={"reply_id": reply["id"]},
            headers=headers("alice"),
        ).status_code
        == 200
    )
    journal = tmp_path / "synthetic.json"
    journal.write_text(json.dumps([event(reply["id"], "reply")]), encoding="utf-8")

    run_cli(monkeypatch, "replay-erasure", journal)

    with Session() as db:
        assert db.get(m.Thread, thread["id"]).accepted_reply_id is None
        assert db.get(m.Thread, thread["id"]).state == "published"
        assert db.get(m.Reply, reply["id"]).body_markdown is None
        survivor = db.get(m.Reply, child["id"])
        assert survivor.state == "published" and survivor.body_markdown == "Synthetic child"
        assert survivor.parent_reply_id == reply["id"]


@pytest.mark.parametrize("action", ["clear_bio", "deactivate"])
def test_supported_user_actions_preserve_existing_boundaries(
    client, people, topic, monkeypatch, tmp_path, action
):
    thread = create_thread(client, topic, user="bruce")
    user_id = people["alice"]["id"]
    with Session() as db:
        user = db.get(m.User, user_id)
        user.bio, user.avatar_key = "Synthetic restored bio", "blue"
        before_revision = user.profile_revision
        db.add(m.Save(user_id=user_id, thread_id=thread["id"]))
        db.add(m.Block(blocker_id=user_id, blocked_id=people["claire"]["id"]))
        for submission_action in ["edit_profile", "create_thread"]:
            db.add(
                m.Submission(
                    user_id=user_id,
                    action=submission_action,
                    snapshot={"bio": "Synthetic pending text"},
                    idempotency_key=str(uuid4()),
                    request_hash="a" * 64,
                )
            )
        db.commit()
    journal = tmp_path / "synthetic.json"
    journal.write_text(json.dumps([event(user_id, "user", action)]), encoding="utf-8")

    run_cli(monkeypatch, "replay-erasure", journal)

    with Session() as db:
        user = db.get(m.User, user_id)
        assert user.bio == "" and user.profile_revision == before_revision + 1
        assert user.status == ("deactivated" if action == "deactivate" else "active")
        assert user.avatar_key == ("initials" if action == "deactivate" else "blue")
        profile = db.scalar(
            select(m.Submission).where(m.Submission.user_id == user_id, m.Submission.action == "edit_profile")
        )
        pending = db.scalar(
            select(m.Submission).where(
                m.Submission.user_id == user_id, m.Submission.action == "create_thread"
            )
        )
        assert profile.snapshot is None and profile.status == "cancelled"
        assert pending.status == ("cancelled" if action == "deactivate" else "pending")
        assert (pending.snapshot is None) == (action == "deactivate")
        assert (db.get(m.Save, (user_id, thread["id"])) is None) == (action == "deactivate")
        assert (db.get(m.Block, (user_id, people["claire"]["id"])) is None) == (action == "deactivate")


@pytest.mark.parametrize(
    "invalid",
    [
        {"target_type": "unsupported"},
        {"action": "unsupported"},
        {"target_id": "private-invalid-id"},
        {"target_type": "user", "action": "delete"},
    ],
)
def test_invalid_later_marker_never_erases_earlier_valid_target(
    client, people, topic, monkeypatch, tmp_path, invalid
):
    thread = create_thread(client, topic)
    with Session() as db:
        revision = db.get(m.Thread, thread["id"]).revision
    journal = tmp_path / "synthetic.json"
    journal.write_text(
        json.dumps([event(thread["id"]), {**event(thread["id"]), **invalid}]), encoding="utf-8"
    )

    with pytest.raises(SystemExit, match="Invalid erasure journal; no changes were applied"):
        run_cli(monkeypatch, "replay-erasure", journal)

    with Session() as db:
        row = db.get(m.Thread, thread["id"])
        assert row.state == "published" and row.body_markdown == thread["body_markdown"]
        assert row.revision == revision
        assert db.scalar(select(func.count()).select_from(m.Erasure)) == 0
