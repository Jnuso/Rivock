from datetime import timedelta

import pytest

from app import models as m
from app.db import Session
from .conftest import headers


@pytest.fixture
def history(people, topic):
    ids = {}
    with Session() as db:
        stamp = m.now()
        for state in ["published", "removed", "deleted"]:
            thread = m.Thread(
                author_id=people["alice"]["id"],
                topic_id=topic,
                type="question",
                title=f"Fictional {state} conversation",
                body_markdown="Original fictional context.",
                state=state,
            )
            db.add(thread)
            db.flush()
            for index in range(2 if state == "published" else 1):
                reply = m.Reply(
                    thread_id=thread.id,
                    author_id=people["bruce"]["id"],
                    body_markdown=f"Original public reply {state} {index}.",
                    state="published",
                    published_at=stamp - timedelta(minutes=index),
                )
                db.add(reply)
                db.flush()
                ids[f"{state}-{index}"] = reply.id
                if state == "published" and index == 0:
                    thread.accepted_reply_id = reply.id
            if state == "published":
                ids["thread"] = thread.id
                db.add(
                    m.Reply(
                        thread_id=thread.id,
                        author_id=people["bruce"]["id"],
                        body_markdown="Hidden removed reply.",
                        state="removed",
                    )
                )
                db.add(
                    m.Reply(
                        thread_id=thread.id,
                        author_id=people["claire"]["id"],
                        body_markdown="Another person's public reply.",
                        state="published",
                    )
                )
        db.commit()
    return ids


@pytest.mark.parametrize("viewer", [None, "bruce", "claire"])
def test_public_reply_history_includes_all_visible_published_replies(client, people, history, viewer):
    response = client.get(
        "/api/v1/users/bruce/contributions",
        params={"type": "replies"},
        headers=headers(viewer) if viewer else {},
    )
    assert response.status_code == 200
    rows = response.json()["items"]
    assert [row["id"] for row in rows] == [history["published-0"], history["published-1"]]
    assert rows[0]["is_accepted"] and not rows[1]["is_accepted"]
    assert all(row["thread_id"] == history["thread"] for row in rows)
    assert response.json()["next_offset"] is None


def test_public_reply_history_hides_replies_under_a_blocked_thread_author(client, people, history):
    with Session() as db:
        db.add(m.Block(blocker_id=people["claire"]["id"], blocked_id=people["alice"]["id"]))
        db.commit()
    response = client.get(
        "/api/v1/users/bruce/contributions", params={"type": "replies"}, headers=headers("claire")
    )
    assert response.status_code == 200
    assert response.json() == {"items": [], "next_offset": None}


def test_blocked_profile_reply_history_stays_unavailable(client, people, history):
    with Session() as db:
        db.add(m.Block(blocker_id=people["claire"]["id"], blocked_id=people["bruce"]["id"]))
        db.commit()
    assert (
        client.get(
            "/api/v1/users/bruce/contributions", params={"type": "replies"}, headers=headers("claire")
        ).status_code
        == 404
    )


def test_public_reply_history_paginates_both_accepted_and_ordinary_replies(client, people, history):
    first = client.get("/api/v1/users/bruce/contributions", params={"type": "replies", "limit": 1})
    assert first.status_code == 200
    assert [row["id"] for row in first.json()["items"]] == [history["published-0"]]
    assert first.json()["next_offset"] == 1
    second = client.get(
        "/api/v1/users/bruce/contributions", params={"type": "replies", "limit": 1, "offset": 1}
    )
    assert second.status_code == 200
    assert [row["id"] for row in second.json()["items"]] == [history["published-1"]]
    assert second.json()["next_offset"] is None


def test_deactivated_profile_history_remains_unavailable(client, people, history):
    with Session() as db:
        db.get(m.User, people["bruce"]["id"]).status = "deactivated"
        db.commit()
    assert client.get("/api/v1/users/bruce/contributions", params={"type": "replies"}).status_code == 404
