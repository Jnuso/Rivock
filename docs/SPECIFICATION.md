# Rivock specification

Product specification, October 11, 2026. The user authorized implementation of the confirmed choices and consolidated defaults in [README](README.md). This file defines target behavior; actual implementation, verification and remaining work are recorded in [IMPLEMENTATION](IMPLEMENTATION.md).

## Purpose and release boundary

Build and deploy a full-stack application to learn how frontend, identity, API, persistence, testing, and hosting interact. Rivock serves advice seekers and browsers, initially college students, through public questions and discussions. Anyone may read. Accounts unlock participation. There are no communities, accumulated user scores, or reputation-based access gates.

Launch includes accounts/profiles, the shared feed, preset topics/search, questions/discussions, nested replies, accepted answers, votes, saves, edits/deletion, in-app notifications, blocks/reports, moderation, and basic admin review. DMs, personalization, image uploads, automated ongoing bots, WebSockets, and dedicated search infrastructure are later features. AI assistance in development is separate from AI moderation in the product.

## Accounts and access

- Clerk supplies email/password and Google authentication. Credentials, email verification and recovery remain with Clerk. The React SDK obtains a short-lived session token; FastAPI verifies it before resolving the local account.
- First sign-in leads to a unique username choice. Proposed username rule: 3–24 ASCII letters/digits/underscores, normalized lowercase, immutable in v1; reserve `admin`, `administrator`, `rivock`, `moderator`, `system`, `support`, `deleted`.
- Public profile: username, optional bio up to 300 Unicode code points, preset avatar key, join date, bot badge when applicable, published contribution history. No email, provider identifiers, saves, reports, or aggregated reputation is public.
- Bio/avatar edits publish immediately in current reviews-off mode with profile revision and allowlist checks; initial onboarding has an empty bio/preset avatar. Admin can permanently clear a reported bio with an audited reason, cancelling any legacy pending profile edits. Avatar keys come from a fixed allowlist, not external URLs.
- Members manage their own contributions. Admins review moderation/reports and may remove/restore retained content or suspend/restore accounts. All privileged mutations have a reason and audit entry. No self-service role assignment.
- Proposed account deactivation immediately prevents writes, removes public profile details, labels existing contributions `[deleted]`, and clears private bookmarks/notifications/blocks. It retains the minimal identity mapping to enforce deactivation. Full Clerk account deletion is an operator procedure; the UI must not describe local deactivation as complete data erasure.
- No automatic linkage by email. A separate verified Clerk subject becomes a separate Rivock account; v1 has no account-merging UI.

## Feed, topics, and search

- Each thread has one active preset topic. Initial list: Education, Relationships, Careers, Money, Health & Wellbeing, Hobbies, Everyday Life.
- Admin can rename, reorder, add, or archive topics. Archived topics remain attached to existing threads and searchable but cannot be selected for new/retagged submissions. A pending submission whose topic is archived requires a new selection before publication.
- Default feed is Trending; Latest sorts by initial publication time, descending. Topic filter and sort are URL state, so back/forward and copied links work.
- Proposed Trending and Recommended formula: `net_votes / (max(0, age_hours) + 2)^0.5`, using initial publication time. Sort ties by publication time descending, then UUID descending. Edits do not bump age. The formula deliberately decays both positive and negative scores toward zero; heavily downvoted new posts may sit below older downvoted posts. Test this with samples rather than silently changing the formula.
- Search covers published thread titles and bodies only. PostgreSQL English full-text search weights titles more heavily. Strip supported Markdown syntax for indexing; do not index pending/removed/deleted content. Search filters by topic; default Relevance, optional Newest. A blank query returns the feed. Query length is at most 200 code points.
- Feed/search excludes removed/deleted threads. Authenticated block filtering removes blocked-author cards. Direct thread links retain placeholders where needed for conversation context. Public readers see published content regardless of another member's personal block settings.
- Proposed pagination: offset/limit, default 20/max 50, stable tie-breaks, no expensive total count. Votes and new posts can change pages between requests; frontend deduplicates by ID and resets pagination when filters change.

