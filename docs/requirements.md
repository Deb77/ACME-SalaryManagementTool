# ACME Salary Management – Requirements

Nov 18, 2026 · @Deborah

**Goal:** replace ACME's salary spreadsheets with a web app where ACME's HR team maintains pay for 10,000 employees across 8 countries, and answers "how do we pay people?" in seconds instead of pivot tables.

## Problem and user

**Problem.** Salary data lives in spreadsheets. Finding a person means Ctrl+F across files, a pay change overwrites the old number with no reason or date, every pay question needs a manual pivot, and copies of sensitive files spread by email.

**User.** HR staff, each with one role. Two roles are seeded: Global HR (all countries) and Country HR (assigned countries only); Global HR can add more. Comfortable with Excel, not technical. Their three jobs:

1. Find a person and update their details or pay.
2. Add new joiners and record leavers.
3. Answer leadership questions such as "what do we pay Data Analysts in India vs the UK?"

**Success measures**

- Any employee found by name, email or code in under 3 seconds.
- 100% of salary changes recorded with date, reason and previous amount.
- Any "pay for title X in country Y" question answered from one screen or one question to the assistant.
- API responses under 200 ms at 10,000 employees.
- Country HR users never see employees outside their countries, enforced on the server and covered by tests.
- A country's existing Excel sheet imports in under 5 minutes, with every row either imported or explained.

## In scope (v1)

| Feature | What it does | Priority | Why |
| --- | --- | --- | --- |
| Employee directory | Server-side search, filters (country, department, title, status), sort, pagination | Must | Replaces Ctrl+F; must stay fast at 10k rows |
| Add, edit, terminate | Create and update people; terminate instead of delete | Must | Core spreadsheet work; payroll records must not vanish |
| Salary changes with history | New amount, effective date, reason; history is permanent | Must | Spreadsheets lose the old number and the why |
| Pay insights | Per country and job title: headcount, min, median, average, max, salary spread; payroll per country | Must | The "how do we pay people" questions |
| Ask AI | Plain-English questions over salary data; shows the queries behind each number; can suggest changes only as drafts for approval | Should | Answers questions the fixed screens don't cover |
| CSV export | Export the current filtered list | Should | HR will still share data in Excel |
| Sign-in with role-based access (RBAC) | Each user has one role: a set of permissions (view, edit, terminate, change pay, export, import, insights, Ask AI, audit log, manage users, manage roles) plus a country scope (all, or assigned countries). Global HR and Country HR are seeded, and Global HR can add or edit roles without a deploy. The auth layer checks the permission on every request; Country HR sees and edits only assigned countries in lists, insights, exports, import and Ask AI | Should | Pay data is need-to-know; access is enforced on the server, not just hidden in the UI, and a new HR role doesn't need a release |
| Seed data | Reproducible script creating 10,000 realistic employees | Must | Required to demo and test at real scale |
| Excel and CSV import | Upload .xlsx or .csv, match columns, preview row-level errors, then add new and update existing employees in one step; downloadable template | Must | HR lives in Excel today; adoption needs an easy way in, and repeat imports while teams switch over |

## Deliberately out of scope

| Left out | Why |
| --- | --- |
| Features for managers, finance and employees | Not needed by HR today. Global HR could create such roles from the existing permissions, but v1 builds no screens for them (team views, self-service). |
| AI that edits data directly | Pay changes need a human decision and an audit trail; the assistant only reads and drafts. |
| Payroll, tax, payslips | A different product with country-specific legal rules; the ask is managing and understanding salaries. |
| Bonus, equity, benefits | Base pay answers the stated questions; total compensation multiplies the data model. |
| Live two-way sync with Excel or other HR systems | Import covers the switch-over; ongoing sync needs rules for which system wins a conflict. |
| Approval workflows, notifications | Needs more than one user first. |

## Assumptions

- Salary means annual base pay, stored in the country's currency as whole minor units (paise, cents) to avoid rounding errors.
- One currency per country; an employee's currency follows their country.
- Job titles and departments come from a fixed catalogue, so insights group correctly.
- All data is synthetic; no real personal data is used.
- Ask AI has a fallback model: if the primary model errors or times out, the request is retried once on a second model. If both are unavailable, only Ask AI is affected and every other feature still works.
- Country HR imports only their assigned countries' employees. Rows for any other country are rejected as row errors that tell them to ask Global HR to make the change; those rows are never applied.
- Invite links are copied by hand in v1: Global HR sees a new link once and passes it on. No email is sent.
- Money is formatted in the currency's own locale (₹32,40,000 for INR, £92,000 for GBP), whatever the viewer's locale.
