from datetime import timedelta

import pytest
from sqlalchemy import event

from app import models as m, schemas as v, services as s
from app.db import Session, engine
from .conftest import headers


@pytest.fixture
def conversation(people, topic):
    with Session() as db:
        stamp = m.now()
        thread = m.Thread(
            author_id=people["alice"]["id"],
            topic_id=topic,
            type="question",
            title="Original fictional conversation for page checks",
            body_markdown="Synthetic test-only context.",
        )
        db.add(thread)
        db.flush()
        roots = []
        for index in range(60):
            row = m.Reply(
                thread_id=thread.id,
                author_id=people["bruce"]["id"],
                body_markdown=f"Original direct answer {index}.",
                published_at=stamp - timedelta(minutes=index),
            )
            db.add(row)
            db.flush()
            roots.append(row)
            db.add(m.ReplyVote(user_id=people["claire"]["id"], reply_id=row.id, value=1))
        thread.accepted_reply_id = roots[-1].id
        for index in range(60):
            child = m.Reply(
                thread_id=thread.id,
                author_id=people["bruce"]["id"],
                parent_reply_id=roots[0].id,
                response_to_reply_id=roots[0].id,
                depth=2,
                body_markdown=f"Original follow-up {index}.",
                published_at=stamp - timedelta(minutes=index),
            )
            db.add(child)
            db.flush()
            db.add(m.ReplyVote(user_id=people["claire"]["id"], reply_id=child.id, value=-1))
        db.commit()
        return {"thread": thread.id, "parent": roots[0].id, "accepted": roots[-1].id}


@pytest.mark.parametrize("viewer", [None, "claire"])
@pytest.mark.parametrize("order", ["recommended", "newest", "oldest", "children"])
def test_conversation_pages_bound_queries_and_match_single_projection(
    client, people, conversation, viewer, order
):
    url = (
        f"/api/v1/replies/{conversation['parent']}/children"
        if order == "children"
        else f"/api/v1/threads/{conversation['thread']}/replies"
    )
    counts = []
    for size in [1, 20, 50]:
        statements = []

        def observe(*args):
            statements.append(args[2])

        event.listen(engine, "before_cursor_execute", observe)
        try:
            response = client.get(
                url,
                params={"limit": size, **({"sort": order} if order != "children" else {})},
                headers=headers(viewer) if viewer else {},
            )
        finally:
            event.remove(engine, "before_cursor_execute", observe)
        assert response.status_code == 200, response.text
        result = response.json()
        assert len(result["items"]) == size
        assert result["next_offset"] == size
        counts.append(len(statements))
        if order != "children":
            assert result["items"][0]["id"] == conversation["accepted"]
        with Session() as db:
            user = db.get(m.User, people[viewer]["id"]) if viewer else None
            reference = [s.reply_out(db, db.get(m.Reply, item["id"]), user) for item in result["items"]]
            assert result == v.ReplyList(items=reference, next_offset=size).model_dump(mode="json")
    print(f"{order}/{viewer or 'anonymous'} SQL at 1/20/50: {counts}")
    assert max(counts) <= 14, counts


@pytest.mark.parametrize("kind", ["answers", "children"])
@pytest.mark.parametrize(
    "variant",
    [
        "blocked-author",
        "blocked-thread-author",
        "reverse-block",
        "deactivated-author",
        "removed-thread",
        "removed-parent",
    ],
)
def test_conversation_batch_preserves_safe_shells_and_targets(client, people, conversation, kind, variant):
    with Session() as db:
        if variant in {"blocked-author", "blocked-thread-author"}:
            db.add(
                m.Block(
                    blocker_id=people["claire"]["id"],
                    blocked_id=people["bruce" if variant == "blocked-author" else "alice"]["id"],
                )
            )
        elif variant == "reverse-block":
            db.add(m.Block(blocker_id=people["bruce"]["id"], blocked_id=people["claire"]["id"]))
        elif variant == "deactivated-author":
            db.get(m.User, people["bruce"]["id"]).status = "deactivated"
        elif variant == "removed-thread":
            db.get(m.Thread, conversation["thread"]).state = "removed"
        else:
            db.get(m.Reply, conversation["parent"]).state = "removed"
        db.commit()
    url = (
        f"/api/v1/replies/{conversation['parent']}/children"
        if kind == "children"
        else f"/api/v1/threads/{conversation['thread']}/replies"
    )
    response = client.get(url, params={"limit": 50}, headers=headers("claire"))
    assert response.status_code == 200, response.text
    result = response.json()
    with Session() as db:
        viewer = db.get(m.User, people["claire"]["id"])
        expected = [s.reply_out(db, db.get(m.Reply, row["id"]), viewer) for row in result["items"]]
        assert result == v.ReplyList(items=expected, next_offset=50).model_dump(mode="json")
    if variant == "blocked-author":
        assert all(row["state"] == "blocked" for row in result["items"])
        assert all(row["body_markdown"] is None and row["author"] is None for row in result["items"])
        assert all(row["score"] is None and row["my_vote"] is None for row in result["items"])
        assert not any(row["is_accepted"] for row in result["items"])
    if variant in {"blocked-thread-author", "removed-thread"}:
        assert not any(row["is_accepted"] for row in result["items"])
        # Other people's replies survive the unavailable conversation shell.
        assert all(row["body_markdown"] is not None for row in result["items"])
    if variant == "deactivated-author":
        assert all(row["author"]["username"] == "[deleted]" for row in result["items"])
    if variant == "reverse-block":
        # Public read visibility uses viewer-hidden authors; participation checks are bilateral.
        assert all(row["state"] == "published" for row in result["items"])
    if kind == "children" and variant in {"blocked-author", "removed-parent"}:
        assert all(row["response_to"]["username"] == "[unavailable]" for row in result["items"])


@pytest.mark.parametrize("kind", ["answers", "children"])
def test_conversation_batch_empty_page_is_still_empty(client, people, conversation, kind):
    url = (
        f"/api/v1/replies/{conversation['parent']}/children"
        if kind == "children"
        else f"/api/v1/threads/{conversation['thread']}/replies"
    )
    response = client.get(url, params={"offset": 60}, headers=headers("claire"))
    assert response.status_code == 200
    assert response.json() == {"items": [], "next_offset": None}
