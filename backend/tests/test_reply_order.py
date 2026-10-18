from datetime import datetime, timedelta, timezone
import pytest
from app import models as m
from app.db import Session
from .conftest import headers


@pytest.fixture
def conversation(people, topic):
    stamp = datetime(2026, 10, 12, tzinfo=timezone.utc)
    with Session() as db:
        thread = m.Thread(
            author_id=people["alice"]["id"],
            topic_id=topic,
            type="question",
            title="Fictional ordering question",
            body_markdown="Original synthetic question.",
        )
        db.add(thread)
        db.flush()
        rows = {}
        for number, key, delta, author, state in [
            (201, "old", -1, "bruce", "published"),
            (202, "accepted", 0, "claire", "published"),
            (203, "new", 1, "claire", "published"),
            (204, "tie", 1, "alice", "published"),
            (205, "shell", -2, "bruce", "removed"),
        ]:
            row = m.Reply(
                id=f"00000000-0000-4000-8000-{number:012}",
                thread_id=thread.id,
                author_id=people[author]["id"],
                body_markdown=f"Fictional answer {key}" if state == "published" else None,
                state=state,
                published_at=stamp + timedelta(days=delta),
            )
            db.add(row)
            db.flush()
            rows[key] = row
        child = m.Reply(
            thread_id=thread.id,
            author_id=people["alice"]["id"],
            parent_reply_id=rows["shell"].id,
            response_to_reply_id=rows["shell"].id,
            depth=2,
            body_markdown="Surviving fictional nested reply.",
        )
        db.add(child)
        for author in ["alice", "claire", "admin"]:
            db.add(m.ReplyVote(user_id=people[author]["id"], reply_id=rows["old"].id, value=1))
        thread.accepted_reply_id = rows["accepted"].id
        db.commit()
        return {"id": thread.id, "rows": {key: row.id for key, row in rows.items()}, "child": child.id}


def read(client, conversation, **params):
    response = client.get(f"/api/v1/threads/{conversation['id']}/replies", params=params)
    assert response.status_code == 200, response.text
    return response.json()


@pytest.mark.parametrize(
    "sort,order",
    [
        ("recommended", ["accepted", "old", "tie", "new", "shell"]),
        ("newest", ["accepted", "tie", "new", "old", "shell"]),
        ("oldest", ["accepted", "shell", "old", "new", "tie"]),
    ],
)
def test_orders_preserve_acceptance_ties_and_unavailable_parent_shells(client, conversation, sort, order):
    result = read(client, conversation, sort=sort)
    assert [row["id"] for row in result["items"]] == [conversation["rows"][key] for key in order]
    assert result["items"][0]["is_accepted"]
    shell = next(row for row in result["items"] if row["id"] == conversation["rows"]["shell"])
    assert shell["state"] == "removed" and shell["body_markdown"] is None and shell["author"] is None
    assert shell["child_count"] == 1
    assert conversation["child"] not in {row["id"] for row in result["items"]}


def test_omitting_order_keeps_the_recommended_default(client, conversation):
    assert read(client, conversation) == read(client, conversation, sort="recommended")


@pytest.mark.parametrize("sort", ["recommended", "newest", "oldest"])
def test_each_reply_order_paginates_before_serializing(client, conversation, sort):
    expected = read(client, conversation, sort=sort)["items"]
    first = read(client, conversation, sort=sort, limit=2)
    second = read(client, conversation, sort=sort, limit=2, offset=first["next_offset"])
    third = read(client, conversation, sort=sort, limit=2, offset=second["next_offset"])
    assert first["items"] + second["items"] + third["items"] == expected
    assert third["next_offset"] is None


@pytest.mark.parametrize("sort", ["recommended", "newest", "oldest"])
def test_blocked_answers_are_safe_placeholders_and_lose_acceptance_in_every_order(
    client, people, conversation, sort
):
    with Session() as db:
        db.add(m.Block(blocker_id=people["bruce"]["id"], blocked_id=people["claire"]["id"]))
        db.commit()
    response = client.get(
        f"/api/v1/threads/{conversation['id']}/replies", params={"sort": sort}, headers=headers("bruce")
    )
    assert response.status_code == 200, response.text
    rows = response.json()["items"]
    assert not any(row["is_accepted"] for row in rows)
    hidden = next(row for row in rows if row["id"] == conversation["rows"]["accepted"])
    assert hidden["state"] == "blocked" and hidden["body_markdown"] is None and hidden["author"] is None
    assert hidden["score"] is None
    assert read(client, conversation, sort=sort)["items"][0]["is_accepted"]


@pytest.mark.parametrize("sort", ["newest", "oldest"])
def test_discussion_orders_do_not_pin_an_answer(client, conversation, sort):
    with Session() as db:
        thread = db.get(m.Thread, conversation["id"])
        thread.accepted_reply_id = None
        thread.type = "discussion"
        db.commit()
    rows = read(client, conversation, sort=sort)["items"]
    assert rows[0]["id"] == conversation["rows"]["tie" if sort == "newest" else "shell"]
    assert not any(row["is_accepted"] for row in rows)


@pytest.mark.parametrize("sort", ["", "unknown", "LATEST"])
def test_invalid_order_is_a_validation_error(client, conversation, sort):
    response = client.get(f"/api/v1/threads/{conversation['id']}/replies", params={"sort": sort})
    assert response.status_code == 422
    assert set(response.json()) == {"error"}
