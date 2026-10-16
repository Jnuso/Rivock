# Azure setup and release checklist

The Azure PostgreSQL server/schema and restricted logins are ready. Management sign-in and [authenticated hosting preflight](AZURE_PREFLIGHT.md) are complete. The student's policy blocks Static Web Apps' supported regions, so the current template serves React and FastAPI together in one Container App. No cloud app/jobs, domain records or deployment identity have been configured. Start with the [hosting cost review](HOSTING_COSTS.md); compilation does not prove network feasibility, capacity or a final bill.

## Account values required

Observed October 14, 2026: Azure for Students is present in the university workforce directory and the user is subscription Owner. Before database creation, the user reported **$100 unused credit** and roughly one year remaining. Authenticated management checks now confirm subscription Enabled and spending limit On; exact credit expiry/current balance and actual billing remain unverified. Canada Central accepted B1ms/32 GiB with displayed free compute/storage allowances. The actual policy/provider intersection led to the [combined hosting decision](AZURE_PREFLIGHT.md). Entra tenant creation was unavailable; **Clerk** replaces that component without transferring or upgrading the subscription.

Use your Azure for Students subscription to inspect credit balance/expiry, spending limit, region availability, and PostgreSQL offer eligibility. Record a complete monthly estimate, including database compute/storage/backups, API and job execution, bandwidth, logs, and up to $2 for AI. The target is $10 excluding the domain. No database service is provisioned by `infra/main.bicep`; its existing database URL is a required secure parameter. This avoids choosing an unverified paid database tier automatically.

| Setting | Where to obtain it |
| --- | --- |
| Clerk publishable key | Clerk application's development instance locally; production public key for deployment |
| Clerk issuer | Matching Frontend API HTTPS origin without trailing slash; local helper derives it from the public key |
| Authorized parties | Exact frontend HTTPS origins for deployment, passed as `CLERK_AUTHORIZED_PARTIES` |
| Optional audience | Only when a custom session `aud` is configured; otherwise blank |
| Email/password and Google | Enable in the Clerk application; configure production Google OAuth credentials in Clerk |
| Database URL | Reviewed PostgreSQL instance, runtime credentials, verified TLS, connection limit and approved firewall/network route |
| AI model/key/billing/prices | Gemma 4 passed a limited isolated local evaluation. Review data suitability/activation and current prices before public `google` mode; use explicit `aiBillingMode` (metered by default, or allowlisted free with zero prices) |

Use the provider-hosted sign-in pages. Rivock does not collect passwords. The API validates the Clerk user-session signature/issuer, timestamps, version/session/user IDs, authorized frontend origin, optional configured audience and local account status. The user confirmed local Google sign-in and the two-account journey; remaining account methods and production identity still need smoke tests.

Never send account passwords or API secrets in chat. Put secrets in local ignored `.env` files or Azure secret configuration. Only public SPA settings belong in `VITE_*` variables.

## Current database and first connection

User-provided Overview screenshot: `rivock-dev-jnuso`, resource group `rivock-dev`, **Canada Central**, **Ready**, PostgreSQL **17.11**, B1ms/32 GiB, HA disabled. Endpoint: `rivock-dev-jnuso.postgres.database.azure.com`; administrator login: `Jnuso`. The creation review specified seven-day backups, autogrow/geo-redundancy off, one current-client-IP firewall rule and no all-Azure access. The user has now initialized the application database and both restricted logins, as verified below.

A local password-free PostgreSQL TLS handshake verified the endpoint certificate/hostname with TLS 1.3. That only verifies network/TLS reachability, not login or database permissions. Run the read-only login check in an interactive PowerShell terminal:

```powershell
Set-Location 'C:\Users\Jnuso\Codex\Codex\Codex\Rivock'
.\backend\.venv\Scripts\python.exe .\scripts\check-azure-db.py --host rivock-dev-jnuso.postgres.database.azure.com --user Jnuso
```

