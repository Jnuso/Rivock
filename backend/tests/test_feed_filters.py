from datetime import timedelta
import pytest
from sqlalchemy import select
from app import models as m
from app.db import Session
from .conftest import headers

API = "/api/v1/threads"


@pytest.fixture
def catalog(people, topic):
    with Session() as db:
        other_topic = db.scalar(select(m.Topic).where(m.Topic.id != topic))
        main_topic = db.get(m.Topic, topic)
        keys = [
            "empty",
            "answered",
            "accepted",
            "nested",
            "removed",
            "blocked",
            "hidden-accepted",
            "discussion",
            "other-topic",
            "otherword",
            "hidden-thread",
            "removed-thread",
        ]
        threads = {}
        for index, key in enumerate(keys):
            row = m.Thread(
                author_id=people["bruce" if key == "hidden-thread" else "alice"]["id"],
                topic_id=other_topic.id if key == "other-topic" else topic,
                type="discussion" if key == "discussion" else "question",
                title=f"{'Different' if key == 'otherword' else 'Comet'} conversation {key}",
                body_markdown="Original fictional feed-filter fixture.",
                state="removed" if key == "removed-thread" else "published",
                published_at=m.now() + timedelta(seconds=index),
            )
            db.add(row)
            db.flush()
            threads[key] = row
        replies = {}
        for key in [
            "answered",
            "accepted",
            "blocked",
            "hidden-accepted",
            "discussion",
            "removed-thread",
            "removed",
            "nested",
        ]:
            row = m.Reply(
                thread_id=threads[key].id,
                author_id=people["bruce" if key in {"blocked", "hidden-accepted"} else "claire"]["id"],
                body_markdown=None if key in {"removed", "nested"} else "A visible direct answer.",
                state="removed" if key == "removed" else "deleted" if key == "nested" else "published",
            )
            db.add(row)
            db.flush()
            replies[key] = row
        db.add(
            m.Reply(
                thread_id=threads["nested"].id,
                author_id=people["claire"]["id"],
                parent_reply_id=replies["nested"].id,
                response_to_reply_id=replies["nested"].id,
                depth=2,
                body_markdown="A surviving nested response is not a direct answer.",
            )
        )
        db.add(
            m.Reply(
                thread_id=threads["hidden-accepted"].id,
                author_id=people["claire"]["id"],
                body_markdown="Another visible answer.",
            )
        )
        for key in ["accepted", "hidden-accepted"]:
            threads[key].accepted_reply_id = replies[key].id
        db.commit()
        return {
            "threads": {key: row.id for key, row in threads.items()},
            "replies": {key: row.id for key, row in replies.items()},
            "topic": main_topic.slug,
            "other_topic": other_topic.slug,
        }


def read(client, params=None, viewer=None):
    response = client.get(API, params=params or {}, headers=headers(viewer) if viewer else {})
    assert response.status_code == 200, response.text
    return response.json()


def selected(catalog, *keys):
    return {catalog["threads"][key] for key in keys}


def ids(result):
    return {item["id"] for item in result["items"]}


def test_default_feed_preserves_types_and_excludes_removed_threads(client, catalog):
    result = read(client)
    assert ids(result) == set(catalog["threads"].values()) - selected(catalog, "removed-thread")
    assert {item["type"] for item in result["items"]} == {"question", "discussion"}


@pytest.mark.parametrize("kind", ["question", "discussion"])
def test_type_filters_apply_before_pagination(client, catalog, kind):
    result = read(client, {"type": kind})
    assert all(item["type"] == kind for item in result["items"])
    assert ids(result) == (
        selected(catalog, "discussion")
        if kind == "discussion"
        else set(catalog["threads"].values()) - selected(catalog, "discussion", "removed-thread")
    )


