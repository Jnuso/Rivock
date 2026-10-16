# Community app reference review

Reviewed October 9, 2026. These notes adapt the supplied course materials to the user's proposed community discussion app. They are planning notes, not an approved specification or instructions to an AI coding agent.

## User intent and established preferences

- Work through the full development process, starting with product discovery and documentation.
- Explore a Reddit-style app with communities and threads.
- The user dislikes Reddit karma. The reason and intended replacement remain undecided.
- Prefer Azure and the existing Azure student subscription; consider alternatives where they offer a meaningful advantage.
- Define the app and its differences from Reddit before choosing a name.
- Choose a name before the user creates the new Git repository.
- Prepare development guidance Markdown after establishing requirements, stories, and features.

The attached documents are reference material. Their classroom instructions, deadlines, organizational requirements, permissions, AI policies, and domain-specific features do not automatically apply to this project.

## Adapted workflow

| Stage | What we will work out | Course reference |
| --- | --- | --- |
| Product discovery | Audience, user problem, reason to use the app, community culture, and meaning of removing karma | [Personas and features](</C:/Users/Jnuso/Downloads/04a - Features Stories.pdf>) |
| Requirements | Draft personas, scenarios, stories, functional requirements, and measurable quality requirements | [Milestone 2](</C:/Users/Jnuso/Downloads/Milestone 2.pdf>) |
| Features and scope | Define each feature's input, activation, action, and output; connect features to stories; separate the first release from later work | [Personas and features](</C:/Users/Jnuso/Downloads/04a - Features Stories.pdf>) |
| Name and repository | Choose a name after the product direction is clear; the user creates the new repository | User's requested sequence |
| Screens and flows | Sketch and prototype the screens needed for the agreed features | [Milestone 3](</C:/Users/Jnuso/Downloads/Milestone 3.pdf>) |
| System design | Map roles and permissions, major interaction flows, data entities and relationships, and API behavior | [Milestone 4](</C:/Users/Jnuso/Downloads/Milestone 4.pdf>) |
| Development Markdown | Consolidate the specification, tasks, database, API, interface, security, deployment, and development guidance | [Agentic programming syllabus](</C:/Users/Jnuso/Downloads/CSE 4095-001 — Agentic Programming Syllabus.pdf>) |
| API and verification | Define request and response contracts; build small slices with automated checks | [Milestone 5](</C:/Users/Jnuso/Downloads/Milestone 5.pdf>) |
| Persistence and packaging | Implement persistent storage, boundary checks, and a reproducible development setup | [Milestone 6](</C:/Users/Jnuso/Downloads/Milestone 6.pdf>) |
| Complete user journeys | Connect screens, API, and database; verify an entire user action end to end | [Milestone 7](</C:/Users/Jnuso/Downloads/Milestone 7(1).pdf>) |
| Deployment and iteration | Deploy, test the hosted application, collect feedback, and update the documents as decisions change | [Agentic programming syllabus](</C:/Users/Jnuso/Downloads/CSE 4095-001 — Agentic Programming Syllabus.pdf>) |

This is an adaptation rather than a strict waterfall. We can revise designs and documents when a prototype or working feature reveals a problem. Development guidance should be ready before implementation and evolve with the app. There is no requirement to finish every API before building an initial complete user journey.

## How to use the materials

The milestone series and personas/features lecture provide the strongest planning structure. The syllabus adds specification-driven development, incremental implementation, verification, deployment, and living documentation for both people and coding agents.

Git labs and homework support version control, reviews, automated testing, and quality checks. They do not require us to repeat the calculator assignments or use the university's GitHub organization. Docker, API, frontend, authentication, security, and reliability lectures are supporting references for later design and implementation. Design patterns and microservices are options to assess when a concrete need arises, rather than a requirement to build a distributed system.

The farm marketplace requirements and essential-features checklist illustrate how features connect to roles, data, validation, and state transitions. Farm profiles, inventory, orders, pickup, and verified purchase reviews are outside this app's current concept. The team evaluation form and previous homework submission documents add little to product discovery.

