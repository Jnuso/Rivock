from datetime import timedelta

import pytest
from sqlalchemy import event, select

from app import models as m, moderation as mod
from app.config import settings
from app.db import Session, engine
from .conftest import headers


def post(client, topic, body="How can I prepare for office hours?"):
    return client.post(
        "/api/v1/threads",
        json={"type": "question", "topic_id": topic, "title": "Review visibility", "body_markdown": body},
        headers=headers("alice"),
    )


def google_config():
    cfg = settings()
    cfg.moderation_mode, cfg.ai_model, cfg.ai_api_key = "google", "synthetic-model", "synthetic-key"
    cfg.ai_billing_mode = "metered"
    cfg.ai_input_usd_per_million = cfg.ai_output_usd_per_million = 1


def test_completed_review_is_private_and_visible_in_mutation_list_and_detail(client, people, topic):
    result = post(client, topic)
    assert result.status_code == 201
    submission = result.json()["submission"]
    review = submission["review"]
    assert review["source"] == "fixture" and review["decision"] == "allow"
    assert review["model"] is None and review["completed_at"]
    assert set(review) == {"source", "decision", "model", "completed_at"}
    sid = submission["id"]
    detail = client.get(f"/api/v1/me/submissions/{sid}", headers=headers("alice"))
    listing = client.get("/api/v1/me/submissions", headers=headers("alice"))
    assert detail.json()["review"] == listing.json()["items"][0]["review"] == review
    assert client.get(f"/api/v1/me/submissions/{sid}", headers=headers("bruce")).status_code == 404
    assert client.get("/api/v1/me/submissions", headers=headers("bruce")).json()["items"] == []
    assert client.get(f"/api/v1/me/submissions/{sid}").status_code == 401
    public = client.get(f"/api/v1/threads/{result.json()['content']['id']}").json()
    assert "review" not in public and "synthetic-key" not in str(detail.json())


@pytest.mark.parametrize("decision", ["allow", "reject", "uncertain"])
def test_owner_sees_actual_ai_decision_including_inconclusive(client, people, topic, monkeypatch, decision):
    google_config()
    monkeypatch.setattr(mod, "google_decision", lambda _: (decision, "policy", 100, 12))
    result = post(client, topic)
    sid = (
        result.json()["error"]["submission_id"] if decision == "reject" else result.json()["submission"]["id"]
    )
    review = client.get(f"/api/v1/me/submissions/{sid}", headers=headers("alice")).json()["review"]
    assert review["source"] == "ai"
    assert review["model"] == "synthetic-model"
    assert review["decision"] == decision


def test_failed_ai_attempt_is_not_presented_as_a_completed_review(client, people, topic, monkeypatch):
    google_config()
    monkeypatch.setattr(mod, "google_decision", lambda _: (_ for _ in ()).throw(TimeoutError()))
    result = post(client, topic)
    assert result.status_code == 202
    submission = result.json()["submission"]
    assert submission["status"] == "pending" and submission["review"] is None
    with Session() as db:
        assert db.get(m.Submission, submission["id"]).ai_attempt_count == 1


def test_late_older_ai_result_does_not_replace_a_newer_moderator_review(client, people, topic):
    settings().moderation_mode = "pending"
    sid = post(client, topic).json()["submission"]["id"]
    with Session() as db:
        old = m.Attempt(submission_id=sid, source="ai", model="synthetic-model")
        db.add(old)
        db.commit()
        old_id = old.id
    result = client.post(
        f"/api/v1/admin/submissions/{sid}/decision",
        json={"decision": "approve", "reason": "Synthetic review"},
        headers=headers("admin"),
    )
    assert result.status_code == 200
    assert result.json()["review"]["source"] == "admin"
    assert result.json()["review"]["decision"] == "allow"
    with Session() as db:
        old = db.get(m.Attempt, old_id)
        old.decision, old.finished_at = "allow", m.now() + timedelta(seconds=1)
        db.commit()
    detail = client.get(f"/api/v1/me/submissions/{sid}", headers=headers("alice")).json()
    assert detail["review"]["source"] == "admin"


def test_rule_rejection_is_distinguished_from_ai(client, people, topic):
    result = post(client, topic, "Promotion " + "x" * 110)
    assert result.status_code == 422
    sid = result.json()["error"]["submission_id"]
    review = client.get(f"/api/v1/me/submissions/{sid}", headers=headers("alice")).json()["review"]
    assert review["source"] == "rules" and review["decision"] == "reject"


def test_review_history_is_loaded_once_for_the_visible_page(client, people, topic):
    post(client, topic)
    post(client, topic, "Another original fictional question")
    queries = []

    def capture(connection, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("SELECT") and "moderation_attempts" in statement:
            queries.append(statement)

    event.listen(engine, "before_cursor_execute", capture)
    try:
        result = client.get("/api/v1/me/submissions", headers=headers("alice"))
    finally:
        event.remove(engine, "before_cursor_execute", capture)
    assert result.status_code == 200 and len(result.json()["items"]) == 2
    assert len(queries) == 1
    with Session() as db:
        assert len(list(db.scalars(select(m.Submission)))) == 2
