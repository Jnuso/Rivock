# Rivock development and deployment runbook

Deployment runbook: **the Azure PostgreSQL server/schema are ready; app hosting is not provisioned**. See [authenticated preflight](AZURE_PREFLIGHT.md) for subscription policy, regional support, environment quota and firewall evidence. The revised build combines React and FastAPI in one Container App because the student policy blocks Static Web Apps. Monthly target remains $10 excluding the annual domain, including any paid AI usage. Exact credit expiry/current balance, measured billing, narrow app/job routing and final deployment capacity remain unverified.

## Local setup

Dedicated repository: `git@github.com:Jnuso/Rivock.git`. Inspect/reuse a suitable existing checkout; otherwise clone into a dedicated Rivock directory, keeping unrelated Codex files untouched. Use HTTPS if local SSH execution remains unavailable; do not alter global SSH settings blindly. Verify repository remote/default branch before publishing anything. Do not initialize this planning output folder as the application's repository.

Tested runtime baseline: Python 3.12.14, Node.js 24.19.0, PostgreSQL 17.11. Lockfiles capture installed dependencies. The repository contains frontend/backend, docs, infra/Compose, `.env.example`, ignored local environment/runtime files, README, and scoped agent instructions. Follow the root README for executable local commands. Docker images, Compose startup, all three migrations and the 153-test backend suite were verified locally on October 14 through approved host commands; cloud deployment remains separate. Bicep exposes explicit `aiBillingMode` (default metered); free mode is restricted to the verified Gemma model. A successful fictional live evaluation does not authorize public content transfer or establish broad moderation quality.

Compose starts PostgreSQL with a named volume, localhost-only exposed port, health check, and test/dev credentials distinct from production. Backend uses migrations and explicit fictional seed command; frontend uses Vite. Provide a native frontend command and Docker-based end-to-end start path. Expected local ports: frontend 5173, API 8000, PostgreSQL 5432. FastAPI schema/docs available locally. Read-only/fixture demonstrations are labeled; real protected flows require Clerk configuration.

The worker runs from the same backend image with a separate command. Local development can run it continuously with a five-second idle sleep; cloud runs a bounded scheduled Job every five minutes. Lease/retry semantics are identical. No fake production identity issuer, public database-admin interface, or production-data seed.

## Environment configuration

| Browser-public configuration | Server/worker-only configuration |
| --- | --- |
| API base URL; Clerk publishable key | Database credentials; Clerk issuer/authorized frontend origins/optional audience; AI model/key/prices/limits; retry/lease/rate settings; HMAC secret; CORS origins; log level |

Browser settings are not secrets; anything built into a Vite bundle is public. Google OAuth secrets stay in Clerk. AI/database credentials go in Azure secret configuration and never GitHub source or print output. Keep example values as placeholders. Backend must refuse fixture AI mode in production and fail clearly on missing required auth configuration.

## Azure deployment defaults

| Component | Proposed service | Constraint |
| --- | --- | --- |
| React website and FastAPI | One Azure Container App, Consumption | Same-origin `/api/v1`; minimum replicas 0, maximum 1, 0.25 vCPU/0.5 GiB; shared cold starts; readiness/liveness configured |
| Moderation/cleanup worker | Azure Container Apps scheduled Job | Same image/secrets; five-minute schedule; one parallel execution, sixty-second cap, twenty-item batch |
| PostgreSQL | Azure Database for PostgreSQL Flexible Server | Only if actual student/free eligibility and expected cost fit; use allowed small SKU/storage, same region where possible |
| Container image | Public GHCR package for public repository | No embedded secrets; immutable tag/digest; avoids assuming a paid Azure Container Registry is required |
| Identity | Clerk Hobby initially | Email/password and Google; development key locally, verified production instance/domain and public key for deployment; review current free limits |

`infra/app.Dockerfile` builds one image containing the website and API; the same image supports migration and worker commands. Keep API/job/database in Canada Central, subject to actual capacity and quota validation. The combined website/API needs one HTTPS origin, with API errors distinct from SPA navigation. No Kubernetes, Redis, NAT Gateway, private endpoint, paid edge gateway or permanent VM has been added.

Database connections use verified TLS, strong secret credentials, separate migration/runtime roles, and narrow feasible firewall rules. Confirm the Container Apps egress behavior before choosing rules; avoid weakening database exposure just to get a connection. If private networking/static egress makes the student deployment exceed budget, revisit hosting rather than silently adding costly services.

## Cost and eligibility check before provisioning

