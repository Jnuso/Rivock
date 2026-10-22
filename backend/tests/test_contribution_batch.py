from datetime import timedelta

import pytest
from sqlalchemy import event, select

from app import models as m, schemas as v, services as s
from app.db import Session, engine
from .conftest import headers


@pytest.fixture
def many_contributions(people, topic):
    """Distinct conversations/response targets reveal per-row database work."""
    with Session() as db:
        stamp = m.now()
        for index in range(60):
            thread = m.Thread(
                author_id=people["bruce"]["id"],
                topic_id=topic,
                type="question",
                title=f"Original fictional history {index}",
                body_markdown="Temporary test conversation.",
                published_at=stamp - timedelta(minutes=index),
            )
            db.add(thread)
            db.flush()
            parent = m.Reply(
                thread_id=thread.id,
                author_id=people["alice"]["id"],
                body_markdown="Original fictional response target.",
            )
            db.add(parent)
            db.flush()
            reply = m.Reply(
                thread_id=thread.id,
                author_id=people["bruce"]["id"],
                parent_reply_id=parent.id,
                response_to_reply_id=parent.id,
                depth=2,
                body_markdown=f"Original fictional follow-up {index}.",
                published_at=stamp - timedelta(minutes=index),
            )
            db.add(reply)
            db.flush()
            db.add(m.ReplyVote(user_id=people["claire"]["id"], reply_id=reply.id, value=1))
        db.commit()


@pytest.mark.parametrize("kind", ["threads", "replies"])
@pytest.mark.parametrize("viewer", [None, "claire"])
def test_contribution_pages_bound_database_work(client, people, many_contributions, kind, viewer):
    counts = []
    for size in [1, 20, 50]:
        statements = []

        def observe(_conn, _cursor, statement, _parameters, _context, _many):
            statements.append(statement)

        event.listen(engine, "before_cursor_execute", observe)
        try:
            response = client.get(
                "/api/v1/users/bruce/contributions",
                params={"type": kind, "limit": size},
                headers=headers(viewer) if viewer else {},
            )
        finally:
            event.remove(engine, "before_cursor_execute", observe)
        assert response.status_code == 200, response.text
        assert len(response.json()["items"]) == size
        counts.append(len(statements))
        # Compare the complete HTTP payload with the established per-item projection.
        with Session() as db:
            user = db.get(m.User, people[viewer]["id"]) if viewer else None
            cls = m.Thread if kind == "threads" else m.Reply
            rows = list(
                db.scalars(
                    select(cls)
                    .where(cls.author_id == people["bruce"]["id"])
                    .order_by(cls.published_at.desc(), cls.id)
                    .limit(size + 1)
                )
            )
            expected = s.page(
                rows,
                0,
                size,
                lambda row: (
                    s.thread_out(db, row, user, False) if kind == "threads" else s.reply_out(db, row, user)
                ),
            )
            assert response.json() == v.ContributionList.model_validate(expected).model_dump(mode="json")
    print(f"{kind}/{viewer or 'anonymous'} history SQL at 1/20/50: {counts}")
    # Includes actual HTTP authorization, rate accounting and all public projections.
    assert max(counts) <= 14, counts


@pytest.fixture
def reply_catalog(people, topic):
    with Session() as db:
        thread = m.Thread(
            author_id=people["alice"]["id"],
            topic_id=topic,
            type="question",
            title="Fictional projection comparison",
            body_markdown="Original synthetic context.",
        )
        db.add(thread)
        db.flush()
        root = m.Reply(
            thread_id=thread.id,
            author_id=people["alice"]["id"],
            body_markdown="Response target text.",
        )
        db.add(root)
        db.flush()
        reply = m.Reply(
            thread_id=thread.id,
            author_id=people["bruce"]["id"],
            parent_reply_id=root.id,
            response_to_reply_id=root.id,
            depth=2,
            body_markdown="Original follow-up text.",
            revision=3,
            edited_at=m.now(),
        )
        db.add(reply)
        db.flush()
        # Count structural children even when unavailable, preserving conversation shells.
        for state in ["published", "removed", "deleted"]:
            db.add(
                m.Reply(
                    thread_id=thread.id,
                    author_id=people["claire"]["id"],
                    parent_reply_id=reply.id,
                    response_to_reply_id=reply.id,
                    depth=3,
                    body_markdown="Fictional child.",
                    state=state,
                )
            )
        db.add_all(
            [
                m.ReplyVote(user_id=people["claire"]["id"], reply_id=reply.id, value=1),
                m.ReplyVote(user_id=people["alice"]["id"], reply_id=reply.id, value=-1),
            ]
        )
        thread.accepted_reply_id = root.id
        db.commit()
        return {"thread": thread.id, "root": root.id, "reply": reply.id}


