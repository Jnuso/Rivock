# Rivock: start the next chat here

Checkpoint: October 17, 2026. This is the current handoff, not a new implementation plan or deployment authorization. Read the repository's [AGENTS.md](../AGENTS.md) first. Older chronological notes describe superseded states; the current moderation decision below takes precedence.

## Current usability release — October 17

Application source `7bc80adfe11394deb0e3d6e4e819fd4abf1a6644` passed [exact-commit CI](https://github.com/Jnuso/Rivock/actions/runs/39072833183) and [preview image publication](https://github.com/Jnuso/Rivock/actions/runs/39072992347). Anonymous GHCR manifest access and independent image inspection agreed on `ghcr.io/jnuso/rivock-api@sha256:b8d0905d4109be5f9cb62a68c3d42a554e6c74e11fc2dacd84629e6c92364d1e`. After the user's release authorization, image-only updates moved the existing app and manual migration job to that digest. Ready revision `rivock-api--0000004` is Healthy with 100% traffic. No migration ran and no new ARM group deployment was created.

The batch adds a first-focus Skip to main content link that preserves reply fragments, selection-aware Markdown formatting with restored focus/caret, and honest failed-read states with an explicit Try again control. Cached saved items survive refresh errors. Frontend types, all 71 tests and the production build passed; the exact-commit CI also passed backend, frontend and both container checks. The earlier directly run PostgreSQL suite had 205 backend tests and 22 helper tests; no backend source changed in this batch.

Targeted hosted checks used jack1's existing session at 320 CSS pixels. Skip focused MAIN, the next Tab reached Search, and the exact accepted-reply fragment survived activation. In the empty new-thread composer, selected Bold and Link formatted synthetic text, the link destination remained editable, Preview rendered correctly with formatting controls disabled, and reload restored the exact formatted draft. In the empty reply composer, keyboard Italic restored textarea focus/selection and Preview rendered an EM element. Both synthetic drafts were discarded without posting. Inspected views had no horizontal document overflow; temporary viewport sizing was reset.

A harmless unsupported feed sort produced the useful validation error and Try again without a false empty list. Enter on Try again retried that still-invalid read; choosing Trending restored the real hosted feed. This proves hosted validation-error recovery, not a hosted network outage or HTTP 503. The controlled HTTP 503/recovery check ran only through a local frontend proxy. The earlier two-account report/admin/publication journeys were not all repeated for this release.

Final Azure readback confirmed the pinned digest/ready revision, moderation off, no AI key, min/max 0/1, 0.25 vCPU/0.5 GiB, verified-TLS database URLs, the frozen 161 shared egress addresses plus two operator rules, and only the existing manual migration job. Health/readiness, seven topics, SPA deep links, private/missing resources, anonymous protected reads/writes, security/cache headers, false fixture indicator and changed frontend bundles passed HTTP checks. No schedule, paid resource or network rule was created.

The user authorized built-in-browser testing and the existing jack/jack1 accounts for Rivock only. Firefox remains unsupported by the current Windows browser tool; no Firefox compatibility claim is made. See [browser evidence and limits](BROWSER_CHECKS.md) for this release and the earlier hosted conversation/report/admin journeys. Documentation commits after the application source above do not change the running image.

A [managed restore drill proposal](RESTORE_DRILL.md) and [retail snapshot](restore-retail-snapshot.json) are prepared for separate review. Read-only metadata at October 17 22:03 UTC reported Ready, seven-day retention and earliest restore point October 14 23:43:47 UTC. No restore server, managed restore, rollback, durable encrypted erasure-journal storage or cleanup schedule was created. A reported backup window is not evidence of successful recovery.

Next: improve recovery safeguards, expand account/accessibility coverage and close the remaining network/cost/retention gates. Keep application AI off. The current environment is Consumption-only with no custom VNet; a private route needs its own migration/cost review. Month-to-date resource-group cost at October 17 07:11 UTC was USD 0.0034713738696 for the app and USD 0 for PostgreSQL; billing can lag and exact credit balance/expiry remain unverified.

## Local recovery validation follow-up

The replay-erasure operator command previously accepted unsupported target types/actions and could print success after silently ignoring an entry. A synthetic fake-session container check reproduced that failure without connecting to a database. The new loader validates the entire existing JSON-array export before opening a Session: exact fields, UUID strings, supported target/action pairs, duplicate event IDs (including identical repeats), duplicate JSON fields and readable UTF-8/valid JSON. Invalid input exits with a sanitized message and no success claim; valid replay behavior remains unchanged.

The original reproducer now rejects the unsupported journal without opening a Session. All 259 backend tests passed in a disposable Docker test container against the isolated PostgreSQL 17 test database; this includes 46 new parser/CLI unit cases and eight real-database integration cases. Tests cover actual export/replay compatibility, thread/reply erasure with other-author replies and their snapshots preserved, accepted-answer clearing, the distinct clear_bio/deactivate effects, and rejection of a bad later marker without changing an earlier valid target. Ruff and git diff --check passed. No frontend or schema change was needed.

This recovery fix is available in [draft PR #1](https://github.com/Jnuso/Rivock/pull/1) on branch fix/validate-erasure-journal (implementation commit 4540716), not part of the running Azure source 7bc80ad/revision 0000004. No cloud journal was exported or replayed and no managed restore, resource, schedule, network, secret or AI setting changed. Two bounded coding-worker jobs returned no changes or completed review; their baseline lacked the required isolated test database. All passing test evidence above was produced directly in the project environment. Input validation does not establish journal authenticity/completeness, encrypted storage, destination identity, exactly-once replay or managed recovery. See [the operator journal contract](ERASURE_REPLAY.md).

## Where we are

Rivock is a working college-life advice/discussion project for learning and a résumé. It has a shared text-first feed, questions/discussions, seven topics, replies, accepted answers and content votes. There are **no communities, user karma or reputation gates**. Public visitors can read; participation requires an account. The approved look is light, readable, blue-accented and responsive.

- Repository: [Jnuso/Rivock](https://github.com/Jnuso/Rivock), branch `main`.
- Windows checkout: `C:\Users\Jnuso\Codex\Codex\Codex\Rivock`.
- [Live Azure test site](https://rivock-api.wittymushroom-48e2dfec.canadacentral.azurecontainerapps.io/) and [admin page](https://rivock-api.wittymushroom-48e2dfec.canadacentral.azurecontainerapps.io/admin).
- Stack: React / TypeScript / Vite, FastAPI REST, PostgreSQL 17, SQLAlchemy / Alembic, Clerk, Docker / GitHub Actions, Azure Container Apps.
- The site uses Clerk's development instance and fictional demo conversations. No custom domain has been purchased. This is a preview, with possible cold starts.
- Core implementation includes search/topics, Trending/Latest, five reply levels, acceptance of a direct answer, voting, private saves, profiles, notifications, blocks/reports, account/ownership checks and audited admin actions. DMs, uploads, personalization and ongoing bots remain later work.

## Latest decision: publication and moderation

The user temporarily removed Gemma reviews. **Keep `MODERATION_MODE=off`.** Valid posts, replies and profile edits publish immediately after normal authorization, input, rate, duplicate and target/revision checks. Publication must never be described as AI approval. The owner's submission display says “Published without automated review.”

Reports remain private and do not automatically hide content. Manual administrator review/removal/restoration/suspension remains available. **AI assistance combined with user reports after publication is a future design, not implemented.** Do not reactivate the old initial-publication gate or enable cloud Google calls as a routine next step. Historical Google/fixture/pending adapters and earlier evaluations are retained but inactive. See [REPORT_MODERATION.md](REPORT_MODERATION.md).

The previous ordinary pending submission was released through the validated publication service. The October 16 read-only checkpoint, before the new browser tests, found one unreviewed published submission, zero pending/processing submissions and zero cloud AI attempts. Its content/type was not inspected; do not describe it as a new thread. Previously rejected/cancelled/manual-review items were not automatically published. No scheduled cloud worker or cloud AI key is enabled.

## What is verified, and what is still a check

**User-confirmed in the hosted preview:** Google sign-in, username creation, voting/saving and persistence after sign-out/repeat login. Username **`jack`** is the existing owner account. An audited operator command granted that exact account admin; an independent database check confirmed active, Clerk-linked admin state and one grant audit. Do not create a replacement account or link identities by email/domain.

**Hosted continuation:** the agent verified the same two-account journey in Azure, including both the question-owner reply alert and the reply-author acceptance alert. The user handled sign-in; account/ownership boundaries and report/manual moderation were exercised in the real browser.

**Technical evidence:** the latest app release passed GitHub CI and image publication. Backend tests used real PostgreSQL 17.11; frontend tests/types/build, helper checks, Ruff, Bicep and preview-image checks passed. Live readiness, privacy, headers, served frontend bundle and anonymous protected-route rejection passed. The targeted agent browser checks are now recorded in BROWSER_CHECKS.md; no completed independent coding-worker review is claimed. Detailed counts/checkpoints are in [IMPLEMENTATION.md](IMPLEMENTATION.md).

**Still needed:** additional login/recovery methods, wider accessibility/device checks, managed recovery/rollback, retention scheduling and day/week cost/cold-start observations. The core hosted conversation/report/admin journeys are now verified.

## Next work, in order

### 1. Finish account/accessibility coverage

The core hosted journey and source 7bc80ad usability rollout are complete; preserve [the actual browser and release evidence](BROWSER_CHECKS.md). The current digest is pinned and targeted hosted keyboard/editor/read-recovery checks passed. Future application releases still require their own exact-commit CI, publication and hosted checks.

Remaining account/browser work: test additional offered sign-in/recovery methods without changing credentials automatically; expand screen-reader, touch, blocked-storage draft recovery and return-path coverage; fix concrete defects and record the real check scope. The 320/390/768/1440 review is targeted rather than a full accessibility certification.

The user explicitly authorized the built-in browser and the existing jack/jack1 accounts for Rivock only. Firefox is blocked by the Windows browser tool. Do not repeat Clerk/Azure setup or claim fixtures establish real account/browser success.

### 2. Close operations and security gaps before production

- **Required security follow-up:** read [the new network/cost review](NETWORK_HARDENING.md), validate the selected lower-cost alternative or approve a changed budget, then implement/verify the replacement before removing the shared Azure egress and obsolete operator-IP rules. Do not remove the working route first or silently provision paid networking.
- Review [the concrete restore-drill proposal](RESTORE_DRILL.md), establish protected complete erasure-journal storage, then exercise Azure-managed backup restoration/erasure replay, a previous-image rollback, and administrator recovery/pause procedures. Earlier synthetic local restore evidence does not prove managed Azure recovery.
- Arrange/verify retention cleanup while keeping AI disabled. The scheduled cloud worker is currently disabled; one queue-release run was not a recurring cleanup schedule.
- Check exact student-credit balance/expiration, actual day/week costs and cold-start latency. Record an operator contact and recovery/retention policy before a real launch.

### 3. Design report-assisted AI separately

Discuss when a report should trigger analysis, abuse of false reports, what context is sent, recommendations versus automatic actions, appeals/notifications, privacy/provider data terms, rate limits and costs. Initial publication must remain ungated. Reports alone do not establish harm. Review this design with the user before enabling provider calls or changing moderation behavior.

### 4. Production and portfolio polish later

After verification/security/recovery/cost review: choose/buy a domain, configure Clerk production, rebuild with its production public key and production profile, bind DNS/TLS and recheck real account flows. Decide how preview accounts/data transition. A domain/key switch alone is not production readiness.

Then update screenshots, demo instructions and résumé/architecture evidence. Later bots must be visibly labeled and use original fictional content; no scraped Reddit training corpus, simulated human voting or unsolicited DMs. DMs need their own privacy/moderation design.

## Deployment facts to preserve

| Item | Current checkpoint |
| --- | --- |
| Deployed application source | `7bc80ad`; subsequent documentation commits do not change the running image |
| Immutable image | `ghcr.io/jnuso/rivock-api@sha256:b8d0905d4109be5f9cb62a68c3d42a554e6c74e11fc2dacd84629e6c92364d1e` |
| Rollout / ready revision | Image-only app/manual-job updates, October 17 / `rivock-api--0000004` |
| Azure subscription | Azure for Students, `0f90c4c5-2dab-411c-93a1-503c2faee55f` |
| Tenant | UConn, `17f1a87e-2a25-4eaa-b9df-9d439034b080`; subscription Owner access, no tenant-admin setup needed |
| Resource group / region | `rivock-dev` / Canada Central |
| Environment | `rivock-env`, explicit WorkloadProfiles mode, Consumption profile only; environment quota occupied |
| App | `rivock-api`, combined React + API, HTTPS, 0.25 vCPU / 0.5 GiB, min 0 / max 1 |
| Migrations | Explicit manual `rivock-migrate` job; do not migrate on every API startup |
| PostgreSQL | `rivock-dev-jnuso.postgres.database.azure.com`, version 17.11, B1ms, 32 GiB/P4, seven-day backups, no HA/geo/autogrow |
| Database / schema | `rivock` / Alembic `31c7a48a90c1`; separate restricted `rivock_app` and `rivock_migrate` roles |
| Data | Separate local/cloud databases; no local rows copied to Azure; five original fictional seed threads |
| Cloud AI / schedule | Off; no provider key or scheduled worker |

The UConn directory is not a blocker: Clerk handles application login. Static Web Apps regions did not intersect the subscription's permitted regions, so the reviewed solution serves frontend/API together. Do not restart the Entra external-tenant or Static Web Apps setup.

**Firewall exception:** the user explicitly approved exactly 161 individual shared Azure egress IPv4 addresses for the preview, with the requirement to tighten security later. Two operator-IP rules also remain. Other Azure customers using that shared pool can attempt database login; restricted credentials and verified TLS remain necessary. The approval does not cover expansions, ranges, all-Azure or all-internet access. Do not silently add replacements if egress changes. Full evidence/fingerprint: [PREVIEW_DEPLOYMENT.md](PREVIEW_DEPLOYMENT.md).

**TLS:** both cloud database URLs retain `sslmode=verify-full` and use `sslrootcert=/etc/ssl/certs/ca-certificates.crt` inside the image. `sslrootcert=system` failed in the published runtime. Do not disable certificate/hostname verification to resolve connectivity problems.

**Cost:** target approximately $10/month excluding a future domain. A subscription-scoped $10 monthly budget sends actual-cost alerts at $5/$8/$10 to the user's selected UConn email. Alerts are not a spending cap. Student spending limit was confirmed On. The user estimated $100 credit and roughly a year remaining; exact current balance/expiry are unverified. An earlier USD 0.00 result covered PostgreSQL only at that checkpoint, not all current hosting costs.

## Safe working notes for the next agent

- Inspect Git status and current source before editing; preserve unrelated changes. Work only in the dedicated Rivock checkout. Read current instructions and relevant docs rather than all historical course PDFs.
- Credentials are in ignored, owner-protected local files, including `.env.azure` and `.azure/preview.parameters.json`. Preserve ACLs. Do not print, commit, paste into prompts or request private keys/passwords. The administrator password was not saved. Use supported authenticated tools and request host access if required; never weaken permissions.
- Azure wrapper: `scripts/azure.ps1`, with portable Azure CLI and project-local auth cache. Existing login is established. Browser OAuth replaced the failing Windows broker; do not assume login must be redone. Inspect deployment/job state before retrying an interrupted mutation.
- Image workflow: `.github/workflows/publish-image.yml`, “Publish reviewed Rivock image,” `deployment_environment=preview`. Exact source commit must pass CI first; pin its published digest. GitHub environment `preview` already has the public `CLERK_PUBLISHABLE_KEY` variable. No private Clerk key is required. `gh` was not installed; existing Git Credential Manager authentication was used through its supported helper without printing/saving credentials. If unavailable, use the GitHub Actions UI rather than asking for a pasted token.
- Local Compose file is `compose.yaml`; preserve the PostgreSQL volume. Port 5173 is currently another app; do not stop or replace it. A separate task-local Rivock preview used port 5174 with a localhost API proxy for visual checks. The existing local API/worker were read back with moderation off.
- Run meaningful checks appropriate to code changes: real PostgreSQL backend tests, frontend tests/types/build and relevant image/config guards. Do not claim fixtures prove real login, provider quality or hosted browser layouts. Windows frontend checks previously needed a shared task-local TEMP/TMP directory and one test worker to avoid IPC-file errors.
- The user permitted Google Gemma **coding help in this chat**, at a maximum of two Google requests/minute across workers. Root instructions require batches of at most two calls and at least 65 seconds after the previous terminal/update timestamp before another batch. This does not enable application content review. Last worker attempts failed with HTTP 503 and returned no review; do not claim independent review success. Confirm applicable authorization/instructions in a new chat before delegation.

## Read these as needed

- [REPORT_MODERATION.md](REPORT_MODERATION.md): latest confirmed policy and future questions.
- [TODO.md](TODO.md): remaining checklist; [REVIEW.md](REVIEW.md): broader review/history.
- [PREVIEW_DEPLOYMENT.md](PREVIEW_DEPLOYMENT.md): release, firewall approval, TLS and deployment evidence.
- [IMPLEMENTATION.md](IMPLEMENTATION.md): actual checks and chronological checkpoints.
- [SPECIFICATION.md](SPECIFICATION.md), [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md), [API.md](API.md): product/engineering contracts.
- [HOSTING_COSTS.md](HOSTING_COSTS.md), [CLERK_SETUP.md](CLERK_SETUP.md): cost assumptions and identity configuration.

`GEMMA_SETUP.md`, older Azure walkthroughs and earlier implementation entries contain historical setup states. Do not follow an old activation step when it conflicts with this checkpoint or the user's current request.

## Starter prompt for the new chat

Copy the paragraph below into a new chat opened in this project:

> Continue Rivock in `C:\Users\Jnuso\Codex\Codex\Codex\Rivock`. Read AGENTS.md and docs/HANDOFF.md, inspect Git status, and use the current source and latest verified deployment evidence. The Azure preview works and my hosted username is jack, already granted admin. Keep Gemma/application AI reviews off: valid contributions publish immediately; reports and manual moderation remain. Read docs/BROWSER_CHECKS.md for the completed hosted publication/admin/report/two-account checks, review the released keyboard/editor/read-recovery evidence, then continue operations/security readiness. Built-in browser testing and the existing jack/jack1 accounts were authorized for Rivock only in the continuation chat. Design future report-assisted AI separately. The shared database firewall rules must be narrowed before production after reviewing cost and verifying a replacement. Continue useful work and make routine decisions; ask me only for missing account setup, required authorization or material product choices. Do not repeat completed setup or expose secrets. Give me one consolidated review of changes and remaining decisions.