The password prompt does not echo or save the password and refuses insecure echo fallback. The helper exports public system-trusted CA certificates to a temporary file, uses `sslmode=verify-full` with TLS 1.2 or newer, and checks PostgreSQL 17/read-only/TLS session metadata through one SELECT. Raw driver errors and connection URLs are not printed. It does not change any environment file, database data or schema; no existing local data is transferred. Its focused synthetic tests pass separately from real cloud login. [PostgreSQL certificate verification](https://www.postgresql.org/docs/17/libpq-ssl.html), [Azure TLS configuration](https://learn.microsoft.com/en-us/azure/postgresql/security/security-tls-how-to-connect).

The user ran that check successfully: authenticated `Jnuso` on `postgres`, PostgreSQL 17.11, TLS 1.3 and read-only mode. This is user-provided command output; the coordinating agent did not receive the administrator password.

### Initialize Rivock on the existing server

From the same repository-root PowerShell terminal, run this entire command on one line:

```powershell
.\backend\.venv\Scripts\python.exe .\scripts\setup-azure-db.py --host rivock-dev-jnuso.postgres.database.azure.com --user Jnuso
```

Enter the same administrator password at the hidden prompt. This creates database `rivock` on the existing server, `rivock_migrate` and `rivock_app` logins, and applies all three migrations through the migration login in a real transaction. The seven preset topics are installed by the schema migration; no user accounts, conversations or local database content are copied. The administrator retains database ownership; neither new login is a superuser, database/role creator, replication role or RLS bypass role. Runtime receives application-table DML and sequence usage, without schema creation, truncation, migration-table access or migration-role membership.

Only generated app/migration credentials and connection URLs go into Git-ignored **`.env.azure`**; the administrator password is not saved. The file is created exclusively, with owner-only POSIX permissions or an explicit current-user Windows ACL before any secrets are written. Its URLs use verify-full/system roots for the later CA-equipped Linux deployment; local initialization uses the temporary public system-CA bundle. Do not paste/commit the credential file or replace the local app's `.env` with it.

Reruns preserve rows/passwords and resume only objects marked with this file's random setup identifier. Keep `.env.azure` after partial or successful initialization. Pre-existing/unmarked databases or roles and privilege drift cause a safe refusal rather than adoption, deletion or password rotation. A crash between creating a database and writing its comment needs manual inspection; never delete a database to resolve that warning blindly. SQL/driver failures print sanitized messages and, where available, a SQLSTATE code rather than a raw traceback or secret-bearing URL.

**The user ran initialization successfully on Azure.** The output confirms database `rivock`, schema `31c7a48a90c1`, seven topics, restricted runtime permissions and no copied local data. A subsequent agent-run read-only check independently authenticated both generated logins with certificate/hostname verification over TLS 1.3, confirmed privileged role flags are false, checked runtime privilege boundaries, seven topics and zero users/threads, and read the current migration revision through the migration login. Owner-only file permissions required approved host access; no file permissions were weakened, credentials displayed or administrator password requested.

The combined local suite passes **162 backend + 22 script tests** against PostgreSQL 17.11; integration tests use a new non-superuser administrator and isolated generated test databases/roles. Tests verify complete migrations, restricted runtime DML/DDL boundaries, future grants, safe reruns/collisions, transaction rollback and no app-settings reads through the external migration path. The 22 script tests also pass natively, including Windows private-file permission setup. These local tests are separate from the live read-only checks above.

API/job regional availability, outbound firewall maintenance, full cost/alerts and production Clerk still need review; do not enable broad Azure firewall access to bypass those tasks.

## Azure management sign-in

The workspace uses Microsoft's official Azure CLI 2.91.0 Windows ZIP distribution, rather than a system-wide installation. [Microsoft installation guidance](https://learn.microsoft.com/en-us/cli/azure/install-azure-cli-windows?pivots=zip). `scripts/azure.ps1` locates an installed CLI or the portable `../tmp/azure-cli/bin/az.cmd`, configures repository-local `.azure`, and restricts that directory to the current Windows account. `.azure/` and `.env.azure` are ignored by Git; authentication tokens must never be copied into parameters, source or chat.

From this repository's existing PowerShell terminal:

```powershell
.\scripts\azure.ps1 login --tenant 17f1a87e-2a25-4eaa-b9df-9d439034b080
```

Complete Microsoft's browser sign-in with the UConn account that owns **Azure for Students**. Select that subscription if prompted. The initial Windows WAM attempt failed with an incorrect key-storage-parent error (2150171662); the wrapper now sets `AZURE_CORE_ENABLE_BROKER_ON_WINDOWS=false` so this task uses browser OAuth. This is a process configuration override, with no Windows account reset or cache deletion. [Microsoft browser-sign-in guidance](https://learn.microsoft.com/en-us/cli/azure/authenticate-azure-cli-interactively#sign-in-with-a-browser).

The user completed browser sign-in and selected Azure for Students. Authenticated inspection confirmed Enabled/spending limit On, the five-region policy, Canada Central Container Apps support, one available environment quota and the narrow database firewall. `Microsoft.App` registration completed; no app-hosting resources were created. See [preflight evidence](AZURE_PREFLIGHT.md). Use the same wrapper for later commands and approved host access for its owner-protected cache; never print access tokens.

## Concrete infrastructure

`infra/main.bicep` creates a Container Apps environment and a manual migration job. The combined website/API app and scheduled worker are disabled by default until migration/network checks succeed. It uses the public GHCR combined image pinned by digest. Website/API resources are 0.25 vCPU/0.5 GiB, min replicas 0/max 1; worker runs every five minutes with one replica and a 60-second cap. AI costs are reserved transactionally in PostgreSQL with $2/month and 100 calls/day defaults. Azure alerts do **not** cap cloud spend.

No Log Analytics workspace is created. Native Container Apps metrics and live console diagnostics remain available; configure a reviewed log retention/ingestion budget before launch if historical application logs are needed. Database firewall/egress and separate runtime/migration roles must be configured for the selected provider; do not use an allow-all database firewall as a shortcut.

Validate with Azure CLI on a machine where it is installed and signed into the intended subscription:

```powershell
az account show
az bicep build --file infra/main.bicep
az deployment group what-if --resource-group <reviewed-resource-group> --template-file infra/main.bicep --parameters @<private-parameters-file>
```

Keep the parameter file outside Git. Supply `databaseUrl`, `migrationDatabaseUrl`, `rateHmacSecret` and any AI key as secure parameters. Use a random HMAC secret at least 32 characters long. `frontendOrigin` must match the actual HTTPS SPA origin; `clerkIssuer` must be the matching Clerk production Frontend API origin. `clerkAudience` stays blank unless customized. Start with `moderationMode=pending`, `enableApi=false`, `enableWorker=false`.

After reviewing actual cost and what-if output, deploy the template, start `<name>-migrate`, and inspect its **successful completion** before enabling API/worker with the same image digest. Do not run Alembic on every API startup. The initial worker may remain off until identity/provider setup is verified. Pausing AI in the admin console persists across processes; `AI_PAUSED=true` is an operator override that the console cannot undo.

## Images and frontend

CI builds and tests without deployment secrets, using a synthetic public login host for its combined-image check. `publish-image.yml` is a manual release workflow gated on a successful `Rivock CI` run for the selected commit. Configure a protected GitHub `release` environment with the **variable** `CLERK_PUBLISHABLE_KEY` set to the actual reviewed production public key. Never release the synthetic CI key. Make the GHCR package public for anonymous Container Apps pulls, or explicitly configure private registry credentials. No workflow automatically provisions Azure or purchases a domain.

Build the frontend using actual public values:

```powershell
$env:VITE_API_URL='/api/v1'
$env:VITE_CLERK_PUBLISHABLE_KEY='pk_live_<actual-public-key>'
$env:RIVOCK_PRODUCTION_BUILD='true'
cd frontend
npm ci
npm run build
```

The build writes its CSP into `dist/staticwebapp.config.json`; it refuses incomplete production configuration. `infra/app.Dockerfile` packages this build with FastAPI, which reads the security headers and serves trusted assets plus document-navigation fallback. API errors/missing assets remain errors. No separate Static Web Apps deployment token is needed. Check actual Clerk/challenge/fraud-protection endpoints against the CSP in the real browser smoke test. Azure deployment can use GitHub OIDC after creating a narrowly scoped federated identity; no federation values are fabricated here.

The user has not purchased a domain. After selection, configure Clerk production, bind the domain to the combined Container App with managed TLS, and use its exact HTTPS origin for authorized parties/CORS. Keep preview hosts separately allowlisted. Roll back the website/API and worker to their previous image digest; retain schema compatibility and forward-fix destructive migration problems.

## Required live checks

- Anonymous feed/search/topic/detail and direct deep-link refresh.
- Email/password and Google sign-in, onboarding collision, sign-out/cache clearing and reauthentication.
- Two real test accounts: question → reply → accepted answer → notification; saves and blocks stay private.
- AI safe/reject/ambiguous/outage cases with the configured real model; verify usage records against provider billing.
- 320/390/768/1440px layouts, keyboard focus, long Markdown and maximum-depth replies in a browser.
- Managed backup/restore plus later erasure-journal replay. The local synthetic restore drill is not a managed-service disaster recovery test.
- Verify observed day/week costs, cold starts, quota sharing and post-credit database price.

Sources consulted through Firecrawl search excerpts: [Container Apps jobs](https://learn.microsoft.com/en-us/azure/container-apps/jobs), [job resource schema](https://learn.microsoft.com/en-us/azure/templates/microsoft.app/jobs), [Static Web Apps configuration](https://learn.microsoft.com/en-us/azure/static-web-apps/configuration), [Clerk setup and primary references](CLERK_SETUP.md). Full-page Firecrawl retrieval required unavailable tool approval. These sources do not establish account eligibility or a verified monthly price.