## Duplicates and differing versions

All 39 listed files were accessible and extracted without file-level failures. There are 9 byte-identical duplicate files, leaving 30 distinct files. Some lecture slides contain diagrams or embedded images with little extractable text; a key feature-template slide was also visually inspected. This review concerns the planning workflow, not validation of every technical claim or code example in the lectures.

| Exact duplicate | Matching file |
| --- | --- |
| Milestone 3.pdf | Milestone 3 (1).pdf |
| Milestone 5(1).pdf | Milestone 5.pdf |
| Lab03 - Git part 3.pdf | Lab03 - Git part 3 (1).pdf |
| HW02 - GitHub Actions.pdf | HW02 - GitHub Actions (1).pdf |
| HW01 - GIT(1) (2).pdf | HW01 - GIT.pdf |
| HW01 - GIT(1) (1).pdf | HW01 - GIT.pdf |
| HW01 - GIT(1).pdf | HW01 - GIT.pdf |
| 09b - Design Patterns.pdf | 09b - Design Patterns (1).pdf |
| Milestone 2 (1).pdf | Milestone 2.pdf |

The two [project requirements](</C:/Users/Jnuso/Downloads/Group Project Requirments - Spring2026.pdf>) [versions](</C:/Users/Jnuso/Downloads/Group Project Requirments - Spring2026(1).pdf>) differ in the prescribed backend: the filename with `(1)` says Flask, while the other says FastAPI. They should not be silently treated as identical.

The two Microservices 06b PDFs are different versions: the `(1)` version contains 27 pages, including additional preparation for turning screens and actions into API endpoints; the other contains 21 pages. Other course handouts also mix Spring 2025 and Spring 2026 labels. Dates and numerical artifact quotas are classroom details, not this project's schedule or scope.

Older milestone handouts restrict AI generation of new features, while the Fall 2026 agentic syllabus encourages generating and verifying code. These describe their respective courses. The current user request establishes how these references are being used here.

## Proposed development documents

The syllabus suggests PROJECT_PROPOSAL.md, SPECIFICATION.md, TODO.md, DATABASE.md, API.md, UI_GUIDELINES.md, SECURITY.md, DEPLOYMENT.md, and README.md. We can also add an AGENTS.md for project-specific development rules and a decision log. The exact set is still a proposal; avoid creating repetitive files without distinct purposes.

Product decisions should be traceable from a user need to a requirement, story, feature, and verification criterion. Unknowns should remain explicit rather than being filled in by the coding agent. Using AI to develop the app does not imply adding AI features to the app itself.

## Azure position

Azure is the user's preferred starting point. Microsoft currently describes Azure for Students as providing USD 100 in credits valid for one year, renewable while eligible, plus select free services. Credits and free-service allowances must be distinguished when we choose hosting.

Azure Static Web Apps has a Free plan intended for personal projects and a Standard plan for production apps. This makes it a candidate to assess later, not a selected architecture. We have not inspected the user's subscription, remaining credits, service availability, or deployment settings.

Sources checked October 9, 2026: [Azure for Students](https://learn.microsoft.com/en-us/azure/education-hub/about-azure-for-students) and [Static Web Apps plans](https://learn.microsoft.com/en-us/azure/static-web-apps/plans).

We will compare Azure services and relevant alternatives after determining audience, public versus private access, media needs, authentication, expected usage, and the ongoing budget. No cloud resources have been created.

## First discovery questions

1. Who should the first users be, and what topics or communities would bring them together?
2. What specifically is frustrating about karma: cumulative user scores, posting restrictions, vote-driven visibility, downvotes, or behavior encouraged by point collection? Should content-level reactions remain?
3. Describe a specific occasion when someone would choose this app over Reddit. What should feel or work differently?

Later questions will address who can create communities, public/private membership, identity, post formats, replies, discovery, moderation, notifications, initial launch size, and whether this is primarily a learning project or a product intended for ongoing use.
