# ACME-SalaryManagementTool

## Design

The UI's visual direction was inspired by the [Agentic Dashboard](https://dribbble.com/shots/27449642-Agentic-Dashboard) shot on Dribbble. The screens for this app (Employees, Employee detail, salary change, Add employee, Insights, Ask AI, Access & roles, Import from Excel) were designed separately for ACME's HR workflows, borrowing that shot's overall look: neutral grey frame, white rounded panels, pill buttons and a single accent colour.

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
- **Tests**: `apps/api/src/db/db.test.ts` (migrations and seed) and `apps/api/src/api.test.ts` (every endpoint over HTTP, with row-level security on) run against a real Postgres when `TEST_DATABASE_URL` points at an empty throwaway database (they drop the schema), and are skipped otherwise. CI runs them against a Postgres service container.
- **Security in the database**: migration `0005_rls_and_grants` creates the `acme_app` role, its grants and the row-level security policies. The API connects with `DATABASE_URL` and switches every connection to `acme_app`, so the policies always apply to it (decision #32).

## Running locally

1. Postgres 16+ and the database steps above (`db:migrate`, then `db:seed` with `SEED_DEMO_USERS=true` and a `DEMO_PASSWORD` of your choice).
2. In `.env`, set `DATABASE_URL` (the API's connection; locally the same as `DATABASE_URL_MIGRATOR` is fine, because the API switches to the `acme_app` role).
3. Start the API (port 3000) and the web app (port 5173, which proxies `/api`):

   ```bash
   npm run dev
   ```

4. Open http://localhost:5173 and sign in as `global.hr@demo.acme.test`, `india.hr@demo.acme.test` or `uk-us.hr@demo.acme.test` with your `DEMO_PASSWORD`.

## Backend structure

`apps/api/src` is layered routes → services → repositories, wired by a small inversion-of-control container (decision #31):

- `container.ts`: the composition root. It registers every dependency by name (config, clock, pool, services); classes receive collaborators through their constructors. Tests override single entries, e.g. a fixed clock.
- `auth/`: sessions (SHA-256 token hashes in `sessions`), argon2id sign-in with lockout, invites, the session middleware.
- `db/scope.ts`: `ScopedDb.run(actor, fn)` opens one transaction per request and sets `app.user_id` / `app.countries` / `app.all_countries`, which the RLS policies read.
- `modules/*`: one folder per area (employees, salary, insights, imports, audit, access, meta). Routes only parse with the shared Zod schemas, call one service method and send; services throw typed errors that one middleware turns into the `{ error: { code, message, details } }` envelope.
