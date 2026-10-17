from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
from threading import Event

import pytest
from sqlalchemy import func, select

from app import models as m, moderation as mod
from app.config import settings
from app.db import Session
from .conftest import create_reply, create_thread, headers

API = "/api/v1"


def post(client, topic, request_headers=None, **changes):
    return client.post(
        f"{API}/threads",
        json={"type": "question", "topic_id": topic, "title": "Immediate publication",
              "body_markdown": "An original fictional question.", **changes},
        headers=request_headers or headers("alice"),
    )


def disable_checks(monkeypatch):
    settings().moderation_mode = "off"
    settings().ai_paused = True

    def unexpected(*args, **kwargs):
        raise AssertionError("Reviews-off publication must not call a checker")

    monkeypatch.setattr(mod, "google_decision", unexpected)
    monkeypatch.setattr(mod, "rules", unexpected)


def test_publish_create_edit_and_profile_without_any_review(client, people, topic, monkeypatch):
    disable_checks(monkeypatch)
    thread = create_thread(client, topic, body_markdown="Repeated text " + "x" * 110)
    reply = create_reply(client, thread)
    edit = client.patch(
        f"{API}/threads/{thread['id']}",
        json={"base_revision": 1, "topic_id": topic, "title": "Updated immediately",
              "body_markdown": "An updated fictional question."}, headers=headers("alice"),
    )
    profile = client.patch(
        f"{API}/me", json={"base_revision": 1, "bio": "Fictional profile.", "avatar_key": "blue"},
        headers=headers("alice"),
    )
    reply_edit = client.patch(
        f"{API}/replies/{reply['id']}",
        json={"base_revision": 1, "body_markdown": "An updated fictional answer."},
        headers=headers("bruce"),
    )
    for response in (edit, profile, reply_edit):
        assert response.status_code == 200, response.text
        submission = response.json()["submission"]
        assert submission["status"] == "published"
        assert submission["reason_code"] == "moderation_disabled" and submission["review"] is None
    with Session() as db:
        assert db.scalar(select(func.count()).select_from(m.Attempt)) == 0
        assert all(row.status == "published" for row in db.scalars(select(m.Submission)))


def test_existing_pending_publishes_once_despite_backoff_and_ai_caps(client, people, topic, monkeypatch):
    settings().moderation_mode = "pending"
    request_headers = headers("alice")
    result = post(client, topic, request_headers)
    assert result.status_code == 202
    sid = result.json()["submission"]["id"]
    with Session() as db:
        row = db.get(m.Submission, sid)
        row.next_attempt_at = m.now() + timedelta(days=1)
        row.ai_attempt_count = 4
        row.error_category = "provider_unavailable"
        db.commit()
    disable_checks(monkeypatch)
    for _ in range(2):
        result = post(client, topic, request_headers)
        assert result.status_code == 201
        assert result.json()["submission"]["review"] is None
    with Session() as db:
        assert db.scalar(select(func.count()).select_from(m.Thread)) == 1
        assert db.scalar(select(func.count()).select_from(m.Attempt)) == 0
        assert db.get(m.Submission, sid).error_category is None


def test_reports_and_manual_removal_still_work(client, people, topic, monkeypatch):
    disable_checks(monkeypatch)
    thread = create_thread(client, topic)
    response = client.post(f"{API}/reports", json={"thread_id": thread["id"], "reason": "other"},
                           headers=headers("bruce"))
    assert response.status_code == 201
    assert client.get(f"{API}/threads/{thread['id']}").json()["state"] == "published"
    assert client.get(f"{API}/admin/reports", headers=headers("bruce")).status_code == 403
    assert len(client.get(f"{API}/admin/reports", headers=headers("admin")).json()["items"]) == 1
    response = client.post(f"{API}/admin/threads/{thread['id']}/remove",
                           json={"reason": "Synthetic manual review"}, headers=headers("admin"))
    assert response.status_code == 204
    assert client.get(f"{API}/threads/{thread['id']}").json()["state"] == "removed"