1. Inspect the actual subscription type, student credit balance/expiry, region/SKU eligibility, and billing restrictions. Student Starter differs from a full Azure for Students subscription.
2. Verify the current PostgreSQL offer: Microsoft advertises eligible student/new-customer amounts including 750 hours of B1MS Flexible Server, 32 GB data and backup storage, with time/eligibility restrictions. Treat credit-funded usage as spend, not permanently free hosting.
3. Estimate API + scheduled-job execution, database compute/storage/backups, logs, bandwidth/egress, and AI under the chosen region/tiers. Empty scheduled jobs also consume startup/query resources. Container Apps free grants are shared at subscription level.
4. Reserve the proposed AI ceiling of $2/month within the $10 total target. If the complete Azure plan cannot fit, retain Azure frontend/API and Clerk identity and review an external managed PostgreSQL service such as Neon. Verify its current storage/compute/backup/region limits before selecting it. No fallback subscription/service is created automatically by this draft.
5. Configure monthly budget alerts at $5/$8/$10, replica/job caps, bounded log retention, AI caps, and an operator pause procedure. Alerts do not impose an Azure hard spending cap. Determine whether the student's spending limit is active rather than assuming.
6. Record estimated steady-state cost, credit expiry, post-credit price, first-month actuals, and reconsideration date. If the plan exceeds the target, stop before provisioning paid capacity and present the concrete revised hosting option for review.

Current offer sources checked October 11, 2026: [Azure for Students](https://azure.microsoft.com/en-us/free/students/), [Static Web Apps plans](https://learn.microsoft.com/en-us/azure/static-web-apps/plans), [Container Apps billing](https://learn.microsoft.com/en-us/azure/container-apps/billing), [scheduled jobs](https://learn.microsoft.com/en-us/azure/container-apps/jobs). Offer eligibility is not verified by reading these pages.

## CI/CD and release

- Configured CI: backend Ruff and pytest with real PostgreSQL; frontend TypeScript, Vitest/Testing Library, build and npm audit; OpenAPI/generated-type drift checks; backend container build. Real browser journeys and hosted integration checks remain separate launch gates. The workflow has not yet run on GitHub.
- Keep secrets unavailable to untrusted fork PRs. Deploy to Azure using GitHub OIDC federation where supported. Set the protected release environment's public `CLERK_PUBLISHABLE_KEY` variable before image publication; database/AI secrets remain runtime-only.
- Build the combined image once, push its immutable digest to GHCR, and run migrations as an explicit one-off deployment job with migration credentials. Do not run competing Alembic upgrades from every API replica on startup.
- Initial schema is already initialized; later migrations use expand/contract changes compatible with the prior image. Deploy website/API and job using the same reviewed digest and migrate before enabling new frontend behavior. Record deployed commit/digest/schema version.
- Run hosted smoke tests: anonymous feed, actual Clerk email/Google flow, username onboarding, publish/reply/accept, saved/privacy, notifications, moderation pending/retry, admin controls. Use fictional test content and cleanup.
- Roll back frontend/API/job to prior digest if needed. Never blindly downgrade a destructive migration; restore or forward-fix using the recorded schema compatibility and tested backup procedure.

## Monitoring, backup, and failure handling

Structured request IDs, status/latency, readiness, database errors, moderation queue age/retries/decisions, provider usage, and cost reservations. No raw post/email/token logging. Start with seven-day application log retention and a configured ingestion cap where supported. Track cold starts separately from warm response latency. Check usage after the first day/week and monthly; this document does not create a recurring automation.

Use the managed database's available automatic backups (target seven-day recovery window), and verify what the chosen tier actually includes. Perform a restore drill before public launch. For a tier without adequate automatic recovery, arrange a daily encrypted off-provider export, private retention of seven daily copies, and include its storage cost. Proposed recovery target: at most 24 hours of data loss and same-day manual restoration; no uptime SLA. Export append-only erasure events to a separate encrypted private journal after erasure batches and at least daily; retain for thirty days. Private Blob Storage or a reviewed encrypted off-provider location can hold this journal, with cost included. Before restored data goes public, replay the latest journal and reconcile any later known erasures; if journal recovery is incomplete, keep restoration private until checked. Do not claim point-in-time erasure preservation beyond the verified backup/journal procedure.

If database is unavailable, reads/writes fail honestly with retry guidance; no fake success. If AI is unavailable, stored pending submissions survive and retry. If Clerk is unavailable, public reading continues and new protected actions require sign-in recovery. If budget is exhausted, pause AI/bots/jobs as appropriate and leave honest pending status rather than silently charging beyond configured application caps.

Domain purchase is not confirmed. When owned, configure root/www frontend and optional API subdomain with managed HTTPS, then update Clerk domain/return URLs, CORS, and CSP. Domain purchase, public deployment, and paid-resource provisioning are separate from this documentation delivery.
