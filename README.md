# ACME-SalaryManagementTool

## Design

The UI's visual direction was inspired by the [Agentic Dashboard](https://dribbble.com/shots/27449642-Agentic-Dashboard) shot on Dribbble. The screens for this app (Employees, Employee detail, salary change, Add employee, Insights, Ask AI, Access & roles, Import from Excel) were designed separately for ACME's HR workflows, borrowing that shot's overall look: neutral grey frame, white rounded panels, pill buttons and a single accent colour.

### Design documents

The designs and plans live on claude.ai. The links open only for people the owner has shared them with; the written versions are in [docs/](docs/).

| Document | What it covers | In the repo |
|---|---|---|
| [UI Design](https://claude.ai/artifact/QzyAt4YWZdkEfquH1jWT7y) | Every screen on desktop and phone, plus a component library artboard | [docs/ui.md](docs/ui.md) |
| [Requirements](https://claude.ai/artifact/KZHfskEayTD5jTwuRAgi9r) | Who uses the tool and what it must do | [docs/requirements.md](docs/requirements.md) |
| [Auth Design](https://claude.ai/artifact/7TkVuqNHNnfTVfRpsomgtc) | Sign-in, sessions, roles and country scope | [docs/auth.md](docs/auth.md) |
| [Database Design](https://claude.ai/artifact/B2kPMpoBH9EuFDpKQgwHtW) | Tables, constraints and row-level security | [docs/database.md](docs/database.md) |
| [Salary Database](https://claude.ai/artifact/1J9AyCP5DMfDHLQHXXqwEQ) | Schema diagram | [docs/database.md](docs/database.md) |
| [API and Database Plan](https://claude.ai/artifact/U4tbeYzu3z89NWFk3hinPP) | Endpoints and how they map to the database | [docs/api.md](docs/api.md) |
| [API and Database Build Plan](https://claude.ai/artifact/AXEkC7C1qnEwNnhGJu2mhC) | The order the backend was built in | |
| [Import Queue and Caching Plan](https://claude.ai/artifact/GqseU3MHP9S2aHUrpaWkSw) | Excel import jobs and caching | [docs/api.md](docs/api.md) |
| [Ask AI Text-to-SQL Plan](https://claude.ai/artifact/PKQHWJPFmfT49HYUWBykXA) | How Ask AI writes, checks and runs SQL | [docs/api.md](docs/api.md#ask-ai) |

## Database

Postgres 16+ (Render Postgres in production), with [Drizzle ORM](https://orm.drizzle.team). The design is in [docs/database.md](docs/database.md) and [docs/auth.md](docs/auth.md).

- **Schema**: TypeScript in `apps/api/src/db/schema`. **Migrations**: SQL in `apps/api/drizzle`, applied in order and recorded in the `drizzle` schema.
- **Set up**: copy `.env.example` to `.env` at the repo root and set `DATABASE_URL_MIGRATOR` to the database's owner connection string (on Render, the External Database URL, after adding your IP to the database's allowlist). Then:

  ```bash
  npm run db:migrate
  npm run db:seed
  ```

- **Seed**: 10,000 synthetic employees in 8 countries with about 24,000 salary history entries, generated from a fixed seed, so every run produces the same people. It refuses to run on a database that already has employees; `npm run db:seed -- --reset` replaces them. Options: `--employees 500`, `--seed 42`, `--as-of 2026-11-01`. With `SEED_DEMO_USERS=true` and `DEMO_PASSWORD` set it also creates the demo sign-ins from docs/auth.md.
- **Changing the schema**: edit the TypeScript schema, run `npm run db:generate` to write the next migration, review the SQL, then `npm run db:migrate`. For data, functions, extensions or anything Drizzle can't express (an `INCLUDE` index), run `npm run db:generate -- --custom --name=what_it_does` and write the SQL by hand.
- **Tests**: `apps/api/src/db/db.test.ts` (migrations and seed), `apps/api/src/api.test.ts` (every endpoint over HTTP, with row-level security on), `apps/api/src/modules/ai/ai.test.ts` (Ask AI with a scripted model and the real reader role) and the eval suite run against a real Postgres. `npm test` starts a throwaway one itself (`embedded-postgres`, see `apps/api/src/test/global-setup.ts`), so nothing is skipped and no setup is needed; set `TEST_DATABASE_URL` to an empty database to use your own instead (the suites drop its schema). CI uses a Postgres service container.
- **Browser smoke test**: `npm run test:e2e` (Playwright, `e2e/`) builds the web app, starts it on a throwaway seeded Postgres (`apps/api/src/test/e2e-server.ts`) and signs in as Global HR to find someone, record a raise and see it in their salary history. Run `npx playwright install chromium` once first.
- **Security in the database**: migration `0005_rls_and_grants` creates the `acme_app` role, its grants and the row-level security policies. The API connects with `DATABASE_URL` and switches every connection to `acme_app`, so the policies always apply to it (decision #32).

## Running locally

1. Postgres 16+ and the database steps above (`db:migrate`, then `db:seed` with `SEED_DEMO_USERS=true` and a `DEMO_PASSWORD` of your choice).
2. In `.env`, set `DATABASE_URL` (the API's connection; locally the same as `DATABASE_URL_MIGRATOR` is fine, because the API switches to the `acme_app` role).
3. Start the API (port 3000) and the web app (port 5173, which proxies `/api`):

   ```bash
   npm run dev
   ```

4. Open http://localhost:5173 and sign in as `global.hr@demo.acme.test`, `india.hr@demo.acme.test` or `uk-us.hr@demo.acme.test` with your `DEMO_PASSWORD`.

## Ask AI

Ask AI answers questions with SQL that Claude writes and the API checks and runs as a separate, read-only database login (decisions #36–#43, [docs/api.md](docs/api.md#ask-ai)). It is optional: without `ANTHROPIC_API_KEY` and `DATABASE_URL_AI` it returns `503 ai_unavailable` and everything else works.

1. **Migrate** (creates the `acme_ai_reader` role as `NOLOGIN`, its grants, policies and the AI tables): `npm run db:migrate`.
2. **Turn on the reader login** with a password of at least 16 characters, as the migrator:

   ```bash
   # Locally
   DATABASE_URL_MIGRATOR=postgres://… ACME_AI_READER_PASSWORD='…' npm run db:roles
   ```

   On Render, run the same command from your laptop with `DATABASE_URL_MIGRATOR` set to the **External** Database URL (your IP on the allowlist). Run it again to rotate the password.
3. **Point the API at it**: `DATABASE_URL_AI=postgres://acme_ai_reader:<password>@<host>:<port>/<db>`. On Render use the **Internal** Database URL's host, port and database with the `acme_ai_reader` user, and set `ANTHROPIC_API_KEY` as a secret. Optionally `AI_MODEL_PRIMARY`, `AI_MODEL_FALLBACK` and the `AI_*` budgets in `.env.example`.
4. **Memory**: the API runs with `node --liftoff-only` (the `start` and `dev` scripts). Without it, V8's optimising compiler for the WebAssembly SQL parser (`libpg-query`) takes about 600 MB the first time Ask AI checks a query, which got the 512 MB Render instance killed mid-answer. With it a turn peaks around 260 MB, and the check is no slower.
5. **Watch it**: every SQL attempt is in `GET /api/ai/sql-runs`; counters and alerts at `GET /api/ai/metrics`; `GET /api/health` shows `ai.configured` and `ai.database`. Set `METRICS_TOKEN` to expose Prometheus text at `/metrics`.

### Evals

`apps/api/src/evals` holds 27 questions (including prompt injection, requests for names and emails, writes and multi-statement SQL) whose expected answers are computed from the deterministic seed.

- **CI-safe suite** (no key): runs with the other tests in `npm test`. A scripted model must pass every case and a careless one must fail every case.
- **Real model**: `ANTHROPIC_API_KEY=… EVAL_DATABASE_URL=postgres://…/acme_eval npm run evals` resets and seeds that database, prints a table, writes a JSON report to `apps/api/eval-results/` (gitignored) and exits non-zero when fewer than `EVAL_PASS_THRESHOLD` (default 0.8) of the cases pass. `EVAL_CASES=id1,id2` runs a subset. It costs real tokens (roughly 27 short conversations).
- **When to run it**: before changing the system prompt, the tools, the SQL guard or the models (`AI_MODEL_*`), and nightly in CI with the key stored as a secret, so model updates that change behaviour show up.

## Backend structure

`apps/api/src` is layered routes → services → repositories, wired in one place (decision #31):

- `services.ts`: the composition root. `buildServices(config)` creates the pool, repositories and services with plain constructor calls; classes receive collaborators through their constructors. Tests pass overrides for the clock, logger or model.
- `auth/`: sessions (SHA-256 token hashes in `sessions`), argon2id sign-in with lockout, invites, the session middleware.
- `db/scope.ts`: `ScopedDb.run(actor, fn)` opens one transaction per request and sets `app.user_id` / `app.countries` / `app.all_countries`, which the RLS policies read.
- `modules/*`: one folder per area (employees, salary, insights, imports, audit, access, meta). Routes only parse with the shared Zod schemas, call one service method and send; services throw typed errors that one middleware turns into the `{ error: { code, message, details } }` envelope.
