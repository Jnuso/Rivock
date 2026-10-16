# Rivock database design

Schema guide; PostgreSQL with SQLAlchemy/Alembic. Implemented UUID primary keys, `timestamptz` UTC timestamps, `text` plus CHECK constraints, and application/service validation. Migrations and models are authoritative. Separate threads/replies and vote tables; no user karma table or aggregate score on profiles. See IMPLEMENTATION.md for verification and retention choices.

## Core entities

| Table | Essential fields |
| --- | --- |
| `users` | `id`, `auth_issuer`, `auth_subject`, `username`, `bio`, `avatar_key`, `profile_revision`, `role` (`member/admin`), `status` (`active/suspended/deactivated`), `kind` (`human/bot`), `created_at`, `updated_at` |
| `topics` | `id`, immutable `slug`, `name`, `sort_order`, `is_active` |
| `threads` | `id`, `author_id`, `type` (`question/discussion`), `topic_id`, `title`, `body_markdown`, `search_text`, `search_vector`, `state` (`published/deleted/removed`), nullable `accepted_reply_id`, `revision`, `published_at`, `edited_at`, `updated_at` |
| `replies` | `id`, `thread_id`, `author_id`, nullable `parent_reply_id`, nullable `response_to_reply_id`, `depth`, `body_markdown`, `state`, `revision`, `published_at`, `edited_at`, `updated_at` |
| `thread_votes` | Composite primary key `(user_id, thread_id)`, `value` (-1/+1), `updated_at` |
| `reply_votes` | Composite primary key `(user_id, reply_id)`, `value` (-1/+1), `updated_at` |
| `saves` | Composite primary key `(user_id, thread_id)`, `created_at` |
| `blocks` | Composite primary key `(blocker_id, blocked_id)`, `created_at` |

Human users require a unique, non-null `(auth_issuer, auth_subject)` pair: verified issuer up to 512 characters and immutable Clerk subject up to 255. Operator-created fictional bots may have null identity fields. Identity is never inferred from email. Usernames are normalized lowercase, unique, 3–24 ASCII letters/digits/underscores, and reserved after deactivation. Public author projection returns `[deleted]` for deactivated users without exposing the retained username/identity mapping. Migration `31c7a48a90c1` renames the former Entra fields and places existing identities under `legacy-entra:<old tenant>`, preserving local UUIDs and ownership without connecting them to Clerk accounts. Downgrade refuses new provider identities.

Title/body are required/nonblank and within code-point limits when published. Author deletion clears their text (`NULL`) and excludes search text; API generates placeholders. Topic/type/author/IDs persist to preserve other people's replies. Removed content text is private for a seven-day restore window, then purged. Hard delete is reserved for controlled retention/cleanup procedures.

## Moderation, reports, notifications, operations

| Table | Essential fields |
| --- | --- |
| `moderation_submissions` | `id`, `user_id`, `action` (create/edit thread/reply, edit_profile), nullable target `thread_id`/`reply_id` (profile target is owner `user_id`), immutable `snapshot` JSONB, `base_revision`, `status` (`pending/processing/published/rejected/cancelled/needs_review`), `idempotency_key`, `request_hash`, `ai_attempt_count`, `next_attempt_at`, `lease_until`, `lease_token`, `reason_code`, `error_category`, `created_at`, `updated_at` |
| `moderation_attempts` | `id`, `submission_id`, `attempt_number`, `source` (`rules/ai/admin`), provider/model/version if applicable, decision/category/confidence, structured reason code, token counts, `reserved_cost_microusd`, `actual_cost_microusd`, outcome/error category, `started_at`, `finished_at` |
| `notifications` | `id`, `recipient_id`, `actor_id`, `kind` (`thread_reply/reply_response/answer_accepted`), `thread_id`, `reply_id`, `event_id`, `created_at`, nullable `read_at` |
| `reports` | `id`, `reporter_id`, exactly one target `thread_id`/`reply_id`/`subject_user_id`, `reason`, optional `detail`, `status` (`open/resolved/dismissed`), `created_at`, `resolved_at` |
| `admin_actions` | `id`, `actor_id`, `action`, applicable target references, structured reason, safe metadata, `created_at` |
| `rate_buckets` | Composite key `(subject_key, action, window_start)`, `count`, `expires_at`; atomically increment/check limits |
| `erasure_events` | `id`, target type/UUID, erasure action, `created_at`; append-only metadata without erased text, exported separately for safe backup restoration |

