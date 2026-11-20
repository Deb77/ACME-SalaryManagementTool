# ADR 0001: REST over JSON with shared Zod contracts, commands for domain events

Status: accepted · 2026-11-18

## Context

- One TypeScript monorepo, with an Express 5 API and a React app deployed together and served from the same origin.
- Some of the data is plain records (employee details). Some of it is business events that must never be lost or rewritten: salary changes with a date, reason and previous amount; terminations; imports.
- Some endpoints are not plain JSON: CSV export (a file download), Excel/CSV import (a multipart upload) and Ask AI (a streamed answer).
- Reviewers and future maintainers should be able to read and `curl` the API without special tooling.

Options considered:

1. **tRPC.** End-to-end types for free in a TypeScript monorepo, but it is awkward for file upload/download and SSE. It hides HTTP status codes and caching, and it ties every consumer to TypeScript.
2. **GraphQL.** Flexible reads, but it is heavy for one client with known screens. Per-field authorization on top of RLS adds complexity. Aggregates and streaming need extra machinery.
3. **Generic CRUD REST**, where everything is `PATCH`able, salary included. Simple, but then any code path can overwrite pay without a reason or history, which is the exact spreadsheet problem we are replacing.
4. **Resource-oriented REST plus explicit command endpoints, typed with Zod schemas shared from `@acme/shared`.**

## Decision

We use option 4.

- Records are resources with standard verbs (`GET/POST /employees`, `PATCH /employees/:id`).
- State changes that carry business meaning are explicit commands, each backed by exactly one service method: `POST /employees/:id/salary-changes`, `POST /employees/:id/terminate`, `POST /imports/:id/commit` and `POST /imports/:id/undo`. `PATCH` cannot touch salary, country or status, and the strict request schemas reject those fields.
- Every request and response shape is a Zod schema in `packages/shared`. The API validates input with it, and the web app imports the inferred types, which gives us most of tRPC's type safety without its transport.
- We use one error envelope (`{ error: { code, message, details? } }`) and a single code-to-status table. Domain errors map to 400/404/409.
- Non-JSON endpoints use plain HTTP: `text/csv` for export, `multipart/form-data` for import upload, and `text/event-stream` for Ask AI.

## Consequences

- "Every salary change has a date, reason and previous amount" holds by construction: there is one endpoint, one service and one transaction, and the database role cannot update or delete history.
- Audit events map one-to-one onto commands, which makes them easy to read ("salary.changed by Priya, reason: promotion").
- Contract drift between the API and the UI shows up as a type error or a failing schema test, not as a runtime surprise.
- More endpoints than generic CRUD, and each command needs its own route, service method and tests. We accept this, because there are only a handful of commands.
- No generated OpenAPI document in v1. `docs/api.md` plus the schemas serve as documentation. If an external consumer appears, we can generate OpenAPI from the same Zod schemas.
