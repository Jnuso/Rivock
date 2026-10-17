# Erasure journal replay validation

This operator-only follow-up is locally verified in [draft PR #1](https://github.com/Jnuso/Rivock/pull/1) and awaiting its separate merge/release. The live preview remains source 7bc80ad. It does not perform or authorize a managed restore.

The export-erasure format remains a bare JSON array. Each entry must contain exactly four string fields: id (event UUID), target_type, target_id (target UUID), and action. UUIDs are normalized before duplicate detection and replay. An empty array is a valid empty export; it does not prove that a journal is complete.

| Target type | Supported action | Existing replay effect |
| --- | --- | --- |
| thread | delete | Erase the author's thread text/snapshots and acceptance; preserve other authors' replies. |
| reply | delete | Erase that reply's text/snapshots and acceptance; preserve descendants/structure. |
| user | clear_bio | Clear bio/profile snapshots and cancel open profile edits. |
| user | deactivate | Also deactivate the account, clear avatar/private saves/blocks/notifications and cancel open submissions. |

The command reads and validates the whole file before opening a database Session. Non-array/scalar/malformed input, unknown/missing/extra fields, invalid UUIDs, unsupported target/action combinations, duplicate JSON fields and duplicate event IDs are rejected. Even identical duplicate IDs are rejected to avoid ambiguous replay counts. Unreadable or invalid UTF-8 files also exit before a Session is opened. Errors do not echo paths or journal contents, and invalid input never prints the success message.

Keep a rejected restoration isolated. Recover a trusted complete export and review its contract; do not drop unfamiliar records merely to make validation pass. A valid-looking journal still needs independent protection, completeness/integrity checks and an explicitly verified isolated destination. The export CLI still writes ordinary JSON and does not implement encrypted off-provider storage. Repeated replay retains the existing revision/event behavior; no exactly-once guarantee is introduced.

The original reproducer now rejects the unsupported journal without opening a Session. All 259 backend tests passed in a disposable Docker test container against the isolated PostgreSQL 17 test database; this includes 46 new parser/CLI unit cases and eight real-database integration cases. Tests cover actual export/replay compatibility, thread/reply erasure with other-author replies and their snapshots preserved, accepted-answer clearing, the distinct clear_bio/deactivate effects, and rejection of a bad later marker without changing an earlier valid target. Ruff and git diff --check passed. No frontend or schema change was needed.

This recovery fix is available in [draft PR #1](https://github.com/Jnuso/Rivock/pull/1) on branch fix/validate-erasure-journal (implementation commit 4540716), not part of the running Azure source 7bc80ad/revision 0000004. No cloud journal was exported or replayed and no managed restore, resource, schedule, network, secret or AI setting changed. Two bounded coding-worker jobs returned no changes or completed review; their baseline lacked the required isolated test database. All passing test evidence above was produced directly in the project environment. Input validation does not establish journal authenticity/completeness, encrypted storage, destination identity, exactly-once replay or managed recovery.
