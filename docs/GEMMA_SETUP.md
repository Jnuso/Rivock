# Google AI Studio Gemma 4 setup

## Current product decision

On October 16 the user withdrew the proposed cloud activation and temporarily removed Gemma reviews. Current `MODERATION_MODE=off` publishes validated posts/replies/profile edits immediately, preserves reports/manual admin actions, and makes no provider calls. Local API/worker settings are off with the AI pause override enabled; private keys were preserved without printing or exporting them. The cloud has never received an AI key; its off-mode image rollout is recorded in PREVIEW_DEPLOYMENT.md. Do not apply the old activation procedure below. Future AI assistance after reports needs a separate [policy/design](REPORT_MODERATION.md).

The user separately permits Google Gemma coding workers in this chat, at most two requests per minute. That does not authorize application-content reviews.

## Historical provider setup

The user selected **Gemma 4 from Google AI Studio** on October 14, 2026. Model: `gemma-4-26b-a4b-it`, documented in Google's [Gemma API guide](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api). Authenticated model metadata confirmed access, `generateContent` support and input/output limits of 262,144/32,768 tokens. A real request with system instructions, JSON MIME type and response schema succeeded with HTTP 200 and a complete `STOP` response. The initial fictional request took about 0.94 seconds; this single observation is not a latency benchmark.

The model is set in the ignored root/backend `.env` files. The user added the API key to the ignored root file; its value was not printed or copied to the frontend/coding-worker snapshots. Native backend configuration still has no key and remains pending. Following explicit user approval, the local Compose API and moderation worker now use Google/free mode. No existing submissions were queued at activation; the completed evaluation used only synthetic content.

The isolated evaluation passed all eight limited cases: five benign examples allowed by Gemma, three spam vectors rejected by rules, no deferrals. Including the initial smoke, six model attempts recorded zero reserved/actual cost and no unknown cost. See the reviewed [sanitized report](gemma-evaluation.json) and [coverage limits](MODERATION_EVALUATION.md). The backend suite passes 153 tests in Docker with PostgreSQL; 96 unit tests also passed natively. Ruff, Compose validation and Bicep compilation passed.

## Historical local activation, superseded

The owner’s hosted account `jack` has a verified audited admin grant. The cloud originally used pending mode without an AI key or scheduled worker, with one ordinary queued submission. The proposed Google-specific activation was withdrawn in favor of immediate publication. Its prepared privacy text was replaced with an honest reviews-off/reporting notice before image publication.

The earlier free-model/cap/worker activation proposal is inactive. Preserve the existing provider adapter tests/cost controls for later design, but do not transfer the key or enable a Google worker during this reviews-off phase.

Automatic approval review initially rejected the persistent switch because authorization covered isolated fictional evaluation rather than future user-content transfer. The user subsequently answered **yes** to enabling Gemma for new local post/reply/profile text. That explicit authorization resolved the block on October 14. A fresh check found zero pending/processing submissions and no operator pause before activation.

The approved change is active in local development: `MODERATION_MODE=google`, `AI_BILLING_MODE=free`, both token prices zero, daily cap 100, monthly ceiling $2 for any future paid configuration, pause false, input bound 16,000 and output bound 256. API/worker images were rebuilt and both services restarted. Both containers verified these settings and key presence without printing credentials. API/database are healthy, frontend/worker running, frontend/readiness HTTP checks pass, and `/api/v1/info` reports fixture moderation false. New/edited threads, replies and profile bios now pass through the configured Google moderation service. Use fictional text for testing; public deployment/data suitability remain separate.

## Required local setup

The user completed this step. For a replacement key, open the repository root `.env` file, find `AI_API_KEY=`, and enter the key from your [Google AI Studio](https://aistudio.google.com/) project after the equals sign. Keep the key in this ignored local file; it is a server credential, unlike Clerk's public key. Preserve the moderation mode and other settings unless activation is explicitly authorized.

Only the root file needs the key for the current Docker setup. No frontend `VITE_*` variable should contain it. Native backend configuration can be synchronized when needed. No paid billing upgrade or fallback model is selected by this setup.

## Free tier and data suitability

Google's [pricing page](https://ai.google.dev/gemini-api/docs/pricing) lists Gemma 4 input/output as free on the free tier. Actual access and quotas depend on the project; Google directs users to AI Studio for [current rate limits](https://ai.google.dev/gemini-api/docs/rate-limits). Do not assume an advertised limit guarantees capacity.

Google's [unpaid-service terms](https://ai.google.dev/gemini-api/terms) restrict sensitive, confidential and personal information and describe use of submitted data for product improvement. Use original fictional evaluation text for this initial setup. A public advice app needs a separate data-suitability review before real user content is sent to this service.

`AI_BILLING_MODE=free` is now an explicit opt-in restricted to this verified model with both token prices exactly zero. Metered mode remains the default and requires positive finite prices. Free attempts cost zero even when usage is missing or a call fails, but still count toward daily limits and obey one-call concurrency, pauses, leases, input bounds and retry limits. Invalid model/prices defer to review. Paid calls retain conservative reservations when usage is unknown. The $2 monthly ceiling remains for any future paid configuration.

## Next implementation and verification

1. The first post-activation browser-created question is verified: one `ai` attempt using `gemma-4-26b-a4b-it`, decision `allow`, reason `benign_test_query`, published, about 0.99 seconds, 172 input/19 output tokens and zero recorded cost. My submissions now labels completed AI/rules/demo/moderator checks and their decisions; detail includes the Gemma name and completion time. Owner-only metadata, failure/uncertainty and moderator-override behavior are tested.
2. Complete broader policy evaluation before claiming effective public moderation. The five benign model decisions and three rule decisions do not measure threat/harassment/hate/privacy/scam detection.
3. Review data suitability before real user content or public deployment; current unpaid-service terms remain relevant even though the integration works.

The separate Compose `evaluate` service defaults to offline/pending and a deliberately unconfigured database. Live evaluation requires an explicit migrated disposable database ending in `_test`, Google mode and verified billing configuration; `--limit 1` bounds a smoke test. The automated `test` service explicitly removes the real AI key and uses metered/unconfigured pricing. No paid fallback was added.

Documentation sources were researched through Firecrawl search excerpts. Authenticated metadata and the synthetic evaluation provide the separate real-provider evidence above; no full-page retrieval or broad moderation-quality claim is implied.
