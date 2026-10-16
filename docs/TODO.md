# Rivock implementation checklist

Updated October 14, 2026. Checked items have the implementation/check evidence described below; unchecked items still need work or real external configuration. See [IMPLEMENTATION.md](IMPLEMENTATION.md) for limitations. The Azure database is Ready; the cloud application is not deployed.

## Repository and application foundation

- [x] Use the dedicated `Jnuso/Rivock` checkout and preserve unrelated Codex workspace files.
- [x] Consolidate specifications, agent guidance, API/database/security/UI/deployment documents and approved demo reference.
- [x] Scaffold React/TypeScript/Vite and FastAPI with pinned runtimes, dependency lockfiles and environment examples.
- [x] Add PostgreSQL models, three Alembic migrations, seven topics, explicit original fictional seeds and health endpoints.
- [x] Add typed safe public/private models, errors and generated OpenAPI TypeScript contracts.
- [x] Replace Entra/MSAL with Clerk React, strict JWT verification and issuer/subject identity linkage; add a preserving migration and local public-key setup helper.
- [x] Add real-PostgreSQL integration/auth/concurrency tests, frontend component checks and configured GitHub Actions.
- [x] Configure the supplied Clerk development publishable key and matching issuer in ignored native/Compose files; verify the public JWKS endpoint and rebuild the frontend.
- [x] Verify initial local Google sign-in and username onboarding: user confirmed success; a read-only database check confirmed a persisted Clerk-linked account.
- [x] Verify repeat Google login/sign-out and saved-thread persistence through the user's browser check; confirm a saved thread and a published reply submission in PostgreSQL.
- [x] Verify question creation and the two-account reply/accept/Alerts notification-link journey through the user's successful browser check.
- [ ] Verify email/password/recovery and hosted URLs.

- [x] Execute all three migrations and rerun the PostgreSQL suite after the Clerk switch: the current 153-test backend suite passed in Docker, including migration preservation/constraint checks.

## Core conversations and discovery

- [x] Implement threads, direct/nested replies, depth-five response-target semantics and accepted answers.
- [x] Implement create/edit/delete, revision conflicts, last-approved visibility, private submission status and cancellation.
- [x] Share moderation apply logic across API, worker and admin; enforce idempotency, leases, retries, stale-state checks and cost reservations.
- [x] Add bounded Google adapter and deterministic local fixtures; refuse fixtures in production.
- [x] Add a versioned limited benign/spam pack, offline report and disposable-test-database live runner using shared budget/pause controls; no actual AI evaluation claimed.
- [x] Identify Google AI Studio Gemma 4 as the user's provider/model family; research Google's model/API, free-tier pricing and data terms, and record the candidate/setup in GEMMA_SETUP.md.
- [x] Configure the Google AI Studio key in ignored local settings; verify Gemma 4 metadata/access, structured responses and explicit free-tier accounting through isolated synthetic calls.
- [x] Pass the limited live eight-case pack: five benign model approvals, three rule-based spam rejections, zero deferrals; six calls including smoke recorded zero cost. Save the reviewed sanitized report.
- [x] Pass the 153-test backend suite, including free-mode daily caps, pauses, one-call concurrency, failure cost and strict truncated/malformed-response handling; keep the real key out of automated test containers.
- [x] Obtain explicit user approval for local Google moderation of future post/reply/profile text; rebuild/restart API and worker with verified Google/free settings, and check container health and the non-fixture API indicator.
- [x] Verify a new browser-created thread after Gemma activation: the user reported publication and the moderation record confirms one Gemma AI attempt, allow decision, published state and completed usage accounting.
- [x] Show private completed-review labels/decisions in My submissions and detail: AI, rules, demo or moderator; preserve inconclusive/failure/history distinctions, batch list queries and verify ownership/public serializer boundaries.
- [ ] Evaluate a labeled policy corpus and record false rejections/missed violations. Adapter/state fixtures are tested; production moderation quality is unmeasured.
- [x] Implement seven topic filters, Trending/Latest, full-text search, relevance/newest, pagination and ID deduplication.
- [x] Measure warm feed/search HTTP responses with 10,005 synthetic threads; record the limited single-client baseline in IMPLEMENTATION.md.
- [x] Add votes, accepted-answer ordering and chronological nested replies.
- [x] Add private saves/removal, contribution history, moderated profile settings and account deactivation.
- [x] Retain structural placeholders while erasing deleted text and clearing acceptance/search visibility.

## Abuse controls and operations

