from datetime import datetime, timedelta
from uuid import uuid4

import pytest
from sqlalchemy import func, select

from app import models as m
from app.db import Session
from .conftest import create_reply, create_thread, headers

API = "/api/v1/me/notifications"


@pytest.fixture
def notice(client, people, topic):
    thread = create_thread(client, topic)
    reply = create_reply(client, thread)
    result = client.get(API, headers=headers("alice"))
    assert result.status_code == 200
    note = result.json()["items"][0]
    assert note["reply_id"] == reply["id"]
    return note


@pytest.mark.parametrize("read", [False, True])
def test_owner_can_set_read_state_idempotently_without_creating_events(client, people, notice, read):
    path = f"{API}/{notice['id']}"
    first = client.patch(path, json={"read": True}, headers=headers("alice"))
    assert first.status_code == 200
    with Session() as db:
        stamp = db.get(m.Notification, notice["id"]).read_at
        count = db.scalar(select(func.count()).select_from(m.Notification))
    for _ in range(2):
        response = client.patch(path, json={"read": read}, headers=headers("alice"))
        assert response.status_code == 200
        assert response.json()["read"] is read
        assert response.json()["created_at"] == notice["created_at"]
        assert response.json()["reply_id"] == notice["reply_id"]
    with Session() as db:
        assert db.get(m.Notification, notice["id"]).read_at == (stamp if read else None)
        assert db.scalar(select(func.count()).select_from(m.Notification)) == count
    unread = client.get(API + "/unread-count", headers=headers("alice")).json()["count"]
    assert unread == (0 if read else 1)
    items = client.get(API + "?unread_only=true", headers=headers("alice")).json()["items"]
    assert [item["id"] for item in items] == ([] if read else [notice["id"]])


@pytest.mark.parametrize("read", [False, True])
def test_another_recipient_cannot_change_notification_state(client, people, notice, read):
    response = client.patch(f"{API}/{notice['id']}", json={"read": read}, headers=headers("claire"))
    assert response.status_code == 404
    with Session() as db:
        assert db.get(m.Notification, notice["id"]).read_at is None


@pytest.mark.parametrize(
    "body",
    [{"read": value} for value in [None, 0, 1, "false", "true", [], {}]]
    + [{}, {"read": False, "recipient_id": "other"}],
)
def test_read_state_requires_an_explicit_json_boolean(client, people, notice, body):
    response = client.patch(f"{API}/{notice['id']}", json=body, headers=headers("alice"))
    assert response.status_code == 422
    with Session() as db:
        assert db.get(m.Notification, notice["id"]).read_at is None


@pytest.mark.parametrize("direction", ["recipient", "actor"])
def test_blocked_notifications_cannot_be_changed_or_reappear_in_unread(client, people, notice, direction):
    recipient, actor = people["alice"]["id"], people["bruce"]["id"]
    with Session() as db:
        db.add(
            m.Block(
                blocker_id=recipient if direction == "recipient" else actor,
                blocked_id=actor if direction == "recipient" else recipient,
            )
        )
        db.commit()
    for read in [False, True]:
        response = client.patch(f"{API}/{notice['id']}", json={"read": read}, headers=headers("alice"))
        assert response.status_code == 404
    assert client.get(API + "/unread-count", headers=headers("alice")).json()["count"] == 0
    assert client.get(API + "?unread_only=true", headers=headers("alice")).json()["items"] == []


@pytest.mark.parametrize("target", ["removed-reply", "deleted-reply", "removed-thread", "deleted-thread"])
def test_unavailable_notification_can_be_marked_unread_without_disclosing_target(
    client, people, notice, target
):
    with Session() as db:
        db.get(m.Notification, notice["id"]).read_at = m.now()
        state, kind = target.split("-")
        row = (
            db.get(m.Reply, notice["reply_id"]) if kind == "reply" else db.get(m.Thread, notice["target_id"])
        )
        row.state = state
        db.commit()
    result = client.patch(f"{API}/{notice['id']}", json={"read": False}, headers=headers("alice"))
    assert result.status_code == 200
    payload = result.json()
    assert not payload["read"] and not payload["available"]
    assert payload["target_id"] is None and payload["reply_id"] is None
    assert payload["actor"] is None
    assert payload["summary"] == "This conversation is unavailable."
    listed = client.get(API + "?unread_only=true", headers=headers("alice")).json()["items"][0]
    assert listed["actor"] is None and listed["target_id"] is None and listed["reply_id"] is None


def test_read_all_preserves_snapshot_cutoff_after_an_older_item_is_marked_unread(client, people, notice):
    path = f"{API}/{notice['id']}"
    assert client.patch(path, json={"read": True}, headers=headers("alice")).status_code == 200
    assert client.patch(path, json={"read": False}, headers=headers("alice")).status_code == 200
    snapshot = client.get(API + "?unread_only=true", headers=headers("alice")).json()
    with Session() as db:
        newer = m.Notification(
            recipient_id=people["alice"]["id"],
            actor_id=people["bruce"]["id"],
            kind="reply",
            thread_id=notice["target_id"],
            reply_id=notice["reply_id"],
            created_at=datetime.fromisoformat(snapshot["as_of"].replace("Z", "+00:00"))
            + timedelta(seconds=1),
        )
        db.add(newer)
        db.commit()
        newer_id = newer.id
    assert (
        client.post(
            API + "/read-all", json={"through": snapshot["as_of"]}, headers=headers("alice")
        ).status_code
        == 204
    )
    with Session() as db:
        assert db.get(m.Notification, notice["id"]).read_at is not None
        assert db.get(m.Notification, newer_id).read_at is None


@pytest.mark.parametrize("status", ["suspended", "deactivated"])
def test_inactive_accounts_cannot_mark_notifications_unread(client, people, notice, status):
    with Session() as db:
        db.get(m.User, people["alice"]["id"]).status = status
        db.commit()
    assert (
        client.patch(f"{API}/{notice['id']}", json={"read": False}, headers=headers("alice")).status_code
        == 403
    )


def test_anonymous_read_state_change_requires_sign_in(client, people, notice):
    assert client.patch(f"{API}/{notice['id']}", json={"read": False}).status_code == 401


def test_missing_notification_is_unavailable(client, people, notice):
    assert client.patch(f"{API}/{uuid4()}", json={"read": False}, headers=headers("alice")).status_code == 404
