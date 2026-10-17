# Rivock online preview walkthrough

October 16, 2026. Use Azure's included HTTPS address first; purchase a custom domain after testing. This is a test deployment with fictional content and Clerk development sign-in. Hosting usage still follows the [cost review](HOSTING_COSTS.md).

**Current checkpoint:** [the preview is live](https://rivock-api.wittymushroom-48e2dfec.canadacentral.azurecontainerapps.io/), migration/API/HTTP checks pass, and five labeled fictional conversations are seeded. Start at **step 6** for the user's browser check. Steps 1–5 record the completed setup; repeat-deployment configuration and remaining security work are in [PREVIEW_DEPLOYMENT.md](PREVIEW_DEPLOYMENT.md).

## 1. GitHub preview configuration

Completed by the user: repository **Settings → Environments → preview → Environment variables** contains `CLERK_PUBLISHABLE_KEY`, using the same public `pk_test_...` value as local sign-in. This is a variable, not a secret. [GitHub environment-variable instructions](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments#creating-an-environment).

The existing local GitHub account and Azure for Students session were checked. The initial `main` commit `1fb48ad` and preview-support commit `2d2ca5c` are public and their Rivock CI runs succeeded. No domain, new Entra tenant, second database or Clerk production instance is needed for this stage.

## 2. Publish the tested preview changes and wait for CI

The agent publishes the prepared preview changes to the existing repository. On the repository's **Actions** tab, wait for **Rivock CI** on that commit to turn green. It tests Python/PostgreSQL, frontend behavior/types and combined preview/production images. A previous green commit does not validate a later one.

Local verification before publication: 211 backend/script tests, 34 frontend tests, ten hosted-build configuration checks, Bicep compilation, workflow YAML parsing and the preview image's route/header/private-file guards. This does not establish actual Azure capacity, network routing, hosted identity or browser layout.

## 3. Build the real preview image on GitHub

Completed: preview changes `2d2ca5c` passed GitHub CI; the user's image run succeeded and anonymous pull access was verified. The reviewed digest and live provisioning progress are in [PREVIEW_DEPLOYMENT.md](PREVIEW_DEPLOYMENT.md).

Open **Actions → Publish reviewed Rivock image → Run workflow**. Select the reviewed branch/commit and choose **preview** for `deployment_environment`, then run it. This publishes an image, not Azure infrastructure. It uses the environment's public Clerk key and refuses missing/mismatched configuration.

When it succeeds, keep the image digest from the run summary. The tag starts with `preview-`; deployment uses the immutable `sha256` digest. If anonymous pulls are unavailable, configure the `rivock-api` GHCR package as public before proceeding. The agent checks anonymous access after publication. No database/AI credentials are built into the image.

## 4. Review the exact Azure deployment

Use existing resource group `rivock-dev`, Canada Central and the already-initialized `rivock` database. The agent prepares private parameters from owner-protected `.env.azure`, runs Azure what-if and explains the resource changes/cost assumptions. Do not paste generated database URLs or administrator passwords into GitHub or chat.

Initial settings: one Consumption environment, one website/API with 0.25 vCPU / 0.5 GiB, min 0 / max 1, and an explicit manual migration job. Keep the scheduled worker disabled and moderation in `pending` mode for initial connectivity/sign-in testing. No NAT, private endpoint, paid registry, Dedicated profile or historical logging service is added. Configure budget alerts and verify current allowances; alerts do not cap charges.

The template must use `deploymentEnvironment=preview`, the same reviewed image digest throughout, and a fresh random HMAC secret. Secure database TLS, real Clerk token verification, exact HTTPS authorized origins, no fixture moderation and disabled public API docs remain enforced in preview.

## 5. Establish the address and database route

After the reviewed environment exists, its generated domain determines the app's `*.azurecontainerapps.io` address. The agent sets that exact HTTPS origin for Clerk authorized parties and CORS. It does not depend on buying a domain or changing the development publishable key.

Inspect reported app egress addresses and verify migration/worker egress separately. Allow only reviewed individual addresses at PostgreSQL, following the [preflight routing procedure](AZURE_PREFLIGHT.md#database-route-before-enabling-hosting). Do not assume these addresses are static or shared by jobs. If this narrow route is infeasible, revisit the costed plan before activation; broad firewall exceptions are not a fallback. Run the explicit migration job successfully before enabling user traffic.

For the combined Linux image, set both cloud connection URLs to `sslmode=verify-full` and `sslrootcert=/etc/ssl/certs/ca-certificates.crt`. The packaged libpq did not locate the existing public bundle through `sslrootcert=system`; the explicit path passed the certificate check. Keep the operator's original generated credential file protected, and transform only the deployment URL query settings without printing passwords. Never resolve a trust-path error by disabling certificate or hostname verification. The user's exact shared-pool preview exception and required security tightening before production are recorded in [the deployment review](PREVIEW_DEPLOYMENT.md).

## 6. Test the preview together

Open the actual generated HTTPS link. It should display **Rivock Preview**. Use test accounts and fictional text to check sign-in, username onboarding, browsing, direct thread refresh, saves, replies, accepted answers and mobile navigation. Cloud account/conversation data starts separately from the local database; no local rows are copied.

Initial submissions can remain pending while cloud moderation is disabled. Establish the operator account and review provider/data settings before enabling AI and the scheduled worker; pending is not an AI approval. Use the existing explicitly labeled fictional seed only as a deliberate preview operator action. Verify day/week costs and cold starts before considering a public launch.

## Later: custom domain and production

Buy the domain after the preview is satisfactory. Configure Clerk production, rebuild with the production public key, switch runtime/build profiles together, bind DNS/TLS and verify the real production journey. Review handling of preview accounts/content before that transition. Do not create a second environment assuming another free quota slot.
