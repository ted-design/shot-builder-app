# CHECKPOINT — Sprint S16 Complete (2026-04-01)

## Branch: `vnext/s15-ux-overhaul` — 35+ commits ahead of main

## S16 COMPLETE. All phases delivered.
## Build clean, lint zero. PR #376 open.

## S16 Summary (14 commits this sprint)

### S16a: Critical Bug Fixes
- Gender labels: "women"→Female, "men"→Male
- HTML notes: containsHtml() → SanitizedHtml rendering
- Checkbox overlap: absolute positioning → flex layout
- Text overflow: URL as link component, remove max-w-[200px]

### S16b: Shared Component Extraction
- ViewModeToggle: unified toggle replacing 3 ad-hoc implementations
- SearchBar: consistent search with icon + clear button
- usePersistedViewMode: useSyncExternalStore + localStorage
- Applied to all 4 library pages. 11 new tests.

### S16c: Interactive Table System
- Shared infrastructure: TableColumnConfig, useTableColumns, useColumnResize,
  useTableKeyboardNav, ColumnSettingsPopover, ResizableHeader (19 tests)
- Migrated 5/5 tables: ProductFamilies, Locations, Talent, Shots (bridge), CallSheetCast
- Saturation-pattern: eye icon visibility toggles, drag handles, resize, keyboard nav

### S16d: Consistency Sweep (8 issues)
- ViewModeToggle type="button", Checkbox component, WCAG semantics,
  write validation, URL link for editors, containsHtml shared utility,
  headshot text size, grid gap alignment

### S16e: Shoot Readiness Enhancement
- Expandable per-colorway selection with checkboxes
- Per-SKU requirement status (N needed / Done / No requirements)
- Gender badges on product families
- Sort dropdown (urgency/name/launch date)

### S16f: Call Sheet Visual Upgrade
- Typography: 16 hardcoded px sizes → CSS variable tokens
- Section headers: full-bleed dark bands (white text on dark bg)
- Spacing: hardcoded px → --space-* token references
- Crew call time: center zone background tint

### S16g: Talent Detail Polish
- Headshot: 80px → 112px, click-to-enlarge lightbox dialog
- Spacing: all sub-section grids unified to gap-4
- Overflow: name truncate at 260px, project pills at 220px with tooltip
- Tab bar: -mb-px for clean active border

## New Shared Infrastructure (S16)
- `shared/components/ViewModeToggle.tsx`
- `shared/components/SearchBar.tsx`
- `shared/components/ColumnSettingsPopover.tsx`
- `shared/components/ResizableHeader.tsx`
- `shared/hooks/usePersistedViewMode.ts`
- `shared/hooks/useTableColumns.ts`
- `shared/hooks/useColumnResize.ts`
- `shared/hooks/useTableKeyboardNav.ts`
- `shared/types/table.ts`
- `shared/lib/textUtils.ts` (containsHtml)

## Design System
- `docs/DESIGN_SYSTEM.md` created and enforced from CLAUDE.md Hard Rule #3
- Covers: typography, colors, shared components, table patterns (Saturation), spacing, accessibility
