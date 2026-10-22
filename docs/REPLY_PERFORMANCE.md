# Conversation page database work

October 22, 2026. Local-only continuation of [profile history batching](PROFILE_PERFORMANCE.md) on `features/local-conversation-tools`; nothing pushed or deployed.

Measurement showed the same per-item reads in direct-answer lists and expanded follow-ups. Both now use the existing request-local reply batch for only their returned page. Selection/ranking/pagination queries are unchanged; single-reply/context reads retain their existing bounded paths. No migration, API field, dependency or frontend change is required.

## Measured round trips

The disposable PostgreSQL 17.11 fixture has 60 fictional direct answers, one accepted answer, and 60 follow-ups under one answer. Anonymous and synthetic-member requests run through actual FastAPI test-client routes, including identity/read-rate accounting. Every complete response matches its established per-item projection.

| Page / viewer | Before: SQL at 1 / 20 / 50 items | After: SQL at 1 / 20 / 50 items |
| --- | --- | --- |
| Direct answers / anonymous | 7 / 64 / 154 | 8 / 8 / 8 |
| Direct answers / member | 12 / 107 / 257 | 12 / 12 / 12 |
| Follow-ups / anonymous | 9 / 123 / 303 | 8 / 8 / 8 |
| Follow-ups / member | 13 / 165 / 405 | 12 / 12 / 12 |

All three direct-answer orders—Recommended, Newest and Oldest—have the same counts in this fixture and retain accepted-first priority. All eight query regressions failed before this change. Counts describe round trips on this fixture, not a hosted latency/concurrency/capacity measurement.

## Verification

- **365 backend tests pass** together against isolated PostgreSQL 17.11: 343 at the profile checkpoint plus 22 new conversation-page cases.
- New cases cover page sizes/orders/member views, full serialized payload equality, blocked authors/thread authors, reverse blocks, deactivation, removed threads/parents, response-target placeholders and empty pages. Existing order/tie/pagination/depth-five and publication/privacy regressions remain in the full suite.
- Existing semantics are preserved: other people's replies remain reachable under an unavailable thread/parent shell; public hidden-author behavior differs from bilateral participation checks; blocks/unavailable state suppress acceptance and private viewer fields appropriately.
- Ruff passes using the backend configuration; fresh OpenAPI structure is unchanged. The 22 operator-helper tests passed at the preceding profile checkpoint, and helper code did not change afterward.
- Current preview and production packages were rebuilt locally with synthetic public keys. Network-disabled smoke checks verified non-root UID 10001, AI off/no key, normalized source hashes matching current `services.py`/`routes.py`, liveness, document/deep-link/HEAD behavior, exact Clerk CSP, asset caching, private/missing-path guards and absence of private environment files.

The package checks do not establish database readiness, real Clerk, browser layouts or hosted deployment. Frontend source is unchanged; its earlier 205-test/types/build evidence remains historical, and unchanged build layers were reused. Existing Starlette/httpx deprecation and Docker's public-key ARG heuristic remain warnings.

No application-provider call, worker schedule, cloud/network/credential change, push, PR, CI run, migration or release occurred. Any separate Google coding-worker review must be recorded independently; it does not enable content moderation. Keep the local feature candidate unpublished until owner review.
