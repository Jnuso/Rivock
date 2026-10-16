import json

import pytest

from app.ai_response import parse_google_response


def response(text=None, finish="STOP"):
    return {
        "candidates": [
            {
                "finishReason": finish,
                "content": {"parts": [{"text": text or '{"decision":"allow","reason_code":"policy"}'}]},
            }
        ]
    }


def test_uses_final_text_not_private_thought_and_counts_all_generated_tokens():
    payload = response()
    payload["candidates"][0]["content"]["parts"] = [
        {"thought": True, "text": '{"decision":"reject","reason_code":"thought_only"}'},
        {"text": '{"decision":"allow",'},
        {"text": '"reason_code":"policy"}'},
    ]
    payload["usageMetadata"] = {
        "promptTokenCount": 100,
        "candidatesTokenCount": 12,
        "thoughtsTokenCount": 5,
    }
    assert parse_google_response(payload) == ("allow", "policy", 100, 17)


@pytest.mark.parametrize("decision", ["allow", "reject", "uncertain"])
def test_accepts_each_complete_policy_decision_without_inventing_usage(decision):
    payload = response(json.dumps({"decision": decision, "reason_code": "policy"}))
    assert parse_google_response(payload) == (decision, "policy", 0, 0)


@pytest.mark.parametrize("finish", [None, "MAX_TOKENS", "SAFETY", "RECITATION", "OTHER"])
def test_even_valid_json_is_not_approval_after_interruption_or_refusal(finish):
    with pytest.raises(ValueError):
        parse_google_response(response(finish=finish))


@pytest.mark.parametrize(
    "text",
    [
        "not JSON",
        "[]",
        "null",
        '{"decision":"allow"}',
        '{"decision":"unknown","reason_code":"policy"}',
        '{"decision":"allow","reason_code":null}',
        '{"decision":"allow","reason_code":"free text from user"}',
        '{"decision":"allow","reason_code":"policy","extra":"ignored?"}',
        '{"decision":"reject","decision":"allow","reason_code":"policy"}',
        '```json\n{"decision":"allow","reason_code":"policy"}\n```',
        '{"decision":"allow","reason_code":"' + "a" * 81 + '"}',
    ],
)
def test_rejects_ambiguous_or_malformed_decisions(text):
    with pytest.raises(ValueError):
        parse_google_response(response(text))


def test_prompt_refusal_with_apparently_valid_candidate_is_not_approval():
    payload = response()
    payload["promptFeedback"] = {"blockReason": "SAFETY"}
    with pytest.raises(ValueError):
        parse_google_response(payload)


@pytest.mark.parametrize("parts", [[], None, [{"functionCall": {"name": "unexpected"}}], [None]])
def test_missing_or_non_text_final_answer_is_not_approval(parts):
    payload = response()
    payload["candidates"][0]["content"]["parts"] = parts
    with pytest.raises(ValueError):
        parse_google_response(payload)


@pytest.mark.parametrize("count", [-1, True, 1.5, "12", None, 2**32])
def test_invalid_usage_is_not_treated_as_verified_zero_cost(count):
    payload = response()
    payload["usageMetadata"] = {"promptTokenCount": count}
    with pytest.raises(ValueError):
        parse_google_response(payload)


def test_multiple_candidates_do_not_silently_select_an_approval():
    payload = response()
    payload["candidates"].append(response(finish="SAFETY")["candidates"][0])
    with pytest.raises(ValueError):
        parse_google_response(payload)


def test_combined_output_usage_must_fit_the_database_count():
    payload = response()
    payload["usageMetadata"] = {"candidatesTokenCount": 2_147_483_647, "thoughtsTokenCount": 1}
    with pytest.raises(ValueError):
        parse_google_response(payload)


def test_non_boolean_thought_marker_does_not_become_a_final_answer():
    payload = response()
    payload["candidates"][0]["content"]["parts"][0]["thought"] = "true"
    with pytest.raises(ValueError):
        parse_google_response(payload)
