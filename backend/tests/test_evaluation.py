import pytest
from app.evaluate import evaluate
from app.config import settings
from app import moderation as mod


def test_offline_pack_reports_deferral_without_claiming_ai_quality():
    report = evaluate()
    assert report["summary"] == {
        "total": 8,
        "false_rejections": 0,
        "rejected_violations": 3,
        "published_violations": 0,
        "deferred": 5,
        "live_model_evaluated": False,
    }
    assert report["coverage_gaps"]
    assert all("text" not in row for row in report["cases"])


def test_live_evaluation_refuses_non_test_databases():
    settings().database_url = "postgresql+psycopg://local@localhost/valuable"
    with pytest.raises(RuntimeError, match="disposable"):
        evaluate(live=True)


def test_live_runner_uses_shared_budget_and_pause_controls(monkeypatch):
    cfg = settings()
    cfg.moderation_mode, cfg.ai_model, cfg.ai_api_key = "google", "synthetic-model", "synthetic-test-key"
    cfg.ai_input_usd_per_million = cfg.ai_output_usd_per_million = 1
    cfg.ai_daily_call_cap = 1
    calls = []

    def decide(data):
        calls.append(data)
        return "allow", "safe", 20, 5

    monkeypatch.setattr(mod, "google_decision", decide)
    report = evaluate(live=True)
    assert len(calls) == 1
    assert report["summary"]["live_model_evaluated"]
    assert report["summary"]["deferred"] == 4
    cfg.ai_paused = True
    report = evaluate(live=True)
    assert len(calls) == 1
    assert not report["summary"]["live_model_evaluated"]
