# Hosted browser verification

## Current usability release — October 17

Application source `7bc80adfe11394deb0e3d6e4e819fd4abf1a6644` passed [exact-commit CI](https://github.com/Jnuso/Rivock/actions/runs/39072833183) and [preview image publication](https://github.com/Jnuso/Rivock/actions/runs/39072992347). Anonymous GHCR manifest access and independent image inspection agreed on `ghcr.io/jnuso/rivock-api@sha256:b8d0905d4109be5f9cb62a68c3d42a554e6c74e11fc2dacd84629e6c92364d1e`. After the user's release authorization, image-only updates moved the existing app and manual migration job to that digest. Ready revision `rivock-api--0000004` is Healthy with 100% traffic. No migration ran and no new ARM group deployment was created.

The batch adds a first-focus Skip to main content link that preserves reply fragments, selection-aware Markdown formatting with restored focus/caret, and honest failed-read states with an explicit Try again control. Cached saved items survive refresh errors. Frontend types, all 71 tests and the production build passed; the exact-commit CI also passed backend, frontend and both container checks. The earlier directly run PostgreSQL suite had 205 backend tests and 22 helper tests; no backend source changed in this batch.

Targeted hosted checks used jack1's existing session at 320 CSS pixels. Skip focused MAIN, the next Tab reached Search, and the exact accepted-reply fragment survived activation. In the empty new-thread composer, selected Bold and Link formatted synthetic text, the link destination remained editable, Preview rendered correctly with formatting controls disabled, and reload restored the exact formatted draft. In the empty reply composer, keyboard Italic restored textarea focus/selection and Preview rendered an EM element. Both synthetic drafts were discarded without posting. Inspected views had no horizontal document overflow; temporary viewport sizing was reset.

A harmless unsupported feed sort produced the useful validation error and Try again without a false empty list. Enter on Try again retried that still-invalid read; choosing Trending restored the real hosted feed. This proves hosted validation-error recovery, not a hosted network outage or HTTP 503. The controlled HTTP 503/recovery check ran only through a local frontend proxy. The earlier two-account report/admin/publication journeys were not all repeated for this release.

Final Azure readback confirmed the pinned digest/ready revision, moderation off, no AI key, min/max 0/1, 0.25 vCPU/0.5 GiB, verified-TLS database URLs, the frozen 161 shared egress addresses plus two operator rules, and only the existing manual migration job. Health/readiness, seven topics, SPA deep links, private/missing resources, anonymous protected reads/writes, security/cache headers, false fixture indicator and changed frontend bundles passed HTTP checks. No schedule, paid resource or network rule was created.

The sections below preserve the earlier chronological evidence. Statements about local-only work describe those pre-release checkpoints; all three usability changes are now included in the current source 7bc80ad.

## Earlier core hosted verification

Verified October 16–17, 2026 in the built-in browser, against the Azure preview running application commit d3879aa. The user authorized browser testing and the use of the existing jack and jack1 accounts for Rivock only. The user completed authentication; no credentials were collected. Firefox automation was blocked by the browser tool's Windows URL enforcement limitation, so no Firefox compatibility claim is made.

## Completed hosted journeys

| Check | Observed result |
| --- | --- |
| Public feed and search | Searching hobby returned the expected demo conversation. Topic navigation and an empty topic state worked. |
| Public thread | Original text, replies and an existing accepted answer were readable. Signed-out votes were disabled; New required sign-in. |
| Immediate publication | jack created a fictional question and reply; jack1 added another reply. Each appeared immediately. jack's submission list/detail identified publication without automated review. |
| Draft recovery | Question title, topic, type and Markdown body survived navigation away/back and reload before submission. Markdown preview rendered bold text. |
| Report behavior | jack1 reported the fictional question with an explicit harmless-test explanation. Reload still showed the question and replies; no automatic hiding occurred. |
| Report inspection | jack inspected the private report, then dismissed it with an audit reason. The open report disappeared and an audit entry was visible. |
| Manual moderation | jack temporarily removed only the session's synthetic question. A removal placeholder replaced its text while its reply survived. Restoration recovered the question; both operations appeared in the audit log. |
| Ownership and privacy | jack1 had no Edit thread or Accept answer control for jack's question. The admin page required an active admin account; jack's exact private submission URL returned This submission is unavailable. |
| Reply notification | jack's Alerts contained jack1 replied to your thread. Its link opened the exact new reply in linked-conversation context. |
| Accepted-answer notification | jack accepted jack1's direct answer. jack1 received jack accepted your answer; that link opened the correct reply with the accepted marker. |
| Moderation state | The admin panel showed off, AI reviews off, queue 0 and disabled Resume/Pause controls. No provider was enabled by this work. |

Synthetic evidence thread: https://rivock-api.wittymushroom-48e2dfec.canadacentral.azurecontainerapps.io/threads/34c4b179-1a6f-42d8-b5e3-e341622a0fce . It remains published with two replies; the second account's answer is accepted. The harmless report is dismissed. No pre-existing user contribution was removed or edited.

## Layout and keyboard checks

Inspected representative feed/thread/admin views at 320, 390, 768 and 1440 CSS pixels. The inspected layouts had no horizontal document overflow. Mobile topic navigation worked, search had a visible keyboard focus outline, and protected controls remained distinct. This is a targeted check, not a full accessibility audit or device/browser matrix.

The hosted checks found three interface defects: topic headings used lowercase slugs, My submissions still described checks before publication, and Escape did not dismiss the mobile menu. Application source 1ae86a7 fixes those issues, keeps a failed feed request distinct from an empty feed, and treats the menu as a navigation disclosure with ordinary links/buttons. Local browser checks passed first; the hosted follow-up below independently verifies the released interface.

## Earlier source verification — 1ae86a7

- Frontend: types, all 39 tests and build passed, including empty-topic metadata, error-state and menu keyboard regression checks.
- Backend: 205 tests passed against the isolated PostgreSQL test database; 22 helper tests and backend/script Ruff checks passed.
- Added an isolated --cleanup-only worker CLI command. Its four new tests verify no queue processing or sleeping, preservation of --once/daemon behavior and rejection of conflicting flags.
- The separate cleanup-job Bicep template compiles and defaults to disabled. No cloud schedule or provider key was created.
- Two bounded coding-worker attempts returned Google HTTP 503 and no changes. No independent worker review or successful worker test run is claimed; the checks above were run directly in the project environment.

## October 17 release follow-up

Source `1ae86a721d27a07edf2b9123b372c1207a0c6d75` passed [exact-commit CI](https://github.com/Jnuso/Rivock/actions/runs/39014440542) and [preview publication](https://github.com/Jnuso/Rivock/actions/runs/39014599571). Anonymous GHCR access verified `sha256:c54218359754604551736fcf70de2dc6132bf01ff89f0c1de7819617693af479`. Image-only updates changed the existing app and manual migration job; revision `rivock-api--0000003` became Healthy with 100% traffic. No migration ran.

At 320 CSS pixels, the hosted Health & Wellbeing empty topic uses its canonical name with no horizontal document overflow. Tab moved within the open mobile menu; Escape closed it and returned focus to Menu. Tab from its final control closed the menu and moved to the account link. My submissions shows the new publication/review-history description and the existing reply remains Published without automated review. Reloading the notification deep link preserved the exact accepted reply. This follow-up used jack1's existing signed-in session, without another authentication flow. Temporary viewport sizing was reset afterward.

Live HTTP checks passed for liveness/readiness, seven topics, SPA deep links, private/missing resources, anonymous read/write authorization, security/cache headers, false fixture indicator and the changed linked JavaScript bundles. Final Azure readback confirmed the exact digest/ready revision, moderation off, no AI key, min/max 0/1, the same frozen 161 egress rules plus two operator rules, verified-TLS URLs and only the existing manual migration job. No cleanup schedule, paid resource or network rule was created.

## Local keyboard follow-up after release

Added a first keyboard stop, Skip to main content, and one focusable main landmark around the page outlet. Ordinary activation focuses and scrolls to the content without replacing a reply notification fragment. The link appears on focus above the sticky header; modified clicks retain normal anchor behavior. Local desktop and 320px browser checks verified first-Tab visibility, focus on MAIN, the next Tab reaching Search, a visible heading below the mobile header, no horizontal overflow and preservation of the exact linked reply/context. At this local checkpoint after release 1ae86a7, the change had not yet been released; it is now included in 7bc80ad as verified above. The local preview used the existing localhost API without signing in, changing account state or editing existing data. Frontend types, 39 tests and build passed. Temporary viewport sizing was reset.

## Local writing-editor follow-up

The existing editor appended placeholder Markdown at the end instead of formatting the selection. The defect was reproduced in the hosted jack1 composer using one synthetic, unpublished draft, then that draft was discarded. Local source now formats at the cursor/selection, restores textarea focus/selection, toggles emphasis and line prefixes, formats selected list/quote lines, and selects a new link destination for replacement. It preserves whitespace, emoji offsets, nested bold/italic, partial-word italics and the existing over-limit validation. Formatting buttons are disabled during Preview to prevent hidden edits. Draft persistence and the sanitized Markdown renderer are unchanged.

Frontend types, all 55 tests and production build passed. Sixteen new regression tests cover selection/cursor behavior, nested emphasis, emoji, whitespace, line boundaries, links, preview and limits. Real-browser checks used the actual controlled MarkdownEditor component on a clearly labeled local test page with synthetic text, without authentication/API submission: selected Bold, link address replacement and rendered preview, Shift-Tab/Enter Italic with focus restoration, multi-line List/Quote and a 320px preview with no horizontal document overflow. This isolated component check is distinct from a hosted end-to-end composer/reply verification. Temporary viewport sizing was reset. No backend, moderation policy, cloud configuration, network rule or schedule changed. These editor additions were local at this checkpoint and are now included in 7bc80ad as verified above.

## Local query-recovery follow-up

List failures no longer claim that notifications, submissions, profile contributions, replies, blocks or admin report/submission/audit results are empty. A shared query-error control offers an explicit Try again read, disables repeated retries during an in-progress request, and preserves the existing mutation controls. Saved threads keep their cached items visible if a background refresh fails and now use the shared bounded Load more control. Plain-string validation/authorization messages are displayed instead of being replaced with a generic error.

Frontend types, all 71 tests and production build passed. Sixteen new checks cover error-to-success recovery across ten lists, cached saved content, signed-out read gating, text error messages and retry disabling. The full local frontend was also tested at 320px through a temporary proxy that returned a controlled HTTP 503 only for feed GET requests. It showed an error and Try again with no false empty message or horizontal overflow. After restoring reads, Enter on Try again loaded the real local Hobbies demo feed. This was an injected local outage, not an Azure incident or hosted authenticated recovery check. No data was posted or changed; the temporary proxy is outside the repository and does not alter the API service. Temporary viewport sizing was reset. These additions were local at this checkpoint and are now included in 7bc80ad as verified above.

## Remaining checks

Email/password/recovery, wider screen-reader/touch testing, managed Azure restore/erasure replay, previous-image rollback, retention scheduling and database network tightening remain separate work. Sign-in redirects were exercised through user authentication, but this run does not establish every recovery/return-path variant.

## Independent blocked-storage follow-up — local review candidate

Two failing regressions reproduced discarded text returning after browser storage recovered and a restored draft disappearing during navigation after storage became unavailable. Discard/removal retries now remain pending within the open tab; valid restored drafts are cached in memory. Sign-out/account-change cleanup uses the same deferred clearing, while unrelated storage keys are preserved. A newer memory-only draft is retained until the old stored copy can be removed and persistence succeeds.

Frontend types, all 80 tests and the production build passed. Nine added regressions cover both reproduced failures, unreadable-but-valid storage, new text during failed cleanup, whole-account/partial cleanup, warning removal after memory-only discard and a Clerk-mocked account switch. Real local browser checks used the actual useDraft/MarkdownEditor components with synthetic storage failures: persisted reload, navigation through blocked reads, discarded text staying empty after recovery, whole-draft cleanup and a visible memory-only warning at 320px. The actual privacy component also displayed the preview-only retention notice at 320px. Both inspected layouts had no horizontal overflow; viewport overrides were reset and temporary tabs/server were closed. These fixtures had no account/API connection and do not establish hosted sign-out, native unload-dialog or a full accessibility/device matrix.

This batch is an independent review candidate on fix/browser-draft-recovery, not deployed. Live source remains 7bc80ad/revision 0000004. Deferred cleanup is in-memory: a blocked stored copy cannot be guaranteed erased across a reload/closed tab before storage access returns. The privacy notice explains that limit. Application AI, Azure resources, firewall, credentials, scheduling and schema were unchanged.
