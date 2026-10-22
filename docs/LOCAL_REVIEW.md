# Rivock: local work ready to review

October 22, 2026. Branch `features/local-conversation-tools`. **Keep local: no push, merge, publication or deployment is authorized by this document.** The last recorded hosted release is still the separate October 17 checkpoint in [HANDOFF.md](HANDOFF.md); this batch has not changed it.

## What you can review together

| Area | Prepared behavior |
| --- | --- |
| Sharing and navigation | Canonical thread/reply/profile links with a usable manual-copy fallback; jump to an accepted answer; timestamp links; return to the original filtered feed, Saved list or profile tab |
| Finding conversations | Question/discussion and answer-state filters, combined with topics/search/order; private search across the Saved library |
| Reading answers | Recommended/Newest/Oldest direct-answer order, accepted answer first, chronological follow-ups and clear conversation-wide reply totals |
| Writing | Selection-aware Markdown shortcuts/help, restored drafts, current-editor text downloads and retrying local draft storage without reviving discarded/old-account text |
| Personal lists | Save from feed, All/Unread Alerts and Mark unread, with private state refreshed consistently |
| Profiles | Shareable Threads/Replies tabs, bounded reply previews and repaired public reply-history joins |
| Database efficiency | Feed, Saved, Alerts, profile history, direct answers and expanded follow-ups use page-sized batches with request-local viewer data |
| Future moderation | A concrete [report-assisted AI proposal](REPORT_AI_PROPOSAL.md), documentation only; immediate valid publication and manual reports remain current policy |

Detailed semantics and earlier browser evidence are in [LOCAL_FEATURES.md](LOCAL_FEATURES.md). These are local review candidates, not features already released to the Azure site. Existing product decisions—no communities, user karma or reputation gates—are unchanged.

## What was finished on October 22

Implementation checkpoints are local commits `47e9ca3` (profile history) and `e4c3972` (conversation pages and review proposal). The rebuilt local image tags are `rivock-app:local-batching-preview-20261022` and `rivock-app:local-batching-production-20261022`; package smoke verified their normalized application source hashes against this checkout. These are local artifacts, not GHCR releases.

The new continuation measured and fixed repeated database reads in profile and conversation pages. With 50 fictional items, signed-in profile reply history dropped from **357 to 12 SQL statements**, and expanded follow-ups from **405 to 12**. Anonymous history/follow-ups use eight in these fixtures. Complete HTTP payloads match the established per-item projection.

The changes preserve private votes, hidden-author behavior, unavailable conversation shells, deactivated-author sanitizing, accepted-first ordering, response targets and page boundaries. These are database round-trip measurements on local fixtures, not a claim about Azure response time or production capacity. See [profile measurements](PROFILE_PERFORMANCE.md) and [conversation measurements](REPLY_PERFORMANCE.md).

## Verification and limits

- **365 backend tests passed** together on isolated PostgreSQL 17.11, including 46 new profile/conversation cases.
- **22 operator-helper tests passed** at the profile checkpoint; their source was unchanged afterward.
- Backend Ruff and API-contract comparison passed. No schema migration or API change was needed for this continuation.
- Current preview/production images built locally with fictional public settings and passed network-disabled non-root, source-hash, routing, cache/security-header and private-file checks.
- Frontend source was unchanged on October 22. Its earlier **205 tests/types/build** and local browser evidence remain separate historical checks. No fresh hosted identity/browser check or new CI run is claimed.
- Application AI stays off. Cloud resources, credentials, networking and schedules were unchanged. A separate Google coding review used four calls in two batches, with more than 65 seconds after the first terminal update before resuming. It returned no final report or changes; its baseline lacked an isolated test DB. No independent review/worker tests are claimed or integrated.

The disposable test setup contains fictional data only and is separate from existing app databases. The package checks prove neither database readiness nor real Clerk login. Existing Starlette/httpx deprecation and Docker's public-key ARG heuristic remain warnings.

## Decisions that remain yours

1. **Feature/release review:** decide which local journeys to retain before authorizing any push or release. The live preview does not show these unpublished changes.
2. **Future AI design:** review trigger, human versus automatic authority, data/provider handling and limits. The proposal recommends manual admin-requested analysis and human decisions first; no AI implementation or activation is implied.
3. **Hosting/security direction:** review a costed narrower database route before replacing the explicitly approved shared-IP exception. The working route must remain until a replacement is verified.
4. **Recovery/retention:** choose protected erasure-journal storage and approve an exact temporary restore/rollback/cleanup plan before those operations. Prepared runbooks are not completed recovery evidence.
5. **Public launch:** choose contact/domain/preview-data transition and complete any required provider ownership or real recovery-method entry when ready.

No account setup needs to be repeated just to review these documents. Production networking, managed recovery, real billing/credit expiry and wider device/account checks remain open in [OWNER_CHECKLIST.md](OWNER_CHECKLIST.md).
