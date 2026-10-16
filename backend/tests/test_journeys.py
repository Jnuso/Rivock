from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
import pytest
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from app import models as m, moderation as mod
from app.db import Session
from app.config import settings
from app.worker import cleanup
from .conftest import headers, create_thread, create_reply

API = "/api/v1"


def test_failed_member_actions_consume_general_rate_limit(client, people, topic):
    t = create_thread(client, topic)
    with Session() as db:
        counter = db.scalar(select(m.RateBucket).where(m.RateBucket.action == "member_request"))
        before = counter.count
    assert (
        client.put(f"{API}/threads/{t['id']}/vote", json={"value": 1}, headers=headers("alice")).status_code
        == 403
    )
    with Session() as db:
        counter = db.scalar(select(m.RateBucket).where(m.RateBucket.action == "member_request"))
        assert counter.count == before + 1
        counter.count = 120
        db.commit()
    response = client.put(f"{API}/threads/{t['id']}/save", headers=headers("alice"))
    assert response.status_code == 429
    assert int(response.headers["Retry-After"]) > 0
    assert response.json()["error"]["code"] == "rate_limited"


def test_yearly_metadata_retention_preserves_replay_and_erasure_markers(client, people, topic):
    t = create_thread(client, topic)
    response = client.post(
        f"{API}/reports", json={"thread_id": t["id"], "reason": "spam/scam"}, headers=headers("bruce")
    )
    assert response.status_code == 201, response.text
    report = response.json()
    client.delete(f"{API}/threads/{t['id']}", headers=headers("alice"))
    old = m.now() - timedelta(days=366)
    with Session() as db:
        attempt = db.scalar(select(m.Attempt))
        attempt_id = attempt.id
        attempt.started_at = old
        db.get(m.Report, report["id"]).created_at = old
        action = m.AdminAction(
            actor_id=people["admin"]["id"],
            action="test",
            target_id=t["id"],
            reason="Old synthetic note",
            created_at=old,
        )
        db.add(action)
        marker = db.scalar(select(m.Erasure))
        marker_id = marker.id
        marker.created_at = old
        db.commit()
        action_id = action.id
    cleanup()
    with Session() as db:
        assert db.get(m.Attempt, attempt_id) is None
        assert db.get(m.Report, report["id"]) is None
        assert db.get(m.AdminAction, action_id) is None
        assert db.get(m.Erasure, marker_id) is not None
        assert db.scalar(select(func.count()).select_from(m.Submission)) == 1


def test_public_boundary_and_full_journey(client, people, topic):
    t = create_thread(client, topic)
    r = create_reply(client, t)
    assert client.get(f"{API}/threads/{t['id']}").json()["author"]["username"] == "alice"
    assert "auth_subject" not in client.get(f"{API}/users/alice").text
    assert "auth_issuer" not in client.get(f"{API}/users/alice").text
    assert "role" not in client.get(f"{API}/users/alice").json()
    assert client.get(f"{API}/me/saved").status_code == 401
    assert (
        client.put(f"{API}/threads/{t['id']}/vote", json={"value": 1}, headers=headers("alice")).status_code
        == 403
    )
    for value in [1, 1, -1]:
        res = client.put(f"{API}/threads/{t['id']}/vote", json={"value": value}, headers=headers("bruce"))
        assert res.json() == {"score": value, "my_vote": value}
    assert client.put(f"{API}/threads/{t['id']}/save", headers=headers("bruce")).status_code == 204
    assert client.get(f"{API}/me/saved", headers=headers("bruce")).json()["items"][0]["id"] == t["id"]
    assert not client.get(f"{API}/me/saved", headers=headers("alice")).json()["items"]
    res = client.put(
        f"{API}/threads/{t['id']}/accepted-answer", json={"reply_id": r["id"]}, headers=headers("alice")
    )
    assert res.status_code == 200
    assert client.get(f"{API}/threads/{t['id']}/replies").json()["items"][0]["is_accepted"]
    notes = client.get(f"{API}/me/notifications", headers=headers("bruce")).json()
    assert notes["items"][0]["kind"] == "answer_accepted"
    assert notes["items"][0]["reply_id"] == r["id"]
    assert (
        client.post(
            f"{API}/me/notifications/read-all", json={"through": notes["as_of"]}, headers=headers("bruce")
        ).status_code
        == 204
    )
    assert client.get(f"{API}/me/notifications/unread-count", headers=headers("bruce")).json()["count"] == 0