Moderation snapshots are immutable except retention erasure. Revisions are resubmitted as new rows. Pending creates have no public thread/reply row until approved; create submissions receive their target ID in the publication transaction. Reply-create snapshots reference the existing thread and response target; edit snapshots carry a required content/profile base revision. Profile edits carry bio/avatar snapshot and reference the owner; no separate profile table is needed. A retry never inserts a second content row for an already-published submission. `ai_attempt_count` counts provider calls only; rules/admin attempts have their own increasing log ordinal and do not consume the provider retry count.

No raw provider reasoning, token credentials, private identity claims, or duplicate complete prompts are needed in attempt logs. Budget reservation and actual/unknown costs are tracked on attempts: timed-out calls retain their reservation until usage is known, preventing retries from escaping the cap. One database-wide advisory lock guards AI cost reservation/checks; only one in-flight AI call is permitted initially.

## Constraints and relationships

- Foreign keys for every user/topic/thread/reply relationship. Retain user/content rows for placeholders; avoid cascading deletion of public conversation trees.
- Unique `(auth_issuer, auth_subject)` and normalized username; CHECK role/status/kind values and human identity requirement.
- CHECK bio length <=300 code points and fixed avatar allowlist (`initials`, `blue`, `sage`, `rose`, `warm`); `profile_revision` starts at one and changes only when approved settings apply or an admin clears the bio.
- CHECK thread type/state, published required content, character limits, and `accepted_reply_id IS NULL` for discussions.
- Add unique `(id, thread_id)` on replies. Composite foreign keys `(parent_reply_id, thread_id)` and `(response_to_reply_id, thread_id)` reference it, preventing cross-thread references. CHECK no self-parent/self-target, depth 1–5, and parent-null exactly when depth is one.
- CHECK response-target-null exactly when depth is one; for depth two through four, structural parent equals response target. At depth five, the target may be depth four (normal child) or depth five (sibling response); the service checks the correct case under locks. PostgreSQL CHECKs cannot inspect another row's depth, so do not write an invalid cross-row CHECK expression.
- Enforce depth/target semantics in the publication service using locked existing parent/target rows; create new replies only and never edit ancestry. This prevents cycles without a general-purpose recursive graph mutation system. Tests must exercise direct SQL FK failures as well as service failures.
- Accepted-answer same-thread, direct-reply, published-state, and question-owner checks belong in the shared acceptance/publication/deletion services; update them transactionally. A foreign key alone does not enforce these rules. Use the existing reply `(id, thread_id)` uniqueness for the same-thread acceptance FK where mapped by SQLAlchemy.
- Vote CHECK value in {-1,+1}; composite PKs prevent duplicate votes/saves/blocks. Self-vote restrictions depend on author relation and are service checks. CHECK block endpoints differ.
- Reports use exactly one typed FK target, not an unenforced generic `target_id`. Unique reporter/thread, reporter/reply, reporter/user partial indexes prevent duplicate reports.
- Unique `(user_id, idempotency_key)` on submissions. Same key + different payload/route hash gives 409. Partial unique index on `thread_id` where action is `edit_thread` and status is open (`pending/processing/needs_review`); equivalent on `reply_id` where action is `edit_reply`. A new valid edit cancels the earlier one under the target lock before inserting. Do not constrain every reply submission that happens to share a thread ID.
- One open `edit_profile` per owner with the same cancellation/revision rules. Deactivation/admin bio clear cancel open profile edits so a late decision cannot restore hidden profile text.
- Unique `(submission_id, attempt_number)` and `(recipient_id, event_id)` prevent duplicate attempts/notification delivery. An acceptance change has a fresh event ID, so A→B→A can notify A again; an idempotent repeated A selection cannot.
- Clients cannot set publication status, revision, author, role, score, acceptance, moderation result, or bot kind through general edit payloads.

