# Profile history database work

October 22, 2026. Local-only work on `features/local-conversation-tools`; nothing pushed or deployed.

Public profile Threads and Replies previously projected every contribution separately. Reply history fetched each response target, author, vote, conversation, score and child count individually. A signed-in 50-item reply page required 357 SQL statements in the isolated fixture below.

History now uses bounded, request-local projections for only the returned page. Threads reuse the established feed/saved batch. Replies load response targets, safe authors, owning threads, vote totals, viewer votes and structural child counts in batches, then use the same public serializer as single-reply reads. No shared viewer cache, migration, dependency, API field or ordering change was introduced. The extra pagination row is not projected.

## Measured round trips

The regression uses 60 original fictional conversations, each with its own response target and follow-up, in a disposable PostgreSQL 17.11 container on an internal-only Docker network. Real FastAPI test-client requests include identity lookup and read-rate accounting. No external identity/provider/cloud service participates.

| History / viewer | Before: SQL at 1 / 20 / 50 items | After: SQL at 1 / 20 / 50 items |
| --- | --- | --- |
| Threads / anonymous | 6 / 63 / 153 | 7 / 7 / 7 |
| Replies / anonymous | 8 / 103 / 253 | 8 / 8 / 8 |
| Threads / synthetic member | 12 / 126 / 306 | 12 / 12 / 12 |
| Replies / synthetic member | 14 / 147 / 357 | 12 / 12 / 12 |

All four query-budget regressions failed before implementation. Afterward, every complete HTTP page payload matched the established per-item projection, including pagination. Counts apply to this fixture; regression bounds allow small fixed overhead. They demonstrate bounded round trips, not hosted latency, concurrency, cold starts or capacity.

## Correctness and verification

Twenty-four added PostgreSQL cases cover full-page output/query bounds, anonymous/member views, removed response targets, deactivated target/main authors, deleted/blocked replies, blocked target names, removed conversations, changing votes/blocks across requests, empty batches, filtering before pagination, and the depth-five distinction between structural parent and response target. Existing profile/feed/Alerts tests remain in the suite.

Current semantics are preserved: unavailable targets show an unavailable name; deactivated public authors are sanitized; blocked/unavailable replies expose no body/author/score/viewer vote; structural child counts include conversation placeholders. Accepted-answer visibility uses the owning thread and viewer's hidden authors. Profile availability and owning-thread filtering still run before pagination.

- **343 backend tests passed** together against PostgreSQL 17.11, including 24 new cases.
- **22 operator-helper tests passed** with networking disabled and only helper source mounted.
- Ruff passed using the backend configuration.
- Fresh OpenAPI structure matches the checked-in contract. No TypeScript regeneration is required.
- Frontend source is unchanged; the earlier 205-test/types/build checkpoint remains historical evidence. No new browser, real Clerk, hosted or independent-worker verification is claimed.

The first complete run had 334 passes and nine setup errors because destructive database tests reject nonstandard hostnames. The disposable container was assigned the existing allowed `db` alias; the guard was not weakened. The complete rerun passed. No real app database, private credential file or cloud resource was mounted or modified.

Earlier package checks apply to source `79a8d4f`, before Alerts/history batching; they do not prove the current image has been rebuilt. AI remains off. Review the local feature candidate before any push or release.
