from types import SimpleNamespace

import pytest

from app.ai_costs import cost_microusd, pricing_ready


def config(**changes):
    return SimpleNamespace(
        **(
            {
                "ai_billing_mode": "metered",
                "ai_model": "gemma-4-26b-a4b-it",
                "ai_input_usd_per_million": 0,
                "ai_output_usd_per_million": 0,
            }
            | changes
        )
    )


def test_zero_prices_need_explicit_free_mode():
    cfg = config()
    assert not pricing_ready(cfg)
    assert cost_microusd(cfg, 100, 256) is None
    cfg.ai_billing_mode = "free"
    assert pricing_ready(cfg)
    assert cost_microusd(cfg, 100, 256) == 0
    assert cost_microusd(cfg, 0, 0, usage_known=False) == 0


def test_metered_reservation_and_missing_usage_remain_conservative():
    cfg = config(ai_input_usd_per_million=0.5, ai_output_usd_per_million=2)
    assert pricing_ready(cfg)
    assert cost_microusd(cfg, 100, 256) == 562
    assert cost_microusd(cfg, 0, 0, usage_known=False) is None


@pytest.mark.parametrize("mode", ["free", "metered"])
@pytest.mark.parametrize("price", [-1, float("nan"), float("inf"), -float("inf")])
def test_invalid_prices_cannot_create_a_reservation(mode, price):
    cfg = config(ai_billing_mode=mode, ai_input_usd_per_million=price)
    assert not pricing_ready(cfg)
    assert cost_microusd(cfg, 100, 256) is None


@pytest.mark.parametrize(
    "changes",
    [
        {"ai_model": "unverified-model"},
        {"ai_model": "gemma-4-31b-it"},
        {"ai_input_usd_per_million": 1},
        {"ai_output_usd_per_million": 1},
    ],
)
def test_free_mode_cannot_bypass_unverified_model_or_contradictory_prices(changes):
    cfg = config(ai_billing_mode="free", **changes)
    assert not pricing_ready(cfg)
    assert cost_microusd(cfg, 100, 256) is None


def test_impossible_metered_cost_cannot_overflow_database_or_crash_reservation():
    cfg = config(ai_input_usd_per_million=1e308, ai_output_usd_per_million=1e308)
    assert cost_microusd(cfg, 16000, 256) is None


@pytest.mark.parametrize("count", [-1, True, 1.5])
def test_invalid_token_counts_are_not_verified_free_usage(count):
    assert cost_microusd(config(ai_billing_mode="free"), count, 256) is None