## Threads and conversation

- A thread is a Question or Discussion; proposed type is fixed after first publication. Title 1–200 code points after trimming; body 1–10,000 with meaningful visible text; exactly one topic. Replies have 1–5,000 code points and meaningful visible text.
- Basic Markdown supports paragraphs, bold, italic, lists, quotes, and HTTP(S) links. Toolbar inserts Markdown; preview uses the same renderer as published content. Disable raw HTML, embedded images/media, and executable URL schemes. Attachments and remote link previews are deferred.
- Direct replies are depth one; nested replies can reach depth five. Responding to depth five places a new reply beside that target at depth five and records whom it addresses. Parent/target cannot cross threads; ancestry cannot be edited or form a cycle.
- Direct replies sort by Recommended with accepted answer first. Nested replies sort oldest first. Only direct replies are globally ranked; a branch loads on demand rather than downloading an entire large tree.
- Only the question's author can accept, change, or clear a single published direct answer. Their own direct answer is eligible. Discussions cannot have accepted answers. Deleting/removing an accepted answer clears acceptance atomically. Editing an answer does not clear acceptance but shows the edited marker.
- Up/down votes are +1/-1; one row per voter/contribution. Repeating a set is idempotent; changing replaces the value; removing an absent vote succeeds. Proposed defaults: no self-votes; no votes on unpublished content or across a block relationship. Scores are content-level sums and never become a user score.
- Saves are private thread bookmarks. Repeated save/remove is idempotent. Removed/deleted saved threads show an unavailable placeholder that the user can unsave.

## Publishing, editing, deletion

- Current policy, changed October 16: FastAPI validates identity, account state, limits, topic/parent, duplicates and rate rules, then publishes immediately under explicit `MODERATION_MODE=off`. Every candidate version retains a durable private submission record; publication is labeled as having no automated review.
- No Gemma/content-rule check blocks initial publication in this mode. Input/Markdown safety, account restrictions, blocks, duplicate controls and rate limits remain. Reports and manual moderator actions remain available.
- AI assistance after user reports is a future design, not an active automated removal system. Legacy AI/pending modes remain tested but disabled; provider failure in those modes is never treated as approval.
- Authors can edit/delete their live contributions subject to account/target restrictions. An edit is a full replacement snapshot with expected revision and publishes immediately in current off mode. Legacy pending edits keep the earlier public version visible; a new valid edit cancels the earlier pending edit. Stale results cannot overwrite later edits/deletion/removal.
- Own reply edits/deletion remain available when a thread is author-deleted or another user blocks the author; these are ownership actions, not new responses. An admin-removed thread requires admin review for new content changes. All new reply creation requires a published thread and target.
- Editing preserves original publication time, votes, saves, and reply tree; updates `edited_at` and revision. A changed accepted answer retains its badge. Thread deletion leaves a `[Deleted thread]` shell with other users' replies readable; deleted reply text becomes `[Deleted reply]`. New replies to a deleted/removed thread are disallowed. Author deletion clears their stored content text and cancels pending edits.
- Admin removal preserves a private seven-day restore window; afterward content text is purged and restoration is unavailable. Removal never cascades to other people's replies. An author cannot self-publish over an admin removal; revision requires admin review.
- Removing/deleting a question also clears its accepted-answer pointer; restoring it does not automatically reaccept the old answer. Every deletion/removal takes the content/lease locks, cancels applicable open edits, and prevents a late worker from resurrecting text. Votes may remain stored, but unavailable placeholders show no score.
- Retained legacy retry policy, inactive in off mode: inline provider deadline eight seconds, retries at +5/+15/+60 minutes with a five-minute worker, then `needs_review`. Users may cancel unpublished legacy work; admins can approve/reject it with an audited reason. Switching off does not automatically publish rejected/cancelled/manual-review items. Existing ordinary pending work can publish through the same validated apply service, never through direct status-only database edits.

## Notifications and personal controls

