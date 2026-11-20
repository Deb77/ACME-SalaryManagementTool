# ADR 0003: Ant Design v6 for UI components, Recharts for charts

Status: superseded by [ADR 0004](0004-mantine-css-modules.md) on 2026-11-20 · originally accepted 2026-11-18

## Context

- The app is a data-heavy internal HR tool: a 10,000-row directory with server-side search, filters, sort and pagination; forms with validation; dialogs; an Excel upload; and charts of pay distribution.
- The look is already designed (canvas "ACME Salary Management – UI Design"): neutral grey frame, white rounded panels, grey "tray" cards, pill buttons, one dark-green accent, Geist type.
- One developer, a take-home timebox. Reviewers judge code quality, tests and judgment, not how much UI was hand-built.
- Accessibility matters: keyboard use, labelled controls, focus handling in dialogs.

Options considered:

1. **shadcn/ui (Radix + Tailwind), copied into the repo.** Excellent accessibility primitives and full visual control. But there is no data table, upload or date picker out of the box (TanStack Table and others must be wired by hand), it adds Tailwind and a lot of copied code we would own and review, and every component starts unstyled for our look.
2. **MUI.** Complete, but Material styling fights this design more than antd does, and the DataGrid features we would want are in the paid tier.
3. **Ant Design v6.** Built for admin/data apps: Table with controlled server-side pagination and sorting, Form.Item, Select, Upload.Dragger, Modal with focus trap, Segmented, Steps. v6 uses CSS variables by default and is themed through `ConfigProvider` tokens. Trade-offs: larger bundle, a recognisable "antd" feel unless themed, and less control over markup.
4. **Hand-built components.** Maximum control, but a poor use of time and a risk to accessibility.

Charts: **Recharts** (React components rendering SVG) or **@ant-design/charts** (config objects over G2, canvas rendering).

## Decision

- Use **Ant Design v6** (`antd` 6.7, `@ant-design/icons` 6) themed from one token file (`apps/web/src/theme/tokens.ts` → `antdTheme.ts`).
- Wrap antd in small presentational components under `apps/web/src/components/` (DataTable, Dialog, FormField, PillButton, …) so screens use our vocabulary, and antd stays swappable behind them.
- Build our own markup only where antd does not match the design or misses accessibility: TrayCard, StatTile, Stepper (antd Steps has no `aria-current`) and RangeBar.
- Use **Recharts** 3 for the trend and histogram charts. It composes as React components, renders SVG that we can style from the same tokens and query in jsdom tests, and is much smaller than G2.
- Self-host Geist with `@fontsource/geist-sans` and `@fontsource/geist-mono`.

## Consequences

- Fast delivery of the hard parts (tables, forms, dialogs, upload) with keyboard and focus behaviour we did not have to write.
- The main bundle is larger (about 540 kB minified for antd core). Screens should be lazy-loaded per route. Components are previewed in Ladle, outside the app bundle.
- Some design details (exact focus ring, segmented spacing) depend on antd tokens; small mismatches are accepted over CSS overrides.
- Wrappers mean an upgrade or a later move to another library touches `components/`, not every screen.
- Tests use React Testing Library with accessible queries, so they keep working if the antd markup changes.
