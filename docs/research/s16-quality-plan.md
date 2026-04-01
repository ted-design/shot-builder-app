# Sprint S16: Quality & Consistency Overhaul

**Date:** 2026-04-01
**Status:** PLANNING — mockup + user approval required before implementation
**Branch:** TBD (off main after S15 PR merges)
**Prerequisite:** `docs/DESIGN_SYSTEM.md` is the enforcement document for all S16 work

---

## 1. Problem Statement

Sprint S15 shipped features (export builder, call sheet customization, view improvements) but didn't enforce system-level visual consistency. A live review revealed:

- **5 different view toggle implementations** with different icons, colors, and state management
- **4 different notes rendering patterns** causing raw HTML to display as text
- **[object Object] in table cells** from unhandled Firestore data types
- **Shoot readiness widget** with checkbox/text overlap, no per-colorway selection, no gender display
- **Talent detail cards** with cropped headshots (no edit), HTML in notes, text overflow
- **Tables far below Saturation benchmark** — no column resize, no keyboard nav, no field toggles
- **Call sheet** not approaching SetHero quality despite having the infrastructure

This is not a feature sprint. It's a **consolidation and quality sprint**.

---

## 2. Design System Enforcement

All S16 work must conform to `docs/DESIGN_SYSTEM.md`. This document was created as a result of this audit and codifies:

- Typography scale and semantic classes
- Mandatory CSS variable token usage (no raw Tailwind colors)
- Shared component inventory
- View toggle, search bar, table, and detail panel patterns
- Spacing standards and accessibility requirements

**Any code that violates DESIGN_SYSTEM.md will be rejected in code review.**

---

## 3. Phases

### Phase S16a: Critical Bug Fixes (1 day)

Fix every bug visible to users right now. No new features.

| # | Bug | File(s) | Fix |
|---|-----|---------|-----|
| 1 | ~~[object Object] in talent measurement cells~~ | TalentTable.tsx | ~~Extract primitive from nested objects~~ DONE in S15e |
| 2 | Raw HTML tags showing in talent notes | TalentDetailPanel.tsx | Detect HTML content, use SanitizedHtml when `<` found |
| 3 | Text overflow in talent detail fields | TalentDetailPanel.tsx | Add `truncate` / `min-w-0` / `break-words` as appropriate |
| 4 | Checkbox overlapping "colorway" text in shoot readiness | ShootReadinessWidget.tsx | Fix left padding, add proper spacing between checkbox and label |
| 5 | Gender displaying as "women"/"men" (lowercase) | TalentTable.tsx | Already has `genderLabel()` — check if it's being called; data may be "women" not "female" |
| 6 | Inconsistent view toggle active state colors | LibraryTalentPage, LibraryLocationsPage | Interim fix: use same Button variant pattern on both |

### Phase S16b: Shared Component Extraction (2 days)

Extract and unify patterns into reusable components.

#### S16b-1: ViewModeToggle Component
- New: `src-vnext/shared/components/ViewModeToggle.tsx`
- Props: `modes`, `activeMode`, `onChange`, `storageKey`
- State: `useSyncExternalStore` with localStorage
- Styling: `Button` component, `variant="default"` active / `variant="outline"` inactive
- Icons: standardized (LayoutGrid, Table2, LayoutList)
- Replace all 5 existing implementations

#### S16b-2: SearchBar Component
- New: `src-vnext/shared/components/SearchBar.tsx`
- Props: `value`, `onChange`, `placeholder`, `onClear?`
- Always includes Search icon (left), optional clear button (right)
- Consistent sizing: `max-w-sm flex-1 text-sm pl-9`
- Replace all 4 existing search implementations

#### S16b-3: Notes Renderer
- New: `src-vnext/shared/components/NotesDisplay.tsx`
- Auto-detects HTML content (checks for `<` tags)
- HTML content → `SanitizedHtml` component
- Plain text → `whitespace-pre-wrap` rendering
- Edit mode: unified inline textarea
- Replace: Talent InlineTextarea, Crew NotesSection, Location raw Textarea

#### S16b-4: Unified Section Card
- Standardize the `rounded-md border bg-surface p-4` pattern
- `label-meta` headers everywhere
- Consistent spacing within sections

### Phase S16c: Interactive Table System (3-5 days)

Bring tables to Saturation's level of interactivity.

#### S16c-1: Column Resize
- Drag handle between column headers
- Persist column widths in localStorage per table
- Minimum column width enforcement
- Cursor: `col-resize` on drag handle

#### S16c-2: Column Visibility Toggles (Saturation Pattern)
- **Eye icon** (`Eye` / `EyeOff`) per column in the column config UI
- Visible columns: normal icon opacity
- Hidden columns: grayed out (`opacity-40`) — visually distinct, not just absent
- Persist visibility in localStorage
- Some columns always visible (Name, primary identifier)
- Match Saturation's exact interaction pattern — screenshot and replicate

#### S16c-3: Column Reorder (Saturation Pattern)
- **Drag handle** (`GripVertical` icon) on each column entry in config UI
- Drag to reorder columns
- Use existing `@dnd-kit` dependency
- Persist order in localStorage
- Reset to defaults option

#### S16c-4: Keyboard Navigation
- Arrow keys navigate between cells
- Enter enters edit mode on editable cells
- Escape exits edit mode
- Tab moves to next editable cell
- Focus ring on active cell

