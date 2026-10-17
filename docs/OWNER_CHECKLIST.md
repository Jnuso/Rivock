# Owner input and remaining release decisions

Prepared October 17, 2026 after independent work. This list does not ask the owner to perform technical implementation; the agent can handle those steps once the required input/approval is available.

## Prepared independently

- Two failing regressions reproduced discarded text returning after browser storage recovered and a restored draft disappearing during navigation after storage became unavailable. Discard/removal retries now remain pending within the open tab; valid restored drafts are cached in memory. Sign-out/account-change cleanup uses the same deferred clearing, while unrelated storage keys are preserved. A newer memory-only draft is retained until the old stored copy can be removed and persistence succeeds.
- Clarified preview privacy text: retention periods are targets while automatic cleanup remains disabled.
- Frontend types, all 80 tests and the production build passed. Nine added regressions cover both reproduced failures, unreadable-but-valid storage, new text during failed cleanup, whole-account/partial cleanup, warning removal after memory-only discard and a Clerk-mocked account switch. Real local browser checks used the actual useDraft/MarkdownEditor components with synthetic storage failures: persisted reload, navigation through blocked reads, discarded text staying empty after recovery, whole-draft cleanup and a visible memory-only warning at 320px. The actual privacy component also displayed the preview-only retention notice at 320px. Both inspected layouts had no horizontal overflow; viewport overrides were reset and temporary tabs/server were closed. These fixtures had no account/API connection and do not establish hosted sign-out, native unload-dialog or a full accessibility/device matrix.
- The separately tested recovery-journal safeguard remains open in [draft PR #1](https://github.com/Jnuso/Rivock/pull/1), not merged or deployed; its 259 backend tests and exact-head CI passed. This branch starts from main and does not include that unmerged backend change.
- Added and ran a bounded read-only preview observation command; checked current operating settings and one-time daily billing. Prepared a rollback procedure and a lower-cost private-network feasibility review. No paid resource, schedule, authentication credential or deployment was changed.

## Owner input or approval

| Item | What is needed from the owner | What the agent can do afterward |
| --- | --- | --- |
| Release the two review candidates | Approve the concrete PRs/release after review. | Resolve routine documentation overlap, merge, run exact merged-source CI, publish/pin an image, update only existing app/manual-job images and verify changed hosted flows. |
| Additional real sign-in/recovery methods | Complete any required code, recovery email or password entry/change; confirm methods actually offered. | Exercise safe return paths and public/account states, record results and fix defects. |
| Budget and narrower network | Confirm student-credit balance/expiry privately and choose a reviewed budget/hosting direction. The researched App Service alternative is about USD 20.94/month before database costs and still exceeds the target. | Finish quota, credential/job isolation, full-cost and connectivity/migration proofs; implement an approved route before removing the working public exception. |
| Managed recovery and cleanup | Review the exact temporary restore target/duration/cost, protected journal location/key custody, any short rollback interruption, and the separately proposed cleanup job. | Configure the approved protected storage, perform isolated restore/replay/rollback checks and verify cleanup before scheduling. |
| Public launch details | Choose the public operator contact, domain and preview-account/data transition; complete provider/domain ownership steps when required. | Configure production sign-in/DNS/TLS, finish privacy/retention/contact copy and repeat hosted verification. |

## Remaining verification

Wider screen-reader/touch/device checks, actual native storage/unload and extra authentication variants, managed Azure restore, prior-image rollback, encrypted journal completeness/recovery and day/week cost/cold-start observations remain open. The one-time checks above do not replace them. AI-assisted reports, DMs, ongoing bots, uploads and personalization remain future product choices; application AI stays off.

Technical next steps/evidence: [OPERATIONS_CHECKLIST.md](OPERATIONS_CHECKLIST.md), [RESTORE_DRILL.md](RESTORE_DRILL.md), [NETWORK_ALTERNATIVE.md](NETWORK_ALTERNATIVE.md), [BROWSER_CHECKS.md](BROWSER_CHECKS.md).
