from datetime import timedelta

import pytest
from sqlalchemy import event, select

from app import models as m, routes
from app.db import Session, engine
from .conftest import create_reply, create_thread


@pytest.fixture
def alerts(client, people, topic):
    thread = create_thread(client, topic)
    reply = create_reply(client, thread)
    with Session() as db:
        first = db.scalar(select(m.Notification))
        for index in range(1, 50):
            db.add(
                m.Notification(
                    recipient_id=people["alice"]["id"],
                    actor_id=people["bruce"]["id"],
                    kind=["thread_reply", "reply_response", "answer_accepted"][index % 3],
                    thread_id=thread["id"],
                    reply_id=reply["id"],
                    created_at=first.created_at - timedelta(seconds=index),
                    read_at=m.now() if index % 2 else None,
                )
            )
        db.commit()
    return thread, reply


@pytest.mark.parametrize("size", [1, 20, 50])
def test_alerts_page_has_bounded_database_reads(people, alerts, size):
    statements = []

    def observe(*args):
        statements.append(args[2])

    with Session() as db:
        viewer = db.get(m.User, people["alice"]["id"])
        event.listen(engine, "before_cursor_execute", observe)
        try:
            result = routes.notifications(db, viewer, limit=size, offset=0)
        finally:
            event.remove(engine, "before_cursor_execute", observe)
    assert len(result["items"]) == size
    assert len(statements) <= 8


@pytest.mark.parametrize(
    "variant",
    [
        "published",
        "removed-thread",
        "deleted-reply",
        "blocked-thread-author",
        "deactivated-actor",
        "actor-blocks-viewer",
        "viewer-blocks-actor",
    ],
)
@pytest.mark.parametrize("unread", [False, True])
def test_batched_alerts_match_safe_projection(people, alerts, variant, unread):
    thread, reply = alerts
    with Session() as db:
        viewer = db.get(m.User, people["alice"]["id"])
        if variant == "removed-thread":
            db.get(m.Thread, thread["id"]).state = "removed"
        elif variant == "deleted-reply":
            db.get(m.Reply, reply["id"]).state = "deleted"
        elif variant == "deactivated-actor":
            db.get(m.User, people["bruce"]["id"]).status = "deactivated"
        elif variant == "blocked-thread-author":
            db.get(m.Thread, thread["id"]).author_id = people["claire"]["id"]
            db.add(m.Block(blocker_id=viewer.id, blocked_id=people["claire"]["id"]))
        elif variant in {"actor-blocks-viewer", "viewer-blocks-actor"}:
            actor = people["bruce"]["id"]
            db.add(
                m.Block(
                    blocker_id=actor if variant == "actor-blocks-viewer" else viewer.id,
                    blocked_id=viewer.id if variant == "actor-blocks-viewer" else actor,
                )
            )
        db.commit()
        stmt = routes.notification_stmt(db, viewer)
        if unread:
            stmt = stmt.where(m.Notification.read_at.is_(None))
        rows = list(db.scalars(stmt.order_by(m.Notification.created_at.desc(), m.Notification.id)))
        expected = [routes.notification_out(db, row, viewer) for row in rows]
        db.expunge_all()
        viewer = db.get(m.User, people["alice"]["id"])
        result = routes.notifications(db, viewer, unread_only=unread, limit=50, offset=0)
        assert result["items"] == expected
        assert result["next_offset"] is None
        other = db.get(m.User, people["claire"]["id"])
        assert routes.notifications(db, other, limit=50, offset=0)["items"] == []


def test_alerts_pagination_and_new_request_reflect_target_changes(people, alerts):
    thread, _ = alerts
    with Session() as db:
        viewer = db.get(m.User, people["alice"]["id"])
        first = routes.notifications(db, viewer, limit=20, offset=0)
        second = routes.notifications(db, viewer, limit=20, offset=first["next_offset"])
        third = routes.notifications(db, viewer, limit=20, offset=second["next_offset"])
        ids = [row["id"] for page in [first, second, third] for row in page["items"]]
        assert len(ids) == len(set(ids)) == 50
        assert third["next_offset"] is None
        assert all(row["available"] for row in first["items"])
        db.get(m.Thread, thread["id"]).state = "removed"
        db.commit()
    with Session() as db:
        viewer = db.get(m.User, people["alice"]["id"])
        result = routes.notifications(db, viewer, limit=50, offset=0)
        assert all(
            not row["available"]
            and row["actor"] is None
            and row["target_id"] is None
            and row["reply_id"] is None
            for row in result["items"]
        )
