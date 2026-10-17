# Rivock architecture

Implementation architecture: React/TypeScript/Vite, FastAPI REST, PostgreSQL, SQLAlchemy/Alembic, Clerk, Docker, GitHub Actions. Account setup and hosted deployment remain pending; see [IMPLEMENTATION.md](IMPLEMENTATION.md).

## Application boundaries

Use one dedicated Rivock repository with `frontend/`, `backend/`, `docs/`, and `infra/`. Do not turn the existing broad Codex workspace into the application repository. The standalone demo remains a design reference rather than a production foundation to copy wholesale.

- **Frontend:** React Router for navigation; TanStack Query for server data, cache invalidation, and polling; native Fetch for transport; shared CSS and design tokens. Clerk React SDK for hosted sign-in and short-lived session tokens. Textarea-based Markdown toolbar/preview uses `react-markdown` with raw HTML disabled, an explicit element/URL allowlist and `rehype-sanitize`. Embedded images and unsupported Markdown extensions are disabled.
- **Backend:** FastAPI routers, Pydantic request/response models, service functions for business rules, SQLAlchemy 2 sessions/repositories, Alembic migrations, psycopg 3 PostgreSQL driver. Use synchronous database units of work in synchronous request/service handlers for an approachable first implementation; do not mix blocking DB calls into asynchronous event-loop handlers. Keep provider calls bounded and outside open database transactions.
- **Worker:** a CLI command in the same backend image claims durable moderation work and calls the same apply-decision service as the API. Container Apps scheduled Job starts it every five minutes. A local worker command supports the same behavior. No separate business service or queue broker.
- **Database:** PostgreSQL 17 as a proposed conservative baseline for local/hosted parity; verify host availability at setup. Use ordinary relational tables, full-text search, atomic constraints, and transactions before adding caches/denormalized counters.
- **Identity:** Clerk owns credentials, email verification, recovery and Google sign-in. The browser uses only a public publishable key; FastAPI validates session tokens against the configured instance JWKS. This path needs no Clerk Backend API secret. Local usernames, status and admin roles remain in PostgreSQL.
- **Moderation provider:** Google AI adapter with a typed result: `allow`, `reject`, or `uncertain`, reason code and usage. The selected real model and prices are environment configuration, verified later. A deterministic fixture adapter is permitted only in local/test environments and visibly labeled.

Pin compatible supported dependency versions in lockfiles during scaffolding rather than copying class examples or unrelated projects' package manifests. Implemented runtimes: Python 3.12.14, Node.js 24.19.0 and PostgreSQL 17.11. See IMPLEMENTATION.md for evidence and deliberate differences from the plan.

## Identity and authorization flow

1. Visitor requests public content anonymously.
2. Sign-in preserves a safe local return path and draft, then redirects to Clerk's hosted account portal.
3. The React SDK obtains a short-lived session token and Fetch sends it as `Authorization: Bearer ...`; token failure never silently falls back to an anonymous request.
4. FastAPI verifies signature, issuer, expiry, issued-at/not-before, user/session IDs, v2 and an allowed `azp` frontend origin. Optional audience is checked when configured. The JWKS URL comes from operator configuration, never token claims. Pending/machine/impersonation sessions are refused.
5. `GET /me` signals onboarding; `POST /me` reserves a unique username and verified `(issuer, subject)` identity. Email is not a linking key.
6. Local UUID, role and status govern every operation. Provider claims never grant admin status. Sign-out/account switching clears drafts/private caches and ignores late profile responses.

Clerk SDK configuration and server validation must refer to the same instance. See [Clerk setup](CLERK_SETUP.md) and [verification status](IMPLEMENTATION.md). Real email/Google flows remain a separate smoke test. Offline JWT verification uses short-lived tokens; provider-side revocations take effect when those tokens expire. Local suspension/deactivation checks apply on every protected request.

## Publish/edit flow and durable moderation

