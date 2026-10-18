# Rivock REST contract

Implemented contract overview. Base path `/api/v1`; JSON with snake_case fields; UUID strings; ISO-8601 UTC timestamps. The authoritative machine-readable contract is generated from FastAPI into `frontend/openapi.json`, then into frontend TypeScript types. See [IMPLEMENTATION.md](IMPLEMENTATION.md) for verification and external integration limits.

## Common behavior

Current publication policy is `off`: valid creates/edits return 201/200 immediately with a published submission, private `reason_code=moderation_disabled` and `review=null`. This is an explicit policy, not a provider-error fallback or AI approval. Input/auth/ownership/block/rate/duplicate/revision errors retain their existing codes. Legacy gated modes can still return 202/422 as documented below; reports and admin removal continue independently. No schema or database migration changes are required for the policy switch.

Public GETs accept anonymous requests. A supplied invalid bearer token receives 401 rather than being silently ignored. Protected routes require a verified Clerk v2 user-session token and a local active user, except onboarding/account-status and deactivation as noted. Admin routes additionally check the local admin role. Public responses expose no provider identifiers/email/private flags. Token verification requires RS256, the exact configured issuer, expiry/not-before/issued-at, user subject, session ID, v2 marker and an explicitly allowed frontend origin (`azp`). Missing-origin, pending, machine and impersonation tokens are refused. An optional configured audience is enforced; default Clerk session tokens have no audience.

Lists return `{items: [...], next_offset: number|null}`; query `offset=0`, `limit=20` (1–50). Notification lists additionally return `as_of`, the server's UTC snapshot time for read-all. No total count is required. Dynamic ranked pages may shift under voting/new content; clients deduplicate IDs. All authenticated responses are `Cache-Control: private, no-store`; initial public API responses are also `no-store` to avoid accidental mixed-identity caches. Static assets may be cached by content hash.

Errors use `{error: {code, message, fields?: {...}, submission_id?: uuid, request_id}}`. Standardize FastAPI validation errors into this envelope. Never return SQL/provider stack traces. Typical status codes: 401 unauthenticated/invalid token; 403 inactive account, missing permission, or blocked interaction; 404 unavailable/not-visible target; 409 username/idempotency/duplicate/revision conflict; 422 invalid input or policy rejection; 429 rate limited with `Retry-After`; 503 unavailable infrastructure. AI unavailability is 202 pending rather than 503 once the submission is durably stored.

Creation/edit routes require an `Idempotency-Key` UUID header. Reuse the same key only when retrying the same action/payload. Store normalized payload hash and result reference; same user/key with different payload/route returns 409. Replay returns current submission/result, not a duplicate mutation. Minimal replay metadata remains after text erasure without a fixed expiry. PUT/DELETE votes/saves are naturally idempotent and do not need this header.

## Identity and profiles

| Method/path | Input | Result/access |
| --- | --- | --- |
| `GET /me` | Valid API token | 200 `{onboarding_required, user: PrivateUser|null}`; returns account status even if inactive |
| `POST /me` | `{username}` + idempotency key | 201 local profile; existing identical onboarding may return 200; username/identity conflict 409 |
| `PATCH /me` | Full `{base_revision, bio, avatar_key}` + idempotency key | Moderated profile edit: 200 approved private profile, 202 pending, 422 rejected; username/role/kind not writable |
| `DELETE /me` | `{confirm_username}` | 204 local deactivation; valid identity, including suspended user; idempotent |
| `GET /users/{username}` | — | Public profile or 404 if deactivated; authenticated block visibility applies |
| `GET /users/{username}/contributions` | `type=threads|replies`, pagination | Published public history, subject to block filtering |

`PrivateUser` includes local ID, username, bio, avatar key, profile_revision, role, status, kind, created timestamp. `PublicUser` excludes role/status/provider IDs and includes `is_bot`. Bio length is at most 300 code points; avatar keys are the fixed allowlist in DATABASE.md. Profile edit snapshots use the same pending/revision/cancellation behavior as content edits. An unchanged approved bio with only an allowed avatar-key change can be approved by deterministic validation without another AI call. No account-merging/password/login endpoints exist in FastAPI. Clerk owns those flows.

