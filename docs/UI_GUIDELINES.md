# Rivock interface and journeys

UI guide. The approved [standalone demo](../reference/design-demo.html) is the visual reference; behavior choices in the specification override fictional demo content. Current implementation differences and browser checks still pending are recorded below and in IMPLEMENTATION.md.

## Visual defaults

Light background `#F7F8FB`, white surfaces, dark text `#202638`, muted text `#697184`, blue action color `#2855DF`, darker hover `#1E42B8`, border `#E7EAF0`, soft blue `#EEF2FF`, success `#267451`. Use Inter with system sans-serif fallback; self-host the packaged font in the real application. Controls have subtle 8px rounding, cards about 14px, readable spacing, and a 16px base body for the real app. Verify contrast rather than assuming every demo color combination passes accessibility checks.

Desktop uses a persistent topic/navigation sidebar, constrained reading width, and balanced text previews. At 900px and below use collapsible navigation and a single column. Keep indentation shallow on phones even though logical depth can reach five; use guide lines and “replying to” attribution. Do not shrink body text to squeeze desktop layouts onto mobile.

Initial topics replace the demo's four sample categories: Education, Relationships, Careers, Money, Health & Wellbeing, Hobbies, Everyday Life. Question/Discussion badges describe content type, not different communities. No user score, leaderboard, karma badge, or participation gate.

## Screens and routes

| Screen | Frontend route and content |
| --- | --- |
| Feed/Search | `/` or `/t/:topicSlug` with `q` and `sort` URL parameters; Trending/Latest, topic selector, previews, create action |
| Thread detail | `/threads/:id`; full post, author, vote/save/report, accepted answer, ranked direct replies, expandable branches |
| Create/Edit | `/new`, `/threads/:id/edit`; title/type/topic/body, Markdown controls/preview, limits, submit/draft handling |
| Sign-in return | Clerk-hosted portal returns to a validated same-origin path; Rivock onboarding follows if needed |
| Onboarding | `/onboarding`; username, validation/conflict feedback, public-identity explanation |
| Profile | `/u/:username`; bio/avatar and published thread/reply history, no aggregated reputation |
| Saved | `/saved`; private bookmarks, unsave controls, unavailable placeholders |
| Notifications | `/notifications`; unread/read, read-all, thread/answer destinations |
| Settings | `/settings`; bio/avatar, account status/deactivation and private block management |
| My submissions | `/submissions`, `/submissions/:id`; pending/rejected/review status, reason, retry timing, revise/cancel |
| Admin | `/admin`; reports/submissions queues, inspect/action controls, audit history, topic management |

Auth gates retain the intended action: after sign-in, reopen a draft or return to the target thread. Do not automatically cast a vote or submit content merely because login completed; preserve intent and let the user act. Prevent off-site return URLs. The authenticated backend still checks permission regardless of frontend routing.

## Composer and conversation

- Title and body required; type and exactly one topic required. Show remaining counts using Unicode code points, matching backend limits. Whitespace/formatting-only bodies do not qualify as content.
- Markdown toolbar: bold, italic, list, quote, link, and preview toggle. Sanitize preview exactly like published content. Show link target when editing. Do not permit raw HTML, images, media embeds, or extra rich-editor features in v1.
- Save composer text/type/topic/original revision in session storage with a 24-hour timestamp; preserve through authentication; clear after submit/discard/sign-out/account switch/deactivation. Keep in-memory recovery across navigation if storage fails and warn on tab close in that case. Do not store credentials or all private server data in browser storage. Refresh/sign-in redirects cannot recover an in-memory-only draft.
- Disable duplicate submit while request is in flight and reuse its idempotency key on retry. Pending submission routes to its private status screen, not a fake public thread. Explain “Awaiting moderation” or “Check delayed”; reasons must describe the user's next available action without exposing provider errors.
- While an edit is pending, show the author their pending draft separately from the last public version. Edited marker appears only after successful publication. Background refetch never advances the draft's original revision. Conflicts preserve the draft and show the current published version; loading it asks before replacing the draft, while keeping the draft against that version requires an explicit choice before resubmission. Thread, reply and profile editors follow this behavior.
- Recommended direct replies: accepted answer first, then score/freshness rank. Each collapsed branch shows count; load on demand. Nested replies oldest first. New replies and deep notification links open a focused conversation: expanded structural ancestors, highlighted/focused target and a return to all answers/replies. Context is capped at five and uses safe placeholders; the response-target attribution at depth five remains separate.
- At depth five, show “Replying to @username” while keeping indentation at level five. Deleted/removed/blocked ancestors use placeholders; never expose their hidden text in tooltips, markup attributes, or JSON.

## Notifications and personal controls

Show unread count while signed in; poll every thirty seconds only while the tab is visible. Poll visible pending submissions every five seconds. Invalidate private caches on sign-out/account change. One/all-read actions are explicit. Email notifications are not a launch feature.

Block/report/delete controls are available in consistent contribution menus. Block copy accurately says content remains public. Destructive content deletion asks once with the consequence that other people's replies remain; routine votes/saves do not ask for confirmation. Account deactivation copy distinguishes deactivation from full identity erasure and explains retained conversation structure.

Admin screens show reason/status, safe content inspection, approve/reject/remove/restore/suspend with required reason, and audit result. Review actions use real backend state and clearly show conflicts. Public users do not see admin controls, provider confidence values, reporter identities, or operational costs.

Profile settings use the same pending/rejected edit presentation for the optional bio. Public profile retains its last approved bio/avatar until publication; preset avatar-only changes may complete immediately. Show the private profile draft and revision conflict without exposing it to other users.

## Accessibility, states, and verification

Use semantic buttons/forms/headings/landmarks, skip link, visible focus, meaningful field labels, associated errors, and status announcements. Keyboard users can search, open threads, vote/save, expand replies, compose/preview, accept an answer, and return. Focus moves to appropriate headings/dialogs and returns to trigger on dismissal. Honor reduced motion. Use touch targets around 44 CSS pixels and contrast at least WCAG AA for normal text.

Every data view needs loading, empty, error/retry, and unavailable states. Distinguish signed out, onboarding, suspended, and deactivated. Never represent a network error as an empty feed or a failed publish as success. Reserve layout space for loaders to limit jumps.

Manually inspect and capture real browser layouts at 320, 390, 768, and 1440 CSS pixels during implementation. Verify long usernames/titles, multi-paragraph Markdown, long URLs, depth-five branches, modals, and mobile keyboard. Browser tests cover navigation/back/forward, topic/search URL state, compose validation, draft preservation, pending/rejected publishing, acceptance, voting, and saving. The existing demo's DOM checks are not evidence that these future production screens or mobile layouts have been tested.


Local candidate: direct reply lists offer Recommended/Newest/Oldest, with visible accepted answers first in every mode. Persist the choice in reply_sort, retain it through focused context, and keep nested children chronological. Reply timestamps are keyboard-accessible links into the bounded context. Canonical Copy link omits this display preference and search history. These controls remain local and unreleased.


Local draft-backup candidate: provide a current-editor plain-text download and a manual retry when browser saving fails. Preserve text/original revisions, retry pending cleanup before persisting, and do not resurrect a discarded or former-account value. Do not claim an untouched initial editor value is a saved draft or a requested download is confirmed disk persistence. Explain downloaded copies remain separate from browser-draft cleanup.


Local notification candidate: each item offers Mark read or Mark unread, changing only that recipient’s read state. Refresh All/Unread and the badge together; disable individual/read-all controls until the pending change and refresh finish. Preserve visible state on failure. Unavailable items have no actor/target links.
