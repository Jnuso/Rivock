import json
from contextlib import contextmanager
from datetime import timedelta
import pytest
from sqlalchemy import event, select
from app import models as m, services as s, schemas as v
from app.db import Session, engine
from .conftest import headers
from .test_feed_filters import catalog as catalog


@contextmanager
def statement_count():
    statements = []

    def collect(_conn, _cursor, statement, _parameters, _context, _many):
        statements.append(statement)

    event.listen(engine, "before_cursor_execute", collect)
    try:
        yield statements
    finally:
        event.remove(engine, "before_cursor_execute", collect)


def add_private_state(db, people, catalog):
    keys = list(catalog["threads"].values())[:5]
    for index, key in enumerate(keys):
        db.add(m.ThreadVote(user_id=people["claire"]["id"], thread_id=key, value=1))
        db.add(m.ThreadVote(user_id=people["bruce"]["id"], thread_id=key, value=1 if index == 0 else -1))
    db.add(m.Save(user_id=people["claire"]["id"], thread_id=keys[0]))
    db.add(m.Save(user_id=people["bruce"]["id"], thread_id=keys[1]))


@pytest.mark.parametrize("viewer", [None, "alice", "claire"])
@pytest.mark.parametrize("hidden", [False, True])
def test_batch_summary_matches_single_projection_without_private_leaks(people, catalog, viewer, hidden):
    with Session() as db:
        add_private_state(db, people, catalog)
        if hidden:
            db.add(m.Block(blocker_id=people["claire"]["id"], blocked_id=people["bruce"]["id"]))
        # Deactivation keeps contributions while sanitizing the public author profile.
        db.get(m.User, people["alice"]["id"]).status = "deactivated"
        # Include stale-but-safe pointers to an unavailable accepted answer.
        db.get(m.Reply, catalog["replies"]["accepted"]).state = "removed"
        db.commit()
    with Session() as db:
        rows = list(db.scalars(select(m.Thread).order_by(m.Thread.id.desc())))
        user = db.get(m.User, people[viewer]["id"]) if viewer else None
        expected = [s.thread_out(db, row, user, False) for row in rows]
        actual = s.thread_summaries(db, rows, user)
        assert actual == expected
        assert [item["id"] for item in actual] == [row.id for row in rows]
        checked = [v.ThreadOut.model_validate(item).model_dump(mode="json") for item in actual]
        payload = json.dumps(checked)
        assert "auth_subject" not in payload and "auth_issuer" not in payload
        assert all(item["body_markdown"] is None for item in checked)
        empty = next(item for item in checked if item["id"] == catalog["threads"]["empty"])
        assert empty["author"]["username"] == "[deleted]"
        assert empty["score"] == 2
        assert empty["is_saved"] is (viewer == "claire")
        assert empty["my_vote"] == (1 if viewer == "claire" else None)
        removed = next(item for item in checked if item["id"] == catalog["threads"]["removed-thread"])
        assert removed["title"] == "[Removed thread]" and removed["author"] is None
        assert removed["score"] is None and removed["my_vote"] is None
        if viewer == "claire" and hidden:
            blocked = next(item for item in checked if item["id"] == catalog["threads"]["hidden-thread"])
            assert blocked["state"] == "blocked" and blocked["author"] is None
            assert blocked["body_markdown"] is None and blocked["score"] is None


def test_batch_summary_does_not_reuse_another_viewers_state(people, catalog):
    with Session() as db:
        add_private_state(db, people, catalog)
        db.commit()
    results = {}
    for viewer in ["claire", "bruce", None, "claire"]:
        with Session() as db:
            row = db.get(m.Thread, catalog["threads"]["empty"])
            user = db.get(m.User, people[viewer]["id"]) if viewer else None
            results[viewer] = s.thread_summaries(db, [row], user)[0]
    assert results["claire"]["is_saved"] and results["claire"]["my_vote"] == 1
    assert not results["bruce"]["is_saved"] and results["bruce"]["my_vote"] == 1
    assert not results[None]["is_saved"] and results[None]["my_vote"] is None


def test_batch_summary_reflects_new_votes_saves_blocks_and_removed_answers(people, catalog):
    key = catalog["threads"]["hidden-accepted"]
    viewer_id = people["claire"]["id"]
    with Session() as db:
        initial = s.thread_summaries(db, [db.get(m.Thread, key)], db.get(m.User, viewer_id))[0]
        assert initial["has_accepted_answer"] and initial["reply_count"] == 2
    with Session() as db:
        db.add(m.Block(blocker_id=viewer_id, blocked_id=people["bruce"]["id"]))
        db.add(m.Save(user_id=viewer_id, thread_id=key))
        db.add(m.ThreadVote(user_id=viewer_id, thread_id=key, value=-1))
        db.commit()
    with Session() as db:
        updated = s.thread_summaries(db, [db.get(m.Thread, key)], db.get(m.User, viewer_id))[0]
        assert not updated["has_accepted_answer"] and updated["accepted_reply_id"] is None
        assert updated["reply_count"] == 1 and updated["is_saved"]
        assert updated["score"] == -1 and updated["my_vote"] == -1
    with Session() as db:
        db.get(m.Reply, catalog["replies"]["hidden-accepted"]).state = "removed"
        db.commit()
    with Session() as db:
        anonymous = s.thread_summaries(db, [db.get(m.Thread, key)])[0]
        assert anonymous["reply_count"] == 1 and not anonymous["has_accepted_answer"]
        assert not anonymous["is_saved"] and anonymous["my_vote"] is None


def test_empty_summary_batch_does_not_read_database(people):
    with Session() as db:
        user = db.get(m.User, people["claire"]["id"])
        with statement_count() as statements:
            assert s.thread_summaries(db, [], user) == []
        assert statements == []


@pytest.mark.parametrize("viewer", [None, "claire"])
def test_feed_statement_count_stays_bounded_for_full_pages(client, people, catalog, topic, viewer):
    with Session() as db:
        for index in range(60):
            db.add(
                m.Thread(
                    author_id=people["alice"]["id"],
                    topic_id=topic,
                    type="question",
                    title=f"Fictional projection fixture {index}",
                    body_markdown="Temporary synthetic content.",
                    published_at=m.now() - timedelta(minutes=index),
                )
            )
        db.commit()
    for size in [1, 20, 50]:
        with statement_count() as statements:
            response = client.get(
                "/api/v1/threads",
                params={"limit": size, "sort": "latest"},
                headers=headers(viewer) if viewer else {},
            )
        assert response.status_code == 200, response.text
        assert len(response.json()["items"]) == size
        # Includes viewer lookup, rate accounting, page selection and all projections.
        assert len(statements) <= 13, f"{size} rows used {len(statements)} SQL statements"
