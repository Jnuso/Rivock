# Rivock: review and next setup

For the current checkpoint, prioritized next work and a copyable new-chat prompt, start with [HANDOFF.md](HANDOFF.md). Historical setup/evaluation paragraphs below are superseded by that checkpoint and the current moderation policy.

Updated October 16, 2026. The [Azure preview is live](https://rivock-api.wittymushroom-48e2dfec.canadacentral.azurecontainerapps.io/) with successful database/API/HTTP checks. The core application and immutable preview image are published with successful GitHub checks. Clerk replaces the unavailable external Entra tenant setup. This is a test preview; production and hosted browser verification remain pending.

## Next action

**Hosted account check passed:** the user confirmed Google sign-in/onboarding, votes/saves and repeat-login persistence and identified username `jack`. The audited operator command assigned admin to that existing account; an independent read-only check confirmed active/linked/admin state and one grant audit. Refresh [the hosted admin page](https://rivock-api.wittymushroom-48e2dfec.canadacentral.azurecontainerapps.io/admin) to verify the visible controls. Hosted two-account conversation checks remain pending.

**Immediate publication is live:** the user withdrew cloud Gemma activation. Application commit `d3879aa` passed CI/image publication and is deployed with reviews off, honest unreviewed metadata, reports/manual moderation and existing validation/rate/duplicate/state protections. Live health/privacy/headers/auth checks pass. The one ordinary pending item was published through the shared validated service; read-only metadata confirms zero pending items and zero cloud AI attempts. No AI key or scheduled Google worker was enabled. AI assistance after reports is a [future design](REPORT_MODERATION.md).

Azure's app, WorkloadProfiles/Consumption environment and manual migration job are provisioned; the corrected migration succeeded and HTTPS-only ingress is enabled. The $10/month budget and $5/$8/$10 notifications are active. After the initial automatic approval rejection, the user explicitly approved the frozen 161 shared egress IP rules; read-back verified that exact set. The user required tighter security later: review/implement a narrower database route and remove the preview rules before production. [Deployment and approval evidence](PREVIEW_DEPLOYMENT.md).

The user selected the combined Container App's generated Azure HTTPS address for testing before buying a domain. Preview retains cloud TLS/HMAC/token/fixture protections and the production-key restriction. The GitHub preview variable, CI and image publication are complete. The [preview walkthrough](PREVIEW_SETUP.md) records setup history; hosted Google sign-in is user-confirmed. Cloud AI moderation is off with no provider key or scheduled worker enabled.

Google sign-in and Rivock username creation succeeded, as reported by the user on October 14. A read-only database check confirmed one persisted account linked to the configured Clerk instance; API/frontend health checks also pass. The integration needs no Clerk secret key.

The user confirmed the posting/save/sign-out/repeat-login checklist works. A read-only check at that checkpoint found one saved thread and a published reply submission. The user then confirmed the full two-account Question/reply/**Accept answer**/**Alerts** notification-link journey works. These later browser checks are user-reported; no agent browser inspection is claimed.

Google AI Studio **Gemma 4** is configured and passed isolated fictional evaluation. Five benign examples were allowed by Gemma; three spam vectors were rejected by rules, with no deferrals. Six model attempts including the initial smoke recorded zero cost. The 145-test backend suite passes. See [Gemma setup](GEMMA_SETUP.md) and the [sanitized report](gemma-evaluation.json).

The user explicitly approved local Google moderation after the initial automatic approval rejection. API/worker were rebuilt and restarted together with the verified free Gemma model, zero token prices, 100 daily calls and the existing $2 monthly ceiling for future paid configuration. Both containers confirmed the settings/key presence; API/database health, frontend HTTP and the non-fixture API indicator pass. No submissions were queued before activation.

The next browser-created question is verified: Gemma allowed it in one AI attempt (about 0.99 seconds) and it is published. [My submissions](http://localhost:5173/submissions) now explicitly labels completed AI, rules, demo and moderator checks, with separate decisions and detailed time/Gemma name. Failures remain unreviewed, uncertainty is inconclusive, and only owners/admins see this metadata. The change is running locally; 153 backend and 34 frontend tests plus build pass.

**Hosting basis:** authenticated preflight found no permitted Static Web Apps region, so one Container App serves React and FastAPI in Canada Central. The environment quota is now occupied by Rivock; no second free environment is assumed. Spending limit was confirmed **On**. Restricted runtime/migration credentials remain in owner-protected ignored files; both cloud URLs use the image's explicit CA bundle with verify-full. No domain has been purchased or local data copied. [Preflight](AZURE_PREFLIGHT.md), [cost review](HOSTING_COSTS.md) and [deployment evidence](PREVIEW_DEPLOYMENT.md) distinguish actual checks from remaining credit expiry, real usage and security work. Budget alerts notify rather than cap charges.

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

The switch includes strict session-token checks, safe same-origin returns, account-switch/logout race guards and provider-neutral issuer/subject linkage. Legacy Entra rows preserve UUIDs/contributions under a separate namespace and cannot become Clerk accounts by matching email. Azure for Students in UConn's directory hosts the preview; the user has subscription role Owner. Exact remaining credit/expiry and observed hosting costs still need verification.

## Verification and limits

Latest application release `d3879aa` passed GitHub CI and preview publication and is deployed with reviews off. Direct checks included PostgreSQL backend tests, operator-helper tests, **35 frontend tests**, types/build, Ruff, Bicep and the combined preview image smoke. Azure deployment and live HTTP/headers/privacy/protected-route checks passed. Hosted Google sign-in/onboarding/vote/save persistence is user-confirmed; the full two-account journey has separate local browser evidence. Earlier Gemma evaluation is historical, not the current policy. [Detailed evidence and counts](IMPLEMENTATION.md).

Docker API/frontend/worker images built and the local stack started successfully through an approved host command. HTTP smoke checks passed for health, seven topics, five labeled fictional threads, detail/search, CORS and anonymous/malformed-token authorization. The native PostgreSQL bind restriction remains, but Docker resolved the database verification blocker. An earlier independent coding-worker review could not start under the then-active approval policy; no worker result is claimed.

Fresh hosted immediate publication, admin/report and two-account flows, email/password/recovery, browser layouts/accessibility/CSP behavior and managed backup recovery remain unverified/incomplete. Hosted Google sign-in already passed the user's check. Cloud provider activation was withdrawn; earlier local AI evaluation is historical. No agent browser inspection or completed independent worker review is claimed. The October 11 baseline includes a synthetic dump/restore with later erasure replay; this does not verify Azure-managed recovery.

## Then proceed in this order

1. Refresh the hosted app and verify a fresh post/reply publishes immediately, followed by the admin/report and two-account conversation journeys. Initial Google/onboarding/vote/save checks and the operator grant are complete.
2. Keep Gemma reviews off. Design report-assisted AI separately without reinstating the initial-publication gate; review its triggers, data handling, outcomes/appeals and budgets before implementation.
3. Verify managed backup restoration, prior-image rollback and operator pause; record day/week costs and cold starts. Target $10/month excluding domain, including up to $2 AI; alerts do not cap spending.
4. Before production, implement the narrower, cost-reviewed database connection requested by the user and remove shared-pool/obsolete rules. Then buy/bind the domain, configure Clerk production, rebuild with its real public key and recheck browser/auth/TLS behavior.

A portable Azure CLI and protected project wrapper are authenticated. Docker is working through approved host commands. The [Azure runbook](AZURE_SETUP.md) covers hosting; app authentication uses Clerk and needs no new Microsoft tenant or Entra trial.
