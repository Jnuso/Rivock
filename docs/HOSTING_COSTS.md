# Rivock hosting cost review

## Current operating checkpoint — October 17, 2026

The combined Azure preview is live on one Consumption Container App, min 0/max 1. The migration job is manual; the moderation worker is disabled and application AI is off with no cloud provider key. A new daily cleanup template is compiled but disabled and not deployed. The environment was read back with only a Consumption profile and no custom virtual-network integration.

A read-only resource-group ActualCost/MonthToDate query at 2026-10-17 07:11 UTC returned **USD 0.0034713738696 for rivock-api** and **USD 0 for PostgreSQL**. These are posted costs at that time, not a forecast, a complete day/week, or remaining credit. Billing may lag. Student spending limit/budget alert setup is recorded in PREVIEW_DEPLOYMENT.md; exact credit balance and expiry still need verification.

The current database has the explicitly approved frozen set of 161 shared Azure egress addresses plus two operator-IP rules. This is a preview exception; narrowing the route remains required before production. No paid networking is approved by this checkpoint. The new [network hardening review](NETWORK_HARDENING.md) estimates the current-stack private route at USD 33.35/month of undiscounted network base charges, above the total target, and requires an alternative/verified offer or budget decision. See HANDOFF.md for current release/security status.

## Historical October 14 planning review

The material below records the original pre-deployment assumptions and retail comparison. Its statements about unprovisioned app hosting, worker/provider settings and earlier firewall/quota counts are historical, superseded by the checkpoint above and PREVIEW_DEPLOYMENT.md. Do not repeat those setup steps or enable the old five-minute moderation worker as a default.


Updated October 14, 2026. The PostgreSQL server/schema are ready and Azure management preflight is authenticated. Spending limit is **On**; exact credit expiry/current balance, measured charges and cloud app networking still need verification. The app/jobs are not deployed. See [account evidence and revised hosting decision](AZURE_PREFLIGHT.md).

## Credit and budget

The user reports **$100 unused Azure for Students credit**, with the account created about a week ago and approximately one year remaining. Treat expiry as roughly October 2027 for planning, not a verified date. The earlier subscription screenshot showed Azure for Students and Owner access in the UConn directory. Clerk authentication does not require changing that tenant.

Spreading $100 across 12 months gives about $8.33/month. Aim for **under $8/month of credit consumption**, within the earlier $10/month overall target excluding domain registration. A service paid from credit still consumes the budget. Budget alerts are notifications, not spending caps; retain the student's spending limit and inspect its actual status.

## Proposed configuration

| Component | Initial configuration | Cost assumption |
| --- | --- | --- |
| Website and API | One Container App, Consumption, 0.25 vCPU/0.5 GiB, min 0/max 1 replica | Website and API share the compute/request grant and cold starts; domain registration separate |
| Moderation/cleanup | Consumption scheduled Job, same image, one execution every five minutes, 60-second timeout | Include startup and empty polling in compute usage; not a permanently running cloud worker |
| Database | One PostgreSQL Flexible Server, Burstable B1ms, 32 GB, no HA/read replica | $0 only if the student's advertised allowance actually applies and usage stays within it |
| Identity | Existing Clerk free plan | Stay within its published usage/features; production instance/domain still needs setup |
| Moderation | Existing Gemma 4 explicit free mode, 100 calls/day | Current token rates $0; reserve up to $2 in the overall budget for a reviewed future paid configuration |
| Logs, transfer, backup/journal storage | Small explicit limits, reviewed before provisioning | Fit these in the remaining budget; no claim of an entirely free bill |

The subscription rejected **East US**. Authenticated policy inspection found five allowed regions, including **Canada Central**. None of Static Web Apps' five supported regions is allowed, so the current template uses the combined Container App instead. Container Apps environments/apps/jobs support Canada Central, and the environment quota is 0 used / 1 allowed; actual workload quota/capacity remains a deployment check. Do not silently add Dedicated profiles, environment private endpoints/planned maintenance, NAT gateways, paid logging, HA or a paid registry.