def test_linked_reply_context_preserves_structure_and_hides_deleted_or_blocked_text(client, people, topic):
    t = create_thread(client, topic)
    nodes = [create_reply(client, t, body_markdown="Original ancestor")]
    for number in range(1, 7):
        nodes.append(
            create_reply(
                client, t, body_markdown=f"Context reply {number}", response_to_reply_id=nodes[-1]["id"]
            )
        )
    endpoint = f"{API}/replies/{nodes[-1]['id']}/context"
    context = client.get(endpoint).json()
    assert context["thread_id"] == t["id"]
    assert [r["id"] for r in context["replies"]] == [n["id"] for n in nodes[:4]] + [nodes[-1]["id"]]
    assert context["replies"][-1]["response_to"]["reply_id"] == nodes[-2]["id"]
    assert client.delete(f"{API}/replies/{nodes[0]['id']}", headers=headers("bruce")).status_code == 204
    context = client.get(endpoint).json()
    assert context["replies"][0]["body_markdown"] is None
    assert context["replies"][-1]["body_markdown"] == "Context reply 6"
    client.put(f"{API}/me/blocks/{people['bruce']['id']}", headers=headers("alice"))
    hidden = client.get(endpoint, headers=headers("alice")).json()
    assert all(row["body_markdown"] is None and row["author"] is None for row in hidden["replies"])
    assert hidden["replies"][-1]["response_to"]["username"] == "[unavailable]"


def test_depth_cap_response_target_and_accepted_validation(client, people, topic):
    t = create_thread(client, topic)
    nodes = [create_reply(client, t)]
    for i in range(1, 7):
        nodes.append(
            create_reply(
                client, t, body_markdown=f"Response number {i}", response_to_reply_id=nodes[-1]["id"]
            )
        )
    assert [r["depth"] for r in nodes] == [1, 2, 3, 4, 5, 5, 5]
    assert nodes[5]["parent_reply_id"] == nodes[3]["id"]
    assert nodes[5]["response_to_reply_id"] == nodes[4]["id"]
    assert nodes[6]["response_to"]["reply_id"] == nodes[5]["id"]
    assert (
        client.put(
            f"{API}/threads/{t['id']}/accepted-answer",
            json={"reply_id": nodes[1]["id"]},
            headers=headers("alice"),
        ).status_code
        == 422
    )
    assert (
        client.put(
            f"{API}/threads/{t['id']}/accepted-answer",
            json={"reply_id": nodes[0]["id"]},
            headers=headers("bruce"),
        ).status_code
        == 403
    )
    other = create_thread(client, topic, title="A different question")
    assert (
        client.post(
            f"{API}/threads/{other['id']}/replies",
            json={"body_markdown": "Cross thread", "response_to_reply_id": nodes[0]["id"]},
            headers=headers("alice"),
        ).status_code
        == 422
    )
    with Session() as db:
        db.add(
            m.Reply(
                thread_id=other["id"],
                author_id=people["alice"]["id"],
                depth=2,
                parent_reply_id=nodes[0]["id"],
                response_to_reply_id=nodes[0]["id"],
                body_markdown="Invalid",
            )
        )
        with pytest.raises(IntegrityError):
            db.commit()


def test_pending_private_idempotency_and_cancellation(client, people, topic):
    settings().moderation_mode = "pending"
    body = {
        "type": "question",
        "topic_id": topic,
        "title": "Private new question",
        "body_markdown": "My pending draft",
    }
    h = headers("alice")
    first = client.post(f"{API}/threads", json=body, headers=h)
    assert first.status_code == 202, first.text
    sid = first.json()["submission"]["id"]
    assert first.json()["content"] is None and first.json()["submission"]["content_id"] is None
    assert client.post(f"{API}/threads", json=body, headers=h).json()["submission"]["id"] == sid
    assert client.post(f"{API}/threads", json=body | {"title": "Changed"}, headers=h).status_code == 409
    assert client.post(f"{API}/threads", json=body, headers=headers("alice")).status_code == 409
    assert not client.get(f"{API}/threads").json()["items"]
    assert client.get(f"{API}/me/submissions/{sid}", headers=headers("bruce")).status_code == 404
    assert (
        client.get(f"{API}/me/submissions/{sid}", headers=headers("alice")).json()["snapshot"]["title"]
        == body["title"]
    )
    assert client.delete(f"{API}/me/submissions/{sid}", headers=headers("alice")).status_code == 204
    settings().moderation_mode = "fixture"
    mod.process(sid, force=True)
    with Session() as db:
        assert db.get(m.Submission, sid).status == "cancelled"
        assert db.scalar(select(func.count()).select_from(m.Thread)) == 0


