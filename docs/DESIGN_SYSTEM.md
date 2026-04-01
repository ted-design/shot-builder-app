# Design System — Production Hub

This document codifies the visual and component patterns for the Production Hub vNext app. **Every UI implementation must conform to these patterns.** When a pattern isn't covered here, propose an addition before implementing an ad-hoc solution.

This file is referenced from `CLAUDE.md` Hard Rule #3 and must be consulted before writing any UI code.

---

## 1. Typography

### Scale (from tailwind.config.js)

| Token | Size | Use |
|-------|------|-----|
| `text-3xs` | 9px | Keyboard shortcut hints, micro badges |
| `text-2xs` | 10px | Secondary badges, timestamps, counts |
| `text-xxs` | 11px | Captions, meta labels, table secondary text |
| `text-xs` | 12px | Table body text, small UI labels |
| `text-sm` | 13px | Default body text, form inputs |
| `text-base` | 14px | Emphasized body, navigation items |
| `text-lg` | 16px | Section emphasis |

**Never use** `text-[10px]`, `text-[11px]`, `text-[13px]`, etc. Always use the named tokens above.

### Semantic Classes (from design-tokens.js)

| Class | Purpose | Weight |
|-------|---------|--------|
| `.heading-page` | Page titles | 300 (light, editorial) |
| `.heading-section` | Section headings within a page | 600 |
| `.heading-subsection` | Sub-section headings | 600 |
| `.label-meta` | Uppercase micro labels (section headers in detail panels) | 600, uppercase, tracking-wider |
| `.body-text` | Standard body copy | 400 |
| `.body-text-muted` | De-emphasized body copy | 400 |
| `.caption` | Footnotes, helper text | 400 |

**Rule:** Page headings MUST use `heading-page` (weight 300). Never `text-xl font-semibold` or `text-2xl font-bold`.

---

## 2. Colors

### Mandatory: CSS Variable Tokens Only

**Never use raw Tailwind colors** (`text-gray-400`, `border-gray-300`, `bg-zinc-800`, etc.). Always use CSS variable tokens:

| Instead of | Use |
|------------|-----|
| `text-gray-400` | `text-[var(--color-text-subtle)]` |
| `text-gray-500` | `text-[var(--color-text-muted)]` |
| `text-white` | `text-[var(--color-text)]` |
| `bg-zinc-800` | `bg-[var(--color-surface-subtle)]` |
| `bg-zinc-900` | `bg-[var(--color-surface)]` |
| `border-gray-300` | `border-[var(--color-border)]` |
| `border-gray-700` | `border-[var(--color-border)]` |

### Status Colors

Always use the status token system for badges:

```
--color-status-{gray|blue|green|amber|red|purple}-{bg|text|border}
```

Map to canonical status labels:
- **Draft** = gray
- **In Progress** = blue
- **On Hold** = amber
- **Shot** (complete) = green

### Gender Badge Colors
- Male = `--color-status-blue-*`
- Female / Non-Binary = `--color-status-purple-*`
- Other / Unknown = `--color-status-gray-*`

---

## 3. Shared Components — Mandatory Usage

These components exist and MUST be used. Do not create local variants.

### Page Structure
- `PageHeader` — every page's title bar (title, breadcrumbs, action buttons)
- `EmptyState` — full-page empty states (min-h-[200px], centered, icon + title + description + action)
- `InlineEmpty` — sub-section empty states (min-h-[120px], dashed border)
- `LoadingState` — loading with skeleton support and stuck detection
- `PageTransition` — route transition wrapper (CSS `fade-in-rise`)

### Forms & Inputs
- `Button` (from `@/ui/button`) — cva variants: default, destructive, outline, ghost, link, secondary. Sizes: default, sm, lg, icon.
- `Input` (from `@/ui/input`) — standard text input
- `Checkbox` (from `@/ui/checkbox`) — Radix checkbox
- `Select` / `SelectTrigger` / `SelectContent` — Radix select
- `Dialog` / `Sheet` — Radix dialog and sheet (with built-in enter/exit animations)

### Data Display
- `TagBadge` — tag rendering with category accent borders
- `Badge` (from `@/ui/badge`) — generic badge
- `ProductImage` — resolves Firebase Storage paths via `useStorageUrl`
- `Skeleton`, `ListPageSkeleton`, `TableSkeleton`, `DetailPageSkeleton` — loading skeletons

---

## 4. View Mode Toggle — Single Pattern

