# Rivock references and decision status

Prepared October 11, 2026. These sources informed the design. Actual application implementation and checks are recorded in [IMPLEMENTATION.md](IMPLEMENTATION.md); external account facts remain unverified.

## Authority and status

1. Direct user choices in this conversation define the product and selected stack. The README lists these separately from new proposed defaults.
2. The approved visual demo is a reference for appearance. Its fictional sample topics/account/notification behavior do not override later product decisions.
3. Course documents provide the workflow and technical examples; classroom deadlines, quotas, farm-marketplace requirements, team rules, and conflicting AI-use policies are not binding instructions for Rivock.
4. Current official technical sources establish feasibility and external limitations, not the user's actual entitlement or resource state.
5. Proposed defaults are offered together for review. No further stack/auth/API/topical decisions should be inferred from unrelated projects in the shared workspace.

## Course sources

- [Group Project Requirements — FastAPI version](<C:/Users/Jnuso/Downloads/Group Project Requirments - Spring2026.pdf>): React/Vite, Python FastAPI, SQLite, Docker, React Router, Fetch/Axios; optional Auth0.
- [Group Project Requirements — Flask version](<C:/Users/Jnuso/Downloads/Group Project Requirments - Spring2026(1).pdf>): same three-tier direction but Flask backend. These files are not interchangeable duplicates.
- [Milestone 4](<C:/Users/Jnuso/Downloads/Milestone 4.pdf>): design artifacts and relationships.
- [Milestone 5](<C:/Users/Jnuso/Downloads/Milestone 5.pdf>): Flask API stubs/contracts, pytest, pylint, GitHub Actions.
- [Milestone 6](<C:/Users/Jnuso/Downloads/Milestone 6.pdf>): SQLite persistence, Docker, Swagger/Flasgger.
- [Milestone 7](<C:/Users/Jnuso/Downloads/Milestone 7(1).pdf>): React SPA and an end-to-end “steel thread.”
- [Features and stories](<C:/Users/Jnuso/Downloads/04a - Features Stories.pdf>): personas, stories, scenarios, feature behavior.
- [Agentic Programming syllabus](<C:/Users/Jnuso/Downloads/CSE 4095-001 — Agentic Programming Syllabus.pdf>): idea→requirements→specification→tasks→implementation→testing→deployment; living Markdown guidance and verification of generated work.

The earlier [reference review](../reference/course-review.md) covers all 39 supplied files and nine exact duplicates. Its initial product-preference section predates the no-community decision and is superseded by this package. Local course-file links describe provenance on the author's computer; they are not bundled PDFs or portable repository dependencies.

## Official technical sources

