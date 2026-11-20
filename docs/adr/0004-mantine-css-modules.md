# ADR 0004: Mantine with CSS modules as the only styling mechanism

Status: accepted · 2026-11-20 · Supersedes [ADR 0003](0003-ui-library.md) · Details: [docs/ui.md](../ui.md)

## Context

ADR 0003 chose Ant Design v6. Building the component library on it showed two problems:

- **Two styling mechanisms.** antd components were styled through `ConfigProvider` theme tokens, and our own markup (AppShell, TrayCard, StatTile) through CSS modules. Both read the same token file, but a reader had to know which mechanism applied to which part.
- **Specificity fights.** antd's generated rules are more specific than a single class. Our dialog styles were silently ignored until they were moved into inline `styles` objects. Every further override would have needed the same workaround or `!important`.

There were no screens yet, only the component library, so changing library was still cheap.

Options considered:

1. **Keep antd** and add a rule never to target antd classes from CSS modules. Works, but keeps both mechanisms.
2. **Mantine 9.** Its documented way to style is CSS modules, applied per part through `classNames`. Its CSS ships in `@layer mantine`, so any unlayered rule wins. Covers Select, Modal, SegmentedControl, Pagination, Table, Loader.
3. **shadcn/ui + Tailwind.** One mechanism (utility classes), but adds Tailwind and more hand-assembly (data table, select).
4. **MUI or Chakra.** One mechanism, but runtime CSS-in-JS, and MUI's Material look fights the design.

Before deciding, a spike rebuilt Dialog and DataTable on Mantine behind the same props. The existing tests passed unchanged, except one: sorting moved from a clickable header cell to a real button inside the header, which is better for keyboard users.

## Decision

- Use **Mantine 9** (`@mantine/core`, `@mantine/hooks`) with its layered stylesheet, themed from `theme/tokens.ts` through `theme/mantineTheme.ts`.
- **Style everything with CSS modules.** Mantine parts get classes through `classNames`; nothing targets `.mantine-*` classes; no `!important`; inline styles only for values that come from props.
- Use Mantine where it brings behaviour (Modal, Select, SegmentedControl, Pagination, Table, Loader, Button). Use **plain markup** where a component is only layout and colour (StatusTag, FormField, FileDropzone, avatars, EmptyState, ErrorState).
- Use **Tabler icons** (`@tabler/icons-react`) in place of `@ant-design/icons`.
- Keep every component's props unchanged, so screens and stories did not have to change apart from antd parts used directly in stories.

## Consequences

- One way to style anything, and the cascade layer removes the specificity problem behind the dialog bug.
- Component tests render inside `ThemeProvider` through `src/test/render.tsx`, with Mantine's test mode turning off transitions and portals.
- DataTable wires sorting and paging itself (Mantine's Table is plain markup), about 25 more lines than the antd version.
- The full Mantine stylesheet is loaded; importing per-component CSS is a later optimisation.
- The JavaScript bundle for the whole current app is about 278 kB minified, down from antd's roughly 540 kB core alone.
- Mantine sets some component variables inline (`--button-bg` …), so CSS modules set real properties instead of those variables.
