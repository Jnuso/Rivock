"""Explicit model pricing for both reservations and completed attempts."""

import math

FREE_MODELS = frozenset({"gemma-4-26b-a4b-it"})
MAX_COST_MICROUSD = 2_147_483_647


def pricing_ready(cfg):
    prices = (cfg.ai_input_usd_per_million, cfg.ai_output_usd_per_million)
    if any(type(price) not in (int, float) or not math.isfinite(price) or price < 0 for price in prices):
        return False
    if cfg.ai_billing_mode == "free":
        return cfg.ai_model in FREE_MODELS and all(price == 0 for price in prices)
    return cfg.ai_billing_mode == "metered" and all(price > 0 for price in prices)


def cost_microusd(cfg, inputs, outputs, *, usage_known=True):
    """None means unverified; a free model is exactly zero even with missing usage."""
    if not pricing_ready(cfg):
        return None
    if any(type(count) is not int or count < 0 for count in (inputs, outputs)):
        return None
    if cfg.ai_billing_mode == "free":
        return 0
    if not usage_known:
        return None
    cost = inputs * cfg.ai_input_usd_per_million + outputs * cfg.ai_output_usd_per_million
    if not math.isfinite(cost) or cost > MAX_COST_MICROUSD:
        return None
    return math.ceil(cost)