- [x] Implement publication/acceptance notifications, unique recipients, read/read-all/unread counts and visible-tab polling.
- [x] Implement blocks, safe filtered projections, rate counters, duplicate controls and private reports.
- [x] Build admin inspection, shared approval/rejection/retry, remove/restore/suspend/clear-bio, topics, audit history and persistent AI pause/status.
- [x] Add retention cleanup, restore expiry, stale submission expiry, erasure journal export/replay and initial privacy explanation.
- [x] Restore an older synthetic PostgreSQL backup, replay later erasure markers and verify deleted text stays erased while another author's reply survives.
- [x] Limit AI-attempt/report/audit rows to one year while retaining minimal identity/replay/erasure markers for correctness; document the decision.
- [ ] Publish operator contact and verified provider/backup retention details before launch; review the documented minimal-metadata retention policy as usage grows.

## Release and deployment

- [x] Configure local Compose, backend/frontend Dockerfiles, CI checks and manual immutable GHCR image publication workflow.
- [x] Add and compile Azure app/job/migration/static-site and budget Bicep templates.
- [x] Verify the running native API and production frontend preview over HTTP, including deep-route fallback; no browser layout claim.
- [x] Build Docker images, start Compose, seed the local app and verify public HTTP health/discovery plus authorization errors. Services are bound to localhost.
- [ ] Run the workflows on GitHub after the initial repository publication.
- [ ] Before domain purchase, implement/verify explicit hosted preview configuration: Clerk development keys with exact HTTPS origin, full cloud TLS/HMAC/fixture protections and test-only content. Recommend the combined app's Azure-provided address; GitHub Pages remains a frontend-only alternative. No preview deployed yet.
- [ ] Inspect real browser layouts at 320/390/768/1440px and keyboard/focus/accessibility flows. Browser permission remains pending after an earlier denial; component tests do not establish visual correctness.
- [x] Locate new replies/deep notification targets with bounded safe ancestor context and return to normal ranking.
- [x] Preserve full drafts and original revisions; add explicit compare/reload/rebase controls, memory fallback and tab-close warning when storage fails.
- [x] Add a setup checker that reports missing values and local tooling without exposing credentials.
- [x] Record the user's $100 unused credit/approximate year remaining, research current student allowances and East US retail rates, and prepare HOSTING_COSTS.md with the $8 credit target and conditional database/fallback decision.
- [x] Inspect the actual PostgreSQL free-allowance indicators, replace restricted East US with Canada Central, and guide creation of B1ms/32 GiB/PostgreSQL 17 with HA/geo/autogrow off and one client-IP rule. User's Overview confirms Ready/17.11; local TLS 1.3 certificate/hostname check passes without authentication.
- [x] Add a read-only Azure login helper with a hidden password prompt, verified TLS/system roots, sanitized errors and no stored password/app configuration changes; focused script tests pass.
- [x] Obtain the user's successful real authenticated read-only check: administrator Jnuso, PostgreSQL 17.11, TLS 1.3; no administrator password was shared or saved.
- [x] Prepare the secure cloud database initializer and external-connection Alembic path; verify owner-only generated-credential file, new non-superuser migration/runtime roles, restricted grants, marked reruns/collision refusal and transactional rollback with PostgreSQL 17.11. Combined Docker suite: 162 backend + 22 script tests.
- [x] User ran the initializer against Azure; independently verify both restricted logins over TLS 1.3, schema revision 31c7a48a90c1, seven topics, runtime boundaries/role flags and zero user/thread rows. No local data was copied or configuration repointed.
- [x] Complete project-scoped Azure CLI login; verify subscription Enabled/spending limit On, actual five-region policy, Canada Central app/job support, 0/1 environment quota and the narrow database firewall. Register Microsoft.App without creating hosting resources.
- [x] Replace region-blocked Static Web Apps with a combined website/API Container App build and template; preserve the local development stack.
- [x] Build the combined image with a synthetic public key; verify live local HTTP, production route/cache/security guards, non-root/private-file boundaries, final source hash, frontend tests/build, configuration guards and Bicep. Full Docker suite 201 plus final focused static suite 18; no production identity/browser claim.
- [ ] Verify exact Azure credit expiry/current balance, backup/usage billing, app/job narrow egress route, workload quota/capacity and complete monthly estimate before provisioning app hosting.
- [ ] Configure actual cloud secrets, deployment identity, GHCR package visibility, migration/runtime DB roles, TLS/CORS/CSP and alert recipients.
- [ ] Provision after concrete hosting/cost review, run migrations, enable API/job and publish the frontend.
- [ ] Verify hosted real-identity journeys, managed backup restoration, previous-image rollback and operator pause.
- [ ] Buy/configure the domain and DNS/TLS.
- [ ] Record day/week actual costs, cold starts and hosted latency; add verified screenshots/demo journey to README.

## Later milestones

- [x] Supply five original fictional demo conversations with visible labels, without scraped material or ongoing automated activity.
- [ ] Review and implement DM request/privacy/moderation/retention behavior separately.
- [ ] Evaluate ongoing labeled bots with explicit frequency, model, budget and pause controls; no automated votes or unsolicited DMs.
- [ ] Consider server rendering/link previews, personalization and uploads as separate exercises.
