# Rivock security and moderation

Current October 16 policy: explicit `MODERATION_MODE=off` publishes validated posts/replies/profile edits without content review and makes no provider calls or synthetic approval records. Authentication, ownership/revision/target checks, Markdown sanitization, account restrictions, blocks, duplicate and rate limits remain. User reports and audited manual moderation remain. The AI pipeline details below describe retained inactive capabilities; report-assisted post-publication AI requires a separate review before activation. AI pause or provider failure alone never changes a gated mode into immediate publication.

Security policy and implementation guidance. See [SPECIFICATION](SPECIFICATION.md) for public behavior, [API](API.md) for contracts and [IMPLEMENTATION](IMPLEMENTATION.md) for actual verification and launch gates. Provider quality evaluation and live identity/cloud checks remain pending.

## Identity, secrets, and permissions

- Use Clerk-hosted authentication through the React SDK. The browser has only a publishable key; provider credentials and Google OAuth secrets stay with Clerk. Rivock has no password endpoint.
- Backend verifies RS256, exact issuer, exp/iat/nbf, v2, user subject, session ID and an explicitly allowed frontend `azp` origin. Enforce a configured audience when used. Reject pending, machine, impersonation, unsigned and wrong-instance tokens. Identity uses `(issuer, subject)`; token metadata cannot grant local admin rights.
- Use Clerk’s supported token lifecycle; do not manually persist tokens in local/session storage. Draft storage and a public last-user marker are separate; clear private drafts/caches on sign-out/account changes. Same-origin return paths prevent open redirects. Late responses cannot restore a signed-out or previous account.
- Secrets go in ignored local environment files and Azure secret configuration. Only the Clerk publishable key and public API URL belong in `VITE_*` settings. The integration does not need a Clerk secret key. Never put AI/database/Google secrets, tokens or private user data in bundles, source, prompts or logs.
- Separate public and private Pydantic response models. Check local status/role/ownership in services for every mutation; no mass assignment from request objects. Admin checks are server-side and audited. Production contains no auth bypass or fake token issuer.
- A suspended member may read public content and their account status, sign out, or deactivate; protected participation is disabled. Deactivation cannot be reversed by ordinary signup with the same identity. Admin recovery is an explicit operator action.

## Browser and input boundaries

- Parameterized ORM/SQL queries only. Validate IDs, code-point text lengths, enum values, topic activity, parent/target/thread relationships, revisions, and pagination server-side. Client validation is convenience, not authority.
- Raw HTML and unsupported Markdown nodes disabled. Permit HTTP(S) links only; sanitize rendered output with a maintained library. External new-tab links use `noopener noreferrer`; user links also use `ugc nofollow`. Do not fetch user-supplied URLs or render embedded images/link previews in v1.
- HTTPS in hosted environments. Explicit CORS allowlist for production frontend and local development origins; no wildcard authenticated origins. Bearer-token API requests use `credentials: omit`; no cookie authentication on the API in v1. Revisit CSRF if cookie auth is introduced.
- Deploy CSP allowing the exact Clerk Frontend API origin, Cloudflare challenges and required Clerk fraud-protection hosts; retain self-hosted assets/fonts, frame restrictions and nosniff. Allow only the documented script hosts, without unsafe-eval or a wildcard script origin. Verify actual CSP behavior in a browser before launch.
- Sanitize log fields; do not log Authorization, tokens, provider keys, raw submission bodies, report detail, or email. Use request/submission IDs for correlation. Treat page content, Markdown, reports, and AI outputs as untrusted data, never instructions to tools or agents.

## Implemented launch rate limits

All windows are fixed UTC windows using database atomic counters; responses use 429 and Retry-After. Initial values are service constants and can be tuned after measurement. Identity-independent IP limits are abuse controls, not reputation gates. The general member-write counter commits separately so failed business actions also consume that allowance.

| Action | Limit |
| --- | --- |
| Anonymous reads | 120/minute/IP pseudonym |
| Authenticated reads/general API | 240/minute/account, with 300/minute/IP as a shared-network safety cap |
| New threads | 5/hour and 20/day/account |
| New replies | 30/hour and 100/day/account |
| Content edit submissions | 20/hour and 100/day/account |
| Vote mutations | 60/minute and 500/day/account |
| Reports | 5/hour and 20/day/account |
| Profile changes | 10/hour and 100/day/account |
| New blocks | 30/hour/account |
| Other member mutations | 120/minute/account |

Only trust forwarded client IP from the configured ingress proxy. Store a daily HMAC pseudonym, not raw IP, in expiring rate buckets; keep the HMAC secret server-side. Campus shared networks can hit IP caps, so monitor false positives and tune. Reject same-user exact duplicate normalized thread/reply create payload within 24 hours with 409 and a link to their existing result/submission; edit resubmission uses revision/idempotency rules instead. Do not globally reject two people asking a similar question.

## Rules and AI behavior

