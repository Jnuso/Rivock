# Preview checks and recovery preparation

October 17, 2026. These are read-only checks and prepared procedures. Managed restore, image rollback, recurring cleanup and encrypted erasure-journal storage have not been performed/configured.

## Repeat a small public-read observation

From the repository root, run:

```powershell
powershell.exe -NoProfile -File scripts/observe-preview.ps1 -Samples 1
```

The command sends four anonymous GET requests per sample, caps the sample count at three, requires a plain HTTPS origin without credentials, and emits only status/timing metadata. It sets no schedule, forces no cold start, performs no authenticated action, and changes no resource. Default is three sequential samples. Save the JSON privately if desired. Do not use this as a load test or an uptime guarantee. It was run successfully against all four endpoints.

The one-time twelve-read observation on October 17 returned HTTP 200 throughout: liveness 41.6–217 ms, readiness 51.1–52.5 ms, topics 61.5–66.5 ms and latest feed 128.7–150.6 ms. These include this computer's network/TLS/client overhead. No cold start was proven and this is not day/week or concurrent-load evidence.

## Expected preview state

| Check | Reviewed checkpoint |
| --- | --- |
| Image | ghcr.io/jnuso/rivock-api@sha256:b8d0905d4109be5f9cb62a68c3d42a554e6c74e11fc2dacd84629e6c92364d1e |
| Ready revision | rivock-api--0000004; Healthy; 100% traffic at release verification |
| Moderation/provider | off; no AI_API_KEY |
| Limits | 0.25 vCPU, 0.5 GiB, min 0 / max 1 |
| Jobs | Existing manual rivock-migrate only; same image |
| Database firewall | Frozen 161 approved app egress addresses plus two operator rules; no broad ranges/all-Azure rule |
| Saved database settings | verify-full and Linux CA bundle /etc/ssl/certs/ca-certificates.crt |

The independent cloud inspection reconfirmed the pinned image, ready revision, off mode, replica limits, app egress and firewall counts, and manual-only job. The saved-parameter TLS check is distinct from an independent live certificate probe. These preview checks do not close the required narrower-network gate.

The read-only October 17 22:35 UTC ActualCost query reported USD 0.0034713738696 month-to-date. Available daily rows covered October 15–17, with app cost on October 16 and zero reported PostgreSQL cost. Billing can lag; the result is not a complete week, forecast, verified allowance or remaining student-credit balance/expiry. Keep account/billing evidence out of public reports if it contains private details. [Cost query contract](https://learn.microsoft.com/en-us/rest/api/cost-management/query/usage?view=rest-cost-management-2023-03-01).

## Prepared image rollback drill — approval required before execution

The prior source 1ae86a7 uses immutable image ghcr.io/jnuso/rivock-api@sha256:c54218359754604551736fcf70de2dc6132bf01ff89f0c1de7819617693af479. Both prior/current usability releases use schema 31c7a48a90c1. This is recorded compatibility context, not proof that managed rollback succeeds.

1. Record the current image, revision, traffic, schema and app/manual-job configuration. Confirm the selected prior image still exists and inspect its source/schema compatibility. Agree on the short preview interruption and exact validation/recovery actions.
2. If approved, change only the existing app image to the pinned prior digest; update the existing manual migration job image to match. Do not start that job, run a migration, redeploy broad defaults, change secrets, open a route or change limits. Inspect existing operation/revision state before retrying a timed-out update.
3. Wait for a Healthy ready revision with the intended traffic. Verify health, public reads, protected-route rejection and synthetic account/conversation behavior appropriate to that older interface. Stop on unexpected schema/data/config state.
4. Return app/manual-job images to the recorded current digest, again without executing migration. Reverify traffic, health, privacy/auth, exact settings and the current interface. Record actual timings/results. No rollback/cutover was executed while preparing this procedure.

## Other operator gates

Use [RESTORE_DRILL.md](RESTORE_DRILL.md) for the proposed temporary managed restore. Establish a complete protected encrypted independent erasure journal before replay/public cutover. Use an image containing the reviewed validation fix from [PR #1](https://github.com/Jnuso/Rivock/pull/1). Keep restoration isolated when records are incomplete.

The cleanup template remains disabled. Review the exact image, cost and existing-firewall connectivity before enabling a daily cleanup job. Keep AI off, one execution, sixty-second cap and zero retries; do not expand shared egress to make it run. Once cleanup is enabled and verified, update the preview privacy notice to reflect the verified behavior.

[OWNER_CHECKLIST.md](OWNER_CHECKLIST.md) separates owner input/approval from implementation the agent can perform afterward.