Current policy is explicit `MODERATION_MODE=off`: after the durable submission is stored, call the same state/revision/permission-checked publication transaction immediately, without rules/provider checks or an Attempt record. The private reason `moderation_disabled` identifies this path; old review attempts cannot be presented as approval of that publication. Clear/invalidate an older lease, and ensure its late result cannot overwrite or reject the publication. Terminal rejected/cancelled rows stay terminal. Reports/manual admin actions remain; report-assisted AI is future work. Steps describing provider claims/retries below apply only to retained legacy modes, not the current default.

1. Validate authentication and payload shape, then check the idempotency key before charging a new mutation/rate allowance. Replays return the current owned submission/result projection (never a cached copy of now-deleted text); conflicting payload/route with the same key returns 409. For new work, validate ownership, limits, topic/parent, and create an immutable submission snapshot in a short transaction.
2. Run deterministic policy checks and, if eligible, claim the submission for one bounded inline AI attempt. Reserve model cost in the database first. Never hold a DB transaction during the network call.
3. Apply a valid decision in a new transaction: recheck actor/account, applicable block/parent/topic/target state, expected content/profile revision, and lease. Publish new content or replace the last approved content/profile atomically with submission status, search text, and notification events. New replies enforce thread/target/block guards; owned edits/deletes are not blocked solely by a personal block or author-deleted thread.
4. A provider error leaves pending work with a due time. Return 202. API restarts cannot erase the work. The scheduled worker recovers expired processing leases and runs due retries.
5. Keep the old public version of pending edits. Later edits cancel earlier open submissions; deletion/removal prevents their later application. A stale worker lease/result has no authority to publish.
6. Rejected authors see a reason and can revise through a new submission. Users can cancel pending/review work. Admin review can publish/reject eligible work through the same transaction service.

Inline completed creates return 201; completed content/profile edits return 200; pending results return 202; deterministic/AI rejection returns 422 with an owned submission reference. Poll submission status every five seconds while that page is visible; stop at a terminal/review state or when hidden.

## Transaction and concurrency rules

- Use unique vote/save/identity/idempotency constraints; do not rely on a previous SELECT alone.
- Lock a content target before editing, deleting, accepting, removing, or applying moderation. Use expected revision for edit conflicts. Concurrent acceptance is last committed selection, with one accepted ID stored on the question.
- Mutations involving a pair of users and block creation use the same ordered user-row locks; recheck blocks/account state inside the transaction. This prevents a concurrent block or suspension being bypassed by a late worker decision.
- A short global advisory transaction lock serializes writes and moderation claims at this project's initial scale. Claims have a two-minute expiry and unique lease token; only the current token may apply a result. Worker batches handle at most twenty submissions and stop starting new work after 35 seconds for the proposed sixty-second cloud job. Database failure leaves durable work recoverable on the next run; API errors remain explicit. Revisit lock granularity before higher throughput.
- Insert notifications in the content/acceptance transaction with a unique event+recipient key; no external notification-delivery service is needed at launch.
- Compute vote totals from vote rows initially. Aggregate before joining to replies/other relations to avoid inflated sums. Add counters or ranking materialization only if measured performance warrants them.

## Development and delivery

Development includes Docker Compose and native commands. CI is configured with a real PostgreSQL service. Frontend tests use Vitest/Testing Library; backend tests use pytest. Real browser journeys remain a launch gate; component tests are not layout verification. Test token fixtures override the auth dependency only inside tests; production has no auth-bypass switch.

Generate frontend REST types from FastAPI OpenAPI using `openapi-typescript`. Do not hand-maintain competing request types. CI checks the exported schema and generated types for drift.

Deploy the static frontend separately from the API. The Static Web Apps Free plan must not be assumed to provide a linked Container Apps API proxy: call the API address directly with explicit CORS. Keep public feed/detail GETs anonymous and user-specific responses uncached across accounts. Clear all private frontend cache on sign-out/account change.

Launch uses an SPA; server rendering, rich per-thread social previews, and stronger search-engine indexing are deferred. REST remains suitable if server rendering is added later. Cold starts and AI checks have separate UI states rather than being hidden by misleading success messages.
