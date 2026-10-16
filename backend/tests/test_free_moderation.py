from concurrent.futures import ThreadPoolExecutor
from threading import Event

import httpx
import pytest
from sqlalchemy import select

from app import models as m, moderation as mod
from app.config import settings
from app.db import Session
from app.evaluate import evaluate
from .conftest import headers


def configure_free():
    cfg = settings()
    cfg.moderation_mode, cfg.ai_model, cfg.ai_api_key = ("google", "gemma-4-26b-a4b-it", "synthetic-test-key")
    cfg.ai_billing_mode = "free"
    cfg.ai_input_usd_per_million = cfg.ai_output_usd_per_million = 0
    cfg.ai_monthly_budget_usd = 0
    return cfg


def submit(client, topic, title):
    return client.post(
        "/api/v1/threads",
        json={
            "type": "question",
            "topic_id": topic,
            "title": title,
            "body_markdown": "What is a useful way to prepare for office hours?",
        },
        headers=headers("alice"),
    )


def test_free_calls_still_honor_daily_cap_and_both_pause_controls(client, people, topic, monkeypatch):
    cfg = configure_free()
    cfg.ai_daily_call_cap = 1
    calls = []

    def decide(data):
        calls.append(data)
        return "allow", "policy", 0, 0

    monkeypatch.setattr(mod, "google_decision", decide)
    assert submit(client, topic, "Free question").status_code == 201
    capped = submit(client, topic, "Daily cap")
    assert capped.json()["submission"]["error_category"] == "capacity_or_budget"
    cfg.ai_daily_call_cap = 100
    cfg.ai_paused = True
    paused = submit(client, topic, "Environment pause")
    assert paused.json()["submission"]["error_category"] == "moderation_unavailable"
    cfg.ai_paused = False
    with Session() as db:
        db.add(m.RuntimeControl(key="ai_paused", value=True))
        db.commit()
    paused = submit(client, topic, "Operator pause")
    assert paused.json()["submission"]["error_category"] == "moderation_unavailable"
    assert len(calls) == 1
    with Session() as db:
        attempt = db.scalar(select(m.Attempt).where(m.Attempt.source == "ai"))
        assert attempt.reserved_cost_microusd == attempt.actual_cost_microusd == 0


def test_failed_free_call_costs_zero_but_still_consumes_daily_allowance(client, people, topic, monkeypatch):
    cfg = configure_free()
    cfg.ai_daily_call_cap = 1
    calls = []

    def failure(data):
        calls.append(data)
        raise TimeoutError()

    monkeypatch.setattr(mod, "google_decision", failure)
    result = submit(client, topic, "Failure stays pending")
    assert result.status_code == 202
    sid = result.json()["submission"]["id"]
    mod.process(sid, force=True)
    assert len(calls) == 1
    with Session() as db:
        row = db.get(m.Submission, sid)
        attempt = db.scalar(select(m.Attempt).where(m.Attempt.submission_id == sid))
        assert row.status == "pending" and row.ai_attempt_count == 1
        assert row.error_category == "capacity_or_budget"
        assert attempt.decision is None
        assert attempt.reserved_cost_microusd == attempt.actual_cost_microusd == 0


@pytest.mark.parametrize("invalid", ["wrong_model", "nonzero_price", "nan_price", "too_long"])
def test_unverified_free_configuration_or_input_never_calls_provider(
    client, people, topic, monkeypatch, invalid
):
    cfg = configure_free()
    if invalid == "wrong_model":
        cfg.ai_model = "unverified-model"
    elif invalid == "nonzero_price":
        cfg.ai_input_usd_per_million = 1
    elif invalid == "nan_price":
        cfg.ai_output_usd_per_million = float("nan")
    else:
        cfg.ai_max_input_tokens = 1

    def unexpected(_):
        pytest.fail("Unverified configuration must not reach a model")

    monkeypatch.setattr(mod, "google_decision", unexpected)
    result = submit(client, topic, "Unverified free configuration")
    assert result.status_code == 202
    assert result.json()["submission"]["status"] == "needs_review"


def test_free_mode_keeps_one_in_flight_provider_call(client, people, topic, monkeypatch):
    configure_free()
    entered, release = Event(), Event()

    def delayed(_):
        entered.set()
        assert release.wait(10)
        return "allow", "policy", 100, 12

    monkeypatch.setattr(mod, "google_decision", delayed)
    with ThreadPoolExecutor(1) as pool:
        future = pool.submit(submit, client, topic, "First in flight")
        try:
            assert entered.wait(5)
            second = submit(client, topic, "Second waits")
            assert second.status_code == 202
            assert second.json()["submission"]["error_category"] == "capacity_or_budget"
        finally:
            release.set()
        assert future.result(timeout=10).status_code == 201


def test_truncated_json_cannot_publish_a_free_submission(client, people, topic, monkeypatch):
    configure_free()
    monkeypatch.setattr(
        mod.httpx,
        "post",
        lambda url, **kw: httpx.Response(
            200,
            request=httpx.Request("POST", url),
            json={
                "candidates": [
                    {
                        "finishReason": "MAX_TOKENS",
                        "content": {"parts": [{"text": '{"decision":"allow","reason_code":"policy"}'}]},
                    }
                ]
            },
        ),
    )
    result = submit(client, topic, "Incomplete result")
    assert result.status_code == 202
    assert result.json()["submission"]["status"] == "pending"
    assert result.json()["submission"]["error_category"] == "provider_unavailable"


def test_free_evaluation_limit_uses_normal_accounting(monkeypatch):
    configure_free()
    monkeypatch.setattr(mod, "google_decision", lambda _: ("allow", "policy", 80, 10))
    report = evaluate(live=True, limit=1)
    assert report["summary"]["total"] == 1
    assert report["provider_attempts"] == 1
    assert report["billing_mode"] == "free"
    assert report["summary"]["live_model_evaluated"]


@pytest.mark.parametrize("limit", [0, -1, 9, True])
def test_evaluation_refuses_invalid_limits(limit):
    with pytest.raises(RuntimeError, match="limit"):
        evaluate(limit=limit)
