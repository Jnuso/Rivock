# Rivock: review and next setup

Updated October 14, 2026. The core application is implemented locally. The user selected **Clerk** to replace Entra after tenant creation was unavailable in the university directory. The user has now created the reviewed Azure PostgreSQL server; no application has been pushed or publicly deployed.

## Next action

**October 16 update:** the user wants a provider-hosted preview before buying a domain. That is supported: GitHub Pages can host the static frontend, while the simpler full-app preview uses the combined Container App's generated Azure HTTPS address and Clerk development keys. Preview configuration is not yet implemented/deployed; production guards remain intact. Domain purchase is deferred to the final production setup. See [preview decision and required checks](AZURE_PREFLIGHT.md#preview-before-purchasing-a-domain-october-16-update). The production sequence below follows that preview.

Google sign-in and Rivock username creation succeeded, as reported by the user on October 14. A read-only database check confirmed one persisted account linked to the configured Clerk instance; API/frontend health checks also pass. The integration needs no Clerk secret key.

The user confirmed the posting/save/sign-out/repeat-login checklist works. A read-only check at that checkpoint found one saved thread and a published reply submission. The user then confirmed the full two-account Question/reply/**Accept answer**/**Alerts** notification-link journey works. These later browser checks are user-reported; no agent browser inspection is claimed.

Google AI Studio **Gemma 4** is configured and passed isolated fictional evaluation. Five benign examples were allowed by Gemma; three spam vectors were rejected by rules, with no deferrals. Six model attempts including the initial smoke recorded zero cost. The 145-test backend suite passes. See [Gemma setup](GEMMA_SETUP.md) and the [sanitized report](gemma-evaluation.json).

The user explicitly approved local Google moderation after the initial automatic approval rejection. API/worker were rebuilt and restarted together with the verified free Gemma model, zero token prices, 100 daily calls and the existing $2 monthly ceiling for future paid configuration. Both containers confirmed the settings/key presence; API/database health, frontend HTTP and the non-fixture API indicator pass. No submissions were queued before activation.

The next browser-created question is verified: Gemma allowed it in one AI attempt (about 0.99 seconds) and it is published. [My submissions](http://localhost:5173/submissions) now explicitly labels completed AI, rules, demo and moderator checks, with separate decisions and detailed time/Gemma name. Failures remain unreviewed, uncertainty is inconclusive, and only owners/admins see this metadata. The change is running locally; 153 backend and 34 frontend tests plus build pass.

**Next: domain selection and production Clerk, followed by publication and hosting/network review.** Azure management sign-in succeeded. Authenticated preflight found that the student's allowed regions exclude every Static Web Apps location. The revised build combines the React website and FastAPI API in one Container App; Canada Central supports the service and has an available environment quota. Spending limit is **On**. The database/schema/restricted logins remain verified over TLS, with private generated credentials in ignored `.env.azure`. The user confirmed no domain has been purchased. No local data/configuration was repointed and no cloud app/jobs or public image/repository release has been deployed. [Account evidence and remaining route checks](AZURE_PREFLIGHT.md) and [cost review](HOSTING_COSTS.md) distinguish known facts from pending workload capacity, narrow egress, credit expiry and actual billing.

The three local environment files are ignored by Git. [Clerk setup](CLERK_SETUP.md) records the identity configuration and remaining account-method/production checks.

## What is ready to review

| Area | Behavior |
| --- | --- |
| Conversations | Public questions/discussions, seven topics, five reply levels, accepted direct answer and votes; no communities/karma/gates |
| Discovery | Trending/Latest, full-text search/topic filters, private saves and paged replies |
| Accounts | Clerk login integration, Rivock pseudonym onboarding, profiles, ownership controls and deactivation |
| Editing | Last approved version stays public; complete drafts recover for 24 hours; explicit revision conflict choices |
| Navigation | New replies and notification links open the exact reply with bounded ancestor context |
| Moderation | Reports, blocks, admin actions, durable retries, cost reservations, usage caps and persistent pause |
| Operations | Three Alembic migrations, generated API types, Compose/CI/Bicep, restore and erasure replay |
| Demonstration | Five original fictional labeled conversations; no scraped training material or ongoing bots |

Stack: React/TypeScript/Vite, FastAPI, PostgreSQL 17, SQLAlchemy/Alembic, Clerk; Azure hosting preferred. DMs/uploads/ongoing bots/personalization remain later work. [Product decisions](README.md) and [implementation evidence](IMPLEMENTATION.md) record the detail.

The switch includes strict session-token checks, safe same-origin returns, account-switch/logout race guards and provider-neutral issuer/subject linkage. Legacy Entra rows preserve UUIDs/contributions under a separate namespace and cannot become Clerk accounts by matching email. Azure for Students is confirmed present in UConn's directory with subscription role Owner; that subscription remains a hosting candidate. Credits/expiry and resource costs still need review.

## Verification and limits

Current checks: **201 backend/script tests passed together in Docker with PostgreSQL 17.11**, followed by **18 focused static-hosting tests** covering the final malformed-path guard. All **34 frontend tests** pass on a one-worker rerun; the initial concurrent run had one five-second timeout. Types, production same-origin frontend build, combined Docker image build and Bicep compilation pass. The image uses a synthetic public login host for verification, with no real identity flow claimed. Earlier evidence also includes 22 native script tests and restricted cloud database/schema checks. Google sign-in and the core two-account journey have separate user-reported local browser success; limited Gemma evaluation has real-provider evidence.

Docker API/frontend/worker images built and the local stack started successfully through an approved host command. HTTP smoke checks passed for health, seven topics, five labeled fictional threads, detail/search, CORS and anonymous/malformed-token authorization. The native PostgreSQL bind restriction remains, but Docker resolved the database verification blocker. An earlier independent coding-worker review could not start under the then-active approval policy; no worker result is claimed.

Email/password/recovery, browser layouts/accessibility/CSP, broad AI moderation quality, GitHub workflows, Azure hosting and managed backups remain unverified/incomplete. Local provider activation and a subsequent browser-created AI-approved question are verified by runtime records. No agent browser inspection, independent worker review result, initial commit/push or public deployment is claimed. The October 11 baseline also includes a synthetic dump/restore with later erasure replay.

## Then proceed in this order

1. Select/purchase the domain, configure Clerk production and its public key, then publish the reviewed repository and run GitHub CI. Keep the synthetic verification key out of releases.
2. Finalize narrow website/API and job database routing, actual workload quota/capacity, budget alerts and the monthly estimate before additional provisioning. The combined template keeps the app/worker disabled initially.
3. Publish the reviewed image digest, run the explicit migration job, enable website/API, connect domain/TLS and verify account methods/browser layouts/CSP. Enable the worker only after its separate route/provider checks.
4. Review public moderation/data suitability and managed backup recovery; record actual day/week costs and cold starts. Target $10/month excluding domain, including up to $2 AI; alerts do not cap Azure spending.

A portable Azure CLI and protected project wrapper are authenticated. Docker is working through approved host commands. The [Azure runbook](AZURE_SETUP.md) covers hosting; app authentication uses Clerk and needs no new Microsoft tenant or Entra trial.
