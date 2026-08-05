# Order AI Design System — usage conventions

Internal admin/dashboard UI for a wine & glassware distributor (Korean B2B). Data-dense, calm, editorial. Build with the shipped components; style your own layout glue with the CSS custom properties below.

## Setup — no provider needed
These are plain React components with **no context/provider requirement**. The only requirement is that the shipped stylesheet is loaded: `styles.css` (it `@import`s `_ds_bundle.css`, which defines **both** the design tokens and the component classes). Render a component and it is styled.

Brand font is **Pretendard**, loaded at runtime by the host app (CDN); `--font-body`/`--font-display` fall back to the system sans-serif stack (incl. Apple SD Gothic Neo) when Pretendard isn't present. Do not hardcode font families — use `var(--font-body)`.

## Styling idiom — two layers, no utility classes
There is **no Tailwind / utility-class system**. Style in two ways only:

1. **Library components carry their own classes** — you never add class names to them, you pass props. `<Button variant="primary" size="lg">` emits `.btn .btn-primary .btn-lg` for you.
2. **For your own layout glue** (wrappers, grids, spacing between components), use the design **tokens as `var(--*)`** — never invent hex values or px scales.

Real token names (all defined in `_ds_bundle.css`):

| Group | Tokens |
|---|---|
| Brand / action | `--color-primary`, `--color-primary-dark`, `--action`, `--action-hover` |
| Text | `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-muted`, `--text-on-primary` |
| Surface / border | `--surface`, `--surface-muted`, `--surface-hover`, `--border-default`, `--border-subtle`, `--border-strong` |
| Status | `--color-success`, `--color-warning`, `--color-error`, `--color-info` |
| Type scale | `--text-xs`, `--text-sm`, `--text-base`, `--text-lg`, `--text-xl` … `--text-6xl` |
| Spacing | `--space-1` … `--space-16` |
| Radius / shadow | `--radius-sm/md/lg/xl/2xl/full`, `--shadow-xs/sm/md/lg/xl` |
| Fonts | `--font-body`, `--font-display` |

## Components
- **Button** — `variant`: primary | secondary | outline | ghost; `size`: sm | md | lg; `disabled`, `loading`.
- **Card** — `size`: sm | md | lg; `hover` (clickable affordance). Content goes in children.
- **PageHeader** — every page's top block: `eyebrow` (small caps label), `title`, `subtitle`, `actions` (put Buttons here).
- **Section** — a bordered content region: `title`, `meta`, `actions`, `bordered` (default true), `padding`: none | sm | md.
- **Stack** — fl: `direction` vertical | horizontal, `gap` (4–32), `align`, `justify` (incl. `between`), `fullWidth`.
- **Skeleton set** — `SkeletonBlock` (w/h/r), `ListSkeleton` (rows), `StatStripSkeleton` (cells), `TableSkeleton` (rows). Use instead of spinners.

## Where the truth is
Read `styles.css` (+ `_ds_bundle.css`) for the full token/class vocabulary, and each component's `.d.ts` (API) and `.prompt.md` (usage) before composing.

## Idiomatic snippet
```tsx
import { PageHeader, Section, Button, Card, Stack } from "order-ai";

<>
  <PageHeader eyebrow="Sales" title="거래처 분석"
    actions={<Button size="sm">새 견적</Button>} />
  <Section title="오늘의 수금" meta="3건">
    <Stack direction="vertical" gap={8}>
      <Card>
        <Stack direction="horizontal" justify="between" fullWidth>
          <span style={{ color: "var(--text-primary)" }}>스시소라 정자점</span>
          <span style={{ color: "var(--color-primary)", fontWeight: 700 }}>220,000원</span>
        </Stack>
      </Card>
    </Stack>
  </Section>
</>
```
