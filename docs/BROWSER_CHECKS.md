# Hosted browser verification

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

The hosted checks found three interface defects: topic headings used lowercase slugs, My submissions still described checks before publication, and Escape did not dismiss the mobile menu. The current source fixes those issues, keeps a failed feed request distinct from an empty feed, and treats the menu as a navigation disclosure with ordinary links/buttons. A separate local browser check verified the canonical topic name and Escape returning focus to Menu. These local results do not by themselves prove a new hosted release.

## Current source verification

- Frontend: types, all 39 tests and build passed, including empty-topic metadata, error-state and menu keyboard regression checks.
- Backend: 205 tests passed against the isolated PostgreSQL test database; 22 helper tests and backend/script Ruff checks passed.
- Added an isolated --cleanup-only worker CLI command. Its four new tests verify no queue processing or sleeping, preservation of --once/daemon behavior and rejection of conflicting flags.
- The separate cleanup-job Bicep template compiles and defaults to disabled. No cloud schedule or provider key was created.
- Two bounded coding-worker attempts returned Google HTTP 503 and no changes. No independent worker review or successful worker test run is claimed; the checks above were run directly in the project environment.

## Remaining checks

Verify the next deployed image and repeat the changed interface checks there. Email/password/recovery, wider screen-reader/touch testing, managed Azure restore/erasure replay, previous-image rollback, retention scheduling and database network tightening remain separate work. Sign-in redirects were exercised through user authentication, but this run does not establish every recovery/return-path variant.
