# Rivock: next-chat handoff

Updated October 24, 2026. Read [AGENTS.md](../AGENTS.md) first, inspect Git status, then use this checkpoint and current source. Earlier chronological notes are evidence of earlier states, not instructions to repeat setup or activate services.

## Current task and boundaries

On October 24 the user explicitly authorized validating and pushing all current work on `features/local-conversation-tools` to GitHub, followed by an illustrated UI improvement document. This supersedes the earlier no-push restriction. The branch is based on `a00c794` from `fix/browser-draft-recovery`; preserve its work. Merge, image publication and deployment remain separate actions and were not authorized.

Start with [LOCAL_REVIEW.md](LOCAL_REVIEW.md), which summarizes the prepared journeys, verification and owner decisions. [LOCAL_FEATURES.md](LOCAL_FEATURES.md) retains detailed feature/browser history.

Repository: `C:\Users\Jnuso\Codex\Codex\Codex\Rivock`; remote [Jnuso/Rivock](https://github.com/Jnuso/Rivock). Work only in this dedicated checkout, not the parent Codex repository.

## Product and current moderation

Rivock is a text-first college-life advice/discussion learning and résumé project. Public visitors can read. Participation requires an account. Shared feed, seven topics, questions/discussions, accepted direct answers and content votes; **no communities, user karma or reputation gates**. React/TypeScript/Vite, FastAPI REST, PostgreSQL 17, SQLAlchemy/Alembic, Clerk and Docker/GitHub Actions; Azure preferred within a small budget.

**Keep application `MODERATION_MODE=off`.** Valid posts/replies/profile edits publish immediately after ordinary authorization, validation, duplicate/rate and target/revision checks. Publication is not AI approval. Reports remain private and do not automatically hide content; audited manual admin moderation remains. Do not reactivate the old pre-publication gate or add a cloud AI key/schedule.

[REPORT_AI_PROPOSAL.md](REPORT_AI_PROPOSAL.md) is an unapproved design draft: manual admin-requested, recommendation-only analysis first, revision-aware deduplication, minimal provider context and explicit privacy/budget review. It creates no endpoint, migration, job or provider call. Discuss the proposal before implementation/activation. [REPORT_MODERATION.md](REPORT_MODERATION.md) is the confirmed policy.

DMs, uploads, personalization and ongoing bots remain later work. Any bots must be visibly fictional/labeled, with original content; no scraped Reddit training corpus, simulated human voting or unsolicited DMs.

## Prepared local feature journeys

- Canonical thread/reply/profile sharing and usable manual-copy fallback; accepted-answer shortcut and timestamp permalinks.
- Conversation/answer-state filters combined with topics/search/order; private Saved-library search.
- Recommended/Newest/Oldest direct answers with accepted-first priority; chronological follow-ups and clear total-reply labels.
- Preserved return to filtered feed, Saved search or profile tab through context/reload.
- Selection-aware Markdown shortcuts/help; robust local draft recovery, current-editor text downloads and retry saving.
- Feed saves, All/Unread Alerts, Mark unread and consistent private-state refresh.
- Public profile Threads/Replies tab links and repaired reply-history joins.
- Request-local batching for feed, Saved, Alerts, profile history, direct answers and expanded follow-ups. No cross-viewer cache.

The base includes the separate browser-recovery/privacy candidate previously recorded as draft PR #2. It does not include the separately recorded recovery-journal backend candidate from draft PR #1. Inspect actual source/PR status before assuming either is merged or released; this task did not change those PRs.

## October 22 implementation and checks

Local commits: `47e9ca3` batches profile history; `e4c3972` batches conversation pages and prepares the review/AI proposal. Later documentation commits do not change application source.

- **365 backend tests passed together against disposable PostgreSQL 17.11**, including 46 new profile/conversation cases. Four profile and eight conversation query-budget regressions failed before their corresponding implementation.
- **22 operator-helper tests passed** at the profile checkpoint; helpers did not change afterward.
- Ruff with backend configuration and unchanged OpenAPI structure passed. No schema migration, dependency or API change in this continuation.
- Full HTTP test-client payload comparisons preserve pagination, votes, blocks, deactivated authors, unavailable shells/targets, accepted priority and the depth-five parent/response-target distinction.
- At 50 items, signed-in profile reply history fell from **357 to 12 SQL statements**; expanded follow-ups from **405 to 12**. These are local fixture round trips, not hosted latency/capacity measurements. Details: [PROFILE_PERFORMANCE.md](PROFILE_PERFORMANCE.md), [REPLY_PERFORMANCE.md](REPLY_PERFORMANCE.md).
- Both local preview/production images rebuilt with fictional public keys. Network-disabled smoke verified non-root UID 10001, AI off/no key, current normalized app-source hashes, liveness, document/deep-link/HEAD behavior, exact Clerk CSP, asset caching and private/missing-file guards. Tags: `rivock-app:local-batching-preview-20261022` and `rivock-app:local-batching-production-20261022`.
- Frontend source was unchanged; its prior **205 tests across 24 files**, types/build and local browser evidence remain separate historical checks. No fresh hosted identity/browser or CI run is claimed on October 22. Package smoke does not prove database readiness or real Clerk login.
- Independent Google coding review job `544f8647cadc486ba60ad03749b6b9f3` used four calls in two batches, with more than 65 seconds after the first terminal update before resuming. It ended `provider_protocol` / no final report, no changes or source conflicts. Its baseline could not collect without an isolated test DB. **No completed independent review or worker tests are claimed.** Direct checks above are the verification.
- The task's disposable PostgreSQL container, anonymous volume and internal network were removed. No real app database, private configuration, cloud resource, schedule or network rule changed. Local images remain. No active worker job remains from this task.

Existing Starlette/httpx deprecation and Docker public-key ARG heuristic remain warnings. Do not claim fresh audit/browser checks merely because an unchanged build layer was reused.

## Last recorded hosted checkpoint, separate from local work

[Live Azure preview](https://rivock-api.wittymushroom-48e2dfec.canadacentral.azurecontainerapps.io/) / [admin](https://rivock-api.wittymushroom-48e2dfec.canadacentral.azurecontainerapps.io/admin).

The last recorded release is October 17 application source `7bc80adfe11394deb0e3d6e4e819fd4abf1a6644`, image `ghcr.io/jnuso/rivock-api@sha256:b8d0905d4109be5f9cb62a68c3d42a554e6c74e11fc2dacd84629e6c92364d1e`, Healthy revision `rivock-api--0000004` with 100% traffic at that check. Exact-source CI and image publication passed. No fresh Azure inspection was performed on October 22; none of this branch's new features were deployed by this task.

The user confirmed Google login/onboarding/vote/save persistence. Hosted `jack` has an audited exact-account admin grant; `jack1` is the other test account. Later authorized built-in-browser checks verified hosted immediate publication, reports leaving content visible, manual removal/restoration preserving replies, private/admin access boundaries, accepted answers/notifications and the released keyboard/editor/read-error recovery. See [BROWSER_CHECKS.md](BROWSER_CHECKS.md). Do not repeat completed setup or confuse synthetic local principals with real Clerk verification.

Built-in-browser testing with the existing jack/jack1 accounts was authorized for Rivock only. Do not touch unrelated accounts/tabs. The user handles any password, recovery or provider ownership entry. Firefox was unsupported by that tool at the recorded checkpoint; no Firefox compatibility claim exists. Additional offered sign-in/recovery methods and wider screen-reader/touch/device coverage remain open.

## Deployment and security facts to preserve

| Item | Recorded configuration |
| --- | --- |
| Subscription / tenant | Azure for Students `0f90c4c5-2dab-411c-93a1-503c2faee55f`; UConn tenant `17f1a87e-2a25-4eaa-b9df-9d439034b080`; subscription Owner, no tenant-admin setup needed |
| Resource group / region | `rivock-dev` / Canada Central |
| Environment | `rivock-env`, explicit WorkloadProfiles mode, Consumption only; environment quota occupied |
| App | `rivock-api`, combined React/API, HTTPS, 0.25 vCPU / 0.5 GiB, min 0 / max 1; cold starts possible |
| Migrations | Existing explicit manual `rivock-migrate` job; do not migrate on every API startup |
| PostgreSQL | `rivock-dev-jnuso.postgres.database.azure.com`, 17.11, B1ms, 32 GiB/P4, seven-day backups; no HA/geo/autogrow |
| Database / schema | `rivock` / `31c7a48a90c1`; separate restricted `rivock_app` and `rivock_migrate` roles |
| Data / identity | Separate local/cloud databases; no local rows copied; five original fictional seed conversations; Clerk development instance |
| Cloud AI / schedule | Off, no provider key or scheduled worker; cleanup-only code/template prepared but daily schedule not enabled |

Clerk replaced blocked external-Entra setup. Static Web Apps regions did not intersect subscription policy, so one Container App serves frontend/API. Do not restart those failed setup paths or assume quota for another free environment. No domain has been purchased.

**Required before production:** replace the database's shared-egress route with a narrower cost-reviewed, verified connection, then retire the preview and obsolete operator rules. The user explicitly approved only the frozen **161 single shared Azure egress IPs**, plus the existing two operator rules, and requested tightening later. Other Azure tenants using that pool can attempt database login. Do not silently expand the set, add broad exceptions, remove the working route prematurely or provision paid networking without reviewing its concrete cost. Evidence/fingerprint: [PREVIEW_DEPLOYMENT.md](PREVIEW_DEPLOYMENT.md).

Both cloud DB URLs retain `sslmode=verify-full` and `sslrootcert=/etc/ssl/certs/ca-certificates.crt` inside the image. `sslrootcert=system` failed in that runtime. Never disable certificate/hostname verification as a workaround.

Target budget: approximately $10/month excluding a future domain. The $10 subscription budget alerts at $5/$8/$10 go to the selected UConn email; **alerts do not cap spending**. Spending limit was confirmed On. The original $100/roughly-one-year student-credit estimate is not a current balance/expiry check. Last recorded October 17 billing was about USD 0.00347 app and USD 0 PostgreSQL, subject to lag; it is not a forecast or current bill. Recheck before new spending decisions.

## What to do next

1. Review [LOCAL_REVIEW.md](LOCAL_REVIEW.md) and preserve the no-push branch. Fix concrete local defects or continue bounded verification; do not publish the candidate simply because its tests pass.
2. Review the report-assisted AI proposal as a product/data decision. Keep application AI off while discussing or building any separately authorized offline fixtures.
3. Address remaining accessibility/account/recovery coverage without repeating completed hosted checks. A changed-feature hosted verification belongs after a separately authorized release.
4. Finish production gates through the prepared owner decisions: costed narrower networking, protected complete erasure-journal storage, exact temporary managed restore/rollback/cleanup plan and actual billing/credit observations. Do not execute paid/drill/schedule operations from a historical runbook alone.
5. Later choose contact/domain/preview-data transition, production Clerk and DNS/TLS. DMs/bots/uploads/personalization remain separate scope.

[OWNER_CHECKLIST.md](OWNER_CHECKLIST.md), [OPERATIONS_CHECKLIST.md](OPERATIONS_CHECKLIST.md), [RESTORE_DRILL.md](RESTORE_DRILL.md) and [NETWORK_ALTERNATIVE.md](NETWORK_ALTERNATIVE.md) record the concrete open gates. Earlier synthetic restore evidence and a reported backup window do not establish managed Azure recovery.

## Safe working notes

- Preserve unrelated changes. Do not print, commit or forward passwords, keys, HMACs, private tokens or user text. Identity links use validated Clerk issuer/subject, never email/domain.
- `.env.azure` and `.azure/preview.parameters.json` are ignored, owner-protected files. Preserve ACLs; use supported authenticated tools/host access only when needed. The administrator password was not saved. No private Clerk key is needed for this integration.
- Existing Azure wrapper `scripts/azure.ps1` uses the portable CLI/project auth cache; browser OAuth replaced the failing Windows broker. Inspect existing operation state before retrying interrupted cloud mutations.
- GitHub `preview` environment already has the public `CLERK_PUBLISHABLE_KEY` variable. Exact-commit CI must pass before its immutable image is published/pinned, but current no-push/no-release scope takes precedence. `gh` was not installed; never ask for pasted access tokens.
- Local Compose file is `compose.yaml`; preserve its real PostgreSQL volume. Port 5173 previously belonged to another app; inspect listeners before starting/stopping a preview. Do not kill unrelated servers. Use disposable data and synthetic principals for local tests; never substitute SQLite for PostgreSQL verification.
- Windows frontend tests previously needed shared task-local TEMP/TMP and one test worker. Read current scripts/config before running them. Fresh tests/layout/provider checks are distinct evidence.
- Google coding-worker permission is at most **two Google requests/minute across workers**; cap each batch at two and wait at least 65 seconds after its prior terminal/update timestamp before more. Never resume with a larger unconsumed allowance. Coding authorization does not enable application content review. The last worker here is terminal; no retries are necessary just to repeat its failed report attempt.

Read [IMPLEMENTATION.md](IMPLEMENTATION.md) for chronological checks, [SPECIFICATION.md](SPECIFICATION.md)/[ARCHITECTURE.md](ARCHITECTURE.md)/[SECURITY.md](SECURITY.md)/[API.md](API.md) for contracts, and [PREVIEW_DEPLOYMENT.md](PREVIEW_DEPLOYMENT.md) for deployment details. Old `GEMMA_SETUP.md` activation steps are historical, not current instructions.

## Starter prompt

> Continue Rivock in `C:\Users\Jnuso\Codex\Codex\Codex\Rivock`. Read AGENTS.md, docs/HANDOFF.md and docs/LOCAL_REVIEW.md, then inspect Git status/current source. Keep features/local-conversation-tools local: do not push, merge, publish or deploy. The October 22 batch has 365 PostgreSQL backend tests, 22 helper tests and rebuilt local package checks; the new features are not on the Azure site. Keep application AI off and valid publication immediate, with private reports/manual moderation. Review the proposed report-assisted AI design separately before implementation or provider calls. Continue useful local fixes/verification, preserve existing work and make routine decisions; ask only for missing account input, required authorization or material product choices. Existing built-in-browser authorization is for Rivock and its jack/jack1 test accounts only. Do not repeat completed setup, expose secrets or execute paid cloud/recovery/schedule changes from old plans. Give me a consolidated review of changes, evidence and remaining decisions.


## October 24 push preparation

Reading preferences now offer Light, Dark or System theme, Comfortable or Compact density, and three post-text sizes. Only validated device appearance settings are persisted; storage failures show retry feedback. Conversation tools collapse/expand loaded direct answers and jump to loaded answers, protecting open reply/edit composers and preserving loaded follow-ups. No API or schema changes.

Fresh checks passed: 365 Docker/PostgreSQL tests, 230 frontend tests across 26 files, frontend types/build, 22 operator-helper tests, backend Ruff and API-contract equivalence. The 25 added frontend cases cover reading settings, unavailable storage, account draft-cleanup separation, collapse/jump behavior and editor protection. Browser automation reported no available browser surfaces in this session, so fresh responsive, dark-mode and enlarged-text layout inspection remains pending. Existing browser screenshots predate these controls. This limitation does not establish a hosted failure.

The user requested a practical illustrated Word/PDF UI plan after the source push. Its recommendations are proposals, not implemented changes. Keep application AI off and do not merge, deploy, publish images or change cloud configuration.