@pytest.mark.parametrize(
    "status, keys",
    [
        ("unanswered", ["empty", "nested", "removed", "other-topic", "otherword", "hidden-thread"]),
        ("answered", ["answered", "accepted", "blocked", "hidden-accepted"]),
        ("accepted", ["accepted", "hidden-accepted"]),
    ],
)
def test_answer_states_count_only_published_direct_answers(client, catalog, status, keys):
    result = read(client, {"answer_status": status})
    assert ids(result) == selected(catalog, *keys)
    assert all(item["type"] == "question" for item in result["items"])
    if status == "unanswered":
        # A surviving nested response contributes to the count, but isn't an answer.
        nested = next(item for item in result["items"] if item["id"] == catalog["threads"]["nested"])
        assert nested["reply_count"] == 1


@pytest.mark.parametrize(
    "status, keys",
    [
        ("unanswered", ["empty", "nested", "removed", "blocked", "other-topic", "otherword"]),
        ("answered", ["answered", "accepted", "hidden-accepted"]),
        ("accepted", ["accepted"]),
    ],
)
def test_answer_filters_use_the_viewers_block_projection(client, people, catalog, status, keys):
    with Session() as db:
        db.add(m.Block(blocker_id=people["claire"]["id"], blocked_id=people["bruce"]["id"]))
        db.commit()
    result = read(client, {"answer_status": status}, "claire")
    assert ids(result) == selected(catalog, *keys)
    assert all(item["author"]["username"] != "bruce" for item in result["items"])
    assert ids(read(client, {"answer_status": "accepted"})) == selected(
        catalog, "accepted", "hidden-accepted"
    )


@pytest.mark.parametrize("sort", ["relevance", "newest"])
def test_filters_combine_with_search_topic_and_search_sort(client, catalog, sort):
    result = read(
        client,
        {
            "q": "comet",
            "topic": catalog["topic"],
            "type": "question",
            "answer_status": "unanswered",
            "sort": sort,
        },
    )
    assert ids(result) == selected(catalog, "empty", "nested", "removed", "hidden-thread")
    assert ids(read(client, {"topic": catalog["other_topic"], "answer_status": "unanswered"})) == selected(
        catalog, "other-topic"
    )


@pytest.mark.parametrize("sort", ["latest", "trending"])
def test_filtered_pages_are_full_and_stably_ordered(client, catalog, sort):
    params = {"type": "question", "answer_status": "unanswered", "sort": sort, "limit": 2}
    first = read(client, params)
    second = read(client, {**params, "offset": first["next_offset"]})
    third = read(client, {**params, "offset": second["next_offset"]})
    assert len(first["items"]) == len(second["items"]) == len(third["items"]) == 2
    assert third["next_offset"] is None
    combined = first["items"] + second["items"] + third["items"]
    assert [item["id"] for item in combined] == [
        item["id"] for item in read(client, {**params, "limit": 20})["items"]
    ]
    assert len({item["id"] for item in combined}) == 6


def test_deleting_an_accepted_answer_moves_question_back_to_unanswered(client, people, catalog):
    key = catalog["threads"]["accepted"]
    assert key in ids(read(client, {"answer_status": "accepted"}))
    response = client.delete(f"/api/v1/replies/{catalog['replies']['accepted']}", headers=headers("claire"))
    assert response.status_code == 204, response.text
    assert key not in ids(read(client, {"answer_status": "accepted"}))
    assert key not in ids(read(client, {"answer_status": "answered"}))
    assert key in ids(read(client, {"answer_status": "unanswered"}))


@pytest.mark.parametrize(
    "params",
    [
        {"type": "anything"},
        {"type": ""},
        {"answer_status": "anything"},
        {"answer_status": ""},
        {"type": "discussion", "answer_status": "unanswered"},
        {"type": "discussion", "answer_status": "answered"},
        {"type": "discussion", "answer_status": "accepted"},
    ],
)
def test_invalid_filter_values_use_the_safe_error_envelope(client, params):
    result = client.get(API, params=params)
    assert result.status_code == 422
    assert set(result.json()) == {"error"}
    assert "message" in result.json()["error"]
