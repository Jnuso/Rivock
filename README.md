# Rivock

A public advice and discussion app for college life: shared threads, useful answers, and content votes without user karma or community participation gates.

Built with **React + TypeScript + Vite, FastAPI, PostgreSQL 17, SQLAlchemy/Alembic, and Clerk**. The approved visual demo is kept at [reference/design-demo.html](reference/design-demo.html). Product choices and acceptance criteria are in [docs/README.md](docs/README.md).

**[Open the Azure test preview](https://rivock-api.wittymushroom-48e2dfec.canadacentral.azurecontainerapps.io/)** — five original fictional conversations, Clerk development sign-in and a separate cloud database. Please use fictional content. HTTP/database checks pass; the owner confirmed hosted Google sign-in, onboarding and vote/save persistence. Broader browser/account checks remain pending. Cloud AI moderation is not enabled, so new submissions may remain pending. [Deployment evidence and remaining security work](docs/PREVIEW_DEPLOYMENT.md).

## What works in the implementation

- Public feed, seven topics, PostgreSQL full-text search, Trending/Latest and ranked answers.
- Threads, depth-five replies, accepted answers, content votes, private saves and public profiles.
- Owner edits/deletes, placeholders, private pending/rejected submissions and revision controls.
- Notifications, blocking, reports, admin review/removal/restoration/suspension, topic management and audit history.
- Durable moderation with deterministic local fixtures, a bounded Google AI adapter, retries/leases, cost reservations and persistent pause control.
- Generated OpenAPI TypeScript contracts, PostgreSQL integration tests, frontend component tests, Docker Compose, GitHub Actions and Azure Bicep templates.

**Local Google sign-in and the core two-account journey passed the user's browser checks.** Gemma 4 passed a limited live synthetic evaluation and was enabled locally with explicit user approval; a browser-created question was confirmed AI-approved and published. Hosted account methods, broader model quality and cloud AI activation need separate verification. Automated tests exclude the real AI key. DMs, ongoing bots, uploads and personalization remain later milestones.

Start with the [single review and setup handoff](docs/REVIEW.md). Local development uses [localhost:5173](http://localhost:5173); My submissions identifies completed AI/rules/demo/moderator checks. The Azure preview serves React and FastAPI together in one Consumption Container App with restricted database roles and verified TLS. Migration and live HTTP checks pass. The exact shared egress set was explicitly approved for preview; tightening that route is required before production. Domain/production Clerk, managed recovery and observed billing remain release work. Check local configuration presence without printing secrets:

```powershell
backend/.venv/Scripts/python.exe scripts/check-setup.py
```

For login, create a free Clerk application and run the local public-key helper after obtaining its `pk_test_...` key:

```powershell
backend/.venv/Scripts/python.exe scripts/configure-clerk.py
```

[Clerk setup](docs/CLERK_SETUP.md) explains the dashboard settings and real-account checks. No Clerk secret key is needed for this integration.

## Run locally with Docker

Requires Docker Desktop with the Linux engine running. From the repository root:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
docker compose up --build -d
docker compose exec api python -m app.cli seed
```

Open `http://localhost:5173`. API documentation: `http://localhost:8000/docs`. The seed adds five **original fictional** conversations with visibly labeled accounts. It does not scrape Reddit or simulate human activity. A fresh `.env.example` selects labeled fixture moderation, which production refuses; the current ignored local configuration uses user-approved Google/free moderation. Configure Clerk values to participate with real accounts.

```powershell
docker compose run --rm test
docker compose down
```

`down` preserves the PostgreSQL named volume. Migrations run in one explicit service before API/worker startup; no schema creation occurs inside every API replica. Compose is a local development setup, not the production deployment.

## Native development

Tested with Python 3.12.14, Node 24.19.0 and PostgreSQL 17.11. Use a PostgreSQL instance with `rivock` and isolated `rivock_test` databases.

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.lock
python -m pip install --no-deps -e .
Copy-Item .env.example .env
# Edit .env for your database and real Clerk configuration.
alembic upgrade head
python -m app.cli seed
uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log
```

In separate terminals:

```powershell
cd frontend
Copy-Item .env.example .env
npm ci
npm run dev
```

```powershell
cd backend
.\.venv\Scripts\python.exe -m app.worker
```

Without Clerk configuration, public browsing works and sign-in is visibly unavailable. Moderation defaults to `pending`; explicitly set `MODERATION_MODE=fixture` only for a labeled local demo. Google mode requires a real key/model and verified positive prices in default `AI_BILLING_MODE=metered`, or explicit `free` mode for the allowlisted Gemma model with both prices zero. The current local API/worker use the approved free Gemma model with 100 calls/day; test with fictional content. Never put keys in `VITE_*` values.

## Verify changes

```powershell
cd backend
$env:TEST_DATABASE_URL='postgresql+psycopg://rivock:rivock_local@127.0.0.1:5432/rivock_test'
ruff check --config pyproject.toml app tests tests_unit migrations ../scripts
pytest -q
pytest ../scripts/tests -q
python -m app.cli export-openapi ../frontend/openapi.json
cd ../frontend
npm run generate:api
npm run lint
npm test
npm run build
npm audit --audit-level=high
```

The test harness refuses a database name that does not end in `_test` and truncates its synthetic rows between tests. Do not point it at any valuable database. OpenAPI generation is checked for drift in CI. Windows sandbox runners may require `TEMP`/`TMP` to point at a writable scratch directory for test workers.

The limited moderation pack can be evaluated without provider calls from `backend`:

```powershell
.venv/Scripts/python.exe -m app.evaluate --output ../docs/moderation-evaluation.json
```

See [moderation evaluation](docs/MODERATION_EVALUATION.md) for coverage gaps and the guarded opt-in live runner. Offline deferral and test-provider success do not measure real moderation quality.

The local PostgreSQL restore drill uses a separate disposable target and replays erasures newer than the backup:

```powershell
$env:TEST_DATABASE_URL='<isolated-source-database-ending-_test>'
$env:RESTORE_TEST_DATABASE_URL='<different-isolated-target-ending-_test>'
backend/.venv/Scripts/python.exe scripts/restore-drill.py --pg-bin '<PostgreSQL-17-bin-directory>' --output '<private-scratch-directory>'
```

## Identity, operations and Azure

Follow [Azure setup](docs/AZURE_SETUP.md) for actual account values, concrete template resources, cost review, migration sequencing, image publication and live smoke checks. [Deployment runbook](docs/DEPLOYMENT.md) contains backup/rollback and failure procedures. Admin bootstrap is an operator command against a named local UUID:

```powershell
python -m app.cli grant-admin <local-user-uuid> --reason 'Initial operator bootstrap'
```

No email domain grants admin rights. Usernames are immutable; Clerk `(issuer, subject)` links identity. Self-deactivation is distinct from deleting contribution text or deleting the Clerk account.

## Architecture

```mermaid
flowchart LR
  Browser[React browser] -->|Public reads / session token| API[FastAPI]
  Browser -->|Hosted sign-in| Clerk[Clerk]
  API --> DB[(PostgreSQL)]
  Worker[Same codebase worker] --> DB
  API -->|Bounded text check| AI[Configured Google AI model]
  Worker -->|Durable retry| AI
```

Short writes use a PostgreSQL advisory transaction lock to keep v1 state transitions ordered; AI calls happen outside database transactions. This favors correctness at a small résumé-project scale and limits write throughput. See [implementation notes](docs/IMPLEMENTATION.md) for verification evidence and remaining launch gates.
