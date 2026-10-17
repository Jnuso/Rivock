# Reviewed preview deployment

Updated October 17, 2026. This records the reviewed configuration, actual provisioning evidence and remaining checks. It is not an uptime or cost guarantee.

## Current release

Application source `1ae86a721d27a07edf2b9123b372c1207a0c6d75` passed [Rivock CI](https://github.com/Jnuso/Rivock/actions/runs/39014440542) and [preview image publication](https://github.com/Jnuso/Rivock/actions/runs/39014599571). Anonymous GHCR manifest access and independent image inspection agreed on `ghcr.io/jnuso/rivock-api@sha256:c54218359754604551736fcf70de2dc6132bf01ff89f0c1de7819617693af479`.

After the user's explicit push/publication/preview approval, image-only CLI updates moved `rivock-api` and the existing manual `rivock-migrate` job to that digest. Revision `rivock-api--0000003` is Healthy with 100% traffic. The broader Bicep what-if also proposed environment default changes, so it was not applied; the image-only operations preserved that environment. No schema migration ran and no new ARM group deployment was created for this release.

Hosted topic labels, submission wording and mobile menu keyboard behavior passed; the prior accepted reply remained accessible after reload. HTTP health, route/auth/privacy/cache/security checks passed. Final readback confirmed moderation off, no AI key, min/max 0/1, manual-only migration job, verified TLS and exactly the original 161 approved app egress addresses plus two operator rules. The separate cleanup template remains disabled/unprovisioned. See [BROWSER_CHECKS.md](BROWSER_CHECKS.md) for scope and limits.

## Previous preview history — October 16

**Live preview:** [Rivock on Azure](https://rivock-api.wittymushroom-48e2dfec.canadacentral.azurecontainerapps.io/). HTTPS/API/database HTTP checks pass. The owner confirmed hosted Google sign-in, username onboarding and vote/save persistence as `jack`. The core hosted two-account journey and targeted visual review subsequently passed; additional account/recovery methods remain open.

**Previous immediate-publication release:** the user withdrew the cloud Gemma proposal. Application commit `d3879aa` passed [Rivock CI](https://github.com/Jnuso/Rivock/actions/runs/38995011126) and [preview image publication](https://github.com/Jnuso/Rivock/actions/runs/38995196001). Anonymous registry access verified the exact digest `sha256:521ae020da920f86a382a9a2681ef9e027b737baa239930f595b18f911754963`. Deployment `rivock-preview-reviews-off` succeeded with that digest and `moderationMode=off`; latest/ready revision was `rivock-api--0000002`. Live health/HTML/privacy/Clerk headers/protected-route checks pass, and the served bundle contains the reviews-off notice. No AI key or scheduled Google worker was added; min/max remain 0/1 and the reported outbound set has zero unapproved addresses. See [REPORT_MODERATION.md](REPORT_MODERATION.md).

Ran the existing worker once inside the verified off-mode API to release ordinary pending work through the shared validated apply service. A separate read-only verified-TLS metadata check confirmed one published submission with `reason_code=moderation_disabled`, zero pending/processing items, zero cloud AI attempts, and `jack` still active/admin. No contribution text was read by the operator. Earlier rejected/cancelled/manual-review items remain protected. A fresh signed-in browser post/reply test was still pending then; it subsequently passed as recorded in BROWSER_CHECKS.md.

The existing audited operator command assigned admin to that user-confirmed account, using its exact Rivock UUID. Independent read-only verified-TLS metadata confirmed active/linked/admin state and exactly one grant audit entry. The original pending submission has now been released as described above. The proposed Google disclosure/activation was withdrawn; the live privacy notice now explains immediate publication, reports/manual review and disabled AI. Report-assisted AI needs a future design and provider/data review.

## Verified release and account state

- Initial preview commit `2d2ca5c` passed [Rivock CI](https://github.com/Jnuso/Rivock/actions/runs/38971138021); the current application release is recorded above.
- The user's [preview image publication](https://github.com/Jnuso/Rivock/actions/runs/38972983397) succeeded. Anonymous GHCR retrieval and local pull verified digest `sha256:6c0f6198bd46e07ef11a1276a89fccd8c85a72e53cd082a0f3b69e431abf8468` for `ghcr.io/jnuso/rivock-api`.
- The actual published image defaults to preview and its generated CSP matches the saved public Clerk development instance. No private local environment files were found in the image check.
- Azure for Students is Enabled; earlier authenticated inspection confirmed spending limit On. Canada Central is permitted and supports the services; environment quota was 0 used / 1 allowed.
- PostgreSQL remains Ready, B1ms, 32 GB/P4, seven-day backups, no HA/geo/autogrow. After adding the computer's changed public IP as a single-address operator rule, a read-only runtime login passed with verified TLS 1.3: seven topics, zero users/threads. The original operator rule remains; no broad Azure or internet rule was added.
- The Cost Management month-to-date query currently reports **USD 0.00** for PostgreSQL in `rivock-dev`. Billing can lag; this is neither remaining credit nor a forecast. Exact credit balance/expiry remain unverified.
- The user selected their UConn email for alerts. The subscription-scoped $10/month budget deployment succeeded, with actual-cost notifications at $5/$8/$10, for October 2026 through September 2027. Alerts do not cap spend.

## Resources and limits

| Resource | Concrete configuration |
| --- | --- |
| `rivock-env` | WorkloadProfiles mode with only Consumption in Canada Central; no custom VNet, NAT, private endpoint, Dedicated profile or log sink |
| `rivock-api` | Current digest `c5421835…` above; 0.25 vCPU / 0.5 GiB; min 0 / max 1; HTTPS; exact Azure preview origin |
| `rivock-migrate` | Same digest; explicit manual Alembic job; 0.25 vCPU / 0.5 GiB; 120-second timeout; no retries/parallel executions |
| Existing PostgreSQL | Consumed in place with separate restricted runtime/migration credentials; no database recreation or local data copy |
| Worker / AI | Scheduled worker disabled; moderation off; no cloud AI key. One explicit off-mode run released earlier ordinary pending work without provider calls |

No extra registry, logging workspace or network appliance is provisioned. Container Apps' shared monthly free grant is 180,000 vCPU-seconds / 360,000 GiB-seconds; light test usage is expected to fit, while excess/transfer can consume credit. [Microsoft billing guidance](https://learn.microsoft.com/en-us/azure/container-apps/billing). The [cost review](HOSTING_COSTS.md) records database allowance and post-credit limitations.

The ARM what-if check for this exact plan succeeded with three Creates (environment/app/manual job), existing PostgreSQL Ignore, and no deletes. It caught and resolved the invalid literal logging destination `none`: omitting the log sink passes provider validation. Empty AI secrets are omitted. Private parameters/HMAC are held only in owner-protected ignored `.azure/preview.parameters.json`.

## Activation order

Original activation progress (historical): the environment, app and manual migration job were provisioned successfully. Original migration execution `rivock-migrate-qnsxp1n` succeeded after the trust-path correction below; the off-mode release changes no schema. HTTPS-only public ingress is enabled; revision `rivock-api--0000002` was ready with latest-revision traffic. Min/max remain 0/1. Budget notifications are confirmed enabled. No database was recreated or local rows copied. AI and the scheduled worker remain disabled; the explicit one-off queue release above made no provider call.

The first manual-job creation failed with `ExpressEnvironmentResourceNotSupported`: Azure's newer default selected Express even though the older API response showed a Consumption profile. The template now uses environment API `2026-07-01`, explicitly selects `environmentMode=WorkloadProfiles`, and declares only the Consumption profile. The corrected in-place deployment succeeded after about 20 minutes, without resource deletion. Public ingress stayed off through the network and migration checks.

**Approved preview exception:** the app reports **161** possible global IPv4 egress addresses, shared by Azure customers rather than dedicated to Rivock. The exact-address firewall what-if succeeded with 161 single-address Creates and zero unrelated changes. Automatic approval review initially **rejected** applying that plan because this persistent shared-pool access lacked explicit user authorization. After being told that other Azure customers could attempt database login through those addresses, the user explicitly approved this exact set and requested tighter security later. The authorized deployment succeeded. The existing two operator-address rules remain; no regional CIDR/all-Azure exception was added.

The reviewed template is `infra/database-access.bicep`: stable per-address names, identical start/end addresses, no database recreation or operator-rule changes. Parameters were derived from authenticated app metadata, validated for global IPv4/count bounds and saved only in ignored `.azure/preview-egress.parameters.json`. The sorted list fingerprint is `9717441dd33d31348cebd99366229ba7a696666951914351cd0fd8af3e2fbcc9` (SHA-256 of newline-separated addresses), revalidated before the authorized retry. Deployment `rivock-preview-egress` succeeded. A subsequent authenticated comparison confirmed exactly 161 matching app rules plus the two existing operator rules, zero ranges and zero `0.0.0.0` rules. Restricted credentials and verified TLS remain required, but other Azure tenants using these IPs could reach the database port and attempt login. The rules persist until removed and need manual drift reconciliation; no static-egress guarantee is implied. This approval covers this frozen set only, not future expansion or broad exceptions.

The first cloud migration checks failed. Bounded output from the post-firewall attempt identified certificate verification failure, not a schema error. A synthetic invalid-login probe in the exact published image reproduced failure with `sslrootcert=system`; with `sslrootcert=/etc/ssl/certs/ca-certificates.crt`, certificate/hostname verification completed and PostgreSQL rejected the deliberately invalid password. Both private cloud URLs now use that explicit existing public bundle path while retaining `sslmode=verify-full`; no real password was used in the probe or printed. The in-place configuration deployment `rivock-preview-tls` succeeded, followed by the successful migration execution above. [Microsoft's TLS guidance](https://learn.microsoft.com/en-us/azure/postgresql/security/security-tls-how-to-connect) identifies the required Microsoft RSA 2017 and DigiCert Global Root G2 roots. No TLS verification bypass was introduced.

After enabling ingress, the earlier failed revisions still did not serve traffic. Creating a fresh revision using the same digest and corrected secret resolved startup. Live HTTP checks then passed for liveness/readiness, seven topics, five original fictional threads, one accepted demo answer/reply, full-text search, anonymous account-route rejection, disabled docs/schema, missing API/assets, HTML deep links/HEAD, exact Clerk CSP/security headers, no-store APIs and immutable hashed assets. The first deep-link probe omitted the HTML Accept header; its expected non-document 404 was corrected in the probe, then HTML GET/HEAD checks passed. Preview notice presence was verified in the served JavaScript, not through visual inspection. The explicit seed command completed inside the preview API using its restricted runtime role; authors expose `is_bot=true`. No ongoing bots, automated votes or external AI calls were started.

**Required before production:** review a narrower database connection with its actual Azure cost, implement and verify it, then remove the shared-pool preview rules and obsolete operator rules. The user explicitly requested this security tightening; a production domain/key switch alone does not complete it.

1. Create the reviewed resources with `enableApi=true`, `enablePublicIngress=false`, `enableWorker=false`. Public traffic remains off while egress and schema are checked.
2. Read the app's reported outbound addresses; configure only the reviewed individual PostgreSQL rules. Verify migration-job connectivity separately. These addresses can change; no static-egress guarantee or broad fallback is implied.
3. Run the explicit migration job and confirm success/current schema. Confirm the runtime container becomes ready with restricted credentials.
4. Enable public ingress using the same digest/profile/secrets. The derived Azure HTTPS origin becomes the actual browser origin for Clerk/CORS. Run HTTP checks, then have the user test real sign-in and the visible Preview notice in a browser.
5. Review cloud moderation/provider settings and worker routing before enabling them. Observe real costs/cold starts and managed recovery before a production launch.

If capacity or narrow routing fails, leave public access disabled and report the concrete error before considering a costed alternative. At initial provisioning, browser automation was not yet authorized. The subsequent authorized hosted checks are recorded separately in BROWSER_CHECKS.md; local/HTTP checks alone do not establish layout or hosted identity success.

Environment-mode source: [Microsoft's create/update schema](https://learn.microsoft.com/en-us/rest/api/resource-manager/containerapps/managed-environments/create-or-update?view=rest-resource-manager-containerapps-2026-07-01) lists ConsumptionOnly, WorkloadProfiles, Express and Archived. The live older API omitted this field; the newer API exposed the actual Express mode. [Express overview](https://learn.microsoft.com/en-us/azure/container-apps/express-overview) confirms jobs are unsupported there. The correction adds no Dedicated workload profile.
