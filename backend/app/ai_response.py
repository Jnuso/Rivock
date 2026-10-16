"""Validate the provider's final moderation result without exposing its raw text."""

import json
import re


def _unique_object(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError("malformed_result")
        value[key] = item
    return value


def _token_count(usage, field):
    value = usage.get(field, 0)
    if type(value) is not int or not 0 <= value <= 2_147_483_647:
        raise ValueError("malformed_usage")
    return value


def parse_google_response(payload):
    """Only a complete, unblocked final answer can produce a moderation decision."""
    if not isinstance(payload, dict):
        raise ValueError("malformed_result")
    feedback = payload.get("promptFeedback", {})
    if not isinstance(feedback, dict) or feedback.get("blockReason"):
        raise ValueError("provider_refusal")
    candidates = payload.get("candidates")
    if not isinstance(candidates, list) or len(candidates) != 1:
        raise ValueError("malformed_result")
    candidate = candidates[0]
    if not isinstance(candidate, dict) or candidate.get("finishReason") != "STOP":
        raise ValueError("incomplete_result")
    content = candidate.get("content")
    parts = content.get("parts") if isinstance(content, dict) else None
    if not isinstance(parts, list) or not 1 <= len(parts) <= 32:
        raise ValueError("malformed_result")
    texts = []
    for part in parts:
        if not isinstance(part, dict):
            raise ValueError("malformed_result")
        if "thought" in part and type(part["thought"]) is not bool:
            raise ValueError("malformed_result")
        if any(key in part for key in ("functionCall", "inlineData", "executableCode")):
            raise ValueError("malformed_result")
        if part.get("thought") is True:
            continue
        if not isinstance(part.get("text"), str):
            raise ValueError("malformed_result")
        texts.append(part["text"])
    final = "".join(texts)
    if not final or len(final) > 4096:
        raise ValueError("malformed_result")
    try:
        value = json.loads(final, object_pairs_hook=_unique_object)
    except (ValueError, TypeError, RecursionError):
        raise ValueError("malformed_result") from None
    if (
        not isinstance(value, dict)
        or set(value) != {"decision", "reason_code"}
        or value["decision"] not in ("allow", "reject", "uncertain")
        or not isinstance(value["reason_code"], str)
        or not re.fullmatch(r"[a-z][a-z0-9_]{0,79}", value["reason_code"])
    ):
        raise ValueError("malformed_result")
    usage = payload.get("usageMetadata", {})
    if not isinstance(usage, dict):
        raise ValueError("malformed_usage")
    outputs = _token_count(usage, "candidatesTokenCount") + _token_count(usage, "thoughtsTokenCount")
    if outputs > 2_147_483_647:
        raise ValueError("malformed_usage")
    return (
        value["decision"],
        value["reason_code"],
        _token_count(usage, "promptTokenCount"),
        outputs,
    )
