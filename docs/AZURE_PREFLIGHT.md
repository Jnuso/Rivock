# Authenticated Azure hosting preflight

Checked October 14, 2026 through the task's authenticated Azure CLI. This records account evidence, not a completed deployment or measured bill.

| Check | Observed result |
| --- | --- |
| Subscription | Azure for Students, Enabled, spending limit **On** |
| Location policy | `sys.regionrestriction` permits `northcentralus`, `mexicocentral`, `spaincentral`, `germanywestcentral`, `canadacentral`; global resources are exempt |
| Static Web Apps | Provider lists Central US, East US 2, West US 2, West Europe, East Asia; none intersects the allowed locations |
| Container Apps | Provider supports Canada Central for environments, apps and jobs; `Microsoft.App` registration completed |
| Regional environment quota | Canada Central: 0 used / 1 allowed. This does not prove sufficient workload vCPU quota or deployment capacity |
| Existing resource group | `rivock-dev` contains the PostgreSQL server only; no app environment, app or job exists |
| PostgreSQL | Ready, version 17, B1ms, 32 GB/P4, seven-day backups; HA, geo-backup and storage autogrow disabled |
| PostgreSQL access | Public endpoint, exactly one single-address firewall rule; no all-Azure exception or private endpoint |
| Domain | User confirmed **not purchased** |

## Hosting decision

Replace the separate Static Web App with **one Container App serving the compiled React website and FastAPI API**. API calls use `/api/v1` on the website's own origin. This preserves the chosen stack, avoids the actual region-policy block and needs no extra frontend hosting account. It also makes page reads count toward Container Apps requests/compute and exposes the website to the same cold starts as the API.

`infra/app.Dockerfile` builds the combined image. The public production Clerk key is a build argument; no database, migration or AI secret belongs in a build argument. The root `.dockerignore` excludes private environment files, Azure credentials and development dependencies. Local Compose continues using Vite and the existing development database.

The template creates a Consumption environment and a manual migration job. The combined web/API app and scheduled worker stay disabled by default. No paid networking, Log Analytics, registry, extra database or Dedicated profile has been added. One API replica uses 0.25 vCPU / 0.5 GiB with min 0 / max 1; the optional worker uses the same allocation for at most 60 seconds every five minutes. Actual total costs remain unmeasured.

## Database route before enabling hosting

The candidate low-cost route is public PostgreSQL with individual observed egress IP rules, managed explicitly. Container Apps egress addresses can change and may be shared: this is **not a static-egress guarantee**. [Microsoft networking guidance](https://learn.microsoft.com/en-us/azure/container-apps/networking).

Before enabling app traffic, inspect the app's reported outbound addresses and verify its actual database connectivity. Verify migration-job and worker-job egress separately; do not assume a job uses the app's addresses. Add only the reviewed necessary individual addresses. Keep the existing client rule only while operator access needs it. Check after every deployment/environment change and when readiness fails; reconcile obsolete addresses manually. A changed egress route must fail closed, with no automatic broad firewall exception.

This route is a proposal for the small learning deployment. If Azure cannot expose a usable narrow address set for both apps and jobs, stop before activation and compare a priced network option or hosting alternative. NAT, private endpoints, broad regional CIDRs and “allow all Azure services” are not implicit fallbacks. No firewall changes were made during preflight.

## Preview before purchasing a domain (October 16 update)

The user wants an online test before buying a custom domain. Domain purchase is **not a prerequisite for a preview**. Clerk documents using development API keys with a host-provided preview domain; production keys cannot be used on that domain. [Clerk preview environments](https://clerk.com/docs/guides/development/managing-environments#use-your-hosts-provided-preview-domain).

GitHub Pages can provide a free `jnuso.github.io/Rivock/` frontend address for a public repository, but only serves static files; FastAPI/PostgreSQL still need separate hosting. [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [server-side language limitation](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site#static-site-generators). That option also needs frontend base-path/navigation and API-origin configuration.

The recommended preview is the existing combined Container App at its generated `*.azurecontainerapps.io` HTTPS address, avoiding a second frontend deployment. The address needs no purchased domain; app/database usage still follows Azure billing and allowances. [Azure default addresses](https://learn.microsoft.com/en-us/azure/container-apps/connect-apps), [HTTPS ingress](https://learn.microsoft.com/en-us/azure/container-apps/ingress-overview).

Before a preview deployment, add and verify an explicit preview configuration using Clerk development keys and the exact HTTPS preview origin, retaining verified database TLS, real token validation, secure HMAC and fixture restrictions. The current production guards intentionally reject development keys; preview support is proposed, **not implemented or deployed**. Keep test content/accounts clearly separate from a production launch. Network/cost/image publication checks below still apply. No custom-domain purchase, Pages publication, app provisioning or production-guard change occurred during this review.

## Remaining production release steps

1. After the preview, select/purchase a domain and configure the corresponding Clerk production instance. The production configuration and final public image depend on that selection; a provider-hosted preview can happen first. Clerk's production guide requires a domain you own and access to its DNS records. [Clerk production setup](https://clerk.com/docs/guides/development/deployment/production).
2. Publish the reviewed repository, run GitHub CI and configure the protected `release` environment's **variable** `CLERK_PUBLISHABLE_KEY` with the actual public `pk_live_...` value. CI uses a synthetic non-existent host only to validate builds; never release that test key.
3. Publish the reviewed digest to a publicly readable GHCR package. Complete the cost/network review, budget alerts and Azure what-if using private parameters before creating hosting resources.
4. Establish the narrow database route, run the migration job successfully, then enable the combined app. Bind the domain/TLS and use that same HTTPS origin for Clerk authorized parties/CORS. Enable the worker only after its route and provider/data settings are verified.
5. Verify hosted browser journeys, cold starts, actual usage/billing, managed restore and rollback. Browser automation remains unapproved; HTTP/component tests do not establish layout or live Clerk correctness.

The spending limit protects the subscription's overall credit balance; it is not the $8 monthly planning cap. Exact credit expiry/current balance, backup allowance, first billing records and alert recipients still require inspection. No app-hosting resources or public release were created by this preflight.
