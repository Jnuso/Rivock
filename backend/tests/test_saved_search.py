from datetime import timedelta

import pytest
from sqlalchemy import select

from app import models as m, schemas as v, services as s
from app.db import Session
from .conftest import headers
from .test_feed_projection import statement_count

API = "/api/v1/me/saved"


@pytest.fixture
def saved_catalog(people, topic):
    values = [
        ("title", "Office hours preparation", "Plan one specific question.", "published", "claire"),
        ("body", "Finding a routine", "Try office hours after class.", "published", "claire"),
        ("other", "Weekend cooking", "Make a simple meal.", "published", "claire"),
        ("removed", "Office hours removedsecret", "Hidden removedsecret.", "removed", "claire"),
        ("deleted", "Office hours deletedsecret", "Stale deletedsecret.", "deleted", "claire"),
        ("blocked", "Office hours blockedsecret", "Hidden blockedsecret.", "published", "bruce"),
        ("unsaved", "Office hours unsavedsecret", "Another account saved this.", "published", "claire"),
    ]
    ids = {}
    with Session() as db:
        stamp = m.now()
        for index, (label, title, body, state, author) in enumerate(values):
            row = m.Thread(
                author_id=people[author]["id"],
                topic_id=topic,
                type="question",
                title=title,
                body_markdown=body,
                search_text=s.plain(body),
                state=state,
            )
            db.add(row)
            db.flush()
            ids[label] = row.id
            db.add(
                m.Save(
                    user_id=people["bruce" if label == "unsaved" else "alice"]["id"],
                    thread_id=row.id,
                    created_at=stamp - timedelta(minutes=index),
                )
            )
        db.add(m.Block(blocker_id=people["alice"]["id"], blocked_id=people["bruce"]["id"]))
        db.add(m.ThreadVote(user_id=people["alice"]["id"], thread_id=ids["title"], value=1))
        db.commit()
    return ids


@pytest.mark.parametrize("query", ["", "   "])
def test_clear_search_keeps_safe_placeholders_and_matches_the_existing_saved_projection(
    client, people, saved_catalog, query
):
    result = client.get(API, params={"q": query}, headers=headers("alice"))
    assert result.status_code == 200
    assert "no-store" in result.headers["cache-control"]
    with Session() as db:
        user = db.get(m.User, people["alice"]["id"])
        rows = list(
            db.scalars(
                select(m.Thread)
                .join(m.Save)
                .where(m.Save.user_id == user.id)
                .order_by(m.Save.created_at.desc(), m.Thread.id)
            )
        )
        expected = [
            v.ThreadOut.model_validate(s.thread_out(db, row, user, False)).model_dump(mode="json")
            for row in rows
        ]
    assert result.json()["items"] == expected
    assert result.json()["next_offset"] is None
    assert len(expected) == 6
    assert expected[0]["my_vote"] == 1 and expected[0]["is_saved"]
    assert all(item["body_markdown"] is None for item in expected)
    assert expected[-1]["state"] == "blocked" and expected[-1]["author"] is None


@pytest.mark.parametrize(
    "query, labels",
    [
        ("office", ["title", "body"]),
        (" office hours ", ["title", "body"]),
        ('"office hours"', ["title", "body"]),
        ("office OR routine", ["title", "body"]),
        ("specific question", ["title"]),
    ],
)
def test_saved_search_uses_published_title_and_body_before_pagination(
    client, people, saved_catalog, query, labels
):
    result = client.get(API, params={"q": query}, headers=headers("alice"))
    assert result.status_code == 200
    assert [row["id"] for row in result.json()["items"]] == [saved_catalog[label] for label in labels]
    assert all(row["is_saved"] for row in result.json()["items"])


@pytest.mark.parametrize("query", ["removedsecret", "deletedsecret", "blockedsecret"])
def test_search_does_not_disclose_whether_unavailable_saved_text_matches(
    client, people, saved_catalog, query
):
    result = client.get(API, params={"q": query, "limit": 1}, headers=headers("alice"))
    assert result.status_code == 200
    assert result.json() == {"items": [], "next_offset": None}


def test_saved_search_never_searches_another_accounts_library(client, people, saved_catalog):
    result = client.get(API, params={"q": "unsavedsecret"}, headers=headers("alice"))
    assert result.json() == {"items": [], "next_offset": None}
    other = client.get(API, params={"q": "office"}, headers=headers("bruce"))
    assert [row["id"] for row in other.json()["items"]] == [saved_catalog["unsaved"]]


def test_saved_search_paginates_matches_in_saved_time_order_without_duplicates(
    client, people, topic, saved_catalog
):
    expected = []
    with Session() as db:
        stamp = m.now()
        for index in range(60):
            row = m.Thread(
                author_id=people["claire"]["id"],
                topic_id=topic,
                type="discussion",
                title=("Office hours " if index % 2 == 0 else "Cooking ") + str(index),
                body_markdown="Original synthetic text.",
            )
            db.add(row)
            db.flush()
            db.add(
                m.Save(
                    user_id=people["alice"]["id"],
                    thread_id=row.id,
                    created_at=stamp + timedelta(seconds=index),
                )
            )
            if index % 2 == 0:
                expected.insert(0, row.id)
        db.commit()
    expected.extend([saved_catalog["title"], saved_catalog["body"]])
    actual, offset = [], 0
    while offset is not None:
        result = client.get(
            API, params={"q": "office", "offset": offset, "limit": 7}, headers=headers("alice")
        )
        assert result.status_code == 200
        page = result.json()
        actual.extend(row["id"] for row in page["items"])
        offset = page["next_offset"]
    assert actual == expected
    assert len(set(actual)) == 32


@pytest.mark.parametrize("length, status", [(200, 200), (201, 422)])
def test_saved_search_bounds_unicode_query_length(client, people, saved_catalog, length, status):
    result = client.get(API, params={"q": "📝" * length}, headers=headers("alice"))
    assert result.status_code == status


def test_saved_search_requires_a_signed_in_account(client, people, saved_catalog):
    assert client.get(API, params={"q": "office"}).status_code == 401


@pytest.mark.parametrize("status", ["suspended", "deactivated"])
def test_inactive_accounts_cannot_search_private_saves(client, people, saved_catalog, status):
    with Session() as db:
        db.get(m.User, people["alice"]["id"]).status = status
        db.commit()
    assert client.get(API, params={"q": "office"}, headers=headers("alice")).status_code == 403


def test_saved_projection_queries_stay_bounded_as_pages_grow(client, people, topic):
    with Session() as db:
        for index in range(55):
            row = m.Thread(
                author_id=people["claire"]["id"],
                topic_id=topic,
                type="question",
                title=f"Office hours {index}",
                body_markdown="Original fictional content.",
            )
            db.add(row)
            db.flush()
            db.add(m.Save(user_id=people["alice"]["id"], thread_id=row.id))
        db.commit()
    counts = []
    for size in [1, 20, 50]:
        with statement_count() as statements:
            result = client.get(API, params={"q": "office", "limit": size}, headers=headers("alice"))
        assert result.status_code == 200
        assert len(result.json()["items"]) == size
        counts.append(len(statements))
    assert max(counts) <= 14
    assert max(counts) - min(counts) <= 1