@pytest.mark.parametrize("viewer", [None, "claire"])
@pytest.mark.parametrize(
    "variant",
    [
        "published",
        "removed-target",
        "deactivated-target",
        "deactivated-author",
        "removed-thread",
        "deleted-reply",
        "blocked-target",
        "blocked-author",
    ],
)
def test_batched_replies_match_safe_single_projection(people, reply_catalog, viewer, variant):
    with Session() as db:
        if variant == "removed-target":
            db.get(m.Reply, reply_catalog["root"]).state = "removed"
        elif variant == "deactivated-target":
            db.get(m.User, people["alice"]["id"]).status = "deactivated"
        elif variant == "deactivated-author":
            db.get(m.User, people["bruce"]["id"]).status = "deactivated"
        elif variant == "removed-thread":
            db.get(m.Thread, reply_catalog["thread"]).state = "removed"
        elif variant == "deleted-reply":
            db.get(m.Reply, reply_catalog["reply"]).state = "deleted"
        elif variant in {"blocked-target", "blocked-author"}:
            db.add(
                m.Block(
                    blocker_id=people["claire"]["id"],
                    blocked_id=people["alice" if variant == "blocked-target" else "bruce"]["id"],
                )
            )
        db.commit()
    with Session() as db:
        user = db.get(m.User, people[viewer]["id"]) if viewer else None
        rows = list(db.scalars(select(m.Reply).order_by(m.Reply.id)))
        expected = [s.reply_out(db, row, user) for row in rows]
        actual = s.reply_summaries(db, rows, user)
        assert actual == expected
        followup = next(row for row in actual if row["id"] == reply_catalog["reply"])
        assert followup["child_count"] == 3
        assert followup["revision"] == 3
        if variant == "published":
            assert followup["score"] == 0
            assert followup["my_vote"] == (1 if viewer else None)
            assert followup["response_to"]["username"] == "alice"
            assert next(row for row in actual if row["id"] == reply_catalog["root"])["is_accepted"]
        if variant == "removed-target" or (viewer and variant == "blocked-target"):
            assert followup["response_to"]["username"] == "[unavailable]"
        if variant == "deactivated-target":
            assert followup["response_to"]["username"] == "[deleted]"
        if variant == "deactivated-author":
            assert followup["author"]["username"] == "[deleted]"
            assert followup["author"]["bio"] == ""
        if variant == "removed-thread":
            assert not any(row["is_accepted"] for row in actual)
        if variant == "deleted-reply" or (viewer and variant == "blocked-author"):
            assert followup["body_markdown"] is None
            assert followup["author"] is None
            assert followup["score"] is None and followup["my_vote"] is None


def test_reply_batch_does_not_cache_private_state_between_requests(people, reply_catalog):
    def project(viewer):
        with Session() as db:
            row = db.get(m.Reply, reply_catalog["reply"])
            user = db.get(m.User, people[viewer]["id"]) if viewer else None
            return s.reply_summaries(db, [row], user)[0]

    assert project("claire")["my_vote"] == 1
    assert project("alice")["my_vote"] == -1
    assert project(None)["my_vote"] is None
    with Session() as db:
        db.get(m.ReplyVote, (people["claire"]["id"], reply_catalog["reply"])).value = -1
        db.add(m.Block(blocker_id=people["claire"]["id"], blocked_id=people["bruce"]["id"]))
        db.commit()
    assert project("claire")["state"] == "blocked"
    assert project("claire")["my_vote"] is None
    assert project("alice")["state"] == "published"
    assert project(None)["score"] == -2


def test_empty_reply_batch_performs_no_queries():
    with Session() as db:
        statements = []

        def observe(*args):
            statements.append(args[2])

        event.listen(engine, "before_cursor_execute", observe)
        try:
            assert s.reply_summaries(db, []) == []
        finally:
            event.remove(engine, "before_cursor_execute", observe)
        assert statements == []


def test_reply_batch_keeps_depth_five_response_target_distinct_from_structural_parent(people, reply_catalog):
    with Session() as db:
        parent = db.get(m.Reply, reply_catalog["reply"])
        for depth in [3, 4, 5]:
            row = m.Reply(
                thread_id=parent.thread_id,
                author_id=people["bruce"]["id"],
                parent_reply_id=parent.id,
                response_to_reply_id=parent.id,
                depth=depth,
                body_markdown=f"Original nested follow-up at depth {depth}.",
            )
            db.add(row)
            db.flush()
            parent = row
        response = m.Reply(
            thread_id=parent.thread_id,
            author_id=people["claire"]["id"],
            parent_reply_id=parent.parent_reply_id,
            response_to_reply_id=parent.id,
            depth=5,
            body_markdown="Response to depth five under the depth-four structural parent.",
        )
        db.add(response)
        db.flush()
        expected = s.reply_out(db, response)
        actual = s.reply_summaries(db, [response])[0]
        assert actual == expected
        assert actual["parent_reply_id"] != actual["response_to_reply_id"]
        assert actual["response_to"] == {"reply_id": parent.id, "username": "bruce"}


def test_history_filters_before_pagination_and_observes_later_changes(client, people, reply_catalog):
    url = "/api/v1/users/bruce/contributions"
    with Session() as db:
        hidden_thread = m.Thread(
            author_id=people["claire"]["id"],
            topic_id=db.get(m.Thread, reply_catalog["thread"]).topic_id,
            type="question",
            title="Fictional hidden conversation",
            body_markdown="Hidden context.",
        )
        db.add(hidden_thread)
        db.flush()
        db.add(
            m.Reply(
                thread_id=hidden_thread.id,
                author_id=people["bruce"]["id"],
                body_markdown="Newest hidden history entry.",
                published_at=m.now() + timedelta(minutes=1),
            )
        )
        db.add(m.Block(blocker_id=people["alice"]["id"], blocked_id=people["claire"]["id"]))
        db.commit()
    result = client.get(url, params={"type": "replies", "limit": 1}, headers=headers("alice"))
    assert result.status_code == 200
    assert [row["id"] for row in result.json()["items"]] == [reply_catalog["reply"]]
    assert result.json()["next_offset"] is None
    with Session() as db:
        db.get(m.Thread, reply_catalog["thread"]).state = "removed"
        db.commit()
    assert client.get(url, params={"type": "replies"}, headers=headers("alice")).json() == {
        "items": [],
        "next_offset": None,
    }