**There must be ONE view toggle pattern across the entire app.** Currently inconsistent; S16 will unify.

### Target Pattern (to be implemented in S16)

```tsx
<ViewModeToggle
  modes={[
    { key: "grid", icon: LayoutGrid, label: "Grid view" },
    { key: "table", icon: Table2, label: "Table view" },
  ]}
  activeMode={viewMode}
  onChange={setViewMode}
  storageKey="sb:talent-view"
/>
```

**Rules:**
- Active state: `variant="default"` (filled button)
- Inactive state: `variant="outline"`
- Icons: `LayoutGrid` for card/grid, `Table2` for table, `LayoutList` for list
- State persistence: `useSyncExternalStore` with localStorage (not raw useState + manual localStorage)
- Size: `size="icon"` (`h-9 w-9`) with `aria-label`

---

## 5. Search Bar — Single Pattern

### Target Pattern

```tsx
<div className="relative max-w-sm flex-1">
  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-subtle)]" />
  <Input
    placeholder="Search..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
    className="pl-9 text-sm"
  />
</div>
```

**Rules:**
- Always include Search icon (left-positioned)
- Use `pl-9` to accommodate icon
- Container: `relative max-w-sm flex-1`
- Text size: `text-sm`

---

## 6. Table Patterns

### Column Headers
- Font: `text-left font-medium` (inherit size from table context, typically text-xs or text-sm)
- Sortable headers: clickable with arrow indicators (ArrowUp/ArrowDown from Lucide)
- Non-sortable headers: plain `<th>`

### Cell Content
- Text values: `text-[var(--color-text-muted)]` for secondary data
- Empty values: `<span className="text-[var(--color-text-subtle)]">--</span>`
- Never display `[object Object]` — always extract primitive values from nested objects

### Table Container
```tsx
<div className="overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
  <table className="w-full text-sm">
```

---

## 7. Detail Panel / Sheet Pattern

### Headshot / Profile Image
- Container: `h-20 w-20 overflow-hidden rounded-md border`
- Image: `object-cover` for aspect ratio preservation
- Fallback: Initials in `text-2xs font-semibold`
- Actions: Upload + Remove buttons (future: Crop via canvas editor)

### Section Layout
- Sections use rounded border containers: `rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4`
- Section headers use `label-meta` class
- Two-column grid on desktop: `lg:grid-cols-2 gap-4`

### Notes Rendering
- If data contains HTML tags (legacy data): use `SanitizedHtml` component
- If data is plain text: use `InlineTextarea` for editing or `whitespace-pre-wrap` for display
- **Never render raw HTML as plain text** — always check for `<` in content and use `SanitizedHtml` when detected

---

## 8. Interaction Utilities (from tokens.css)

| Class | Effect | Use on |
|-------|--------|--------|
| `.hover-lift` | translateY(-2px) + shadow on hover | Cards (ShotCard, ProjectCard) |
| `.btn-press` | scale(0.97) on :active | All buttons (via cva base) |
| `.hover-glow` | border glow on hover | Bordered interactive rows |
| `.shimmer-bg` | gradient shimmer animation | Skeleton loading |
| `.stagger-children` | fade-in-rise with 50ms stagger | List items on initial render |

All interaction utilities respect `prefers-reduced-motion: reduce`.

---

## 9. Spacing Standards

| Context | Value | Token |
|---------|-------|-------|
| Page content gap (PageHeader to content) | 24px | `gap-6` |
| Section gap within page | 20px | `gap-5` |
| Card internal padding | 16-24px | `p-4` to `p-6` |
| Toolbar gaps | 8-12px | `gap-2` to `gap-3` |
| Form field gaps | 16px | `gap-4` |

---

## 10. Accessibility Requirements

- All interactive elements must have `aria-label` when icon-only
- Focus visible: handled by shadcn's `focus-visible:ring-1 focus-visible:ring-ring`
- Keyboard navigation: Tab order must be logical; Escape closes dialogs/sheets
- Color contrast: status badge text must meet WCAG AA against badge background
- Animations: all must respect `prefers-reduced-motion`

---

## Enforcement

Before implementing ANY UI component or page:

1. Check this document for the applicable pattern
2. Use the shared component if one exists (Section 3)
3. Use CSS variable tokens for all colors (Section 2)
4. Use semantic typography classes (Section 1)
5. If no pattern exists, propose one before implementing

**Violations found in code review must be fixed before merge.**
