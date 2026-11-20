# UI foundation

How the web app's look and shared components are built. Decision records: [ADR 0004](adr/0004-mantine-css-modules.md) (Mantine and CSS modules), which supersedes [ADR 0003](adr/0003-ui-library.md) (Ant Design).
Designs: the Claude Design canvas "ACME Salary Management – UI Design" (Employees, Employee detail, Record salary change, Add employee, Insights, Ask AI, Access & roles, Import from Excel, and a Component library artboard that mirrors this document).

## Viewing the components

```bash
npm run ladle -w @acme/web         # component workshop at http://localhost:61000
npm run ladle:build -w @acme/web   # static build in apps/web/build
```

Components are shown in [Ladle](https://ladle.dev), a lightweight Storybook-compatible workshop. Stories live in `apps/web/src/stories/*.stories.tsx`, grouped in the sidebar by atomic level (Atoms, Molecules, Organisms, Templates) through each file's `export default { title: 'Level / Name' }`, and use synthetic data from `stories/sampleData.ts`. Every story renders inside the app's `ThemeProvider` (`apps/web/.ladle/components.tsx`), so it looks exactly like the app. Ladle's accessibility check and width switcher are enabled.

Ladle bundles its own Vite version, so it has its own small config (`apps/web/.ladle/vite.config.ts`) instead of reading the app's. Stories are not part of the app bundle.

## Layout

```
apps/web/src/
  theme/          tokens.ts (source of truth), mantineTheme.ts, cssVariables.ts, ThemeProvider.tsx, fonts.ts
  lib/money.ts    minor-unit formatting and parsing (no floats)
  components/     atomic levels, one folder per component: Component.tsx, Component.test.tsx (+ .module.css, helpers)
    atoms/        single-purpose pieces: PillButton, StatusTag, MoneyText, MoneyInput, SegmentedControl, RangeBar
    molecules/    a few atoms or Mantine parts together: SearchField, FilterSelect, FormField, PersonCell, PayRangeRow, Stepper, FileDropzone, the three states, ChatMessage, TrayCard, StatTile
    organisms/    self-contained sections: PageHeader, DataTable, Dialog, ConfirmDialog, QuerySteps, TrendChart, HistogramChart, ErrorBoundary
    templates/    page layout without data: AppShell
  stories/        Ladle stories and their sample data
```

Screens (pages) will live outside `components/` and are the only layer that fetches data.

### Atomic levels

| Level | Definition | Examples |
| --- | --- | --- |
| Atom | The smallest piece that still means something on its own. Does one job, imports no other component of ours, and knows nothing about the domain beyond the values it shows. | PillButton, StatusTag, MoneyText, RangeBar |
| Molecule | A few atoms or Mantine parts combined into one small, reusable unit with a single purpose. No opinion about page layout. | PayRangeRow, PersonCell, FormField, TrayCard |
| Organism | A self-contained section of a screen with its own behaviour (sorting, paging, focus trapping, charting), usable on its own. | DataTable, Dialog, PageHeader, TrendChart |
| Template | Page layout with slots and no data: where navigation, header and content go. | AppShell |
| Page (screen) | Outside `components/`. A template filled with real data; the only layer that fetches data or holds server state. | Employees, Insights, Ask AI |

Borderline calls:

- **TrayCard** is a molecule: a container with no behaviour of its own.
- **Dialog** is an organism: it owns focus trapping, Escape and busy state.
- A domain-specific wrapper goes one level above the generic piece it wraps (RangeBar atom → PayRangeRow molecule).

Rules for `components/`:

- **Atomic levels**: a component may import only from its own level or a lower one (atoms → molecules → organisms → templates). ESLint `no-restricted-imports` enforces this in `eslint.config.js`, so an atom importing a molecule fails lint.
- Presentational only. No data fetching, no global state. Screens own queries and pass data and callbacks in.
- **One styling mechanism**: every component is styled by its own CSS module, reading the tokens as `--acme-*` variables. Mantine parts are styled through their `classNames` prop; Mantine's CSS loads as `@layer mantine`, so a plain class always wins. No inline style objects except for values that come from props (a width, a position), no `!important`, and never target Mantine's own `.mantine-*` classes.
- Use Mantine where it brings behaviour (focus trapping, comboboxes, pagination); write plain markup where a component is only layout and colour (StatusTag, FormField, avatars, the state messages).
- No `index.ts` per component. Each level has one `index.ts` barrel that names exactly what leaves each folder (helpers such as `toPercent` or `initialsOf` only when another layer needs them), and `components/index.ts` re-exports the four levels, so screens import from `components` without knowing the level. Inside `components/`, one component imports another by its file path (`../Dialog/Dialog`), not through a barrel, to avoid import cycles.
- Helpers that are not components live in their own file (named `<Component>.utils.ts`, for example `PersonCell/PersonCell.utils.ts`) so React Fast Refresh keeps working.

## Component inventory

| Component | Built on | Used by screens |
| --- | --- | --- |
| AppShell (left nav grouped by area, top bar, white panel, skip link) | own markup | all pages |
| PageHeader (h1, description, actions) | own markup | all pages |
| TrayCard (grey tray, uppercase title, white panel, footer strip) | own markup | every card: directory, profile, salary history, insights cards, roles, import review |
| StatTile (KPI value, delta, decorative bars; `hero` variant) | own markup | Insights, Import summary |
| PillButton (`primary`, `secondary`, `quiet`, `danger`) | Mantine Button | all pages and dialogs |
| SegmentedControl (pill radio group) | Mantine SegmentedControl | Insights period and country, Roles filter, Import row filter |
| FilterSelect ("Country: India" pill) | Mantine Select | Employees filters, Ask AI scope |
| SearchField | Mantine TextInput | Employees directory, top bar |
| DataTable (server-side page and sort, "Showing 1–10 of N"; sort buttons in the headers) | Mantine Table + Pagination | Employees, salary history, payroll by country, Ask AI result, team members, import errors |
| MoneyText (`{ amountMinor, currency }` → Intl.NumberFormat) | `lib/money.ts` | every amount |
| MoneyInput (currency prefix, reports minor units) | Mantine Input + `lib/money.ts` | Record salary change, Add employee |
| StatusTag (tone + optional dot) | own markup | employee status, change reason, role badges |
| PersonCell (initials avatar, name link, detail line) | own markup | Employees, Roles, dialogs, Ask AI people chips |
| FormField (label, hint/error, aria wiring via render prop) | own markup | Add employee, Record salary change, Edit access, Import options |
| Dialog (tray-style modal, footer note + actions) | Mantine Modal | Record salary change |
| ConfirmDialog | Dialog + PillButton | Terminate, Remove access |
| FileDropzone (.xlsx/.csv, size check, hands File to parent; a keyboard-reachable button) | own markup + hidden file input | Import (upload step) |
| Stepper (pill `<ol>` with `aria-current="step"`) | own markup | Import |
| RangeBar (min–max range, median dot, optional marker; unit-free) | own markup | PayRangeRow |
| PayRangeRow (title, RangeBar, median amount; label built from money) | RangeBar + MoneyText | Insights pay by job title, Employee detail current pay |
| TrendChart (area) | Recharts | Insights payroll trend |
| HistogramChart (bands, median highlighted) | Recharts | Insights salary spread |
| ChatMessage (question bubble / answer article) | own markup | Ask AI |
| QuerySteps ("Worked through 3 steps", collapsible, queries in mono) | TrayCard + PillButton | Ask AI |
| LoadingState / EmptyState / ErrorState | Mantine Loader / own markup / own markup | every async card and table |
| ErrorBoundary | React class component + ErrorState | wraps the app; can wrap individual cards |

Deliberately not built: a separate Timeline (salary history is a table in the designs), a Drawer wrapper (Edit access is a side TrayCard), and toasts (none of the designs show one; `@mantine/notifications` is the option if a screen needs it).

## Theming

- `theme/tokens.ts` holds every colour, radius, font, shadow and control size taken from the canvas: accent `#2E6B47`, greens `#3FA266`/`#9FD3B0`/`#EEF7F1`/`#F3FAF5`, greys `#111` to `#F4F4F4`, radii 8–22 px, Geist and Geist Mono.
- `theme/mantineTheme.ts` maps the tokens Mantine needs into its theme: the green scale as the `acme` primary colour, Geist fonts and the radii. Everything else about a component's look is in its CSS module.
- `theme/cssVariables.ts` exposes the same tokens as `--acme-*` custom properties on `:root` (portalled dialogs and dropdowns need them there), so CSS modules never repeat a hex value.
- `ThemeProvider` loads Mantine's layered CSS, wraps the app in `MantineProvider` and writes the `:root` variables. `App.tsx`, Ladle and the test `render` helper all use it.
- Fonts are self-hosted from `@fontsource/geist-sans` and `@fontsource/geist-mono` (imported once in `main.tsx`), so no request goes to a font CDN.

## Money

Amounts are integer minor units plus an ISO 4217 code, as in the requirements. `lib/money.ts`:

- `formatMoney` converts minor units to an exact decimal string (no division, no floats) and passes it to `Intl.NumberFormat`, which accepts decimal strings. INR uses `en-IN` grouping (₹32,40,000), GBP `en-GB`, others `en-US`. Options: `signed` (+₹2,60,000) and `compact` (₹7.2L, with the exact amount as a tooltip in MoneyText).
- `parseMajorToMinor` turns typed text ("35,00,000") into minor units, rejecting extra decimals for the currency (e.g. any decimals for JPY).
- The fraction digits come from `Intl` per currency, not a hard-coded 2.

## Charts

Recharts 3, chosen over G2-based libraries because it composes as React components, renders SVG that takes our tokens directly and can be queried in jsdom tests, and is far lighter than G2. Simple marks that are really layout (RangeBar, StatTile bars) are plain CSS instead of a chart library.

Every chart has a required `summary` prop that becomes `role="img"` + `aria-label` with the takeaway in one sentence ("Monthly payroll rose from $57.9M to $60.9M…"). Colours come from `chartColors` in the tokens; the highlighted band uses the darker accent so it differs in lightness, not only hue.

## Accessibility

- Landmarks: `nav aria-label="Main"`, `header`, `main` with a "Skip to content" link; the current page has `aria-current="page"`.
- Every card is a `section` named by its title (`aria-labelledby`), so screen-reader users can jump between cards.
- Controls have accessible names (SearchField and FilterSelect require a `label`; icon-only parts are `aria-hidden`).
- FormField links label, hint and error to the control and sets `aria-invalid`; errors are text, not colour alone.
- Status tags always state the status in words; decorative dots, avatars and sparkline bars are hidden from assistive technology.
- Dialogs use Mantine Modal (focus trap, Esc, focus returned) and cannot be dismissed while saving.
- Sortable table headers hold a real button and carry `aria-sort`, so sorting works from the keyboard.
- Stepper exposes the current step with `aria-current="step"` and announces finished steps.
- LoadingState is a polite live region; ErrorState is an alert with a retry.
- Buttons and inputs are at least 44 px tall.

## Testing

Each component has a small React Testing Library test in its folder, named after behaviour ("sorts by the column key and returns to the first page") and using accessible queries (`getByRole`, `getByLabelText`). Component tests import `render` from `src/test/render.tsx`, which wraps the component in `ThemeProvider` with Mantine's test mode (no transitions, no portals). `src/test/setup.ts` adds the `matchMedia` and `ResizeObserver` stubs that Mantine and Recharts need in jsdom. Money formatting and parsing are unit-tested in `lib/money.test.ts`.

## Patterns adopted from the `frontend-patterns` skill

From the affaan-m/ecc `frontend-patterns` skill (read as reference only), we adopted what fits a presentational library:

- **Composition over inheritance**: TrayCard takes `title`, `extra`, `footer` and children; Dialog takes `footerNote` and `actions`; QuerySteps and StatTile are built from TrayCard's styles rather than extending it.
- **Render props** for FormField, so any control gets the `id`, `aria-describedby` and `aria-invalid` wiring.
- **Error boundary** around the app (and available per card) with a retry that resets it.
- **Code splitting with `lazy` + `Suspense`**, planned per route once screens exist.
- **Accessibility patterns**: keyboard support and focus management, which we get from Mantine for comboboxes and dialogs rather than hand-writing key handlers (FileDropzone is the one hand-written case: Enter and Space open the picker).
- **Controlled components**: DataTable, SegmentedControl, FilterSelect and SearchField are controlled; the parent owns the state.

Not adopted here: context + reducer stores, data-fetching hooks, virtualisation and animation libraries. The library has no data fetching, server-side pagination keeps lists at one page, and the design has no motion beyond Mantine's defaults. Data hooks belong to the screens and will be decided with them.

## Known trade-offs

- Mantine's full stylesheet is loaded (`styles.layer.css`, about 296 kB unminified CSS, 66 kB gzipped, in the current build). Importing only the used components' CSS would cut that; worth doing once the screens settle.
- The JavaScript bundle is about 278 kB minified (86 kB gzipped) for the whole current app, well under antd's 540 kB core. Screens should still be lazy-loaded per route.
- Mantine's Table does not sort or page by itself, so DataTable wires both (`DataTable.utils.ts` holds the ascending → descending → unsorted cycle).
- Mantine sets component variables (`--button-bg` …) inline, so CSS modules set real properties (`background`, `height`) rather than overriding those variables.
- MoneyInput keeps its own text after the first render (`defaultValueMinor`); to reset it, remount it with a new `key`.
