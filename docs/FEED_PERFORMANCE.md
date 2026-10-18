# Local feed projection performance

Prepared October 18, 2026. Branch **features/local-conversation-tools**; local only, no push or deployment.

The new feed filters exposed a concrete scaling cost: each visible thread fetched its own counts, votes, saved state, author, topic and accepted answer. Feed pages now load those projections in a request-local batch and pass them through the same public serializer. There is no shared or cross-account cache. Detail and other endpoint behavior stays on the existing single-item path. Ranking, filtering, page boundaries and response fields are unchanged.

## Verification

- **237 backend tests passed** against isolated PostgreSQL in Docker, including 11 added cases for anonymous/member equivalence, blocked/unavailable/deactivated authors and replies, acceptance, descendant counts, votes/saves, viewer switching, changed data and bounded statement counts. The statement-count regressions exercise actual HTTP test-client reads at 1, 20 and 50 items and include authentication/rate accounting; each request stays within 13 SQL statements.
- Backend Ruff passed. Re-exported OpenAPI is byte-for-byte identical to the tracked contract. Frontend source is unchanged in this optimization; the earlier 139 frontend tests/types/build remain the relevant frontend checkpoint.
- A guarded paired measurement used 10,000 additional original fictional threads and 2,500 direct answers, with anonymous and synthetic-member views. For each of 12 cases, three samples per path alternated the per-row serializer and batched serializer on the same dataset. Every complete page payload matched. All temporary benchmark rows rolled back and the original three preview threads/two replies remained.

| Viewer | Case | SQL statements, three samples (per-row → batched) | Median local milliseconds (per-row → batched) |
| --- | --- | --- | --- |
| anonymous | all questions / latest | 84/84/84 → 6/6/6 | 80.590 → 11.325 |
| anonymous | unanswered / latest | 81/81/81 → 5/5/5 | 90.815 → 20.539 |
| anonymous | answered / latest | 88/88/88 → 6/6/6 | 92.200 → 14.487 |
| anonymous | accepted / latest | 101/101/101 → 6/6/6 | 100.123 → 13.052 |
| anonymous | unanswered / trending | 81/81/81 → 5/5/5 | 100.411 → 37.027 |
| anonymous | accepted / relevance + search | 101/101/101 → 6/6/6 | 102.251 → 14.493 |
| synthetic member | all questions / latest | 145/145/145 → 9/9/9 | 131.746 → 13.542 |
| synthetic member | unanswered / latest | 142/142/142 → 8/8/8 | 152.713 → 24.313 |
| synthetic member | answered / latest | 149/149/149 → 9/9/9 | 142.265 → 16.694 |
| synthetic member | accepted / latest | 162/162/162 → 9/9/9 | 162.035 → 18.296 |
| synthetic member | unanswered / trending | 142/142/142 → 8/8/8 | 149.019 → 29.182 |
| synthetic member | accepted / relevance + search | 162/162/162 → 9/9/9 | 183.436 → 20.322 |

This measures the native feed function, database queries and serialization on one local client. It excludes HTTP, authentication transport, cloud network latency, concurrency, cold starts and production load. It supports fewer database round trips, not a hosted latency or capacity promise. The per-row comparator uses the existing single-item serializer path with the same feed-selection query. Raw sanitized evidence: rivock-local-feature-performance-batched.json.

## Boundaries

No schema migration, new dependency, API contract, environment setting, provider call from the app, cloud resource, schedule, firewall rule, pushed commit or hosted release is part of this optimization. Application AI remains off. The bounded implementation worker returned no changes. The review worker exhausted its first two-call allowance, then a retry within the permitted two-call batch ended in a provider timeout; it returned no findings or changes, and its baseline collection could not run without an isolated test database. No worker changes were integrated and no independent review is claimed. The passing PostgreSQL evidence was run directly by Codex.