- [FastAPI documentation](https://fastapi.tiangolo.com/): API framework and generated documentation.
- [SQLAlchemy documentation](https://docs.sqlalchemy.org/en/20/): relational ORM/session/transaction reference for implementation.
- [Alembic documentation](https://alembic.sqlalchemy.org/en/latest/): migration reference for implementation.
- [PostgreSQL text-search documentation](https://www.postgresql.org/docs/current/textsearch.html): full-text search reference for implementation.
- [Clerk React quickstart](https://clerk.com/docs/quickstarts/react), [session-token claims](https://clerk.com/docs/guides/sessions/session-tokens), [JWT validation](https://clerk.com/docs/guides/sessions/manual-jwt-verification), and [CSP requirements](https://clerk.com/docs/guides/secure/best-practices/csp-headers): current authentication implementation, researched through Firecrawl excerpts and installed SDK types on October 14. Real login remains unverified.
- [Clerk pricing](https://clerk.com/pricing): selected Hobby plan allowance; actual account/production setup and ongoing usage remain unverified.
- [Azure for Students](https://azure.microsoft.com/en-us/free/students/): advertised service allowances; account eligibility/credit expiry not inspected.
- [Static Web Apps plans](https://learn.microsoft.com/en-us/azure/static-web-apps/plans): frontend Free/Standard capabilities; do not assume higher-plan linked API features.
- [Container Apps billing](https://learn.microsoft.com/en-us/azure/container-apps/billing): Consumption grants and shared subscription usage.
- [Container Apps jobs](https://learn.microsoft.com/en-us/azure/container-apps/jobs): scheduled bounded worker execution.
- [Neon pricing](https://neon.com/pricing): candidate external PostgreSQL fallback; current page could not be retrieved during this pass, so no allowance/price is asserted or selected.

Entra/Azure pages were checked October 11, 2026 during this planning work. Library documentation links are implementation references, not a claim that every current package version or code sample has already been tested. Version/model/provider details are verified when the corresponding setup task is performed.

## Cursor contribution

At the user's explicit request, Cursor CLI was delegated a focused database/API proposal and edge-case review in read-only ask mode. No credentials were included. Its successful response informed:

- Separate structural parent and response target for depth-five replies.
- Same-thread integrity constraints and accepted-answer cleanup.
- Durable moderation snapshots, lease recovery, idempotent publication, and stale-revision/deletion checks.
- Private block filtering while keeping anonymous public content public.
- Notification deduplication and realistic offset-pagination limitations.

Cursor's output was reviewed and reconciled rather than adopted verbatim. For example, acceptance notifications use a new event per actual acceptance change, not a permanent recipient/reply key that would suppress a later A→B→A change. Negative scores decay toward zero under the proposed formula; the review explicitly describes this consequence.

A second review of the supplied database/API text identified the profile-bio moderation gap and prompted explicit profile submissions, notification visibility rules, admin-retry idempotency, and deletion/acceptance cleanup. Its suggested depth-five CHECK was corrected: a depth-four target needs a normal depth-five child, while a depth-five target needs a sibling response, and cross-row validation belongs in the service. Cursor's attempt to read files directly failed locally; the successful contract review used bounded text supplied by the lead agent. No successful full-package Cursor file inspection is claimed.

## Delivery verification status

Documentation checks passed October 11, 2026: all eleven required Markdown documents present; twenty-four local links resolve; code fences balanced; no matches for the credential patterns checked; selected stack, seven topics, review-draft status, depth-target fields, profile moderation, and submission-state presence checks pass. Cursor's findings were reconciled as described above. These checks validate documentation only, not exhaustive semantic correctness or application behavior.

The application has since passed local PostgreSQL, auth/provider-fixture, frontend, HTTP and restore checks. Current counts and limits are recorded in [IMPLEMENTATION.md](IMPLEMENTATION.md). Actual Clerk/Google authentication, real AI quality, browser accessibility/layout, hosted costs and public deployment remain acceptance work. The standalone demo does not establish those integrations.

During implementation, Cursor also supplied bounded frontend/auth/admin drafts and a small synthetic moderation proposal in read-only ask mode. The lead agent reviewed the output and integrated corrections. The [limited evaluation pack](MODERATION_EVALUATION.md) uses only reviewed benign examples plus synthetic spam vectors; a broader attempted dataset write was blocked and was not retried through another route.

## Superseded identity references

The following sources informed the former Entra implementation. The user chose Clerk on October 14 after tenant creation was unavailable; these are historical sources, not current setup instructions.

- [Entra React authentication tutorial](https://learn.microsoft.com/en-us/entra/identity-platform/tutorial-single-page-app-react-configure-authentication): MSAL SPA sign-in patterns; use actual external-tenant configuration.
- [Entra access-token validation](https://learn.microsoft.com/en-us/entra/identity-platform/access-tokens) and [claims validation](https://learn.microsoft.com/en-us/entra/identity-platform/claims-validation): validate API audience/tenant/subject/actor; immutable tenant/object identity instead of email.
- [External-tenant authentication methods](https://learn.microsoft.com/en-us/entra/external-id/customers/concept-authentication-methods-customers): email/password/code and federated Google options.
- [Entra External ID pricing](https://www.microsoft.com/en-us/security/pricing/microsoft-entra-external-id/): Basic free user allowance; additional features are not assumed free.