def test_validation_ownership_and_posting_limits_survive_reviews_off(client, people, topic, monkeypatch):
    disable_checks(monkeypatch)
    assert client.post(f"{API}/threads", json={}, headers={}).status_code == 401
    assert post(client, topic, body_markdown=" ").status_code == 422
    thread = create_thread(client, topic)
    assert client.patch(
        f"{API}/threads/{thread['id']}",
        json={"base_revision": 1, "topic_id": topic, "title": "Not mine", "body_markdown": "No."},
        headers=headers("bruce"),
    ).status_code == 403
    for index in range(4):
        assert post(client, topic, title=f"Fictional example {index}").status_code == 201
    assert post(client, topic, title="Rate limited example").status_code == 429


def test_pending_edit_cannot_resurrect_deleted_content(client, people, topic, monkeypatch):
    thread = create_thread(client, topic)
    settings().moderation_mode = "pending"
    response = client.patch(
        f"{API}/threads/{thread['id']}",
        json={"base_revision": 1, "topic_id": topic, "title": "Never restore",
              "body_markdown": "This must remain erased."}, headers=headers("alice"),
    )
    sid = response.json()["submission"]["id"]
    assert client.delete(f"{API}/threads/{thread['id']}", headers=headers("alice")).status_code == 204
    disable_checks(monkeypatch)
    mod.process(sid, force=True)
    with Session() as db:
        assert db.get(m.Thread, thread["id"]).body_markdown is None
        assert db.get(m.Submission, sid).status == "cancelled"


@pytest.mark.parametrize("status", ["rejected", "needs_review"])
def test_reviews_off_does_not_publish_old_terminal_or_manual_review_items(
    client, people, topic, monkeypatch, status,
):
    settings().moderation_mode = "pending"
    sid = post(client, topic).json()["submission"]["id"]
    with Session() as db:
        row = db.get(m.Submission, sid)
        row.status, row.reason_code = status, "earlier_decision"
        db.commit()
    disable_checks(monkeypatch)
    mod.process(sid, force=True)
    with Session() as db:
        assert db.get(m.Submission, sid).status == status
        assert db.scalar(select(func.count()).select_from(m.Thread)) == 0


@pytest.mark.parametrize("publish_while_in_flight", [True, False])
def test_late_ai_rejection_cannot_gate_or_overwrite_reviews_off(
    client, people, topic, monkeypatch, publish_while_in_flight,
):
    settings().moderation_mode = "pending"
    sid = post(client, topic).json()["submission"]["id"]
    cfg = settings()
    cfg.moderation_mode, cfg.ai_model, cfg.ai_api_key = "google", "synthetic", "synthetic-key"
    cfg.ai_input_usd_per_million = cfg.ai_output_usd_per_million = 1
    entered, release = Event(), Event()

    def delayed(_):
        entered.set()
        assert release.wait(10)
        return "reject", "synthetic_old_result", 100, 10

    monkeypatch.setattr(mod, "google_decision", delayed)
    with ThreadPoolExecutor(1) as pool:
        future = pool.submit(mod.process, sid, True)
        try:
            assert entered.wait(10)
            cfg.moderation_mode = "off"
            if publish_while_in_flight:
                mod.process(sid)
        finally:
            release.set()
        future.result(timeout=10)
    submission = client.get(f"{API}/me/submissions/{sid}", headers=headers("alice")).json()
    assert submission["status"] == "published" and submission["reason_code"] == "moderation_disabled"
    assert submission["review"] is None
    with Session() as db:
        row = db.get(m.Submission, sid)
        assert row.lease_token is None and row.lease_until is None
        assert db.scalar(select(func.count()).select_from(m.Thread)) == 1
        assert db.scalar(select(func.count()).select_from(m.Attempt)) == 1