## Topics, feed, search, threads

| Method/path | Input | Result |
| --- | --- | --- |
| `GET /topics` | `include_archived=false` | Ordered topic IDs/slugs/names/active flags; archived option supports old filters |
| `GET /info` | — | Public local-fixture indicator used to label demonstrations |
| `GET /threads` | `topic=<slug>`, optional `q`, `sort`, `type=question|discussion`, `answer_status=unanswered|answered|accepted`, pagination | Thread-summary list |
| `GET /threads/{id}` | — | Thread detail; deleted/removed thread may return a shell with conversation context |
| `POST /threads` | `{type, topic_id, title, body_markdown}` | Moderated creation outcome below |
| `PATCH /threads/{id}` | `{base_revision, topic_id, title, body_markdown}` full editable snapshot | Moderated edit outcome; author only |
| `DELETE /threads/{id}` | — | 204; author only; under target/lease locks cancel open edits, clear text/acceptance, retain shell |

For a blank/absent `q`, `sort=trending|latest`, default trending. With a nonblank `q`, `sort=relevance|newest`, default relevance. Invalid combinations return 422. Query up to 200 code points. Thread type cannot change after publication. Search excludes deleted/removed/pending content; topic filtering applies before ranking/pagination.

Local-only feature branch addition: type and answer_status apply before search ranking and pagination. Any answer_status restricts to questions; combining it with type=discussion returns 422. unanswered/answered use absence/presence of a published direct answer visible in the viewer’s normal block projection. accepted requires such an answer to match the question’s acceptance pointer. Deleted/removed/blocked answers and nested replies do not count. Omitting both preserves existing feed behavior. These additions have not been released.

Thread summary includes ID, type, topic, title, a plain-text excerpt up to 240 code points, public author, publication/edit timestamps, revision, score, published reply count, acceptance flag, and (for a viewer) `my_vote`, `is_saved`. Count includes published descendants but excludes hidden blocked-author content in the viewer's filtered projection. Thread detail adds body Markdown, accepted reply ID, and state. Deleted/removed/blocked shells expose no original text or hidden author metadata; state/placeholder explains availability.

## Replies, votes, acceptance, saves

| Method/path | Input | Result |
| --- | --- | --- |
| `GET /threads/{id}/replies` | Pagination | Direct replies; accepted first then Recommended |
| `GET /replies/{id}/children` | Pagination | Structural children oldest first; lazy expansion |
| `GET /replies/{id}` | — | Single reply with the same safe visibility projection |
| `GET /replies/{id}/context` | — | `{thread_id, replies}`: structural ancestors through target, oldest first, maximum five; safe placeholders apply |
| `POST /threads/{id}/replies` | `{body_markdown, response_to_reply_id?: uuid}` | Moderated reply creation |
| `PATCH /replies/{id}` | `{base_revision, body_markdown}` | Moderated edit; author only; ancestry immutable |
| `DELETE /replies/{id}` | — | 204; author only; under target/lease locks cancel open edits, clear text/acceptance if applicable, keep descendants |
| `PUT /threads/{id}/vote` | `{value: 1|-1}` | 200 `{score, my_vote}` |
| `DELETE /threads/{id}/vote` | — | 200 `{score, my_vote: null}` |
| `PUT /replies/{id}/vote` | `{value: 1|-1}` | 200 `{score, my_vote}` |
| `DELETE /replies/{id}/vote` | — | 200 `{score, my_vote: null}` |
| `PUT /threads/{id}/accepted-answer` | `{reply_id}` | 200 `{accepted_reply_id}`; question author only |
| `DELETE /threads/{id}/accepted-answer` | — | 200 `{accepted_reply_id: null}`; question author only |
| `GET /me/saved` | Pagination | Private saved summaries or unavailable placeholders |
| `PUT /threads/{id}/save` | — | 204; published target; active member |
| `DELETE /threads/{id}/save` | — | 204 even if target unavailable or already unsaved |

