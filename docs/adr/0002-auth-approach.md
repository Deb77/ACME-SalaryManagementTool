# ADR 0002: Authentication and authorization approach

- Status: Proposed
- Date: 2026-11-18
- Details: [docs/auth.md](../auth.md)

## Context

Only ACME HR staff use the app, in two roles: Global HR (all 8 countries, manages access) and Country HR (assigned countries only). Salary data is need-to-know, and the requirements say Country HR must never see other countries, enforced on the server and covered by tests. That includes Ask AI, where SQL is written by a model.

The React app is served by the Express API from the same origin, on a single Render web service with Render Postgres. Writes need an actor for the audit log. Reviewers need easy demo sign-in for both roles, and the code should be readable in one sitting.

## Options considered

**Session mechanism**

1. **Opaque session token in an `HttpOnly` cookie, sessions in Postgres** — instant revocation, nothing secret in the browser, one table.
2. **JWT (cookie or header)** — stateless, but revocation needs a denylist (so state anyway), and claims go stale when Global HR changes someone's countries. Its benefits (no shared store, cross-service) don't apply to one same-origin server.

**Who implements it**

1. **Hosted (Clerk, Auth0)** — polished, MFA included; but HR identities live with a vendor, setup is heavier for reviewers, and we would still keep our own role and country mapping for RLS.
2. **Better Auth** — capable and Kysely-friendly, but brings its own tables, plugin system and conventions (organizations, admin plugin) that are larger than our need and harder to align with our DB roles.
3. **Passport + express-session** — Passport adds a strategy layer for a single strategy; express-session stores signed IDs and session JSON, with less control over token hashing and revocation.
4. **Hand-rolled sessions (Lucia-style)** — about 200 lines using `crypto.randomBytes`, SHA-256 and argon2id; every security property visible in the code.

**Credentials**: argon2id passwords (with invite links to set them), magic links (need email delivery on every sign-in), or SSO (needs ACME's identity provider).

**Scope enforcement**: in application code only (`where country_code in ...` in every repository), or in Postgres RLS fed by transaction-local settings.

## Decision

- Opaque, random 256-bit session tokens in a `__Host-` cookie (`HttpOnly`, `Secure`, `SameSite=Lax`); only the SHA-256 hash is stored in a `sessions` table. 2h idle, 12h absolute; rotate on sign-in; delete on sign-out, password set and deactivation.
- Hand-rolled, no auth framework.
- Email and password hashed with argon2id (OWASP parameters). Accounts exist only through Global HR invites; the same single-use, 72h link resets a password. No email delivery in v1: the link is shown to Global HR once.
- CSRF: `SameSite=Lax` plus an `Origin` check on all unsafe methods. No tokens.
- Sign-in: per-IP rate limit, temporary per-account lock after 5 failures, identical response for every failure, dummy hash for unknown emails.
- Authorization in two layers: `requireAuth` / `requireRole` middleware for route access, and **Postgres RLS** for country scope. Every request's queries run in a transaction that sets `app.user_id`, `app.user_role` and `app.countries` with `set_config(..., true)`. Missing settings mean no rows.
- Three DB roles: `acme_owner` (migrations, owns tables), `acme_app` (server; not owner, `NOBYPASSRLS`, no DDL or deletes on history), `acme_ai_reader` (Ask AI; separate login, read-only, salary tables only). Because any role can call `set_config`, the AI role reads its scope from a table it cannot write, keyed by its connection's backend PID.
- Demo users are created by the seed script only when explicitly enabled, with the password from an environment variable.

## Consequences

- Positive: revocation and role or country changes take effect on the next request. A missed filter in code, or a prompt-injected AI query, cannot cross countries, and tests can prove this directly against the database. All auth code is small and reviewable; no third-party identity vendor.
- Negative: we own the security of the auth code, so it needs focused tests (listed in auth.md). One extra DB read per request for the session (indexed, cheap at this scale). Running migrations and the server as different roles needs three connection strings and a roles setup step, which depends on Render Postgres allowing role creation. The PID-keyed AI scope relies on direct connections (no transaction-mode PgBouncer).
- Follow-ups: MFA (TOTP) first; SSO with ACME's identity provider would replace only the password step; an email provider for invites; a shared rate-limit store if the API ever runs on more than one instance.