def test_last_approved_edit_stale_revision_delete_and_search(client, people, topic):
    t = create_thread(client, topic, title="Calculus office hours")
    r = create_reply(client, t)
    settings().moderation_mode = "pending"
    data = {
        "base_revision": 1,
        "topic_id": topic,
        "title": "Updated calculus",
        "body_markdown": "New version",
    }
    res = client.patch(f"{API}/threads/{t['id']}", json=data, headers=headers("alice"))
    assert res.status_code == 202, res.text
    sid = res.json()["submission"]["id"]
    assert client.get(f"{API}/threads/{t['id']}").json()["title"] == t["title"]
    assert (
        client.patch(
            f"{API}/threads/{t['id']}", json=data | {"base_revision": 42}, headers=headers("alice")
        ).status_code
        == 409
    )
    assert client.delete(f"{API}/threads/{t['id']}", headers=headers("bruce")).status_code == 403
    assert client.delete(f"{API}/threads/{t['id']}", headers=headers("alice")).status_code == 204
    settings().moderation_mode = "fixture"
    mod.process(sid, force=True)
    shell = client.get(f"{API}/threads/{t['id']}").json()
    assert shell["body_markdown"] is None and shell["author"] is None and shell["score"] is None
    assert not client.get(f"{API}/threads?q=calculus").json()["items"]
    assert (
        client.get(f"{API}/threads/{t['id']}/replies").json()["items"][0]["body_markdown"]
        == r["body_markdown"]
    )
    edited = client.patch(
        f"{API}/replies/{r['id']}",
        json={"base_revision": 1, "body_markdown": "Own edit survives thread deletion"},
        headers=headers("bruce"),
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["content"]["published_at"] == r["published_at"]


def test_blocks_filter_reads_prevent_interactions_and_late_publish(client, people, topic):
    t = create_thread(client, topic)
    client.put(f"{API}/threads/{t['id']}/save", headers=headers("bruce"))
    settings().moderation_mode = "pending"
    res = client.post(
        f"{API}/threads/{t['id']}/replies",
        json={"body_markdown": "Pending reply before block"},
        headers=headers("bruce"),
    )
    sid = res.json()["submission"]["id"]
    assert client.put(f"{API}/me/blocks/{people['alice']['id']}", headers=headers("bruce")).status_code == 204
    assert not client.get(f"{API}/threads", headers=headers("bruce")).json()["items"]
    saved = client.get(f"{API}/me/saved", headers=headers("bruce")).json()["items"][0]
    assert saved["state"] == "blocked" and saved["author"] is None
    settings().moderation_mode = "fixture"
    mod.process(sid, force=True)
    assert client.get(f"{API}/me/submissions/{sid}", headers=headers("bruce")).json()["status"] == "cancelled"
    assert (
        client.put(f"{API}/threads/{t['id']}/vote", json={"value": 1}, headers=headers("bruce")).status_code
        == 403
    )
    # Blocking is directional for reading, symmetric for interaction.
    assert client.get(f"{API}/threads", headers=headers("alice")).json()["items"]


def test_admin_authorization_audit_idempotency_restore_and_suspension(client, people, topic):
    t = create_thread(client, topic)
    r = create_reply(client, t)
    client.put(
        f"{API}/threads/{t['id']}/accepted-answer", json={"reply_id": r["id"]}, headers=headers("alice")
    )
    path = f"{API}/admin/replies/{r['id']}/remove"
    assert client.post(path, json={"reason": "Review"}, headers=headers("alice")).status_code == 403
    h = headers("admin")
    for _ in range(2):
        assert client.post(path, json={"reason": "Privacy review"}, headers=h).status_code == 204
    assert client.get(f"{API}/threads/{t['id']}").json()["accepted_reply_id"] is None
    assert client.get(f"{API}/threads/{t['id']}/replies").json()["items"][0]["body_markdown"] is None
    assert client.post(path, json={"reason": "Different"}, headers=h).status_code == 409
    assert (
        client.post(
            f"{API}/admin/replies/{r['id']}/restore",
            json={"reason": "Safe to restore"},
            headers=headers("admin"),
        ).status_code
        == 204
    )
    assert client.get(f"{API}/threads/{t['id']}").json()["accepted_reply_id"] is None
    audit = client.get(f"{API}/admin/actions", headers=headers("admin")).json()["items"]
    assert len(audit) == 2
    assert (
        client.post(
            f"{API}/admin/users/{people['admin']['id']}/suspend",
            json={"reason": "Test"},
            headers=headers("admin"),
        ).status_code
        == 409
    )
    assert (
        client.post(
            f"{API}/admin/users/{people['alice']['id']}/suspend",
            json={"reason": "Test"},
            headers=headers("admin"),
        ).status_code
        == 204
    )
    assert (
        client.post(
            f"{API}/threads/{t['id']}/replies",
            json={"body_markdown": "Cannot publish"},
            headers=headers("alice"),
        ).status_code
        == 403
    )


def test_admin_pending_shared_apply_and_replay(client, people, topic):
    settings().moderation_mode = "pending"
    res = client.post(
        f"{API}/threads",
        json={
            "type": "question",
            "topic_id": topic,
            "title": "Manual review",
            "body_markdown": "Please review",
        },
        headers=headers("alice"),
    )
    sid = res.json()["submission"]["id"]
    h = headers("admin")
    path = f"{API}/admin/submissions/{sid}/decision"
    result = client.post(path, json={"decision": "approve", "reason": "Reviewed safe text"}, headers=h)
    assert result.status_code == 200, result.text
    assert result.json()["status"] == "published"
    assert (
        client.post(path, json={"decision": "approve", "reason": "Reviewed safe text"}, headers=h).json()
        == result.json()
    )
    with Session() as db:
        assert db.scalar(select(func.count()).select_from(m.Thread)) == 1
    mod.process(sid, force=True)
    assert len(client.get(f"{API}/threads").json()["items"]) == 1


def test_reports_retention_deactivation_and_safe_projection(client, people, topic):
    t = create_thread(client, topic)
    r = create_reply(client, t)
    report = {"thread_id": t["id"], "reason": "personal information", "detail": "Sensitive example"}
    assert client.post(f"{API}/reports", json=report, headers=headers("bruce")).status_code == 201
    assert client.post(f"{API}/reports", json=report, headers=headers("bruce")).status_code == 409
    assert (
        client.post(
            f"{API}/reports", json=report | {"reply_id": r["id"]}, headers=headers("bruce")
        ).status_code
        == 422
    )
    assert client.get(f"{API}/admin/reports", headers=headers("bruce")).status_code == 403
    assert (
        client.request(
            "DELETE", f"{API}/me", json={"confirm_username": "alice"}, headers=headers("alice")
        ).status_code
        == 204
    )
    assert client.get(f"{API}/users/alice").status_code == 404
    assert client.get(f"{API}/threads/{t['id']}").json()["author"]["username"] == "[deleted]"
    with Session() as db:
        row = db.get(m.Thread, t["id"])
        row.state, row.updated_at = "removed", m.now() - timedelta(days=8)
        db.commit()
    cleanup()
    with Session() as db:
        assert db.get(m.Thread, t["id"]).body_markdown is None
        assert db.scalar(select(func.count()).select_from(m.Erasure)) >= 2


def test_parallel_username_and_vote_uniqueness(client, people, topic):
    def onboard(name):
        return client.post(f"{API}/me", json={"username": "same_name"}, headers=headers(name)).status_code

    with ThreadPoolExecutor(2) as pool:
        assert sorted(pool.map(onboard, ["one", "two"])) == [201, 409]
    t = create_thread(client, topic)

    def vote(_):
        return client.put(
            f"{API}/threads/{t['id']}/vote", json={"value": 1}, headers=headers("bruce")
        ).status_code

    with ThreadPoolExecutor(4) as pool:
        assert list(pool.map(vote, range(4))) == [200] * 4
    assert client.get(f"{API}/threads/{t['id']}").json()["score"] == 1


@pytest.mark.parametrize(
    "path",
    ["/threads?offset=-1", "/threads?limit=100", "/threads?q=test&sort=latest", "/threads?sort=relevance"],
)
def test_pagination_and_sort_validation(client, path):
    assert client.get(API + path).status_code == 422


def test_unicode_validation_mass_assignment_and_rejection(client, people, topic):
    body = {
        "type": "question",
        "topic_id": topic,
        "title": "🦉a" * 100,
        "body_markdown": "Emoji title counts code points",
    }
    assert client.post(f"{API}/threads", json=body, headers=headers("alice")).status_code == 201
    assert (
        client.post(f"{API}/threads", json=body | {"title": "🦉" * 201}, headers=headers("alice")).status_code
        == 422
    )
    assert (
        client.post(
            f"{API}/threads", json=body | {"author_id": people["bruce"]["id"]}, headers=headers("alice")
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"{API}/threads", json=body | {"body_markdown": "   "}, headers=headers("alice")
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"{API}/threads",
            json=body | {"body_markdown": "Repeated spam " + "x" * 102},
            headers=headers("alice"),
        ).json()["error"]["code"]
        == "policy_rejected"
    )
    assert client.post(f"{API}/threads", content="x" * 140000, headers=headers("alice")).status_code == 413


def test_ai_failure_budget_uncertainty_and_stale_result(client, people, topic, monkeypatch):
    settings().moderation_mode = "google"
    settings().ai_api_key = "synthetic-test-key"
    settings().ai_model = "synthetic-fixture"
    settings().ai_input_usd_per_million = 1
    settings().ai_output_usd_per_million = 2
    monkeypatch.setattr(mod, "google_decision", lambda data: (_ for _ in ()).throw(TimeoutError()))
    body = {
        "type": "discussion",
        "topic_id": topic,
        "title": "Provider outage",
        "body_markdown": "Please keep this private while retrying",
    }
    res = client.post(f"{API}/threads", json=body, headers=headers("alice"))
    assert res.status_code == 202, res.text
    sid = res.json()["submission"]["id"]
    with Session() as db:
        assert db.get(m.Submission, sid).ai_attempt_count == 1
        assert db.get(m.Submission, sid).error_category == "provider_unavailable"
    monkeypatch.setattr(mod, "google_decision", lambda data: ("uncertain", "ambiguous", 200, 20))
    mod.process(sid, force=True)
    assert client.get(f"{API}/me/submissions/{sid}", headers=headers("alice")).json()["status"] == "published"
    settings().ai_monthly_budget_usd = 0
    res = client.post(f"{API}/threads", json=body | {"title": "Budget capped"}, headers=headers("alice"))
    assert res.status_code == 202
    assert res.json()["submission"]["error_category"] == "capacity_or_budget"
    settings().ai_monthly_budget_usd = 2


def test_late_provider_result_cannot_resurrect_deleted_edit(client, people, topic, monkeypatch):
    from threading import Event

    t = create_thread(client, topic)
    settings().moderation_mode = "pending"
    res = client.patch(
        f"{API}/threads/{t['id']}",
        json={
            "base_revision": 1,
            "topic_id": topic,
            "title": "Late edit",
            "body_markdown": "Never resurrect",
        },
        headers=headers("alice"),
    )
    sid = res.json()["submission"]["id"]
    cfg = settings()
    cfg.moderation_mode, cfg.ai_api_key, cfg.ai_model = "google", "synthetic", "synthetic"
    cfg.ai_input_usd_per_million, cfg.ai_output_usd_per_million = 1, 2
    entered, release = Event(), Event()

    def delayed(_):
        entered.set()
        assert release.wait(10)
        return "allow", "safe", 100, 10

    monkeypatch.setattr(mod, "google_decision", delayed)
    with ThreadPoolExecutor(1) as pool:
        future = pool.submit(mod.process, sid, True)
        assert entered.wait(10)
        assert client.delete(f"{API}/threads/{t['id']}", headers=headers("alice")).status_code == 204
        release.set()
        future.result(timeout=10)
    with Session() as db:
        assert db.get(m.Thread, t["id"]).body_markdown is None
        assert db.get(m.Submission, sid).status == "cancelled"
