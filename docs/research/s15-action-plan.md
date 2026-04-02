# Sprint S15: Action Plan — UX Overhaul & Competitive Parity

**Date:** 2026-04-01
**Status:** PROPOSED — awaiting user approval before implementation
**Branch:** `vnext/s15-ux-overhaul`
**Research inputs:** `saturation-export-builder.md`, `sethero-callsheet.md`, `kobolabs-plm.md`, `internal-ux-audit.md`

---

## 1. Executive Summary

Four research streams converged on a clear picture of where Production Hub stands and where it needs to go. The internal UX audit catalogued every gap in the current codebase; three competitive analyses (Saturation, SetHero, KoboLabs) revealed the patterns that best-in-class tools use to solve the same problems.

### User-Reported Pain Points

| Area | Pain | Evidence |
|------|------|----------|
| **Shoot Readiness** | No SKU-level selection from readiness widget; priority system is confidence-based but not surfaced as actionable urgency tags | UX audit Section 3 — selection only at family level, no priority field on shots |
| **Shots** | No batch delete; three view modes exist but gallery and visual are near-duplicates; table functional but lacks inline editing beyond status | UX audit Sections 1-2 — `selectedIds` state exists but no delete action wired |
| **Exports** | Fixed templates with only 4 toggles (orientation, hero, description, notes) — far behind Saturation's block-based, variable-powered, multi-page PDF builder | UX audit Section 6 vs Saturation analysis Section 12 |
| **General Polish** | No page transition animations (instant route swaps), no image editing (upload only), app does not yet feel "premium" | UX audit Sections 5, 8 — no framer-motion, no crop/canvas |
| **Library** | Talent and locations lack table views; talent is grid-only, locations is list-only; no batch operations on either | UX audit Section 7 — shots have 3 views, library entities have 1 |
| **Call Sheet** | No section toggles, no per-field customization, no layout templates — SetHero's call sheet builder is significantly more flexible | SetHero analysis Section 9 — 12 feature gaps identified |

### What We Do Well (Preserve)

- Soft-delete pattern with typed "DELETE" confirmation (safe, reversible)
- Three-view system for shots with 12 toggleable field properties
- Sophisticated confidence-based readiness computation (not simple tags)
- Comprehensive call sheet builder with editorial design language
- Real-time Firestore subscriptions with aggressive unsubscribe on unmount
- Clean component architecture (AppShell 85 lines, 11 sidebar components)
- 2488 tests passing, build clean, lint zero warnings

---

## 2. Prioritized Feature List

### Ranking Criteria

- **User Impact:** How directly does this fix a reported pain point? (1-5, where 5 = blocks daily workflow)
- **Complexity:** Implementation effort (1-5, where 5 = full week)
- **Risk:** Could this break existing functionality? (1-5, where 5 = high regression risk)

### P0 — Quick Wins (High Impact, Low Risk, 1-2 Days Total)

| # | Feature | User Impact | Complexity | Risk | Rationale |
|---|---------|-------------|------------|------|-----------|
| 1 | **Shot batch delete** | 5 | 1 | 1 | Selection state (`selectedIds`) already exists in ShotListPage. Wire `softDeleteShot` in a loop with `writeBatch` + confirmation dialog. Pattern proven in single-delete. |
| 2 | **Priority tag rework** | 4 | 2 | 1 | Rework shootReadiness confidence logic so products PAST launch date get OVERDUE (highest urgency, red) instead of LOW. Add urgency tiers: OVERDUE / URGENT / SOON / UPCOMING / UNSCHEDULED. |
| 3 | **Page transitions** | 3 | 1 | 1 | CSS-only fade-in animation on route changes. No new deps — use CSS `@keyframes` + React key prop on route wrapper. Improves perceived performance immediately. |
| 4 | **View consolidation** | 2 | 1 | 1 | Gallery and visual views are near-duplicates. Merge into single "card" view with density toggle (compact/expanded). Reduces ViewMode from 3 options to 2. |

### P1 — Medium Effort, High Impact (2-5 Days Total)

| # | Feature | User Impact | Complexity | Risk | Rationale |
|---|---------|-------------|------------|------|-----------|
| 5 | **Table views for talent/locations** | 4 | 2 | 1 | Shots already have ShotsTable as a proven pattern. Replicate for talent (columns: name, agency, gender, measurements) and locations (name, address, phone, notes). Enables batch operations. |
| 6 | **SKU-level selection in readiness widget** | 3 | 2 | 2 | ShootReadinessWidget currently selects at family level. Add expandable SKU rows with per-SKU checkboxes. BulkAddToProjectDialog already supports SKU granularity — just need to expose it in the widget. |
| 7 | **Shots table inline editing** | 4 | 3 | 2 | ShotsTable has inline status editing. Extend to title, tags, location, talent via click-to-edit cells. Matches Saturation inline editing pattern. |
| 8 | **Product section enrichment** | 3 | 2 | 1 | KoboLabs pattern: show linked shots, completion status, contextual actions on product detail views. Add "Shots" tab to ProductDetailPage showing shots referencing this product. |