Reply creation accepts the user's response target, not a client-selected structural parent/depth. Server derives both fields using DATABASE.md, preventing a sixth level. `Reply` includes ID, thread ID, parent ID, response target projection, depth, public author, body, state, revision, timestamps, score, my vote, acceptance flag, and child count. If text/author is hidden, return only the placeholder/context fields needed for traversal. Do not return hidden body in an offscreen JSON field.

Context follows structural parents, not response-target links; at depth five these differ. The bounded same-thread chain does not load siblings or alter permanent ranking. Each item uses the normal viewer-safe projection. The frontend uses `/threads/{thread_id}#reply-{reply_id}` to open this focused context and offers a return to ranked replies.

Published thread and response target are required for new replies/votes/acceptance; pending creates have no public content ID. Existing reply votes may be changed only while their thread and reply remain published. Own reply edits/deletes are allowed in an author-deleted thread and despite personal blocks; changes under an admin-removed thread need admin review. Saving a blocked-author thread is disallowed while hidden; existing saved entries become unavailable placeholders. Existing votes are preserved when blocks occur; scores remain global content scores. Unavailable placeholders expose no score. Removing/deleting a question clears its accepted-answer pointer; restoring content does not automatically restore acceptance.

## Moderated outcomes and private submissions

Private mutation outcomes and owner/admin submission list/detail responses include nullable `review`: `{source: ai|rules|fixture|admin, decision: allow|reject|uncertain, model, completed_at}`. This summarizes the latest completed check by attempt start order, so an older AI attempt finishing late cannot supersede a newer moderator check. Failed/in-progress attempts do not imply a completed review; missing/expired history returns null. Lists batch the review query for visible submissions. Public thread/reply serializers do not expose this field. Publication status remains separate from the check's decision, including inconclusive AI results.

Create/edit can return:

```json
{
  "submission": {
    "id": "uuid",
    "status": "published",
    "action": "create_thread",
    "content_id": "uuid",
    "reason_code": null,
    "next_attempt_at": null
  },
  "content": {"id": "uuid", "revision": 1}
}
```

Full content uses the applicable Thread/Reply/PrivateUser model. Profile actions use `edit_profile`, with the owner's UUID as content_id. 201 for completed create, 200 for completed edit; 202 for pending/processing with `content: null` and an owned submission ID. Terminal rejection returns 422 in the error envelope with `submission_id` and a safe reason. Client stores the submission ID and reads the owned status; it never fabricates a public success page before publication.

| Method/path | Behavior |
| --- | --- |
| `GET /me/submissions` | Owner list, optional status filter, pagination; include status/action/times/result reference |
| `GET /me/submissions/{id}` | Owner only; includes editable snapshot until retention expiry, decision reason, retry status, published target reference |
| `DELETE /me/submissions/{id}` | Cancel pending/processing/needs_review under lease/target locks; 204; published/rejected cannot be cancelled and return 409 |

Revise by issuing a new normal POST/PATCH with a fresh idempotency key. Revisions to live content require the current `base_revision`; rejected/pending snapshots do not increment published revision. Missing snapshot after retention expiry is explicit `snapshot_available: false`. A submission can transition pending→processing→published/rejected/pending/needs_review/cancelled; invalidated work cancels with a reason. Workers cannot resurrect cancelled work.

## Notifications, blocks, reports, admin