Policy targets spam/scams, credible threats, hateful attacks, targeted harassment, and exposed personal information. Profanity, disagreement, and sensitive-life questions are allowed unless they meet a prohibited category. Word lists supply category/context signals; an isolated swear word is not a sufficient hard rejection. Normalize text for spam checks without altering the author's stored Markdown. Validate URL schemes and flag configured known malicious domains; do not scan/fetch arbitrary links.

Model adapter returns a validated structured decision, safe reason code and usage. It does not treat a numeric model confidence as a calibrated safety score. Prompt includes policy and delimiters around user text, treats text as data, and grants no tools. Malformed/missing results are provider failures. Uncertain judgments publish and log; clear violations reject with a plain-language reason. Never publish solely because a provider timed out.

Public bio edits use this same durable moderation path with profile revision checks; the last approved bio/avatar remains public during review. Fixed preset avatars have no external URL. Avatar-only changes with unchanged approved bio need deterministic allowlist/revision validation, not a redundant AI call. Admin may clear a reported bio with an audit reason and cancel open profile edits.

The application sends only submitted text and essential context, not identity claims/email/private settings. Privacy copy explains that a third-party AI service processes submitted content and that generated seed accounts are labeled. Provider retention/terms are verified when selecting the actual API/model; this draft does not assert a particular privacy guarantee.

## Durable moderation and cost defaults

- Bound inline provider attempts to eight seconds; processing lease two minutes. No open database transaction across a network call.
- Retry provider failures at +5/+15/+60 minutes using a five-minute scheduled worker. After the retry budget or 24 hours unresolved, mark needs_review. Validation/state conflict cancels instead of retrying. Rate/quota response honors a later provider Retry-After. Budget exhaustion waits until the next available budget window and is shown honestly.
- Reserve estimated worst-case cost before each metered call. Global initial caps: one concurrent call, 100 calls/day, $2/month. Tokens/model limits/prices must be verified; unsupported or too-long input stays for admin review rather than being silently truncated. Metered timeouts retain their reservation. Explicit free mode permits only the researched Gemma model with zero prices; failed/missing-usage free attempts cost zero but still consume daily allowance and honor pause/concurrency/lease/retry controls.
- Global pause switch stops provider attempts, leaves submissions pending, and allows admin decisions; it does not silently disable checks and publish everything. Local fixtures are visibly labeled and forbidden in production startup checks.
- Record attempt outcomes/latency/usage and pending age. Cleanup expires private snapshots according to DATABASE.md. Worker retry/apply paths share the same permissions/revision checks as normal API paths.

Evaluate a versioned fixture set containing allowed profanity, criticism, quoted harmful language, ordinary college/life questions, spam/duplicate attacks, scams, harassment, threats, and prompt injection. Record false rejections and missed violations by category before tuning the policy. Report/admin controls remain necessary even with AI.

The implemented [limited evaluation pack](MODERATION_EVALUATION.md) covers five benign examples and three synthetic spam patterns. The isolated live Gemma run allowed those five benign examples; rules rejected the spam. Other policy categories and broader model quality remain unmeasured. Its opt-in live runner refuses non-test databases and uses the normal reservation, cap, pause and publication services. The user explicitly approved local Google content transfer and local activation is verified. Real public advice still needs review against Google's data terms.

## Blocking, administration, and retention

Blocks filter the blocker's signed-in reads and prevent direct interaction in either direction, but public pages remain public. Remove hidden text/author metadata from JSON projections, not just CSS. Existing votes remain counted; prior conversations retain placeholders. Report IDs/details and blocked lists are private. Block checks and mutations use consistent ordered locks to avoid concurrent bypass.

Admin remove/restore/suspend/approve/reject actions require a reason and immutable audit metadata. Reports alone never auto-remove content. Author deletion purges their text and related snapshots, retaining structure. Moderator removal preserves a seven-day restore window. Local account deactivation is clearly distinguished from full identity/data erasure; operator procedures and backup retention are documented before public launch.

Report/audit detail is redacted after ninety days; report, admin-action and AI-attempt rows expire after 365 days. Minimal identity, idempotency, ancestry and erasure metadata remains without a fixed expiry for safe replay/restoration. Browser drafts expire after 24 hours; sign-out/account changes/deactivation clear Rivock drafts and private query caches.

Use separate database migration and runtime roles, TLS with verified database certificates, and least-privilege access. Keep backups out of public containers/repositories. Restore drills must reapply deletion/retention markers before restoring public access. CI uses synthetic data and isolated keys, never production database dumps.

## Required checks

Wrong instance/issuer/audience/algorithm/timestamps/authorized origin; missing session/user IDs; pending/machine/impersonation token; nonexistent profile; suspended/deactivated user; forged author/role; non-owner mutation; self-vote; block races; cross-thread/cyclic nesting; accepted-answer constraints; unsafe links/HTML; private serializer leaks; idempotency conflicts; delayed worker publish after delete; provider malformed result/outage/budget cap; redacted logs; production fixture-adapter refusal.
