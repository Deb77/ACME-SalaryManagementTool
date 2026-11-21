# ACME Salary Management – HTTP API

The API serves one client, the React app shipped in the same deploy and served from the same origin. It is designed for that client, but it stays plain enough to use with `curl`. Request and response shapes are Zod schemas in `packages/shared/src`, which both apps import. This document describes them; the schemas are the source of truth.

See [ADR 0001](adr/0001-api-style.md) for the API style. Authentication and sessions are covered in [auth.md](auth.md).

## 1. Conventions

| Topic | Rule |
| --- | --- |
| Base path | `/api`. No version prefix: the only client ships in the same deploy. We add `/api/v2` when a second, independently deployed consumer appears. |
| Format | JSON in and out (`application/json`), camelCase keys. Exceptions: CSV export (`text/csv`), import upload (`multipart/form-data`) and Ask AI (`text/event-stream`). |
| IDs | Records have UUIDs. Employees also have a human `employeeCode` (e.g. `ACM-000123`), which import uses as the matching key. Catalogue entries use stable slugs (`data-analyst`, `engineering`). |
| Money | `{ "amountMinor": 180000000, "currency": "INR" }`. `amountMinor` is an integer in minor units (paise, pence, cents), never a float. Every integer money field ends in `Minor`. The currency always follows the employee's country, so clients never send it: they send `amountMinor` and the server adds the currency. Annual base salary. |
| Cross-currency | The API never sums, averages or sorts across currencies. The only org-wide figures are USD totals from a fixed rate table, labelled `indicative`, with `ratesAsOf`. |
| Dates | Calendar dates (hire, termination, effective) are `YYYY-MM-DD` with no time zone. Instants (`createdAt`, `occurredAt`) are ISO 8601 UTC. |
| Concurrency | Employees carry `version`. Every write to an employee (PATCH, salary change, terminate) sends the `version` the user saw. A mismatch returns `409 stale_version`, so two HR users never silently overwrite each other. This also makes a double-clicked submit harmless. |
| Scope | Scope comes from the session (`req.user`), never from the request. The auth layer checks the route's permission against the user's role ([auth.md](auth.md#roles-and-permissions-rbac)). Each request then runs in a transaction with `SET LOCAL app.user_id / app.countries`, and Postgres row-level security filters `employees`, `salary_changes`, `audit_events` and imports by country. Country HR therefore never sees out-of-scope rows, even when a query has a bug. |
| Out of scope = 404 | When Country HR requests an employee outside their countries, the API returns `404 not_found`, not 403, so it never confirms that the record exists. Creating an employee in a non-assigned country returns `403 forbidden`, because the country is the user's own input. |

### Pagination, filtering, sorting

The employee list uses offset pagination, because HR wants page numbers and "1–25 of 9,812" (see section 5).

```
GET /api/employees?q=rao&country=IN,GB&department=analytics&jobTitle=data-analyst&status=active&sort=-hireDate&page=2&pageSize=25
```

```json
{ "items": [ /* Employee */ ], "page": 2, "pageSize": 25, "total": 312 }
```

- `pageSize` defaults to 25, with a maximum of 100. `page` starts at 1.
- Multi-value filters accept either `country=IN&country=GB` or `country=IN,GB`. Filters combine with AND; values within a filter combine with OR.
- `status` is `active` (default), `terminated` or `all`.
- `q` does a case-insensitive contains match on full name, email and employee code. It filters the rows in scope (no trigram index: `ILIKE` is not leakproof, so an index could not be used under RLS; database.md, E2).
- `sort` takes one allow-listed field: `name`, `employeeCode`, `country`, `jobTitle`, `department`, `hireDate` or `salary`. A `-` prefix sorts descending. `id` is always appended as the tiebreaker, so pages are stable.
- `sort=salary` requires exactly one `country` filter, because ordering INR against GBP amounts means nothing. Otherwise the API returns 400.

The audit log uses cursor pagination: `?cursor=…&limit=50` returns `{ "items": [...], "nextCursor": "…" | null }`.

### Errors

Every error has the same envelope (`apiErrorBodySchema`). The existing unknown-route 404 already uses it:

```json
{
  "error": {
    "code": "validation_error",
    "message": "The request is invalid",
    "details": [{ "path": "salaryAmountMinor", "message": "Too small: expected number to be >0" }]
  }
}
```

| Code | Status | When |
| --- | --- | --- |
| `validation_error` | 400 | The Zod schema failed (`details` lists each field), or a domain rule failed, e.g. an effective date before the latest salary entry |
| `unauthenticated` | 401 | No valid session |
| `forbidden` | 403 | The user's role lacks the route's permission (`details.permission` names it), or writing to a country the user doesn't hold |
| `not_found` | 404 | Unknown route, unknown id, or a row hidden by RLS |
| `conflict` | 409 | Duplicate email or employee code, terminating someone already terminated, committing an import twice, undo blocked |
| `stale_version` | 409 | The `version` in the request doesn't match the current one; the client reloads and retries |
| `payload_too_large` | 413 | Import file over 5 MB |
| `draft_stale` | 409 | An AI draft is out of date: the employee changed since it was drafted, or it is older than 7 days ("This draft is out of date — ask again") |
| `draft_applied` | 409 | An AI draft was already applied; each draft applies once |
| `rate_limited` | 429 | Ask AI message limit reached (20 a minute, 200 a day); includes a `Retry-After` header |
| `ai_budget_exceeded` | 429 | Ask AI token budget used up: 150k tokens for the conversation ("Start a new conversation") or 1M for the user today ("Try again tomorrow") |
| `ai_unavailable` | 503 | No API key or AI database is configured, or both the primary and the fallback model failed. Only Ask AI is affected |
| `internal_error` | 500 | Anything unexpected. The message is generic; details go to logs only |

Services throw typed domain errors (`NotFoundError`, `ConflictError`, …). A single error middleware maps them using `apiErrorStatus` from `@acme/shared`. Routes never build error responses themselves.

### Idempotency and rate limits

- There is no `Idempotency-Key` header. The writes that matter are already protected: employee writes require `version`, and import commit/undo are state transitions on the import resource, so repeating one returns `409`.
- Ask AI: 20 messages per minute and 200 per day per user (in-memory limiter, which is fine for one Render instance), plus token budgets (150k per conversation, 1M per user per day, counted from stored messages) and, per answer, at most 6 tool rounds and 2,000 output tokens. Other endpoints have no limit beyond the session.

## 2. Roles and permissions

Access is role-based. Each user has one role, and a role is a set of permissions plus a country scope (all countries, or the user's assigned countries). Roles live in the database, so Global HR can add or edit them through `/api/roles` without a deploy. The permission catalogue and the rules that stop privilege escalation are in [auth.md](auth.md#roles-and-permissions-rbac). The two seeded roles:

| | Global HR | Country HR |
| --- | --- | --- |
| Country scope | All countries; indicative USD org totals | Assigned countries only; USD total covers only those countries |
| `employees:read`, `employees:write`, `employees:terminate`, `salary:change` | Yes | Yes, in scope |
| `insights:read`, `employees:export`, `imports:run`, `ai:ask` | Yes | Yes, in scope |
| `audit:read` | Everything | Events for employees in assigned countries, plus their own imports and exports |
| `users:manage`, `roles:manage` | Yes | No (403) |

The auth layer checks each route's permission (`requirePermission`), and Postgres RLS enforces country scope. Tests cover both layers, including a role without the permission getting 403 and a Country HR request for an out-of-scope id returning 404.

## 3. Resources

| Method | Path | Purpose | Permission |
| --- | --- | --- | --- |
| GET | `/api/health` | Liveness | public |
| POST | `/api/auth/sign-in` | `{ email, password }` → `200` Me, sets the session cookie; every failure is `401` (see [auth.md](auth.md)) | public, rate limited |
| POST | `/api/auth/sign-out` | Ends the current session → `204` | — |
| GET | `/api/auth/me` | The signed-in user, role, permissions and resolved countries | signed in |
| GET | `/api/auth/invites/:token` | Who an invite or reset link is for → `{ email, name, isReset }` | public, rate limited |
| POST | `/api/auth/accept-invite` | `{ token, password }` → `200` Me; sets the password and signs in | public, rate limited |
| GET | `/api/meta` | Countries (with currency), departments, job titles, reasons, FX table | signed in |
| GET | `/api/employees` | Search, filter, sort, page | `employees:read` (scoped) |
| GET | `/api/employees/export.csv` | CSV of the current filtered list (same params, no paging) | `employees:export` (scoped) |
| POST | `/api/employees` | Add a new joiner, writing the first salary entry (`hire`) | `employees:write` (scoped) |
| GET | `/api/employees/:id` | Employee detail | `employees:read` (scoped) |
| PATCH | `/api/employees/:id` | Edit details (not pay, country or status) | `employees:write` (scoped) |
| POST | `/api/employees/:id/terminate` | Record a leaver (soft) | `employees:terminate` (scoped) |
| GET | `/api/employees/:id/salary-changes` | Salary history, newest first | `employees:read` (scoped) |
| POST | `/api/employees/:id/salary-changes` | The only way to change pay | `salary:change` (scoped) |
| GET | `/api/insights/overview` | Per country: headcount, pay stats, payroll; indicative USD total | `insights:read` (scoped) |
| GET | `/api/insights/by-title?country=IN` | Per job title within one country | `insights:read` (scoped) |
| GET | `/api/insights/titles/:jobTitleId` | One title compared across countries | `insights:read` (scoped) |
| GET | `/api/insights/distribution?country=IN[&jobTitle=…]` | Salary histogram | `insights:read` (scoped) |
| GET | `/api/imports/template.xlsx` | Downloadable template (`template.csv` also available) | `imports:run` |
| POST | `/api/imports` | Upload a file; returns detected columns and a suggested mapping | `imports:run` |
| GET | `/api/imports` | Recent imports | `imports:run` (scoped) |
| GET | `/api/imports/:id` | Import status and summary | `imports:run` (scoped) |
| PUT | `/api/imports/:id/mapping` | Set the column mapping and run the dry run | `imports:run` (scoped) |
| GET | `/api/imports/:id/rows?outcome=error` | Row-level preview and errors (paged) | `imports:run` (scoped) |
| POST | `/api/imports/:id/commit` | Apply in one transaction | `imports:run` (scoped) |
| POST | `/api/imports/:id/undo` | Revert the batch | `imports:run` (scoped) |
| POST | `/api/ai/messages` | Ask a question; streams the answer (SSE) | `ai:ask` (scoped) |
| GET | `/api/ai/conversations/:id` | Reload a conversation (own only) | `ai:ask` |
| GET | `/api/ai/sql-runs?userId=&status=&from=&to=&cursor=&limit=` | The SQL audit log: every `run_sql` attempt (cursor-paged, newest first) | `audit:read` (own runs; every run for all-country roles) |
| GET | `/api/ai/metrics` | In-process Ask AI metrics and active alerts (JSON) | `users:manage` |
| GET | `/metrics` | The same metrics in Prometheus text format; only when `METRICS_TOKEN` is set, with `Authorization: Bearer <token>` | token |
| GET | `/api/audit-events` | Who changed what, when, before and after | `audit:read` (scoped) |
| GET | `/api/users` | HR users with role and countries | `users:manage` |
| POST | `/api/users` | Invite an HR user | `users:manage` |
| PATCH | `/api/users/:id` | Change role or countries | `users:manage` |
| POST | `/api/users/:id/deactivate` | Revoke access (no delete) | `users:manage` |
| POST | `/api/users/:id/reactivate` | Restore access | `users:manage` |
| GET | `/api/permissions` | Permission catalogue with dependencies | `roles:manage` |
| GET | `/api/roles` | Roles with permissions, country scope and user count | `users:manage` or `roles:manage` |
| POST | `/api/roles` | Create a role | `roles:manage` |
| PATCH | `/api/roles/:id` | Rename a role or change its permissions | `roles:manage` |
| DELETE | `/api/roles/:id` | Delete a non-system role that nobody holds | `roles:manage` |
| POST | `/api/users/:id/invite` | Issue a new invite or password-reset link (see auth.md) | `users:manage` |

There is no `DELETE` route anywhere. Leavers are terminated, salary history is append-only, users are deactivated, and imports are undone by compensating writes.

## 4. Shapes

### Employee (`employeeSchema`)

```json
{
  "id": "0b8f4a2e-6c1d-4f7e-9a3b-2d5e8c1f4a60",
  "employeeCode": "ACM-004211",
  "firstName": "Asha",
  "lastName": "Rao",
  "email": "asha.rao@acme.test",
  "country": "IN",
  "jobTitle": { "id": "data-analyst", "name": "Data Analyst" },
  "department": { "id": "analytics", "name": "Analytics" },
  "hireDate": "2024-03-11",
  "status": "active",
  "termination": null,
  "salary": { "amountMinor": 180000000, "currency": "INR" },
  "salaryEffectiveDate": "2026-04-01",
  "version": 3,
  "createdAt": "2026-11-18T09:30:00.000Z",
  "updatedAt": "2026-11-18T09:30:00.000Z"
}
```

The list returns the same shape. At 25 rows per page there is no need for a slimmer list DTO.

**Create**: `POST /api/employees` → `201` with Employee and a `Location` header (`createEmployeeRequestSchema`).

```json
{
  "firstName": "Asha", "lastName": "Rao", "email": "asha.rao@acme.test",
  "country": "IN", "jobTitleId": "data-analyst", "departmentId": "analytics",
  "hireDate": "2026-11-02", "salaryAmountMinor": 180000000
}
```

`employeeCode` is optional; the server generates one if it's missing. Any unknown key, such as `currency`, returns 400. The service writes the employee and the first salary entry (`reason: "hire"`, effective on `hireDate`) in one transaction. A duplicate email or code returns `409 conflict`.

**Update**: `PATCH /api/employees/:id` → `200` Employee (`updateEmployeeRequestSchema`). Any subset of `firstName`, `lastName`, `email`, `jobTitleId`, `departmentId`, `hireDate`, plus the required `version`. The body is a strict object, so sending `salary…`, `country` or `status` returns 400 rather than being silently ignored.

**Terminate**: `POST /api/employees/:id/terminate` → `200` Employee (`terminateEmployeeRequestSchema`).

```json
{ "terminationDate": "2026-12-31", "reason": "resignation", "note": "Moving abroad", "version": 3 }
```

The employee stays in the database with `status: "terminated"`, and their history and audit trail remain. Terminated employees are excluded from insights and from the default list. Terminating twice returns `409`. Reinstating is out of scope for v1.

### Salary changes (`createSalaryChangeRequestSchema`)

`POST /api/employees/:id/salary-changes` → `201`

```json
{
  "amountMinor": 198000000,
  "effectiveDate": "2026-12-01",
  "reason": "market_adjustment",
  "note": "Benchmark review Q4",
  "version": 3,
  "aiDraftId": "6f1c1f3e-2a51-4c55-9d4e-3c3a8e0b7a10"
}
```

```json
{
  "salaryChange": {
    "id": "…", "employeeId": "…",
    "amount": { "amountMinor": 198000000, "currency": "INR" },
    "previousAmount": { "amountMinor": 180000000, "currency": "INR" },
    "effectiveDate": "2026-12-01", "reason": "market_adjustment", "note": "Benchmark review Q4",
    "importId": null, "aiDraftId": "6f1c…",
    "createdAt": "2026-11-18T10:02:11.000Z", "createdBy": { "id": "…", "name": "Priya N" }
  },
  "employee": { /* updated Employee, version 4 */ }
}
```

- `SalaryService.change()` is the only code path that writes pay. The UI dialog, import and import undo all call it. In one transaction it locks the employee row, checks `version`, inserts the history row (which stores `previousAmount`), updates `employees.salary_*`, and writes the audit event.
- Reasons users can pick: `annual_review`, `promotion`, `market_adjustment`, `correction`, `other`. `correction` and `other` require a note. Only the system writes `hire`, `import` and `import_undo`.
- `effectiveDate` must not be earlier than the latest entry's effective date, so the "current" salary stays unambiguous. A wrong past amount is fixed with a new `correction` entry. It must also not be later than today: future-dated changes are not supported in v1 (see open questions).
- History is never updated or deleted. The app's database role has no `UPDATE` or `DELETE` grant on `salary_changes`.

### Insights

All stats are in one currency per row: `currency` plus `*Minor` integer fields. Medians use `percentile_disc` so they stay whole minor units. Averages are rounded half-up to the minor unit. Only active employees are counted.

`GET /api/insights/overview`

```json
{
  "countries": [
    {
      "country": "IN", "currency": "INR", "headcount": 2104,
      "minMinor": 45000000, "medianMinor": 160000000, "avgMinor": 178250000, "maxMinor": 950000000,
      "payrollMinor": 375038000000,
      "payrollUsdIndicativeMinor": 4501000000
    }
  ],
  "total": { "headcount": 9812, "payrollUsdIndicativeMinor": 61230000000 },
  "fx": { "indicative": true, "ratesAsOf": "2026-10-01", "base": "USD" }
}
```

`GET /api/insights/by-title?country=IN[&department=analytics]` returns `{ country, currency, rows: [{ jobTitle, headcount, minMinor, medianMinor, avgMinor, maxMinor, payrollMinor }] }`. `country` is required. Requesting a country outside the user's scope returns `403`.

`GET /api/insights/titles/data-analyst` answers "Data Analysts in India vs the UK". It returns one stats row per visible country, each in its own currency, plus `medianUsdIndicativeMinor` so the rows can be compared side by side.

`GET /api/insights/distribution?country=IN&jobTitle=data-analyst&buckets=10` returns `{ currency, buckets: [{ fromMinor, toMinor, count }] }` (equal-width buckets between min and max).

Each insights endpoint is one aggregate query over the indexed `(country, job_title_id) WHERE status = 'active'` rows, well inside 200 ms at 10k rows. No caching layer is needed in v1.

### Meta / catalogue

`GET /api/meta` → `{ countries: [{ code, name, currency, minorUnits }], departments: [{ id, name }], jobTitles: [{ id, name }], salaryChangeReasons, terminationReasons, fx: { ratesAsOf, rates: { "INR": 0.012, … } } }`. The data is non-sensitive and static per deploy, so the response is sent with an `ETag`. The catalogue is seeded by migration and is not editable in v1. The user's own countries come from `GET /api/auth/me`.

### CSV export

`GET /api/employees/export.csv?<same filters and sort as the list>` → `200 text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="employees-2026-11-18.csv"`.

- Columns: code, first name, last name, email, country, department, job title, hire date, status, salary, currency, salary effective date. Salary is written in major units as a plain decimal (`1800000.00`; `0` decimals for JPY-style currencies), because the file goes to Excel users.
- It is built in one query (at most about 10k rows, about 1 MB) and contains only rows RLS allows. A cursor stream is the next step if exports grow.
- To prevent CSV injection, cells starting with `= + - @` are prefixed with `'`.
- Each export writes an `export.created` audit event with the filters used, since copies of pay data spreading by email is the problem we're replacing.

### Import flow

The import is a resource with a status: `uploaded → validated → committed → undone` (plus `failed`).

1. **Upload**: `POST /api/imports` (multipart, field `file`, `.xlsx` or `.csv`, ≤ 5 MB, ≤ 10,000 data rows) → `201`
   ```json
   { "id": "…", "status": "uploaded", "fileName": "india-2026.xlsx",
     "columns": ["Emp ID", "Name", "Surname", "E-mail", "Role", "Dept", "Annual CTC", "DOJ"],
     "sampleRows": [["IN-0042", "Asha", "Rao", "…"]],
     "suggestedMapping": { "employeeCode": "Emp ID", "firstName": "Name", "salaryAmount": "Annual CTC", "hireDate": "DOJ" } }
   ```
   The suggested mapping comes from fuzzy header matching against field names and their known aliases.
2. **Map and dry run**: `PUT /api/imports/:id/mapping`
   ```json
   { "mapping": { "employeeCode": "Emp ID", "firstName": "Name", "…": "…" },
     "defaults": { "country": "IN", "salaryEffectiveDate": "2026-11-01" } }
   ```
   This parses and validates every row and changes nothing. It returns `200` with `{ status: "validated", summary: { rows: 2104, create: 12, update: 87, unchanged: 1998, error: 7 } }`. The client can call it again to try a different mapping.
3. **Review**: `GET /api/imports/:id/rows?outcome=error|create|update|unchanged&page=1` returns `{ items: [{ rowNumber, outcome, employeeCode, changes: { jobTitleId: { from, to }, salaryAmountMinor: { from, to } }, errors: [{ column: "Annual CTC", message: "Not a number" }] }], page, pageSize, total }`. An error report is available as `GET /api/imports/:id/rows.csv?outcome=error`, so HR can fix the rows in Excel.
4. **Commit**: `POST /api/imports/:id/commit` with `{ "skipInvalidRows": true }` (required if `error > 0`). The server re-validates inside one transaction. Valid rows are created or updated, and pay changes go through `SalaryService` (`reason: "import"`). If the data changed since the dry run so that the outcome differs, the whole commit rolls back with `409` and the user re-runs step 2. It returns `200` with the final summary. Committing twice returns `409`.
5. **Undo**: `POST /api/imports/:id/undo` → `200`. This is allowed only while the import is still the latest change to every employee it touched. Otherwise it returns `409` and lists the blocking employees. Updated employees get their previous values back, with compensating `import_undo` salary entries (history stays append-only). Employees the batch created are removed together with their import-only history rows. This is the single, audited exception to "nothing is deleted", and it runs in a `SECURITY DEFINER` function restricted to that batch id.

Matching key: `employeeCode`, falling back to `email`. Country HR imports only their assigned countries. A row for any other country is a row error ("GB is outside your countries. Ask Global HR to make this change.") and is never applied, rather than silently skipped. Every row ends up created, updated, unchanged or listed with a reason, which is the "every row imported or explained" success measure.

### Ask AI

`POST /api/ai/messages` with `{ "conversationId"?: uuid, "message": "What do we pay Data Analysts in India vs the UK?" }` returns `200 text/event-stream`. Each `data:` line is one `aiStreamEventSchema` event:

```
data: {"type":"conversation","conversationId":"…"}
data: {"type":"tool_call","callId":"c1","tool":"run_sql","summary":"Median Data Analyst pay in IN and GB"}
data: {"type":"tool_result","callId":"c1","rowCount":2}
data: {"type":"text","delta":"In India the median Data Analyst salary is ₹16,00,000…"}
data: {"type":"draft_salary_change","draft":{"draftId":"…","employeeId":"…","currentAmount":{…},"proposedAmount":{…},"effectiveDate":"2027-01-01","reason":"market_adjustment","note":null}}
data: {"type":"done"}
```

- The request is a POST, not an `EventSource` GET, because it carries a body. The web app reads it with `fetch` and a stream reader.
- The server keeps the conversation (owned by the user). The client never sends history or tool results, so it cannot inject fake data into the model's context.
- **Generated SQL, not typed tools** (decision #36). The model writes SQL through one tool, `run_sql {sql, purpose}`. Before anything reaches the database, a real Postgres parser (`libpg-query`) checks it is exactly one `SELECT` (no `INTO`, no locking clause) over the allowed tables (`employees`, `salary_changes`, `countries`, `job_titles`, `departments`, `fx_rates`), using only allow-listed functions and no `reg*` casts. It is then wrapped to return at most 200 rows (and 20,000 characters of JSON) and run as the `acme_ai_reader` login in `begin read only` … `rollback`, with a 5 s statement timeout. That role cannot bypass RLS and has column grants only (no names, emails, termination notes or salary-change notes), and its country scope comes from the session, never from the model ([auth.md](auth.md#ask-ai-database-role)). Rejected SQL never reaches the database; the reason goes back to the model as a tool error. The UI shows each step as `tool_call.summary` (the model's plain-English `purpose`) with its row count. The SQL itself never reaches the browser, in the stream or in `GET /api/ai/conversations/:id`; it is kept only in the SQL audit log (`GET /api/ai/sql-runs`, `audit:read`), decision #44.
- **Codes, not names.** `find_employee_codes {name}` returns at most 10 employee codes with title, country and status, never names. Answers mention people by code (`ACM-000123`); the web app looks each code up through the normal employees API and shows "Name (code)" as a link, so names never reach the model.
- `draft_salary_change {employeeCode, proposedAmountMinor, effectiveDate, reason, note?}` is offered only to users with `salary:change`. The server checks the employee is in scope and active, the date is not in the future or before the current salary, and stores the draft with the employee's `version_at_draft` and a 7-day `expires_at`.
- Drafts are only data. The UI opens the normal salary-change dialog prefilled. Submitting it is an ordinary `POST /salary-changes` with `aiDraftId`, so the audit log shows that the change started as an AI suggestion and that a named person confirmed it. A draft applies once (a second apply is `409 draft_applied`, backed by a unique index on `salary_changes.ai_draft_id`); if the employee's version changed or the draft is older than 7 days it is `409 draft_stale` and the dialog says "This draft is out of date — ask again". Another user's draft is `404`.
- Models: primary `claude-sonnet-5-5`, fallback `claude-opus-5-5` (`AI_MODEL_PRIMARY`, `AI_MODEL_FALLBACK`), 30 s per call. If the primary errors, times out or refuses before any `text` event has been sent, the server retries that call once on the fallback and the client sees one normal stream. Once text has streamed, it does not switch models, because the answer would repeat or contradict itself. The system prompt and tools are prompt-cached.
- Errors before the stream starts use the normal envelope (`429 rate_limited`, `429 ai_budget_exceeded`, `503 ai_unavailable`). Errors mid-stream arrive as an `error` event followed by the end of the stream. Without `ANTHROPIC_API_KEY` or `DATABASE_URL_AI` Ask AI answers `503 ai_unavailable` and the rest of the API works normally.
- `GET /api/ai/conversations/:id` returns `aiConversationSchema`: the turns (question, steps with their SQL, answer, drafts), `tokensUsed` and `tokenBudget`. Another user's conversation is `404`.

### Ask AI SQL audit log and monitoring

- `GET /api/ai/sql-runs` returns `aiSqlRunsResponseSchema` (`{ items, nextCursor }`, keyset on `(created_at, id)`). Each item has the user, conversation, SQL text, countries it ran with, `status` (`ok`, `rejected`, `error`, `timeout`), error code and message, row count, `truncated`, duration and model. Result rows are never stored. Rows are written for every attempt, rejected ones included, in their own transaction, and cannot be updated or deleted. Filters: `userId`, `status`, `from`/`to` (ISO dates, inclusive); `limit` up to 100.
- `GET /api/ai/metrics` returns `aiMetricsSchema`: counters (turns by outcome, model calls by model and outcome, fallbacks, SQL runs by status, tokens in/out/cache), latency histograms for turns, model calls and SQL, and the alerts currently firing.
- `GET /api/health` includes `ai: { configured, database: "ok" | "unreachable" | "not_configured" }`; the app is healthy without AI.
- Alerts (`AI_ALERT_*`): error rate over 10 % or fallback rate over 20 % across the last 15 minutes (at least 5 turns), or more than 5M tokens today. Each is logged once per window as a `warn` line `ai.alert`.
- Logs are one JSON line per turn (`ai.turn`) and per SQL run (`ai.sql_run`) with OpenTelemetry-style field names (`gen_ai.request.model`, `gen_ai.usage.input_tokens`, …). They never contain the question, the answer, result rows, names, emails, the SQL text (only its length; the text is in the audit table) or the API key.

### Audit log

`GET /api/audit-events?entityType=employee&entityId=…&actorId=…&action=salary.changed&from=2026-11-01&to=2026-11-30&cursor=…&limit=50`

```json
{
  "items": [
    {
      "id": "…", "occurredAt": "2026-11-18T10:02:11.000Z",
      "actor": { "id": "…", "name": "Priya N", "role": "country_hr" },
      "action": "employee.updated",
      "entity": { "type": "employee", "id": "…", "label": "ACM-004211 Asha Rao" },
      "country": "IN",
      "before": { "jobTitleId": "data-analyst" },
      "after": { "jobTitleId": "senior-data-analyst" },
      "context": { "importId": null, "aiDraftId": null }
    }
  ],
  "nextCursor": "eyJ0IjoiMjAyNi0xMS0xOFQxMDowMjoxMS4wMDBaIiwiaWQiOiIuLi4ifQ"
}
```

Actions: `employee.created`, `employee.updated`, `employee.terminated`, `salary.changed`, `import.committed`, `import.undone`, `export.created`, `user.invited`, `user.updated`, `user.deactivated`, `role.created`, `role.updated`, `role.deleted`. `before` and `after` contain only the fields that changed. Audit rows are written in the same transaction as the change and are insert-only, like salary history. The employee page reads its timeline with `?entityType=employee&entityId=…`.

### Access management (`users:manage`, `roles:manage`)

`GET /api/users` → `{ items: [{ id, name, email, role: { id, key, name }, countries, status: "active" | "invited" | "deactivated", lastSignInAt, version }] }` (about 20 users, no paging).

`POST /api/users` `{ name, email, roleId, countries: ["IN"] }` → `201`. A role with `countryScope: "assigned"` needs at least one country; for an `all` role `countries` is ignored. You can only assign a role whose permissions you hold (otherwise `403`). How invitations are delivered is covered in auth.md.

`PATCH /api/users/:id` `{ roleId?, countries?, version }` → `200`. `POST /api/users/:id/deactivate` → `200`. Changes take effect on the user's next request, because scope is read from the database for each session lookup and is not baked into a token. Changing your own role, deactivating yourself, or demoting or deactivating the last active Global HR returns `409`.

`GET /api/roles` → `{ items: [{ id, key, name, description, countryScope: "all" | "assigned", isSystem, permissions: ["employees:read", …], userCount, version }] }`. `GET /api/permissions` → `{ items: [{ key, description, requires: ["employees:read"] }] }`.

`POST /api/roles` `{ name, description?, countryScope, permissions }` → `201`. `PATCH /api/roles/:id` `{ name?, description?, permissions?, version }` → `200`; `countryScope` cannot change. `DELETE /api/roles/:id` → `204`. A missing dependency returns `400`; granting a permission you don't hold, or editing your own role, returns `403`; editing `global_hr`, or deleting a system role or one somebody holds, returns `409`. Changes apply to every holder on their next request.

## 5. Decisions and trade-offs

- **Pay is not editable via PATCH.** A salary change is a business event with a date, a reason and a previous amount, not a field edit. Having one endpoint backed by one service makes "100% of changes recorded" true by construction: no other code path can write `employees.salary_*`, and the strict PATCH schema rejects the field outright.
- **Offset pagination for employees, cursor pagination for audit.** With about 10k rows and indexes, `OFFSET` up to page 400 plus `count(*)` costs a few milliseconds in Postgres. That buys page numbers, totals and arbitrary sort columns, which keyset pagination makes awkward. The audit log grows without bound and is read newest-first, so it uses a keyset cursor on `(occurred_at, id)`. If the employee table ever reaches millions of rows, the list can switch to keyset pagination behind the same `sort` parameter.
- **Synchronous import with a stateful resource.** Validating and writing 10k rows takes seconds, not minutes, so commit runs inside the request and one transaction. That means no queue, worker or second Render service. The import still has an id and a status, so moving to `202 Accepted` and polling `GET /imports/:id` later would not change the contract the UI relies on.
- **Undo compensates rather than rewriting history.** The one deletion it allows is of employees the batch created. It is blocked as soon as anyone else has touched those employees, which keeps the semantics simple and explainable.
- **Currency is derived, never accepted.** Clients send `amountMinor` only. A wrong-currency salary is impossible to submit, and the strict schemas return 400 if anyone tries.
- **No cross-currency maths.** Sorting by salary needs a single country. Insights are per country. Org totals are explicitly indicative and carry the rate date.
- **Out of scope = 404.** The API never confirms that an employee exists in a country the user can't see.
- **Roles in the database, permissions in code.** Global HR can define roles without a deploy, but only from a fixed catalogue that the routes reference, so the database can never hold a permission that no route checks.
- **Optimistic concurrency via a `version` body field rather than `If-Match`.** It has the same semantics, is easier to send from forms and Zod, and shows up clearly in the schemas.
- **No API versioning yet.** The API and the UI deploy together. Versioning now would be ceremony without a consumer.

- **Generated SQL for Ask AI** instead of a fixed set of typed tools: the questions HR asks vary too much for a handful of functions, and the protections sit in the database (role, RLS, column grants, read-only, timeout) and in a parser, not in the model's good behaviour. See decision #36.

## 6. Open questions

1. **Future-dated salary changes** (e.g. a raise effective 1 January, entered in November). v1 limits `effectiveDate` to today or earlier, so "current salary" is a simple column. Supporting future dates would need "current" to be derived as of today, plus a daily job or a view.
2. **Country moves** (relocations change the currency). v1 rejects `country` in PATCH. Should a move become a dedicated command that also records a salary change in the new currency?
3. **Undo window**: is "until anyone touches an affected employee" enough, or do we also want a time limit (e.g. 24 h)?
4. **Reinstating** a terminated employee (a mistaken termination) is not in v1. For now it would be a new hire record.