| Method/path | Behavior |
| --- | --- |
| `GET /me/notifications` | Private list, `unread_only=false`, pagination; unavailable targets render placeholders |
| `GET /me/notifications/unread-count` | `{count}` for visible/suppression-filtered notifications |
| `PATCH /me/notifications/{id}` | `{read: true}`; 200; owner only, idempotent |
| `POST /me/notifications/read-all` | `{through: <as_of from list response>}`; reject future timestamps; 204; notifications created after the cutoff remain unread |
| `GET /me/blocks` | Private blocked-user list |
| `PUT /me/blocks/{user_id}` | 204; no self-block; blocking an admin's personal content does not disable their privileged moderation access |
| `DELETE /me/blocks/{user_id}` | 204 idempotent |
| `POST /reports` | Exactly one `{thread_id|reply_id|user_id}`, reason enum, optional detail; 201 or 409 duplicate |
| `GET /admin/reports` | Admin queue, status filter, pagination |
| `PATCH /admin/reports/{id}` | `{status: resolved|dismissed, reason}`; audit |
| `GET /admin/submissions` | Admin pending/review queue, status filter, pagination |
| `GET /admin/submissions/{id}` | Private submission inspection |
| `GET /admin/threads/{id}` and `/admin/replies/{id}` | Admin-only retained-content inspection; no public serializer bypass |
| `POST /admin/submissions/{id}/decision` | `{decision: approve|reject, reason}`; shared safe apply service, audit, idempotency key |
| `POST /admin/submissions/{id}/retry` | New admin idempotency key; schedule one bounded attempt on the same nonterminal submission if budget/lease permits; audit; published/rejected/cancelled return 409 |
| `POST /admin/threads/{id}/remove` and `/restore` | Reason + idempotency key; audit; restore only retained text and valid state |
| `POST /admin/replies/{id}/remove` and `/restore` | Same, with accepted-answer cleanup |
| `POST /admin/users/{id}/suspend` and `/restore` | Reason + idempotency key; audit; no restoring self-deactivated account through suspension endpoint |
| `POST /admin/users/{id}/clear-bio` | Reason + idempotency key; permanently clear bio, increment profile revision, cancel open profile edit, audit |
| `GET /admin/actions` | Paginated safe audit history |
| `POST /admin/topics` | `{slug, name, sort_order}`; validate, audit |
| `PATCH /admin/topics/{id}` | Optional `{name, sort_order, is_active}`; slug immutable; audit |
| `GET /admin/status` | Moderation mode, effective pause, reserved/used cost, budget and open queue count |
| `PUT /admin/pause` | `{paused, reason}`; persistent audited control; environment-level pause still takes precedence |

Admin reason length 1–1,000 code points. Admin content mutations recheck status/revision and cannot bypass cross-thread or deleted-content invariants. Admin retry replays an existing schedule outcome with the same admin key, never creates another content row, and increments provider attempt count only when an actual attempt starts. The original member submission key still references that single submission. The worker has no public unauthenticated HTTP endpoint. Local admin bootstrap uses an explicit CLI command naming a local user UUID, not an application signup field. Admin suspension cannot silently remove the last active admin; the operator CLI is the recovery path.

Notification insertion skips self/inactive actors or recipients and blocks in either direction. List and unread-count share one visibility predicate. Existing events from deactivated actors use `[deleted]`; unavailable targets show placeholders without original text. Recipient deactivation erases their events. These rules do not delete historical events solely because an actor later deactivates.

Notification output includes nullable `reply_id` for an exact answer/reply destination. It is null when the target is unavailable; clients must not construct links to hidden targets from other metadata.

Public content can be reported; pending submissions are visible only to owner/admin and have their own review queue. Reports never automatically remove content based solely on count. Do not expose reporters to the reported user.

## Operational endpoints

`GET /health/live` checks process liveness without database/provider calls. `GET /health/ready` checks required configuration and a bounded database query; returns 503 when unavailable. Neither discloses secrets, internal addresses, or stack traces. AI outage is reported in admin status/metrics, not as an API liveness failure. FastAPI OpenAPI/docs remain accessible in local development; production documentation requires admin access or is disabled.

## Contract verification

Test every private/public serializer boundary, status/error outcome, idempotency replay/conflict, concurrent same-user vote/upsert, stale edit, block/suspension race, moderation retry, offset validation, and API schema/type generation. Provider calls and Clerk endpoints are fixtures in CI; validate real sign-in separately with test accounts. REST authorization belongs in FastAPI regardless of what buttons React hides.