- Direct reply event notifies the thread author; nested reply notifies the addressed reply's author. At the depth cap, notify the actual response target, not the structural parent. Deduplicate if recipients coincide. Never notify self.
- Acceptance changes notify the new accepted-answer author; repeating the same selection creates no new event. Unaccepting creates no notification in v1.
- Store notifications with publication/acceptance transactions. Pending/rejected content produces none. Suppress blocked-account events and hide existing events after a block. Mark one/all read; unread count updates while app is visible (30-second polling). No email or browser-push notifications at launch.
- Skip event creation for inactive actors/recipients or a block in either direction. List and unread-count use one shared visibility rule. Existing events from a later-deactivated actor show `[deleted]`, and unavailable targets show placeholders; no hidden text/name leaks. Recipient deactivation removes their events.
- Blocking hides the blocked account's contributions from the blocker's signed-in feeds/history/detail, using placeholders inside visible trees. Proposed symmetric interaction guard prevents either party replying directly to the other or voting on their content while either block exists. Blocking does not erase prior replies/votes or conceal content from anonymous readers.
- A third party's thread remains available: a blocked pair may each write unrelated direct replies there, but cannot reply directly to one another. Unblock restores visibility without replaying suppressed notification events.
- Reports require a signed-in active member and a reason: spam/scam, harassment, hate/threat, personal information, other; optional detail up to 1,000 code points. One report per reporter/target; counts alone do not auto-remove content. Admin actions record resolution/reason. Public content is not private simply because reported.

## Moderation capacity and later bots

Gemma reviews are temporarily disabled. Future AI may evaluate already-published content in combination with user reports. Define report triggers, context, outcomes, false-report protections, human review/appeals, provider data terms and budgets before implementation; never silently restore the old pre-publication gate. No application contribution text is sent to a provider in current `off` mode.

Proposed launch rates/caps are in SECURITY.md. Automated moderation must have a pause switch, durable pending state, structured decisions, bounded retries, budget accounting, and visible admin queues. Manual review may be infrequent, so pending users see honest status and can revise/cancel; no promise of 24/7 human support.

Later bots are visibly labeled, generate original fictional content, and pass the same checks. They do not scrape/train on Reddit, impersonate humans, vote, or send unsolicited DMs. Begin with a reviewed fixture seed pack; automatic ongoing activity is a separate milestone with explicit frequency and cost limits.

## Acceptance journeys

| ID | Journey and required result |
| --- | --- |
| A01 | Visitor browses/searches/opens a thread without signing in; protected action prompts sign-in and preserves return location/draft |
| A02 | Email or Google sign-in leads to onboarding exactly once; concurrent username claims result in one winner and a clear conflict |
| A03 | Author publishes a valid question; another account finds it and answers; author accepts that direct answer; state persists after reload |
| A04 | Malformed topic, over-limit text, cross-thread parent, non-owner edit, forged admin flag, wrong-audience token, and sixth structural level are rejected |
| A05 | Voting toggles/switches/removes without duplicate rows; concurrent same-voter requests keep one row; self-vote/block rules hold |
| A06 | Pending create stays private; pending edit leaves previous version intact; rejection, timeout, retry, stale result, and cancellation all preserve correct content |
| A07 | Delete/remove retains others' replies, clears affected acceptance, excludes content from search, and prevents later worker resurrection |
| A08 | Saves stay private; notification recipients, blocked suppression, unread/read state, and acceptance changes are correct |
| A09 | Search title/body ranking, topic filters, Latest/Trending, negative scores, tie-breaks, and nested order match the chosen policy |
| A10 | Admin removal/suspension/review requires authorization and an audit record; restored content re-enters applicable feeds/search |
| A11 | Mobile/desktop, keyboard, loading/empty/error/pending states work; Markdown cannot execute HTML/scripts or leak private fields |
| A12 | A clean checkout starts locally, CI passes, deployment health works, database backup restores, and projected/observed cost is recorded |

Performance defaults: target under 500 ms for warm local list/detail API calls against a seeded 10,000-thread dataset, excluding network/AI/identity; measure instead of promising a production SLA. Render usable layouts at 320, 390, 768, and 1440 CSS pixels. Cold-start and pending-moderation delays are separately displayed and measured.
