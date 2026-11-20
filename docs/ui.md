# UI foundation

How the web app's look and shared components are built. Decision records: [ADR 0004](adr/0004-mantine-css-modules.md) (Mantine and CSS modules), which supersedes [ADR 0003](adr/0003-ui-library.md) (Ant Design).
Designs: the Claude Design canvas "ACME Salary Management – UI Design" (Employees, Employee detail, Record salary change, Add employee, Insights, Ask AI, Access & roles, Import from Excel, and a Component library artboard that mirrors this document).

## Viewing the components

```bash
npm run ladle -w @acme/web         # component workshop at http://localhost:61000
npm run ladle:build -w @acme/web   # static build in apps/web/build
```

Components are shown in [Ladle](https://ladle.dev), a lightweight Storybook-compatible workshop. Stories live in `apps/web/src/stories/*.stories.tsx`, grouped in the sidebar by atomic level (Atoms, Molecules, Organisms, Templates) through each file's `export default { title: 'Level / Name' }`, and use synthetic data from `stories/sampleData.ts`. Every story renders inside the app's `ThemeProvider` (`apps/web/.ladle/components.tsx`), so it looks exactly like the app. Ladle's accessibility check and width switcher are enabled; the width switcher offers phone (375), tablet (768) and desktop (1440).

Screen stories live in `stories/screens/` under **Screens / …** (Employees, Employee detail, Employee form, Insights, Ask AI, Access & roles, Import from Excel). Each renders the screen's *view* inside the real AppShell (`ScreenFrame`, with the navigation that user would see) using API-shaped data from `stories/screenSampleData.ts`, and covers loading, empty, error and permission variants. They set `meta = { fullscreen: true }` so the global provider drops its 24 px padding.

Ladle bundles its own Vite version, so it has its own small config (`apps/web/.ladle/vite.config.ts`) instead of reading the app's. Stories are not part of the app bundle.

## Layout

```
apps/web/src/
  theme/          tokens.ts (source of truth), mantineTheme.ts, cssVariables.ts, ThemeProvider.tsx, fonts.ts
  lib/money.ts    minor-unit formatting and parsing (no floats)
  components/     atomic levels, one folder per component: Component.tsx, Component.test.tsx (+ .module.css, helpers)
    atoms/        single-purpose pieces: PillButton, StatusTag, MoneyText, MoneyInput, SegmentedControl, RangeBar, AppLink, IconButton, MeterBar
    molecules/    a few atoms or Mantine parts together: SearchField, FilterSelect, FormField, PersonCell, PayRangeRow, Stepper, FileDropzone, the three states, ChatMessage, TrayCard, StatTile, KeyValueList, Notice, CheckList, ChoiceChips, ChatComposer, RoleCard
    organisms/    self-contained sections: PageHeader, DataTable, Dialog, ConfirmDialog, QuerySteps, TrendChart, HistogramChart, ErrorBoundary
    templates/    page layout without data: AppShell
  stories/        Ladle stories and their sample data; screens/ holds the screen stories
  api/            client.ts (fetch + Zod parsing, ApiError), endpoints.ts (one typed function per endpoint), askStream.ts (SSE), useResource.ts
  session/        SessionProvider (loads /auth/me and /meta), useSession, permissions.ts (escalation rules from auth.md)
  lib/format.ts   dates, counts, labels
  app/            Routes.tsx (lazy route per screen), AppLayout, RequirePermission, navigation.tsx, RouterLink
  screens/        one folder per screen: <Name>View.tsx (props in, no fetching), <Name>Screen.tsx (container), dialogs, utils, CSS module
```

Screens live outside `components/` and are the only layer that fetches data.

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
| Skeleton (grey shimmer block; `circle`, `pill`, `inline` to sit on a real text line and keep its height; static under reduced motion) | own markup | every skeleton below; `PersonCellSkeleton`, `PayRangeRowSkeleton`, `RoleCardSkeleton` reuse their component's own CSS |
| LoadingState (skeleton shaped like the content: `table`, `list`, `chart`, `lines`, `answer`; draws after 150 ms, reserves its height at once) / EmptyState / ErrorState | Skeleton / own markup / own markup | every async card and table, Ask AI while an answer starts |
| PageSkeleton (status wrapper with the 150 ms delay; with `children` it lays out a screen's own skeleton, otherwise a generic `list`/`detail`/`form`/`dashboard`/`cards` sketch) | Skeleton + LoadingState | screen skeletons (`EmployeesSkeleton`, `EmployeeDetailSkeleton`, `InsightsSkeleton`, `AccessSkeleton`, `EmployeeFormSkeleton`), route chunks (`app/RouteSkeleton.tsx`), app start (`app/BootSkeleton.tsx`) |
| ErrorBoundary | React class component + ErrorState | wraps the app and each route |
| AppLink (internal link; renders the router's link through `LinkProvider`, a plain `<a>` in stories and tests) | own markup | PersonCell, PillButton `href`, AppShell, IconButton |
| IconButton (44 px round, required `label`, optional `href`) | own markup | Access & roles rows, role cards |
| MeterBar (decorative fill bar) | own markup | Insights headcount by country |
| KeyValueList (`dl`, rows or two-column grid) | own markup | Employee detail profile, Insights "at a glance" |
| Notice (`info`, `warning`, `accent`; named region with title and action) | own markup | Ask AI approval card, form errors, Import scope and result |
| CheckList (allowed / not allowed in words, not only icons) | own markup | RoleCard |
| ChoiceChips (checkbox pills in a fieldset) | own markup | Invite, Edit access countries, role permissions |
| ChatComposer (input, send button, hint linked by `aria-describedby`) | own markup | Ask AI |
| RoleCard (role summary, `hero` variant for Global HR) | CheckList | Access & roles |

Deliberately not built: a separate Timeline (salary history is a table in the designs), a Drawer wrapper (Edit access uses Dialog, which is a bottom sheet on phones, instead of the design's side TrayCard), and toasts (none of the designs show one; `@mantine/notifications` is the option if a screen needs it).

## Screens and routes

Routing uses `react-router` 8.5.1 (decision #28). Each screen is lazy-loaded in `app/Routes.tsx`, wrapped in `RequirePermission` and an ErrorBoundary per route. Navigation items are filtered by permission (`app/navigation.tsx`), and `/` redirects to the first page the user may open.

| Route | Screen | Needs |
| --- | --- | --- |
| `/employees` | Employees list (search, filters, sort, paging, export, add, import) | `employees:read` |
| `/employees/:id` | Employee detail, Record salary change (dialog), Terminate | `employees:read` |
| `/employees/new`, `/employees/:id/edit` | Add employee / Edit details | `employees:write` |
| `/employees/import` | Import from Excel (upload, match columns, review dry run, import, undo) | `imports:run` |
| `/insights` | Insights | `insights:read` |
| `/ask` | Ask AI (single column; queries folded; drafts open the salary change dialog) | `ai:ask` |
| `/access` | Access & roles (roles, team members, invite, edit access, role editor) | `users:manage` or `roles:manage` |

Loading never shows a spinner. A screen's first load shows that screen's own skeleton, built from its real components: the same PageHeader, card titles and footers, grids, column headers, field labels and permission-based buttons, with Skeleton placeholders only where data goes. Placeholders sit inline on the real text lines and table columns have fixed widths, so the skeleton and the loaded screen line up to the pixel; only data-dependent things differ (how many rows, whether a long name wraps). The first page load draws the real app frame (`BootSkeleton`) and assumes a user who can see everything until the session arrives. Tables take `skeletonRows` (and a `skeletonCard` for phones) and draw placeholder rows under their real headers. A card without its own skeleton shows a LoadingState in the card's shape, and `reload()` after a write keeps the current data on screen (`refreshing`) instead of going back to a skeleton. Skeletons wait 150 ms before drawing, so fast responses don't flash. Containers use `useResource(key, load)` with the functions in `api/endpoints.ts`; responses are parsed with the `@acme/shared` schemas, so a contract drift fails loudly. Actions inside a screen are gated with `useSession().can(...)`; the server enforces the same rules.

## Responsive layout

Styles are written mobile first: the base CSS targets a 390 px phone, then `@media (min-width: 768px)` (tablet) and `@media (min-width: 1024px)` (desktop). The values are `breakpoints` / `mediaQueries` in `theme/tokens.ts`.

- **Phone and tablet**: sticky top bar with logo and account, and the main navigation as a fixed bottom tab bar (Employees, Insights, Ask AI, Access). **Desktop**: the grey frame with the side navigation.
- DataTable renders a card list (`renderCard`) and a native Sort select below tablet width, and the table from 768 px. This is decided in JS (`useMediaQuery`) so only one of the two is in the DOM.
- Dialog is a bottom sheet on phones and a centred modal from 768 px; its actions are full width on phones.
- Touch targets are at least 44 px (pagination included) and no page scrolls horizontally; wide content such as the Stepper or segmented filters scrolls inside its own box.
- On phones, PillButton `small`, SearchField, FilterSelect (and their clear buttons) and the Dialog close button are 44 px; they drop to 36 px from 768 px. Inputs, including MoneyInput and the DataTable Sort select, use 16 px text on phones so iOS does not zoom.
- The bottom sheet keeps its actions in a sticky footer, so they stay on screen however long the form is.
- From 768 to 1023 px, DataTable shows the table; when it is wider than its card it scrolls inside the card with a visible scrollbar. Known gap: on the Employees and Team members tables at tablet width the salary/status and Edit columns start off-screen.
- From desktop width the white panel fits the window and only `<main>` scrolls, so the frame never runs off the bottom. `PageHeader` (with its optional `back` link) sticks to the top of `<main>`. A list page passes `fill` to its `TrayCard` and `DataTable`: the card takes the rest of the height (360 px minimum), the rows scroll under a sticky column header, and the summary and pagination stay at the bottom. Content fades out under the sticky headers and above the table footer instead of being cut. Phones and tablets keep normal page scrolling.
- The design canvas's Component library board mirrors this inventory, including a "Responsive patterns · phone" panel.

## Theming

- `theme/tokens.ts` holds every colour, radius, font, shadow and control size taken from the canvas: accent `#2E6B47`, greens `#3FA266`/`#9FD3B0`/`#EEF7F1`/`#F3FAF5`, greys `#111` to `#F4F4F4`, radii 8–22 px, Geist and Geist Mono.
- `theme/mantineTheme.ts` maps the tokens Mantine needs into its theme: the green scale as the `acme` primary colour, Geist fonts and the radii. Everything else about a component's look is in its CSS module.
- `theme/cssVariables.ts` exposes the same tokens as `--acme-*` custom properties on `:root` (portalled dialogs and dropdowns need them there), so CSS modules never repeat a hex value.
- `ThemeProvider` loads Mantine's layered CSS, wraps the app in `MantineProvider` and writes the `:root` variables. `App.tsx`, Ladle and the test `render` helper all use it.
- **Type scale** (`typeScale` in `theme/tokens.ts`, CSS `--acme-text-*` / `--acme-leading-*`): seven sizes in rem, each paired with a line height on a 4 px grid, the same steps as Tailwind's scale and close to IBM Carbon's productive scale. `xs` 12/16 for uppercase labels, tags, meta and helper text; `sm` 14/20 for body and UI text (the `body` default, usual for data-dense apps); `md` 16/24 for reading text (Ask AI answers), primary lines on phone cards and phone inputs (iOS zooms inputs under 16 px); `lg` 18/28 for small headings; `xl` 20/28; `xxl` 24/32 for page titles and key figures on phones; `xxxl` 30/36 from desktop width. CSS modules use only these variables (the one exception is the 9 px sort arrow, an icon). Mantine's `fontSizes` and `lineHeights` follow the same scale. rem units mean the browser's font-size setting scales the UI.
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

Each component has a small React Testing Library test in its folder, named after behaviour ("sorts by the column key and returns to the first page") and using accessible queries (`getByRole`, `getByLabelText`). Component tests import `render` from `src/test/render.tsx`, which wraps the component in `ThemeProvider` with Mantine's test mode (no transitions, no portals). `src/test/setup.ts` adds the `matchMedia` and `ResizeObserver` stubs that Mantine and Recharts need in jsdom. Money formatting and parsing are unit-tested in `lib/money.test.ts`. Screen views have their own tests next to them (rendering, interactions, permission gating, empty/error states); the jsdom `matchMedia` stub reports no match, so those tests see the phone layout (card lists). The API client, SSE parser, permission rules and stream reducer are unit-tested without React.

## Patterns adopted from the `frontend-patterns` skill

From the affaan-m/ecc `frontend-patterns` skill (read as reference only), we adopted what fits a presentational library:

- **Composition over inheritance**: TrayCard takes `title`, `extra`, `footer` and children; Dialog takes `footerNote` and `actions`; QuerySteps and StatTile are built from TrayCard's styles rather than extending it.
- **Render props** for FormField, so any control gets the `id`, `aria-describedby` and `aria-invalid` wiring.
- **Error boundary** around the app (and available per card) with a retry that resets it.
- **Code splitting with `lazy` + `Suspense`**, one chunk per route.
- **Accessibility patterns**: keyboard support and focus management, which we get from Mantine for comboboxes and dialogs rather than hand-writing key handlers (FileDropzone is the one hand-written case: Enter and Space open the picker).
- **Controlled components**: DataTable, SegmentedControl, FilterSelect and SearchField are controlled; the parent owns the state.

Not adopted here: context + reducer stores, data-fetching hooks, virtualisation and animation libraries. The library has no data fetching, server-side pagination keeps lists at one page, and the design has no motion beyond Mantine's defaults. Data hooks belong to the screens and will be decided with them.

## Known trade-offs

- Mantine's full stylesheet is loaded (`styles.layer.css`, about 296 kB unminified CSS, 66 kB gzipped, in the current build). Importing only the used components' CSS would cut that; worth doing once the screens settle.
- The JavaScript bundle is about 278 kB minified (86 kB gzipped) for the whole current app, well under antd's 540 kB core. Screens should still be lazy-loaded per route.
- Mantine's Table does not sort or page by itself, so DataTable wires both (`DataTable.utils.ts` holds the ascending → descending → unsorted cycle).
- Mantine sets component variables (`--button-bg` …) inline, so CSS modules set real properties (`background`, `height`) rather than overriding those variables.
- MoneyInput keeps its own text after the first render (`defaultValueMinor`); to reset it, remount it with a new `key`.
