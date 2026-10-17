# Lower-cost private networking alternative

Researched October 17, 2026. Proposed only: no App Service plan, private endpoint, VNet, DNS zone, job, permission or cutover was created. This is a feasibility/cost review, not a complete deployment plan or approval.

The existing Container Apps private-network option has a quoted USD 33.35/month network base before app/database costs. A possible alternative is one public HTTPS Linux App Service B1 app with regional VNet integration reaching a private endpoint on the existing PostgreSQL server. Basic supports regional VNet integration without a separate integration charge. [Microsoft VNet guidance](https://learn.microsoft.com/en-us/azure/app-service/overview-vnet-integration).

The [retail snapshot](app-service-network-retail-snapshot.json) gives this 730-hour undiscounted planning base:

| Component | Rate | Monthly base |
| --- | --- | --- |
| One Canada Central Linux B1 app | USD 0.018/hour | USD 13.14 |
| One database private endpoint | USD 0.01/hour | USD 7.30 |
| One private DNS zone | USD 0.50/month | USD 0.50 |
| **App and network only** | **No allowance assumed** | **USD 20.94** |

This excludes the existing database, storage/backups, data, DNS queries, tax and migration overlap. Even if the database qualified for an allowance, this base alone exceeds the USD 10 total target. Actual regional quota, offer eligibility and a full configuration remain unverified. No new resource should be provisioned from this estimate.

## Implementation gates if selected

- Keep the existing React/FastAPI/Clerk image and database contracts. Verify public image pull, port/health configuration, verified-TLS private DNS, least-privilege runtime access, real account journeys, backup compatibility and rollback before traffic moves. App Service changes hosting/scaling behavior and requires separate review.
- Current Microsoft guidance supports WebJobs on non-Alpine Linux containers; scheduled operation needs Always On. Rivock's base is Debian slim, but deployment, shared-image cleanup execution, hard limits and failure handling are still untested on App Service. Do not count documentation as a successful job run. [WebJobs overview](https://learn.microsoft.com/en-us/azure/app-service/overview-webjobs), [scheduled WebJobs](https://learn.microsoft.com/en-us/azure/app-service/webjobs-create).
- Design a separately isolated migration procedure. Never put migration-role credentials into the web app's ordinary runtime settings merely to simplify a one-off command. Preserve the existing migration/runtime boundary and no-migration-on-startup rule.
- Verify app, cleanup and explicit migration connectivity privately before removing the working public route. PostgreSQL can disable public access after private endpoints are configured; firewall edits are discarded while public access is disabled. Plan rollback explicitly before that step. [Microsoft PostgreSQL guidance](https://learn.microsoft.com/en-us/azure/postgresql/network/how-to-networking-servers-deployed-public-access-disable-public-access).
- Review a complete budget and migration plan first. If USD 10 remains a hard total limit, investigate a broader hosting change or a specifically verified allowance rather than assuming this alternative fits. No provider/account change is authorized by this document.