#### S16c-5: Apply to All Tables
- TalentTable
- LocationsTable
- ShotsTable
- CrewTable (if table view exists)
- Export builder tables

### Phase S16d: Page-by-Page Consistency Sweep (2 days)

Apply shared components from S16b to every page. Verify DESIGN_SYSTEM.md compliance.

#### Checklist per page:
- [ ] View toggle uses `ViewModeToggle` component
- [ ] Search uses `SearchBar` component
- [ ] Notes use `NotesDisplay` component
- [ ] All colors use CSS variable tokens
- [ ] All typography uses semantic classes or named tokens
- [ ] Spacing follows standards (gap-6 page content, gap-5 sections)
- [ ] Empty states use `EmptyState` or `InlineEmpty`
- [ ] Status badges use canonical status token colors
- [ ] No raw Tailwind color classes

#### Pages to sweep:
1. LibraryTalentPage + TalentDetailPanel
2. LibraryCrewPage + CrewDetailSheet
3. LibraryLocationsPage + LocationDetailPage
4. LibraryPalettePage
5. ShotListPage + ShotCard + ShotsTable
6. ProductDetailPage + ProductWorkspaceNav
7. Dashboard (ProjectCard, ShootReadinessWidget)
8. ExportBuilderPage

### Phase S16e: Shoot Readiness Enhancement (2 days)

#### S16e-1: Layout Fix
- Fix checkbox/label overlap
- Proper spacing between selection UI and content

#### S16e-2: Per-Colorway Selection
- Expand product family to show individual colorways
- Per-colorway checkboxes
- "Select all" toggle per family
- Show colorway swatch + name

#### S16e-3: Gender Display
- Add gender badge to each product family row
- Use canonical gender badge colors (blue/purple/gray)

#### S16e-4: Sort/Filter Controls
- Sort by: urgency, name, launch date
- Filter by: urgency tier, gender, status
- Group by: urgency tier (default), category

### Phase S16f: Call Sheet Visual Upgrade (3-5 days)

Elevate the call sheet to match SetHero's quality. The infrastructure exists (section toggles, field customization, layout templates) but the visual execution needs work.

#### S16f-1: Research + Mockup
- Screenshot SetHero's call sheet at app.sethero.com
- Document every visual pattern: typography, spacing, color usage, section cards
- Create HTML mockup matching our data model but with SetHero-level polish

#### S16f-2: Typography & Spacing Overhaul
- Apply editorial typography (heading-page for title, heading-section for sections)
- Consistent section card styling
- Print-optimized layout (proper margins, page breaks)

#### S16f-3: Enhanced Section Rendering
- Talent/crew tables with sortable columns (reuse S16c table system)
- Weather section placeholder (future API integration)
- Schedule timeline with visual density improvements

### Phase S16g: Talent Detail Polish (1-2 days)

#### S16g-1: Headshot Edit
- Add crop/resize controls to headshot section
- Initial implementation: simple reposition within frame
- Full canvas editor deferred to S17

#### S16g-2: Notes HTML Rendering
- Apply NotesDisplay component (from S16b-3)
- Handle legacy `<p><span>` markup properly

#### S16g-3: Layout Polish
- **No premature truncation.** Layout must accommodate real-world values:
  - Agency: "Elite Model Management" (~24 chars) displays fully
  - Email: typical addresses display fully
  - Person names with suffixes display fully
- **URLs:** Replace raw URL text with link component (icon + domain text + editable href). Never show raw "https://toronto.elitemodel.com/~toronto/models/women/2244-ashley-allan" as plain text.
- Remove hardcoded `max-w-[200px]` constraints on text fields
- Consistent section card styling
- Responsive two-column layout

---

## 4. Acceptance Criteria (Aggregate)

- [ ] Every page uses `ViewModeToggle` component (no ad-hoc toggles)
- [ ] Every search bar uses `SearchBar` component
- [ ] Every notes field uses `NotesDisplay` component
- [ ] Zero raw Tailwind color classes in any new or modified code
- [ ] Tables support column resize, visibility toggles, and keyboard navigation
- [ ] Shoot readiness widget supports per-colorway selection with gender badges
- [ ] Call sheet visual quality matches SetHero benchmark
- [ ] Talent detail panel renders notes properly (no raw HTML)
- [ ] All view toggle active states use the same color treatment
- [ ] `docs/DESIGN_SYSTEM.md` is up-to-date with any new patterns
- [ ] Build clean, lint zero, all tests pass

---

## 5. Competitive Benchmarks

### Saturation (Tables)
- Column resize via drag handle
- Column visibility toggles
- Keyboard navigation between cells
- Inline editing with auto-save
- Clean, dense typography

### SetHero (Call Sheet)
- Editorial typography (light weights, generous whitespace)
- Section cards with configurable visibility
- Professional print layout
- Weather integration
- Clean status indicators

---

## 6. Constraints

1. **No new Firestore collections or fields** without approval
2. **No new npm dependencies** without approval (canvas editor deferred to S17)
3. **Build/lint/test must pass** after every change
4. **HTML mockups required** before implementation of S16c (tables) and S16f (call sheet)
5. **DESIGN_SYSTEM.md compliance** enforced in every code review
6. **Shared components first** — extract the component, then apply it everywhere
