# Report-assisted AI: proposal for owner review

October 22, 2026. **Design draft only. Nothing here is enabled, implemented or permission to send content to a provider.** The current [moderation policy](REPORT_MODERATION.md) remains authoritative: immediate valid publication, private reports, manual audited moderation, application AI off.

## Intended user experience

An advice seeker publishes normally. Someone who sees a problem can report it. The contribution stays visible while the report enters the private admin queue. The administrator can inspect the current contribution and report; optional AI analysis helps prioritize or understand the case. The administrator makes any removal, restoration or account decision.

There is no public report score, automated user reputation, participation gate or badge suggesting an unreviewed post is safe. Reporting someone does not reduce their account standing. A model recommendation is neither proof nor an automatic moderation action.

## Recommended first version

| Choice | Proposed default | Why |
| --- | --- | --- |
| Trigger | Admin explicitly chooses Analyze on a reported item | Keeps the first experiment bounded and under operator control |
| Automatic report-triggered calls | Off initially; consider later after evaluation | Avoids making every duplicate/hostile report a provider request |
| AI authority | Private recommendation/priority only | A false report or model mistake cannot remove a contribution |
| Reports required | One valid report can enter the manual queue | No karma threshold or popularity test for getting help |
| Review unit | Target ID + content revision + policy version | Duplicate reports share the case; an edit invalidates the old analysis |
| Public behavior while unavailable | Continue normal publication and manual reporting | Provider outage, pause or budget exhaustion does not gate posting |
| Provider/model | Undecided until data terms, quality and cost are reviewed | The old Gemma setup is not automatic authorization for report text |
| Provider pace | Propose one request/minute, one in flight, small explicit daily/monthly ceilings | Conservative starting point; confirm actual shared provider quotas before enablement |
| Repeat analysis | Explicit admin request after a meaningful change, subject to the same limits | Prevents report brigading and repeated clicks from multiplying calls |
| Outcome communication | Existing audited human action with a safe reason and review/contact route | Protects reporters and avoids presenting AI output as fact |

These are proposed product choices, not current settings. The user's two-Google-requests/minute permission for coding help is separate; it does not authorize this application workflow or establish its budget.

## Queue and state rules

1. Accept a report using existing authentication, target validation and reporting limits. Keep the reporter and report private. Do not change content visibility just because a report exists.
2. Show the case to admins, grouping duplicate reports around the exact target/revision. Counts help navigation but are not a harmfulness score or a vote to remove something. Do not silently discard a first report from a new account.
3. A permitted admin requests analysis. Reserve its rate/cost allowance and obtain a bounded lease. Reject duplicate in-flight work for the same case/revision. No external call runs inside a database transaction or mutation lock.
4. Before sending, recheck target availability/revision, administrator authority, provider enablement, pause, privacy approval and allowance. Removed/deleted/unavailable content does not get sent as incidental retry work.
5. Parse a strictly validated response with a small allowed recommendation set, category and bounded explanation. Treat the explanation as untrusted text; never execute it or use it as an instruction. No model tools or arbitrary follow-up fetches.
6. Before storing an applicable result, recheck lease, target revision and current state. Mark outdated results stale; do not attach them as an assessment of newly edited content or resurrect deleted text.
7. Uncertainty, bad output, rate limits, timeouts and exhausted budget leave the manual case available with an honest status. Use bounded retries/backoff only after defining the cost treatment for interrupted/unknown calls. They never imply approval or removal.
8. An administrator acts through the existing authorized, audited moderation service after inspecting current content. AI completion alone cannot invoke removal, restore, suspension, publication or acceptance changes.

Suggested internal states for a later implementation: not requested, queued, analyzing, completed, inconclusive, unavailable, stale, paused or failed. These are design vocabulary, not new API/schema fields. Do not reuse the old pre-publication submission status as the report's content gate.

## Data sent to a provider

Prepare the smallest contextual packet that can explain the report: the reported revision, its thread title, and a bounded relevant parent/response chain. Preserve the depth-five distinction between structural parent and response target. Clearly label quoted source text and separate it from system policy.

Exclude authentication identifiers, email/IP addresses, saved items, private notifications, unrelated profile/history and reporter identity. Start without forwarding report free text; a structured report category and the actual content may be sufficient. If free text is necessary later, make that an explicit data-handling choice. A report or contribution can itself contain sensitive information, so omitting account metadata does not make arbitrary text suitable for an unpaid provider.

Never fetch links or follow instructions embedded in posts/reports/model output. Keep source text within bounded input limits; missing context should produce an inconclusive/manual result. Do not send a whole conversation or account history as an automatic fallback.

Before any real-data enablement, verify the chosen provider's then-current retention, training/human-review and regional/data terms; choose an appropriate service or keep analysis local/manual. Review the notice and retention plan with the owner. No current provider eligibility, free tier or privacy promise is established by this draft.

## Abuse, fairness and operator handling

- Multiple reports must not automatically increase punishment or trigger repeated inference. Preserve ordinary reporting limits and distinct-report bookkeeping; do not invent a user karma score.
- Disagreement, ordinary profanity, criticism and an unpopular opinion are not by themselves reasons to remove content. Evaluate quoted/reported speech in context. The actual content rules still need a written, owner-reviewed policy.
- Keep model recommendation separate from human decision and from publication history. Do not display numerical model confidence as a calibrated safety probability.
- Provide a safe reason and a route to request review after a human action. Do not expose reporter identities or raw reports to the target author. Human restoration/override must remain possible and audited.
- An account block changes interaction/read behavior according to current policy; it must not be treated as evidence that another person's content is harmful.
- Since this is a small project with little human moderation, keep the preview fictional/test-focused until there is a realistic operator response policy. A low-traffic admin queue is not continuous human coverage.

## Evaluation before any live enablement

Build a labeled **original fictional** corpus: benign advice/disagreement/profanity, harassment, threats, spam/scams, privacy violations, quotations, missing context and misleading reports. Include malicious report text trying to override policy. Do not scrape Reddit or send existing user posts as evaluation material by default.

Run offline fixtures first. Test authorization, deduplication, concurrent clicks, lease expiry, edits/deletion/removal during a request, lost/late responses, malformed output, pause/budget limits and private serializers. Verify that normal posting remains immediate in every error case and reports remain private. No provider call should be necessary to prove these state boundaries.

After separate approval of the provider/data/cost configuration, run a small fictional-only evaluation with an explicitly capped call count and pace. Record false harmful recommendations, missed harmful cases, inconclusive cases, and human override effort, with category-level examples and limits. Do not claim production moderation accuracy from a handful of examples. Public deployment and real-data use need their own reviewed configuration/notice.

## Suggested implementation sequence after review

1. Confirm the content policy, manual-response expectations, trigger/action defaults, data handling and limits with the owner.
2. Implement case grouping, revision-aware private statuses and the manual admin workflow using fake provider results. Keep provider execution disabled. Review migration/API/privacy impacts before applying them.
3. Add the strict no-tools adapter and bounded worker path with isolated tests; preserve the existing publication service and off-mode behavior.
4. Conduct the separately approved fictional evaluation and review its results.
5. Decide whether to enable manual analysis in the preview. Automatic report-triggered analysis, automatic enforcement and public-launch changes are separate later decisions.

Until those decisions are made, keep `MODERATION_MODE=off`, no application provider key and no AI schedule. This proposal creates no resource, migration, endpoint, background job, budget or external request.