## Depth-five representation

Use two pointers for different jobs:

| Response | Structural parent | Response target | Depth |
| --- | --- | --- | --- |
| Direct reply to thread | null | null | 1 |
| Reply to a target of depth 1–4 | Target ID | Target ID | Target depth + 1 |
| Reply to a target of depth 5 | Target's parent ID | Target ID | 5 |

The structural parent controls indentation/tree loading; the response target controls “replying to @username” and notification recipient. Both are immutable. Deletion keeps these identifiers, so attribution falls back to `[deleted]` without breaking branches. New responses require published target/parent and a published thread.

## Indexes and query rules

Index thread `(state, published_at DESC, id DESC)` and `(topic_id, state, published_at DESC, id DESC)`, plus a GIN search-vector index. Index replies `(thread_id, parent_reply_id, published_at, id)` and authors' published histories; vote target IDs; saves `(user_id, created_at DESC)`; blocks in each direction; notifications `(recipient_id, created_at DESC)` with an unread partial index; reports `(status, created_at)`; submissions `(status, next_attempt_at)` plus owner/date; attempts by time for monthly budget; expired rate buckets for cleanup.

Use PostgreSQL English `tsvector` with title weight A/body weight B and `websearch_to_tsquery`, bound parameters, and `ts_rank_cd` relevance. Strip supported Markdown in the service before writing indexed plain text. Update/remove the vector in the same publication/removal transaction. Search queries never use untrusted string-built SQL. Later multilingual support requires an explicit change.

Compute vote sums in independent aggregation subqueries before other joins. Compute ranking on the visible candidate set and a single request timestamp. Paginate direct replies independently from each child branch. Do not preload all descendants. Private actor-specific projections are separate from public profile serialization.

## Lifecycle and retention defaults

| Record | Proposed handling |
| --- | --- |
| Published content | Retain until author deletion or moderation removal; public snapshots are current version only |
| Author-deleted text | Clear immediately, including related draft snapshots; preserve IDs/ancestry |
| Admin-removed text | Private seven-day restore window, then purge text; retain action metadata |
| Rejected/cancelled submission text | Retain privately seven days, then erase snapshot; retain minimal replay/FK metadata |
| Published submission snapshots | Erase after seven days; current approved content remains in its normal table |
| Pending/review snapshots | Retain while unresolved, maximum thirty days; then cancel/erase with visible expiry reason |
| Notifications | Ninety days; remove immediately on recipient deactivation |
| Reports/admin decisions | Ninety days of bounded detail, then redact free text; delete rows after 365 days |
| Rate buckets/IP pseudonyms | Expire within two days; raw IPs are not stored in these tables |
| AI usage metadata | Retain without duplicate content text for cost accounting; delete attempts after 365 days |
| Minimal identity/replay/ancestry/erasure markers | No fixed expiry in v1; preserve unique identities, foreign keys, duplicate-replay safety and restoration; do not retain erased text in these markers |

Run cleanup from the same scheduled worker. Author deletion/moderator removal first locks the target and its open submissions, cancels pending/processing/needs_review edits, and invalidates leases; terminal submission history is retained/redacted, not treated as an open cancellation. Deleting/removing a question or its accepted answer clears acceptance atomically; restore does not silently reaccept. Stored votes on unavailable content are frozen and omitted from placeholder scores. Record erasure/deactivation events transactionally, export an encrypted independent journal, and replay after backup restoration before public access.

A table status row may remain after snapshot erasure; the UI must not promise a draft that has expired. Provider retention and database backups are separate: backup expiry must be described in the deployment/privacy notes, and restore procedures reapply deletion/purge records before serving traffic.

Alembic creates schema and initial topic rows idempotently. Development/test seed users and fictional threads are a separate command, never an automatic production migration. Use PostgreSQL in tests to exercise constraints/full-text search; do not substitute SQLite.

Create the threads/replies tables before adding the acceptance composite FK in a separate migration step, since their references are circular. Configure explicit ORM foreign-key relationships rather than relying on ambiguous automatic join inference.
