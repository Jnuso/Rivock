# Database network hardening review

Reviewed October 17, 2026. No networking resources or firewall rules were changed. This is a costed design review, not deployment approval. The user's approximately USD 10/month total target still applies.

## Current connection

The existing Azure Container Apps environment was read back as Succeeded, with only its Consumption workload profile and no custom VNet integration. PostgreSQL still uses the approved 161 individual shared Azure egress rules plus two operator-IP rules. TLS hostname/certificate verification and restricted credentials remain in place. The shared-pool exception must be replaced before production; do not remove its working route first or add new addresses as a fallback.

Microsoft documents that an environment's network type cannot be changed after creation. A custom-VNet route therefore requires a replacement environment and a reviewed cutover, not an in-place switch. The last recorded regional environment quota was one; recheck/increase capacity before any parallel migration. [Container Apps networking](https://learn.microsoft.com/en-us/azure/container-apps/networking).

## Current-stack private route: cost exceeds the target without verified allowances

A custom-VNet workload-profile environment can reach a PostgreSQL private endpoint. Its external environment also carries a Standard load balancer and public-IP infrastructure. These managed resources are charged separately from Container Apps compute grants. Do not quote only the private endpoint price or enable a Container Apps environment private endpoint/Dedicated profile as an incidental step. [Managed network resources](https://learn.microsoft.com/en-us/azure/container-apps/custom-virtual-networks#managed-resources), [Container Apps billing](https://learn.microsoft.com/en-us/azure/container-apps/billing).

The [public retail snapshot](network-retail-snapshot.json) was fetched directly from Microsoft's Retail Prices API. At 730 hours/month, before student allowances/tax/data:

| Network component | Paid retail assumption | Monthly base |
| --- | --- | --- |
| Standard load balancer, included rule tier | USD 0.025/hour | USD 18.25 |
| Two Standard IPv4 addresses | 2 × USD 0.005/hour | USD 7.30 |
| PostgreSQL private endpoint | USD 0.01/hour | USD 7.30 |
| One private DNS zone, initial tier | USD 0.50/month | USD 0.50 |
| **Network base only** | **No free-meter eligibility assumed** | **USD 33.35** |

DNS queries are USD 0.40/million in the quoted public tier; Private Link also bills processed data. Actual regional/offer eligibility, any free meters, managed infrastructure and migration overlap must be checked in the subscription/calculator before approval. The USD 33.35 figure is an undiscounted planning estimate, not an actual bill or a guarantee of a minimum charge. It excludes existing app/database costs. No NAT gateway or DNS Private Resolver is included. [Private Link pricing](https://azure.microsoft.com/en-us/pricing/details/private-link/), [DNS pricing](https://azure.microsoft.com/en-us/pricing/details/dns/).

## Next decision and migration gates

Keep the current preview operating while evaluating a route that fits the existing budget. Prefer investigating a lower-cost Azure hosting/network combination before proposing a budget increase; verify its actual capabilities and preserve the current React/FastAPI/Clerk/PostgreSQL contracts. An external database alternative needs a separate provider/retention/cost decision. Do not silently replatform or spend against the undiscounted plan above.

Once a route is selected: review a complete monthly configuration, verify quota/policy, create the replacement privately, test migration/runtime roles over verify-full TLS, run the full hosted two-account journey and job connectivity, then cut traffic. Only after that succeeds should shared and obsolete operator firewall rules be removed and public PostgreSQL access disabled where the replacement permits it. Confirm app/job connectivity still passes and an unapproved public route fails. Keep the prior image/route available until the rollback/recovery procedure is proven; never widen firewall ranges or disable TLS to rescue a failed cutover.

Managed Azure backup restoration and erasure replay remain unverified. A [separate restore-drill configuration and cost proposal](RESTORE_DRILL.md) is prepared; no clone was created. A networking migration does not replace that recovery gate.

## Cleanup schedule is a separate small change

infra/cleanup-job.bicep is disabled by default. If separately approved, its one daily execution uses 0.25 vCPU/0.5 GiB, a sixty-second timeout and zero retries; a 31-day upper bound is 465 vCPU-seconds and 930 GiB-seconds for the scheduled executions. Shared monthly free grants may cover this, but are not a spending cap. Verify the existing exact firewall allows the job before scheduling; do not add new shared addresses automatically. It forces moderation off, has no AI key, and runs only --cleanup-only. It was compiled, not deployed. [Job billing](https://learn.microsoft.com/en-us/azure/container-apps/billing#jobs).

## October 17 alternative review

[App Service with a private PostgreSQL endpoint](NETWORK_ALTERNATIVE.md) has a researched app/network base of USD 20.94/month before database and other costs. It is cheaper than the current-stack private-network estimate but still exceeds the total target. Hosting/job/migration proofs and a complete budget remain open; no change was deployed.