Microsoft advertises **750 B1MS PostgreSQL hours, 32 GB data and 32 GB backup storage** in the student offer. The user's actual Canada Central creation screen explicitly displayed **Free up to 750 hours** for B1ms and **Free up to 32 GB** for storage. Its gross listed price was $13.50 compute + $4.06 storage = **$17.56/month before the displayed allowances**; it is not the East US retail comparison below. Backup allowance and first actual charges still need usage/billing verification. [Azure for Students](https://azure.microsoft.com/en-us/free/students).

Container Apps Consumption includes 180,000 vCPU-seconds, 360,000 GiB-seconds and two million requests per subscription/calendar month. At 0.25 vCPU/0.5 GiB, an illustrative 70 combined active hours/month uses 63,000 vCPU-seconds and 126,000 GiB-seconds. This fits those compute grants if otherwise unused; it is a planning scenario, not measured cloud usage. Idle allocations, jobs, other apps and traffic must also be counted. Dedicated profiles and certain environment features have separate management fees. [Container Apps billing](https://learn.microsoft.com/en-us/azure/container-apps/billing).

The earlier Static Web Apps Free proposal is superseded by the actual region restriction. The Gemma free tier/data terms are recorded in [Gemma setup](GEMMA_SETUP.md); local testing approval is not a public-launch privacy review.

## Paid database comparison

The [public East US retail snapshot](azure-retail-prices.json), queried directly from Microsoft's Retail Prices API, returned B1MS **$0.017/hour** and standard data storage **$0.115/GB-month**. At 730 hours and 32 GB:

`730 × $0.017 + 32 × $0.115 = $16.09/month`

This calculated base estimate is before student allowances/credits, taxes, any billable backup/IO/network extras and other services. It already exceeds the $8 credit target and $10 overall target. $100 would cover only about 6.2 months of that database base price. **Do not provision the ordinary paid configuration as an assumed fallback.**

If the student offer is unavailable, compare a separate database option before creating resources. Neon's current free plan lists 100 CU-hours/project/month, 1 GB PostgreSQL storage and 5 GB public transfer; quotas, backups and worker polling need review. A five-minute cloud poller can keep a scale-to-zero database active, so it is not an automatic drop-in free replacement. No Neon account/resource has been created. [Neon plans](https://neon.com/docs/introduction/plans).

## Current database and next checks

The portal's final review selected `rivock-dev-jnuso` in resource group `rivock-dev`, Canada Central, B1ms/32 GiB, PostgreSQL 17, seven-day backup retention, storage autogrow off, HA off and geo-redundancy off. Public access has one firewall rule added using the user's current client IP; access from all Azure services is off and no private endpoint was requested. The Overview screenshot shows **Ready**, PostgreSQL **17.11**, endpoint `rivock-dev-jnuso.postgres.database.azure.com` and administrator `Jnuso`. A local protocol handshake verified that hostname's certificate with TLS 1.3; this did not authenticate or create an application database.

The user initialized database `rivock`, separate migration/runtime logins, all three schema revisions and seven topics. Agent-run read-only checks independently authenticated both generated logins over verified TLS 1.3, confirmed restricted runtime permissions/current revision/zero user-thread rows, and inspected management policy/provider/quota settings after successful CLI sign-in. The local app/data were not repointed or copied. Spending limit is On; exact credit expiry/current balance, backup allowance, usage billing and budget alert recipients still need inspection.

The cloud API/job route is still pending. The [preflight runbook](AZURE_PREFLIGHT.md#database-route-before-enabling-hosting) proposes individual observed egress IP rules with manual drift reconciliation and separate job verification; it makes no static-egress guarantee. No broad Azure firewall exception or paid NAT/private endpoint is approved by this review. Finalize feasibility and the complete monthly estimate before creating app hosting resources. Bicep consumes the existing database rather than creating another one.

Evidence: official pages above were checked through Firecrawl search excerpts and the public Retail Prices API on October 14. The agent independently verified restricted database logins/schema over TLS and subscription policy/provider/quota/firewall settings through authenticated management APIs. Credit/approximate expiry came from the user. No cloud app deployment or measured bill is claimed yet.