### P2 — Larger Redesigns, Medium Impact (5-10 Days Total)

| # | Feature | User Impact | Complexity | Risk | Rationale |
|---|---------|-------------|------------|------|-----------|
| 9 | **Export builder redesign** | 4 | 5 | 3 | Saturation-inspired block-based PDF composition. Replace fixed template export with drag-and-drop page builder. Requires new route, block model, WYSIWYG preview. Largest single feature. |
| 10 | **Call sheet section toggles + field customization** | 3 | 3 | 2 | SetHero pattern: show/hide sections, rename/reorder/resize columns per section. Requires refactoring call sheet builder to treat sections as configurable objects. |
| 11 | **Call sheet layout templates** | 3 | 2 | 2 | Save/load call sheet configurations. Requires storage model for layout definitions (localStorage initially, Firestore later). Depends on section toggle system (#10). |
| 12 | **Image cropping** | 3 | 3 | 2 | Crop dialog for hero images. Canvas-based with aspect ratio presets. May need lightweight library (approval required). |

### P3 — Future/Aspirational (Backlog)

| # | Feature | User Impact | Complexity | Risk | Rationale |
|---|---------|-------------|------------|------|-----------|
| 13 | **Variable/token system for exports** | 3 | 4 | 2 | Dynamic variables (project name, dates, page numbers) in text blocks. Depends on export builder (#9). |
| 14 | **Weather integration for call sheets** | 2 | 3 | 1 | SetHero auto-populates weather for shoot location + date. Requires external API. |
| 15 | **Multi-report per project** | 2 | 3 | 2 | Saturation pattern: multiple saved export configurations per project. Depends on export builder (#9). |
| 16 | **Production reports** | 2 | 4 | 2 | SetHero's post-shoot day summary. New entity type, new route. |
| 17 | **Call sheet shareable preview URL** | 2 | 2 | 2 | SetHero pattern: dedicated preview link for stakeholders. |
| 18 | **AI-suggested shot types** | 2 | 4 | 1 | KoboLabs AI pattern: suggest shot types by product category. Future roadmap. |
| 19 | **Full canvas image editor** | 2 | 5 | 3 | Drawing tools, annotations, filters. Cropping (#12) covers 80% of the need. |

---

## 3. Phase Breakdown

### Phase S15a: Quick Wins (1-2 Days)

**Goal:** Ship the four highest-impact, lowest-risk improvements. Each is independent and can be committed separately.

#### S15a-1: Shot Batch Delete

Wire the existing `selectedIds` state in ShotListPage to a batch delete action.

- [ ] **S15a-1a:** Add "Delete selected" button to selection toolbar in `ShotListPage.tsx`
- [ ] **S15a-1b:** Create `batchSoftDeleteShots()` in `shotLifecycleActions.ts` — use `writeBatch` with soft-delete pattern (sets `deleted: true`, `deletedAt`, `updatedAt`, `updatedBy`)
- [ ] **S15a-1c:** Confirmation dialog showing count ("Delete 7 shots?") with typed "DELETE" confirmation (reuse existing pattern from `ShotLifecycleActionsMenu`)
- [ ] **S15a-1d:** Toast with undo hint ("7 shots deleted. Deleted shots can be recovered by an admin.")
- [ ] **S15a-1e:** Clear selection after successful delete
- [ ] **S15a-1f:** Tests for batch delete (unit: `batchSoftDeleteShots`, component: dialog + confirmation flow)

**Files to modify:**
- `src-vnext/features/shots/components/ShotListPage.tsx` — add delete action to selection bar
- `src-vnext/features/shots/lib/shotLifecycleActions.ts` — add `batchSoftDeleteShots()`
- New: `src-vnext/features/shots/components/BatchDeleteDialog.tsx` — confirmation UI (or inline in ShotListPage)
- `src-vnext/features/shots/lib/__tests__/shotLifecycleActions.test.ts` — unit tests

**Acceptance criteria:**
- [ ] User can select multiple shots via checkboxes and delete them in one action
- [ ] Confirmation requires typing "DELETE"
- [ ] Deleted shots are soft-deleted (not permanently removed)
- [ ] Toast confirms count of deleted shots
- [ ] Selection clears after successful delete
- [ ] Build clean, lint zero, tests pass

---

#### S15a-2: Priority Tag Rework

Rework the confidence-based readiness computation to surface urgency tiers with clear visual language.

- [ ] **S15a-2a:** Add urgency tier computation in `shootReadiness.ts`: OVERDUE (past launch date), URGENT (0-7 days), SOON (7-14 days), UPCOMING (14-30 days), UNSCHEDULED (no date)
- [ ] **S15a-2b:** Update `ShootReadinessWidget.tsx` to display urgency badges with distinct colors: OVERDUE=red, URGENT=amber, SOON=blue, UPCOMING=green, UNSCHEDULED=gray
- [ ] **S15a-2c:** Ensure "Deadline has passed" constraint now shows OVERDUE instead of LOW confidence
- [ ] **S15a-2d:** Add urgency tier to `ShootWindow` type (or parallel type)
- [ ] **S15a-2e:** Tests for urgency computation (past date, imminent, upcoming, no date)

**Files to modify:**
- `src-vnext/features/products/lib/shootReadiness.ts` — urgency tier computation
- `src-vnext/features/dashboard/components/ShootReadinessWidget.tsx` — urgency badge display
- `src-vnext/features/products/lib/__tests__/shootReadiness.test.ts` — urgency tests

**Acceptance criteria:**
- [ ] Product 5 days past launch shows red "OVERDUE" badge (not "low" confidence)
- [ ] Product 3 days until launch shows amber "URGENT" badge
- [ ] Products with no date show gray "UNSCHEDULED"
- [ ] Existing confidence system still functions (urgency is complementary, not a replacement)
- [ ] Build clean, lint zero, tests pass

---

#### S15a-3: Page Transitions

Add subtle fade-in animation on route changes. CSS-only, no new dependencies.

- [ ] **S15a-3a:** Create `RouteTransition.tsx` wrapper with CSS fade-in animation (200ms ease-in, keyed on `location.pathname`)
- [ ] **S15a-3b:** Wrap route outlet in `AppShell.tsx` with `RouteTransition`
- [ ] **S15a-3c:** Add `@keyframes fadeIn` to `tokens.css` (opacity 0 to 1, optional translateY 4px to 0)
- [ ] **S15a-3d:** Verify transitions work on mobile (no jank, no layout shift)
- [ ] **S15a-3e:** Test that navigation still works correctly (back/forward, deep links)

**Files to modify:**
- New: `src-vnext/shared/components/RouteTransition.tsx`
- `src-vnext/shared/components/AppShell.tsx` — wrap `<Outlet />` with transition
- `tokens.css` — add fade keyframes

**Acceptance criteria:**
- [ ] Route changes have a visible but subtle fade-in (200ms)
- [ ] No animation jank on mobile
- [ ] Back/forward browser navigation works correctly
- [ ] No new npm dependencies added
- [ ] Build clean, lint zero, tests pass

---

#### S15a-4: View Consolidation (Gallery + Visual Merge)

Merge the near-duplicate gallery and visual views into a single "card" view with a density toggle.

- [ ] **S15a-4a:** Rename `ViewMode` from `"gallery" | "visual" | "table"` to `"card" | "table"`
- [ ] **S15a-4b:** Add `cardDensity` setting (`"compact" | "expanded"`) to display preferences
- [ ] **S15a-4c:** Merge `ShotCard.tsx` and `ShotVisualCard.tsx` into a single component that renders compact or expanded based on density
- [ ] **S15a-4d:** Update `ShotListToolbar.tsx` view mode selector (2 options instead of 3)
- [ ] **S15a-4e:** Add localStorage migration (old "gallery"/"visual" values map to "card")
- [ ] **S15a-4f:** Delete `ShotVisualCard.tsx` after successful merge
- [ ] **S15a-4g:** Update keyboard shortcuts (remove separate gallery/visual hotkeys, unify to single card toggle)
- [ ] **S15a-4h:** Tests (view mode switch, density toggle, localStorage migration)

**Files to modify:**
- `src-vnext/features/shots/lib/shotListFilters.ts` — `ViewMode` type change
- `src-vnext/features/shots/components/ShotCard.tsx` — add density prop, absorb ShotVisualCard features
- `src-vnext/features/shots/components/ShotVisualCard.tsx` — DELETE after merge
- `src-vnext/features/shots/components/ShotListPage.tsx` — update view rendering logic
- `src-vnext/features/shots/components/ShotListToolbar.tsx` — update view selector buttons
- `src-vnext/features/shots/components/ShotListDisplaySheet.tsx` — add density toggle

**Acceptance criteria:**
- [ ] ViewMode is `"card" | "table"` (2 options, not 3)
- [ ] Card view has compact and expanded density toggle
- [ ] Compact = current gallery layout; expanded = current visual layout
- [ ] Old localStorage values ("gallery"/"visual") gracefully migrate to "card"
- [ ] `ShotVisualCard.tsx` is deleted
- [ ] Build clean, lint zero, tests pass

---

### Phase S15a Acceptance Criteria (aggregate)

- [ ] All 4 sub-features working independently
- [ ] Build clean, lint zero warnings, all tests pass
- [ ] No visual regressions on existing pages

---

### Phase S15b: View Improvements (2-3 Days)

**Goal:** Table views for library entities, shots table inline editing, SKU-level readiness selection. Builds on proven ShotsTable patterns.

**Dependencies:** None (independent of S15a).

#### S15b-1: Talent Table View

- [ ] **S15b-1a:** HTML mockup for talent table layout (columns: headshot, name, agency, gender, key measurements)
- [ ] **S15b-1b:** User approval on mockup
- [ ] **S15b-1c:** Create `TalentTable.tsx` component (reuse ShotsTable patterns: sortable columns, row selection checkboxes)
- [ ] **S15b-1d:** Add view mode toggle to `LibraryTalentPage.tsx` (`"grid" | "table"`)
- [ ] **S15b-1e:** Persist view preference in localStorage
- [ ] **S15b-1f:** Tests (render, sort, view toggle)

**Files to modify:**
- New mockup: `mockups/s15b-talent-table.html`
- New: `src-vnext/features/library/components/TalentTable.tsx`
- `src-vnext/features/library/components/LibraryTalentPage.tsx` — view mode state + conditional render

**Acceptance criteria:**
- [ ] Talent page has grid and table view toggle
- [ ] Table shows headshot thumb, name, agency, gender, key measurements
- [ ] Columns are sortable by clicking headers
- [ ] View preference persists in localStorage
- [ ] Build clean, lint zero, tests pass

---

#### S15b-2: Locations Table View

- [ ] **S15b-2a:** HTML mockup for locations table layout (columns: photo, name, address, phone, notes preview)
- [ ] **S15b-2b:** User approval on mockup
- [ ] **S15b-2c:** Create `LocationsTable.tsx` component
- [ ] **S15b-2d:** Add view mode toggle to `LibraryLocationsPage.tsx` (`"list" | "table"`)
- [ ] **S15b-2e:** Persist view preference in localStorage
- [ ] **S15b-2f:** Tests (render, sort, view toggle)

**Files to modify:**
- New mockup: `mockups/s15b-locations-table.html`
- New: `src-vnext/features/library/components/LocationsTable.tsx`
- `src-vnext/features/library/components/LibraryLocationsPage.tsx` — view mode state + conditional render

**Acceptance criteria:**
- [ ] Locations page has list and table view toggle
- [ ] Table shows photo thumb, name, address, phone, notes preview
- [ ] Columns are sortable
- [ ] View preference persists in localStorage
- [ ] Build clean, lint zero, tests pass

---

#### S15b-3: SKU-Level Selection in Shoot Readiness Widget

- [ ] **S15b-3a:** Add expandable SKU rows under each product family in `ShootReadinessWidget.tsx`
- [ ] **S15b-3b:** Per-SKU checkboxes that feed into existing `useProductSelection` hook
- [ ] **S15b-3c:** "Select all SKUs" toggle per family (convenience shortcut)
- [ ] **S15b-3d:** Visual indicator showing selected count vs total SKUs
- [ ] **S15b-3e:** Enrich expanded rows with gender, colorway swatch, launch date
- [ ] **S15b-3f:** Tests (expand, select individual SKU, select all, bulk add with SKU granularity)

**Files to modify:**
- `src-vnext/features/dashboard/components/ShootReadinessWidget.tsx` — expandable SKU rows + selection
- `src-vnext/features/products/hooks/useProductSelection.ts` — already supports SKU selection IDs (no changes expected)

**Acceptance criteria:**
- [ ] User can expand a product family to see individual SKUs
- [ ] Individual SKUs can be selected/deselected with checkboxes
- [ ] "Select all" toggles all SKUs in a family
- [ ] Selected SKUs feed into BulkAddToProjectDialog with SKU granularity
- [ ] Build clean, lint zero, tests pass

---

#### S15b-4: Shots Table Inline Editing

- [ ] **S15b-4a:** Click-to-edit on title cell (reuse InlineEdit pattern from crew/locations)
- [ ] **S15b-4b:** Click-to-edit on tags cell (tag picker popover)
- [ ] **S15b-4c:** Click-to-edit on location cell (location picker popover)
- [ ] **S15b-4d:** Click-to-edit on talent cell (talent picker popover)
- [ ] **S15b-4e:** Auto-save on blur/confirm (debounced Firestore write, same pattern as shot detail)
- [ ] **S15b-4f:** Tests (inline edit title, change tag, change location)

**Files to modify:**
- `src-vnext/features/shots/components/ShotsTable.tsx` — inline edit cells
- May need new: `src-vnext/features/shots/components/InlineEditCell.tsx` — wrapper component

**Acceptance criteria:**
- [ ] Title, tags, location, and talent are editable inline in the table
- [ ] Changes auto-save on blur
- [ ] Editing state is visually distinct (input border, focus ring)
- [ ] Tab key moves between editable cells
- [ ] Build clean, lint zero, tests pass

---

### Phase S15b Acceptance Criteria (aggregate)

- [ ] Talent and locations both have table views
- [ ] Shoot readiness widget supports SKU-level selection
- [ ] Shots table supports inline editing of 4 fields
- [ ] Build clean, lint zero, tests pass

---

### Phase S15c: Export Builder Redesign (3-5 Days)

**Goal:** Replace the fixed-template PDF export with a block-based composition system inspired by Saturation. This is the largest single feature in S15.

**Dependencies:** None (independent of S15a/S15b). Must be preceded by HTML mockups and user approval.

**Note:** This is a desktop-only feature. Add `RequireDesktop` guard on the route.

#### S15c-1: Foundation — Block Model + Route

- [ ] **S15c-1a:** HTML mockup for export builder (left sidebar with block palette, center WYSIWYG preview on dark background, right settings panel)
- [ ] **S15c-1b:** User approval on mockup
- [ ] **S15c-1c:** Define block type system in `exportBuilderTypes.ts`:
  - `TextBlock` — free-form text content
  - `ImageBlock` — uploaded image or project hero
  - `ShotGridBlock` — grid/table of shots with thumbnails (pulls from project shots)
  - `ShotDetailBlock` — single shot card (image + metadata)
  - `ProductTableBlock` — product list with SKU details
  - `CrewListBlock` — crew roster table
  - `TalentGridBlock` — talent headshots + names
  - `DividerBlock` — horizontal rule
  - `PageBreakBlock` — force new page
- [ ] **S15c-1d:** Create `ExportBuilderPage.tsx` route at `/projects/:id/export` with `RequireDesktop` guard
- [ ] **S15c-1e:** Add "Export Builder" to project sidebar nav (between Call Sheet and Settings)
- [ ] **S15c-1f:** Block palette sidebar component (`BlockPalette.tsx`)
- [ ] **S15c-1g:** Tests (route renders, block types defined, RequireDesktop guard)

**Files to modify:**
- New: `src-vnext/features/export/lib/exportBuilderTypes.ts`
- New: `src-vnext/features/export/components/ExportBuilderPage.tsx`
- New: `src-vnext/features/export/components/BlockPalette.tsx`
- `src-vnext/app/routes.tsx` — add export builder route
- Sidebar nav config — add Export Builder entry

**Acceptance criteria:**
- [ ] Export builder route renders at `/projects/:id/export`
- [ ] Redirects to dashboard on mobile with toast (RequireDesktop)
- [ ] Block palette shows all 9 block types with icons and labels
- [ ] Block type definitions include all required configuration properties
- [ ] Build clean, lint zero, tests pass

---

#### S15c-2: WYSIWYG Preview + Block Rendering

- [ ] **S15c-2a:** Page canvas component (`PageCanvas.tsx`) — white page on dark background, letter-size aspect ratio
- [ ] **S15c-2b:** Block renderers for each type (one component per block type in `blocks/` directory)
- [ ] **S15c-2c:** Drag-and-drop from palette to canvas (use existing `@dnd-kit` — already installed)
- [ ] **S15c-2d:** Block reorder within page (drag handle on left edge of each block)
- [ ] **S15c-2e:** Block selection (click to select, blue border highlight, settings panel appears)
- [ ] **S15c-2f:** Block deletion ("Delete Block" red button at bottom of settings panel)
- [ ] **S15c-2g:** Multi-page support (vertical stack of pages, "+" button between pages, page delete via three-dot menu)
- [ ] **S15c-2h:** Tests (render blocks, drag-and-drop, reorder, delete)

**Files to modify:**
- New: `src-vnext/features/export/components/PageCanvas.tsx`
- New: `src-vnext/features/export/components/blocks/TextBlockRenderer.tsx`
- New: `src-vnext/features/export/components/blocks/ShotGridBlockRenderer.tsx`
- New: `src-vnext/features/export/components/blocks/ProductTableBlockRenderer.tsx`
- New: (one renderer per block type)
- New: `src-vnext/features/export/lib/exportBuilderState.ts` — document state management (useReducer)

**Acceptance criteria:**
- [ ] Canvas displays a white page on dark background
- [ ] Blocks can be dragged from palette onto canvas
- [ ] Blocks can be reordered within a page via drag handle
- [ ] Blocks can be selected (blue highlight) and deleted
- [ ] Multiple pages supported with page breaks
- [ ] Build clean, lint zero, tests pass

---

#### S15c-3: Block Settings + Data Binding

- [ ] **S15c-3a:** Settings panel (`BlockSettingsPanel.tsx`) — appears in right sidebar when a block is selected
- [ ] **S15c-3b:** Text block settings: font size (dropdown), text alignment (left/center/right), margin/padding (4 fields each)
- [ ] **S15c-3c:** Shot grid block settings: column toggles (shot number, title, status, hero thumb, tags, etc.), row limit, sort order
- [ ] **S15c-3d:** Product table block settings: column toggles (name, category, SKU count, status)
- [ ] **S15c-3e:** Data blocks auto-populate from Firestore subscriptions (read project shots/products/talent/crew only when block is on canvas)
- [ ] **S15c-3f:** Page settings panel: orientation (portrait/landscape toggle), page size (letter/A4 dropdown)
- [ ] **S15c-3g:** Tests (settings change reflected in preview, column toggle, data binding)

**Files to modify:**
- New: `src-vnext/features/export/components/BlockSettingsPanel.tsx`
- New: `src-vnext/features/export/components/PageSettingsPanel.tsx`

**Acceptance criteria:**
- [ ] Selecting a block shows its settings in the right panel
- [ ] Text block settings control font size, alignment
- [ ] Data blocks (shots, products) pull live data from Firestore
- [ ] Column toggles show/hide columns in data blocks
- [ ] Page orientation and size are configurable
- [ ] Build clean, lint zero, tests pass

---

#### S15c-4: PDF Generation + Template System

- [ ] **S15c-4a:** PDF renderer using existing `@react-pdf/renderer` (map block model to PDF components)
- [ ] **S15c-4b:** "Export PDF" button that generates and downloads the document
- [ ] **S15c-4c:** WYSIWYG preview fidelity — what you see on screen matches the PDF output
- [ ] **S15c-4d:** Built-in templates: "Shot List" (grid of shots), "Lookbook" (hero images with details), "Pull Sheet" (product table), "Contact Sheet" (thumbnail grid)
- [ ] **S15c-4e:** "Save as template" — persist layout configuration to localStorage (Firestore in future sprint)
- [ ] **S15c-4f:** Template picker dialog (choose from saved or built-in templates)
- [ ] **S15c-4g:** Tests (PDF blob generation, template save/load, template picker)

**Files to modify:**
- New: `src-vnext/features/export/lib/exportPdfRenderer.ts`
- New: `src-vnext/features/export/components/TemplatePicker.tsx`
- New: `src-vnext/features/export/lib/exportTemplates.ts` — built-in template definitions

**Acceptance criteria:**
- [ ] Export button generates a PDF that matches the WYSIWYG preview
- [ ] 4 built-in templates available (Shot List, Lookbook, Pull Sheet, Contact Sheet)
- [ ] User can save current block layout as a named template
- [ ] Templates can be loaded from the template picker
- [ ] Build clean, lint zero, tests pass

---

### Phase S15c Acceptance Criteria (aggregate)

- [ ] Block-based export builder available at `/projects/:id/export`
- [ ] 9 block types available in the palette
- [ ] Drag-and-drop composition with WYSIWYG preview
- [ ] PDF export matches preview
- [ ] 4 built-in templates + save/load custom templates
- [ ] Build clean, lint zero, tests pass

---

### Phase S15d: Call Sheet Improvements (2-3 Days)

**Goal:** SetHero-inspired section customization and layout templates for the call sheet builder.

**Dependencies:** None (independent of other S15 phases).

#### S15d-1: Section Toggle System

- [ ] **S15d-1a:** HTML mockup for call sheet outline with section toggles (on/off switches per section: Header, Day Details, Schedule, Talent, Crew, Notes)
- [ ] **S15d-1b:** User approval on mockup
- [ ] **S15d-1c:** Add `visible` boolean per section in call sheet configuration state
- [ ] **S15d-1d:** Toggle switches in the call sheet builder sidebar/outline (eye icon or Switch component)
- [ ] **S15d-1e:** Hidden sections do not render in preview or PDF output
- [ ] **S15d-1f:** Tests (toggle on/off, verify hidden sections not in preview, verify not in PDF)

**Files to modify:**
- New mockup: `mockups/s15d-callsheet-toggles.html`
- `src-vnext/features/callsheet/` — section visibility state
- `src-vnext/features/callsheet/components/` — toggle UI in outline/sidebar

**Acceptance criteria:**
- [ ] Each call sheet section has a visible/hidden toggle
- [ ] Hidden sections do not appear in the live preview
- [ ] Hidden sections do not appear in the exported/printed PDF
- [ ] Toggle state persists (localStorage or schedule document)
- [ ] Build clean, lint zero, tests pass

---

#### S15d-2: Per-Section Field Customization

- [ ] **S15d-2a:** HTML mockup for "Edit Section" modal (per-field controls: drag reorder, rename label, width selector, show/hide toggle, reset to default)
- [ ] **S15d-2b:** User approval on mockup
- [ ] **S15d-2c:** Create `EditSectionModal.tsx` with per-field drag-reorder + rename + width select + show/hide toggle
- [ ] **S15d-2d:** Column width options: X-Small (10%), Small (15%), Medium (25%), Large (35%) — mapped to percentage widths in the table
- [ ] **S15d-2e:** Apply customized field configuration to call sheet preview and PDF output
- [ ] **S15d-2f:** "Reset to defaults" button per section (restores original labels, order, widths, visibility)
- [ ] **S15d-2g:** Tests (field rename, reorder, width change, reset, preview reflects changes)

**Files to modify:**
- New mockup: `mockups/s15d-callsheet-fields.html`
- New: `src-vnext/features/callsheet/components/EditSectionModal.tsx`
- `src-vnext/features/callsheet/` — field configuration state and types

**Acceptance criteria:**
- [ ] User can rename, reorder, resize, and toggle columns in each call sheet section
- [ ] Column widths are selectable (XS/S/M/L)
- [ ] Customized fields render correctly in preview and PDF
- [ ] "Reset to defaults" restores original field configuration
- [ ] Build clean, lint zero, tests pass

---

#### S15d-3: Layout Templates (Save/Load)

- [ ] **S15d-3a:** "Save Layout" button that saves current section visibility + field configuration as a named layout
- [ ] **S15d-3b:** "Load Layout" picker showing saved layouts + built-in defaults
- [ ] **S15d-3c:** Built-in layouts: "Standard Shoot" (all sections visible, default fields), "Studio Day" (no weather/location sections), "Location Day" (no studio-specific sections)
- [ ] **S15d-3d:** Persist layouts in localStorage (Firestore migration in future sprint)
- [ ] **S15d-3e:** Tests (save layout, load layout, apply built-in layout)

**Files to modify:**
- New: `src-vnext/features/callsheet/lib/callsheetLayouts.ts` — layout definitions + save/load helpers
- Call sheet builder toolbar — Save/Load buttons

**Acceptance criteria:**
- [ ] User can save current call sheet configuration as a named layout
- [ ] User can load a saved or built-in layout
- [ ] 3 built-in layout presets available
- [ ] Layouts persist in localStorage
- [ ] Build clean, lint zero, tests pass

---

#### S15d-4: Mobile Preview Toggle

- [ ] **S15d-4a:** "Show mobile" checkbox in call sheet preview controls
- [ ] **S15d-4b:** When checked, preview renders at 375px width within the preview area
- [ ] **S15d-4c:** Test that content reflows correctly in mobile preview

**Files to modify:**
- Call sheet preview component — add mobile width toggle

**Acceptance criteria:**
- [ ] Mobile preview toggle shows call sheet at 375px width
- [ ] Content reflows correctly without horizontal scroll
- [ ] Build clean, lint zero, tests pass

---

### Phase S15d Acceptance Criteria (aggregate)

- [ ] Call sheet sections can be toggled on/off
- [ ] Per-section field customization works (rename, reorder, resize, toggle)
- [ ] Layout templates can be saved and loaded
- [ ] Mobile preview toggle available
- [ ] Build clean, lint zero, tests pass

---

### Phase S15e: Premium Polish (2-3 Days)

**Goal:** Close remaining polish gaps: image editing, product enrichment, overall premium feel.

**Dependencies:** S15a should be complete (view consolidation affects card components referenced here).

#### S15e-1: Image Cropping

- [ ] **S15e-1a:** Research lightweight crop libraries (native Canvas API vs library — need approval for any new dep)
- [ ] **S15e-1b:** HTML mockup for crop dialog (aspect ratio presets: Free, 1:1, 4:3, 16:9; drag-to-crop preview)
- [ ] **S15e-1c:** User approval on mockup + library choice
- [ ] **S15e-1d:** Create `ImageCropDialog.tsx` — crop preview area, aspect ratio selector, confirm/cancel buttons
- [ ] **S15e-1e:** Integrate into `HeroImageSection.tsx` — "Crop" action alongside existing "Replace" and "Remove"
- [ ] **S15e-1f:** Save cropped image to Firebase Storage (replace original, using existing upload infrastructure)
- [ ] **S15e-1g:** Tests (crop dialog render, aspect ratio selection, crop coordinates calculation)

**Files to modify:**
- New: `src-vnext/shared/components/ImageCropDialog.tsx`
- `src-vnext/features/shots/components/HeroImageSection.tsx` — add "Crop" action button
- May need new dep (requires explicit approval)

**Acceptance criteria:**
- [ ] User can crop hero images with 4 aspect ratio presets
- [ ] Cropped image replaces the original in Firebase Storage
- [ ] Crop preview is accurate (WYSIWYG)
- [ ] No new dependencies added without explicit approval
- [ ] Build clean, lint zero, tests pass

---

#### S15e-2: Product Section Enrichment

- [ ] **S15e-2a:** Add "Shots" tab to `ProductDetailPage.tsx` showing shots that reference this product family
- [ ] **S15e-2b:** Create `useLinkedShots` hook — query shots with `where("productFamilyIds", "array-contains", familyId)`, scoped to current client
- [ ] **S15e-2c:** Display: shot card list with status badges, grouped by project name
- [ ] **S15e-2d:** "Last modified by / when" indicator on product detail header (display existing `updatedAt` / `updatedBy` fields)
- [ ] **S15e-2e:** Empty state when no shots reference this product
- [ ] **S15e-2f:** Tests (linked shots display, empty state, grouped rendering)

**Files to modify:**
- `src-vnext/features/products/components/ProductDetailPage.tsx` — add Shots tab
- New: `src-vnext/features/products/components/LinkedShotsTab.tsx`
- New: `src-vnext/features/products/hooks/useLinkedShots.ts`

**Acceptance criteria:**
- [ ] Product detail page shows a "Shots" tab with shots referencing this product
- [ ] Shots grouped by project with status badges
- [ ] "Last modified" indicator shown on product header
- [ ] Empty state when no shots reference this product
- [ ] Build clean, lint zero, tests pass

---

#### S15e-3: Overall Premium Feel

- [ ] **S15e-3a:** Micro-interactions audit: verify hover states, focus rings, button press feedback across all pages
- [ ] **S15e-3b:** Loading state improvements: skeleton shimmer timing consistency, stagger delays
- [ ] **S15e-3c:** Empty state illustration consistency (all empty states use same illustration style or icon treatment)
- [ ] **S15e-3d:** Dialog/Sheet enter/exit animations (scale + fade, 150ms, using CSS transitions)
- [ ] **S15e-3e:** Sidebar expand/collapse animation smoothness
- [ ] **S15e-3f:** Visual consistency pass: spacing uniformity, alignment, card border radius, shadow depth

**Files to modify:**
- Various component files across `src-vnext/`
- `tokens.css` — animation tokens if needed (transition durations, easing curves)

**Acceptance criteria:**
- [ ] All interactive elements have visible hover and focus states
- [ ] Loading skeletons have consistent shimmer timing
- [ ] Dialogs and sheets animate on enter and exit
- [ ] No visual inconsistencies across pages (spacing, borders, radius)
- [ ] A non-technical stakeholder would describe the app as "polished and professional"
- [ ] Build clean, lint zero, tests pass

---

### Phase S15e Acceptance Criteria (aggregate)

- [ ] Image cropping available on hero images
- [ ] Product detail page shows linked shots
- [ ] Overall UX is consistent, polished, and premium-feeling
- [ ] Build clean, lint zero, tests pass

---

## 4. Constraints

All Sprint S15 work must comply with these constraints from CLAUDE.md:

### Hard Rules

1. **No new Firestore collections without approval.** Priority urgency is a computed value (no new field). Export templates and call sheet layouts are stored in localStorage initially (no Firestore). If Firestore storage is needed later, it requires a separate approval.

2. **No new npm dependencies without approval.** Page transitions use CSS-only (no framer-motion). Image cropping needs a library decision (Canvas API fallback if no approval). Export builder reuses existing `@dnd-kit` and `@react-pdf/renderer`.

3. **Build/lint/test must pass after every change.** Each sub-task is a separately committable unit. No phase ships with broken tests.

4. **Vertical-slice discipline.** Each phase ships complete, usable functionality. No stubs, no placeholder routes, no "coming soon" labels. If a feature is deferred, it does not exist in the codebase.

5. **HTML mockups before implementation.** Every phase that touches UI (S15b, S15c, S15d, S15e) requires HTML mockups in `mockups/` and user approval before code changes begin. S15a items are small enough to implement directly (proven patterns with existing infrastructure).

6. **Mobile-first.** All new views start at 375px. Table views must have horizontal scroll on mobile. Export builder is desktop-only (RequireDesktop guard). Call sheet builder is already desktop-only.

### Risk Mitigations

| Risk | Mitigation |
|------|-----------|
| Export builder is too ambitious for one phase | S15c is internally phased (4 sub-phases). Each ships independently. Can ship S15c-1 + S15c-2 without templates. |
| View consolidation breaks localStorage | Migration logic maps old "gallery"/"visual" to "card". Tested with explicit migration test case. |
| Priority rework confuses users about existing confidence system | Urgency is complementary to confidence, not a replacement. Distinct visual treatment (urgency = colored badge, confidence = existing display). |
| Image crop library adds bundle weight | Canvas API fallback requires no dep. If library approved, add to manual chunks in `vite.config.ts`. |
| Call sheet field customization breaks PDF output | Section toggles and field customization must be applied in both preview and PDF renderer. Tested with PDF generation in each sub-task. |

### Estimated Timeline

| Phase | Duration | Cumulative | Can Parallel? |
|-------|----------|-----------|---------------|
| S15a: Quick Wins | 1-2 days | 1-2 days | Baseline |
| S15b: View Improvements | 2-3 days | 3-5 days | Yes (with S15d) |
| S15c: Export Builder | 3-5 days | 6-10 days | No (full focus) |
| S15d: Call Sheet | 2-3 days | 8-13 days | Yes (with S15b) |
| S15e: Premium Polish | 2-3 days | 10-16 days | After S15a |

**Total estimate:** 10-16 engineer-days across all phases. Phases S15b and S15d can run in parallel. S15e depends on S15a completion. S15c is best done with full focus due to complexity.

---

*This document synthesizes findings from 4 research streams into an actionable implementation plan. Every feature is traced back to a specific user pain point or competitive gap. The format follows Plan.md conventions established across Phases 1-14 and Sprints S1-S14.*
