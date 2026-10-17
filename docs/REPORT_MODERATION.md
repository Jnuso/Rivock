# Publication and report-based moderation

Confirmed October 16, 2026. This supersedes the earlier Gemma pre-publication gate.

## Current policy

Posts, replies and profile edits publish immediately in explicit `MODERATION_MODE=off`, after authentication, account/target/ownership/revision checks, validation, duplicate and rate limits. No Gemma or content-rule review runs and no fake approval is recorded. Private submission metadata identifies publication without automated review. Earlier rejected/cancelled/manual-review items are not automatically republished.

People can report published content. Reports stay private, do not automatically hide a contribution, and remain available to admins for inspection and audited removal/restoration/account actions. Reports do not invoke AI. Existing normal pending work may be released through the same validated publication service after the off-mode rollout.

## Future direction, not implemented

The user wants AI assistance combined with reports to assess harmful posts/comments after publication, without delaying the initial contribution. Before building that workflow, decide:

- Which reports or other signals trigger review, with protection against duplicate or coordinated false reports.
- How much thread/reply context the model receives, provider privacy terms, retention and notice.
- Whether AI recommends an action or can take one; human override, appeal and author notification behavior.
- Queue/rate/cost limits, repeated-review deduplication and pause controls.

Report counts alone do not establish harmfulness. Do not restore the old initial-publication gate or send content to a provider as an incidental fallback. Google coding-worker authorization is separate from application moderation; in this chat those workers are capped at two Google requests per minute.
