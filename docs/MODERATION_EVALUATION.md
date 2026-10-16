# Limited moderation evaluation

An isolated Gemma 4 evaluation completed on October 14, 2026. The user subsequently approved sending future local post/reply/profile text to Google, and the API/worker are now running Google/free moderation with verified settings/health. A subsequent browser-created question is confirmed AI-approved and published in the moderation records. The original/synthetic pack is small; quality beyond it remains unmeasured and this is not a launch-quality moderation result.

## Limited live result

The reviewed [Gemma report](gemma-evaluation.json) records `gemma-4-26b-a4b-it` in explicit free mode: five benign examples allowed by the actual model, three spam vectors rejected by deterministic rules, zero false rejections or deferrals. The full run made five model calls; including the preceding one-case smoke, the isolated database recorded six calls with zero reserved/actual cost and no unknown cost. No real app posts or personal information were submitted.

The schema/system-instruction request succeeded. Parsing now requires one unblocked candidate with `finishReason=STOP`, combines final text fragments while ignoring marked thoughts, rejects duplicate/missing/extra JSON fields and invalid reason/usage values, and leaves refusal/truncation/malformed output pending. Free-model cap/pause/concurrency/failure tests passed within the 153-test backend suite. These mechanical checks do not establish safety quality for the missing policy categories below.

## Current offline result

Run from `backend`:

```powershell
.venv/Scripts/python.exe -m app.evaluate --output ../docs/moderation-evaluation.json
```

This requires no model key and performs no provider call. The five benign examples in `evaluation/benign-v1.json` were drafted by Cursor and reviewed locally; the runner adds three synthetic spam vectors using repetitive ASCII, repetitive Unicode and nine `example.invalid` links. These are original examples with no Reddit content or real personal information.

| Cases | Result |
| --- | --- |
| 5 benign examples: everyday advice, nontargeted profanity, criticism, support and discussion of prompt injection | All deferred to the model; none rejected by rules |
| 3 synthetic spam patterns | All rejected by rules |

The [recorded report](moderation-evaluation.json) contains the pack hash, IDs, expected outcomes, decisions/reasons and coverage gaps. It omits input text, credentials and provider responses. Deferred benign examples are not approved publications. This tiny constructed pack cannot estimate false-positive or missed-violation rates in real traffic.

Coverage still needed: threats, targeted harassment, hate, privacy violations, scams, quoted harmful language, multilingual context and harder benign/spam boundary cases. Automatic approval review blocked writing the broader synthetic dataset and provided only “blocked by policy” as its reason. The limited benign/spam pack was completed as a safer alternative; the rejected write was not retried through another route.

## Guarded live runner

The configured Gemma 4 model's `generateContent`/schema compatibility and metadata limits are now verified. For another model/project or later pricing changes, verify compatibility, limits, prices and terms again. No paid fallback or alternate model is selected automatically.

Live evaluation is opt-in and can incur charges. It refuses any environment other than `ENVIRONMENT=test` and any database name not ending in `_test`. Use a **new disposable test database**, apply migrations, and leave its synthetic publications private. Do not use the valuable local-development or production database. Keys remain in ignored environment configuration, never command history or the output report.

After those prerequisites are satisfied, the command is:

```powershell
# DATABASE_URL must already select the migrated disposable database ending in _test.
# ENVIRONMENT=test, MODERATION_MODE=google and verified AI_MODEL/AI_API_KEY are required.
# Use explicit AI_BILLING_MODE=free with the verified Gemma model and zero prices,
# or metered mode with verified positive finite input/output prices.
.venv/Scripts/python.exe -m app.evaluate --live --output <private-report-path>
```

The runner creates a labeled synthetic account and submissions in that database and calls the **normal moderation service**. Monthly reservations, daily caps, one-call concurrency and pause apply. Use `--limit 1` for a bounded initial smoke; the report includes provider attempts, model and billing mode. Free failures still consume daily allowance, while metered unknown usage retains its reservation. Budget/pause can leave cases deferred; a completed command does not establish that every case reached the model.

The separate Compose `evaluate` service defaults to offline and refuses live operation until an explicitly migrated disposable `_test` database, Google mode and valid pricing are supplied. The normal Compose `test` service strips the actual AI key so automated tests cannot inherit it. See [Gemma setup](GEMMA_SETUP.md) for activation status and data terms.

Keep real evaluation reports private until reviewed. Compare case-level decisions, actual provider attempts and usage; investigate false rejections and violations that would publish (including `uncertain`). Expand policy coverage before enabling public AI moderation. Pending moderation and explicit admin review remain available while provider setup or quality evaluation is incomplete.
