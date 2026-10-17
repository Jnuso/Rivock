# Rivock: start the next chat here

Checkpoint: October 16, 2026. This is the current handoff, not a new implementation plan or deployment authorization. Read the repository's [AGENTS.md](../AGENTS.md) first. Older chronological notes describe superseded states; the current moderation decision below takes precedence.

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

The previous ordinary pending submission was released through the validated publication service. The last read-only cloud check found one unreviewed published submission, zero pending/processing submissions and zero cloud AI attempts. Its content/type was not inspected; do not describe it as a new thread. Previously rejected/cancelled/manual-review items were not automatically published. No scheduled cloud worker or cloud AI key is enabled.

## What is verified, and what is still a check

**User-confirmed in the hosted preview:** Google sign-in, username creation, voting/saving and persistence after sign-out/repeat login. Username **`jack`** is the existing owner account. An audited operator command granted that exact account admin; an independent database check confirmed active, Clerk-linked admin state and one grant audit. Do not create a replacement account or link identities by email/domain.

**User-confirmed locally:** the two-account question → reply → accept answer → notification-link journey. This is not yet confirmation of the same journey in Azure.

**Technical evidence:** the latest app release passed GitHub CI and image publication. Backend tests used real PostgreSQL 17.11; frontend tests/types/build, helper checks, Ruff, Bicep and preview-image checks passed. Live readiness, privacy, headers, served frontend bundle and anonymous protected-route rejection passed. No completed independent coding-worker review or agent visual/browser inspection is claimed. Detailed counts/checkpoints are in [IMPLEMENTATION.md](IMPLEMENTATION.md).

**Still needed:** fresh hosted immediate-publication test, visible admin/report controls, hosted two-account conversation, additional login/recovery methods, phone/desktop accessibility/layout checks, managed recovery/rollback and actual hosting cost observations.

## Next work, in order

### 1. Finish the hosted user journey

Use fictional content and refresh the live site to load the current release.

1. As `jack`, publish a question and a reply. Confirm immediate visibility and honest unreviewed status in My submissions.
2. Open `/admin` and verify the expected controls. With a second test account, submit a report; confirm reporting alone does not hide content. Verify authorized removal/restoration and privacy of reports/submission details.
3. Complete the hosted two-account question/reply/accepted-answer/notification journey. Recheck blocks and ownership if a defect appears.
4. Review phone/desktop layouts, keyboard/focus, draft recovery, sign-in return paths and deep links; verify email/password/recovery if those methods are offered.
5. Record what the user actually verified and fix concrete defects. Do not repeat completed Clerk/Azure setup or mark browser checks passed based only on HTTP results.

Earlier browser automation permission was denied. Ask for explicit reauthorization before automating a browser, or walk the user through these checks manually.

### 2. Close operations and security gaps before production

- **Required security follow-up:** cost-review a narrower PostgreSQL connection, implement and verify the replacement, then remove the shared Azure egress rules and obsolete operator-IP rules. Do not remove the working route first or silently provision paid networking.
- Exercise Azure-managed backup restoration and erasure replay, a previous-image rollback, and administrator recovery/pause procedures. Earlier synthetic local restore evidence does not prove managed Azure recovery.
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
| Deployed application source | `d3879aa`; subsequent documentation commits do not change the running image |
| Immutable image | `ghcr.io/jnuso/rivock-api@sha256:521ae020da920f86a382a9a2681ef9e027b737baa239930f595b18f911754963` |
| Deployment / ready revision | `rivock-preview-reviews-off` / `rivock-api--0000002` |
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
- Local Compose file is `compose.yaml`; preserve the PostgreSQL volume. Native frontend already occupied port 5173 when Docker frontend was last attempted. Identify the listener before changing it. API/worker were verified off locally; the existing native frontend's updated visual state was not verified.
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

> Continue Rivock in `C:\Users\Jnuso\Codex\Codex\Codex\Rivock`. Read AGENTS.md and docs/HANDOFF.md, inspect Git status, and use the current source and latest verified deployment evidence. The Azure preview works and my hosted username is jack, already granted admin. Keep Gemma/application AI reviews off: valid contributions publish immediately; reports and manual moderation remain. Start with the remaining hosted publication/admin/report/two-account checks, then operations/security readiness. Browser automation needs my explicit reauthorization, so guide me through checks unless I authorize it. Design future report-assisted AI separately. The shared database firewall rules must be narrowed before production after reviewing cost and verifying a replacement. Continue useful work and make routine decisions; ask me only for missing account setup, required authorization or material product choices. Do not repeat completed setup or expose secrets. Give me one consolidated review of changes and remaining decisions.
