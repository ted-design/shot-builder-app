# Schedule → SetHero-Inspired Call Sheet Builder Transformation

Last updated: 2026-01-06

This document is the master reference and progress tracker for transforming Shot Builder’s current Schedule experience into a SetHero-inspired Call Sheet Builder with modular sections, a contextual 2‑panel editor (working panel + live preview), and professional export.

---

## Goals

- Replace the current “schedule entries list + basic preview” UX with a SetHero-style call sheet builder:
  - **Left working panel**: either Outline/Layout *or* a section editor (never both simultaneously)
  - **Right preview panel**: live WYSIWYG preview (zoom, mobile toggle, fullscreen, refresh, share link)
- Make the call sheet a **modular document** composed of re-orderable sections (Header, Day Details, Reminders, Today’s Schedule, Talent, Crew, etc.).
- Persist layout/settings per project + shoot day, and keep **auto-save** behavior with clear “last saved” feedback.
- Maintain and enhance the existing **Products** feature inside the schedule section.

## Non-Goals (for now)

- Rewriting unrelated project pages (Shots, Products, Locations, etc.) unless required for call sheet integration.
- Changing Firebase auth/permissions flows outside what’s required to store call sheet layout data safely.

---

## Current State Snapshot (Repo Reality Check)

The repo already contains a “call sheet builder” foundation (feature-flagged) including:

- Types: `src/types/callsheet.ts`, `src/types/schedule.ts`
- Config persistence: `src/hooks/useCallSheetConfig.ts`
- Schedule persistence & cascade engine: `src/hooks/useScheduleEntries.js`, `src/lib/cascadeEngine.js`
- Builder/preview UI: `src/components/callsheet/CallSheetBuilder.jsx`, `src/components/callsheet/builder/*`, `src/components/callsheet/vertical/*`

This transformation is therefore a **re-architecture / evolution** to match SetHero’s paradigm (contextual working panel, section-based editing, templates/settings), not a greenfield build.

---

## Target UX (SetHero-Paradigm)

### 2-Panel Layout (Contextual Working Panel)

- **Left (Working)**: shows either Outline/Layout *or* the selected section editor; includes a consistent “Done” action to return to Outline.
- **Right (Preview)**: live document preview with zoom controls, “show mobile”, fullscreen, refresh, shareable URL.

### Top Toolbar

- Tabs: Outline | Settings | File Attach
- Shoot day selector (date dropdown)
- Status indicator + Publish toggle
- Actions: Export, Share Link, Go to Publish

---

## Data Model (Phase 1 Target)

### Canonical Types (target)

These are the Phase 1 target shapes we will converge on (names may be adapted to fit existing code conventions, but the capabilities must remain equivalent):

```ts
interface CallSheetLayout {
  sections: CallSheetSection[];
  header: HeaderConfig;
  settings: CallSheetSettings;
}

interface CallSheetSection {
  id: string;
  type: SectionType;
  enabled: boolean;
  order: number;
  config: SectionConfig;
  fields: FieldConfig[];
}

interface HeaderConfig {
  left: HeaderColumn;
  center: HeaderColumn;
  right: HeaderColumn;
  preset: "classic" | "center-logo" | "multiple-logos";
}

interface HeaderColumn {
  items: HeaderItem[];
}

interface HeaderItem {
  type: "variable" | "text" | "image";
  value: string;
  style: TextStyle;
  enabled: boolean;
}

interface FieldConfig {
  id: string;
  name: string;
  originalName: string;
  width: "hidden" | "x-small" | "small" | "medium" | "large" | "x-large";
  enabled: boolean;
  order: number;
}

interface CallSheetSettings {
  pageSize: { width: number; height: number; unit: "inches" | "mm" };
  spacing: "compact" | "normal" | "relaxed";
  timeFormat: "12h" | "24h";
  tempFormat: "celsius" | "fahrenheit";
  showFooterLogo: boolean;
  colors: ThemeColors;
}

interface ScheduleEntry {
  id: string;
  time: string;
  duration: number;
  type: "setup" | "shot" | "banner" | "move";
  title: string;
  description?: string;
  location?: string;
  note?: string;
  flag?: string;
  sceneId?: string;
  cast?: string[];
  products?: string[];
}
```

### Reconciliation With Existing Types

- Existing call sheet config is stored as `CallSheetConfig` in `src/types/callsheet.ts` with:
  - `headerLayout` + `headerElements` (single list), and `sections` with `isVisible` + `order`.
- Existing schedule system uses `src/types/schedule.ts` with:
  - Tracks, column config, schedule settings, and `ScheduleEntry` (track-based; shot/custom split).

**Plan:** introduce a *versioned* call sheet layout model (`schemaVersion`) and a migration layer that can:

- Read existing schedule entries + existing call sheet config
- Produce a normalized “SetHero-style” section layout with field configs
- Preserve Products as a first-class column/field

---

## Firestore Schema (Phase 1 Target)

### Current Reality (confirmed)

- Schedules: `clients/{clientId}/projects/{projectId}/schedules/{scheduleId}`
- Schedule entries: `clients/{clientId}/projects/{projectId}/schedules/{scheduleId}/entries/{entryId}`
- Call sheet builder state (new): `clients/{clientId}/projects/{projectId}/schedules/{scheduleId}/callSheet/{docId}`
  - Legacy/v1 config doc: `callSheet/config`
  - V2 layout doc: `callSheet/layout`

### Proposed Additions/Changes

- Add a versioned layout doc (implemented as `callSheet/layout`) containing:
  - `schemaVersion` (also duplicated at top-level for easier inspection)
  - `layout` (sections + header config + settings)
  - timestamps + createdBy
- Keep the existing schedule entries subcollection as the source of truth for “Today’s Schedule” rows, but add:
  - `entryType` alignment (`setup|shot|banner|move`)
  - `flag` field support
  - `products` support (already present; ensure preserved/expanded)

**Rules note:** `firestore.rules` now includes an explicit match for `schedules/{scheduleId}/callSheet/{docId}`.

---

## Migration Strategy (Phase 1)

### Requirements

- No breaking changes for existing projects.
- Migration must be **idempotent** and safe to run multiple times.
- Migration should preserve user edits as much as possible:
  - Existing schedule entries map into the “Today’s Schedule” section.
  - Existing `CallSheetConfig` maps into the new header + section enabled/order state when possible.

### Approach

1. Introduce `schemaVersion` on the new layout doc.
2. On load, if:
   - new layout doc exists with current `schemaVersion` → use it
   - otherwise → build layout from legacy data, write it once (behind feature flag / with user consent if needed)
3. Keep a fallback path for older schemas (read-only) until we’re confident to fully cut over.

---

## Phases (Progress Tracker)

Each phase below includes: deliverables, files, and a completion checklist. Update this document as we implement.

### Phase 1: Foundation & Data Models (COMPLETE)

**Deliverables**
- Data model/types for SetHero-style layout + field configuration
- Firestore schema updates (paths + rules + indexes if needed)
- Migration utility for existing schedule/callsheet data

**Planned Files**
- `src/types/callsheet.ts` (extend or supersede with v2 layout types)
- `src/types/schedule.ts` (align entry shape for call sheet “Today’s Schedule” needs)
- `src/lib/*` migration helpers (TBD after inspection)
- `firestore.rules` / `firestore.indexes.json` (only if required)
- `scripts/*` or `functions/*` migration runner (TBD)

**Checklist**
- [x] Document current Firestore structure used by schedule + call sheet config
- [x] Finalize target Firestore paths for layout/settings
- [x] Add versioned types (`schemaVersion`, `CallSheetLayoutV2`, `FieldConfig`, header columns/items)
- [x] Implement migration builder (legacy → v2 layout)
- [x] Add unit tests for migration + paths
- [x] Update this doc with implementation notes, known issues, and manual validation steps

**Implemented (this phase)**
- Types: `src/types/callsheet.ts` (added V2 layout + field models)
- Paths: `src/lib/paths.js` (`callSheetConfigPath`, `callSheetLayoutPath`)
- Layout builder: `src/lib/callsheet/layoutV2.ts` (`buildCallSheetLayoutV2`)
- Firestore rules: `firestore.rules` (allow schedule `callSheet/*`)
- Migration runner: `scripts/migrations/2026-01-callsheet-layout-v2.ts`
- Tests: `src/lib/__tests__/callsheetLayoutV2.test.ts`, `src/lib/__tests__/paths.callsheet.test.js`

**How to run migration (manual)**
- `DRY_RUN=1 MIGRATION_CLIENT_ID=... MIGRATION_PROJECT_ID=... npx tsx scripts/migrations/2026-01-callsheet-layout-v2.ts`
- Remove `DRY_RUN=1` to write changes; add `--force` to overwrite existing v2 layouts.

---

### Phase 2: Layout Panel & Section Management

**Deliverables**
- 2-panel `CallSheetBuilder` container (Working / Preview)
- Draggable, toggleable sections in Layout Panel
- Section enable/disable + reorder persistence
- Template entry points (“Load / Save”)

**Checklist**
- [x] `CallSheetBuilder` 2-panel layout scaffold
- [x] `LayoutPanel` draggable list (dnd-kit)
- [x] Section selection + editor routing
- [x] Persistence to Firestore (`callSheet/config` v1)
- [x] Persistence to Firestore (`callSheet/layout` v2)
- [x] Template entry points (“Load / Save”)

**Implemented (so far)**
- 2-panel container wired in `src/components/callsheet/CallSheetBuilder.jsx`:
  - Left working panel switches between Outline and Section editor: `src/components/callsheet/builder/WorkingPanel.jsx`
  - Outline list: `src/components/callsheet/builder/LayoutPanel.jsx`
  - Section editor content: `src/components/callsheet/builder/EditorPanel.jsx`
- Right preview uses `src/components/callsheet/builder/PreviewPanel.jsx` (schedule-only preview for now)
- Schedule editor runs in “editor-only” mode by hiding the internal preview in `src/components/callsheet/vertical/VerticalTimelineView.jsx`
- Added missing Firestore path helpers for Day Details + Talent/Crew calls in `src/lib/paths.js` and rules in `firestore.rules`
- Added `callSheet/layout` syncing via `src/hooks/useCallSheetLayoutV2.ts` (v2 layout is currently derived from the v1 config on change; v2 will become the primary source in later phases)
- Added “Load / Save” templates entry point in `src/components/callsheet/builder/LayoutPanel.jsx` with scaffold modal `src/components/callsheet/modals/TemplatesModal.jsx`

---

### Phase 3: Header Section Editor

**Deliverables**
- 3-column header editor (Left / Center / Right)
- Presets: Classic, Center Logo, Multiple Logos
- Column item editing: variables/text/images + formatting + reorder
- Shape selector for center element (circle/rectangle/none)

**Checklist**
- [x] Header editor UI + local state (v2)
- [x] Variable selector w/ preview values
- [x] Persist config + render in preview (via `callSheet/layout`)
- [x] Text formatting parity (line height, margins, wrap)
- [x] “Done” edit flow polish + inline hover patterns
- [x] Builder crash fix: import `Button` in `src/components/callsheet/CallSheetBuilder.jsx`

---

### Phase 4: Day Details Section

**Deliverables**
- Day Details editor with 3 tabs:
  - Key People & More
  - Location & Notes (rich text)
  - Times & Weather (shift all times)

**Checklist**
- [x] Editor UI + persistence
- [ ] Weather auto-fill integration (if available)
- [x] Preview renderer parity

**Implemented (this phase so far)**
- Tabbed Day Details editor in `src/components/callsheet/sections/DayDetailsEditorV2.tsx`
  - Key People & More: key people, set medic, script/schedule versions
  - Location & Notes: location cards + rich text “Main notes” (uses existing `src/components/shots/RichTextEditor.jsx`)
  - Times & Weather: call/meal times + “Shift all times” + manual weather fields
- Added “+ Add New Row” support via `DayDetails.customLocations` for extra location cards
- Added `DayDetails.notesStyle` (placement + icon + color) and rendered it in preview
- Added debounced auto-save (still supports “Save now”)
- Wired into center editor via `src/components/callsheet/builder/EditorPanel.jsx`
- Time shifting helper + tests in `src/lib/callsheet/shiftTimes.ts` and `src/lib/__tests__/callsheetShiftTimes.test.ts`
- Updated preview Day Details block in `src/components/callsheet/vertical/CallSheetPreview.jsx` to include custom locations and notes styling

---

### Phase 5: Today’s Schedule (Core)

**Deliverables**
- Row types: Setup / Shot / Banner / Move
- Per-row checkbox selection, flag dropdown, location picker, note
- “Edit Fields” modal for column configuration (draggable fields + widths + toggles)
- Scene lookup + create scene flows

**Checklist**
- [x] Entry UI enhancements + persistence (checkbox selection, flag dropdown, add move/banner/scene)
- [x] Field config model + UI (Edit Fields modal + section title)
- [x] Cascade time changes toggle behavior preserved
- [x] Products support maintained/enhanced

**Implemented (this phase so far)**
- Added per-row checkbox selection + flag dropdown in `src/components/callsheet/vertical/VerticalEntryCard.jsx`
- Persisted `ScheduleEntry.flag` (Firestore field) and wired it through the schedule editor via `src/components/callsheet/CallSheetBuilder.jsx`
- Added “Edit shot” affordance on scene rows (opens existing shot editor modal)
- Rendered entry flags in the preview time cell in `src/components/callsheet/vertical/CallSheetPreview.jsx`
- Moved SetHero-style schedule controls into the schedule editor header area:
  - “Edit Fields” (in the section header), “Show durations”, “Cascade changes”, “+ Add Scene”, “+ Add Banner”, “+ Add Move”
  - `src/components/callsheet/builder/WorkingPanel.jsx`, `src/components/callsheet/builder/EditorPanel.jsx`
- Added SetHero-style “add row” flow with time input + Add dropdown + LOOKUP/CREATE SCENE (time-aware adds)
- Hid the internal schedule header when embedded in the 3-panel builder via `showEditorHeader={false}` in `src/components/callsheet/vertical/VerticalTimelineView.jsx`
- Enhanced “Edit Fields” modal to support section title + per-field reset + Hidden width in `src/components/callsheet/columns/ColumnConfigModal.jsx`

---

### Phase 6: People Sections (Talent, Clients, Crew)

**Deliverables**
- Talent section with smart suggestions from scene tags
- Clients section (similar to Talent)
- Crew section with precalls + department grouping

**Checklist**
- [x] Data sources + UI tables (initial)
- [x] Field config support
- [x] Preview renderers

**Implemented (this phase so far)**
- Talent section now behaves like a callsheet roster (empty state + “+ Add Talent” modal + schedule-tag suggestions):
  - `src/components/callsheet/TalentCallsCard.jsx`
  - Suggestion source is schedule shots’ tagged talent IDs computed in `src/components/callsheet/CallSheetBuilder.jsx`
  - Added roster columns (Role, BLK/RHS, MU/WARD, Remarks) stored in `schedules/{scheduleId}/talentCalls/{talentId}`
- Crew section header/warning aligned with callsheet semantics and respects read-only mode:
  - `src/components/callsheet/CrewCallsCard.jsx`
- Extended call sheet people types to support new talent fields:
  - `src/types/callsheet.ts`, `src/hooks/useTalentCalls.ts`
- Added Clients section (callsheet-only roster stored per schedule) + editor table:
  - `src/hooks/useClientCalls.ts`, `src/components/callsheet/ClientsCallsCard.jsx`
  - Firestore paths: `schedules/{scheduleId}/clientCalls/{clientCallId}` (`src/lib/paths.js`, `firestore.rules`)
- Added SetHero-style “Edit Fields” for Talent/Clients (column order/visibility/width + section title):
  - `src/components/callsheet/people/PeopleFieldsModal.jsx`
  - Defaults/utilities: `src/lib/callsheet/peopleColumns.js`
- Preview now renders Talent + Crew sections (read-only tables) when enabled in the Outline:
  - Data wiring: `src/components/callsheet/CallSheetBuilder.jsx`
  - Preview renderers: `src/components/callsheet/vertical/CallSheetPreview.jsx`
  - Clients preview renderer: `src/components/callsheet/vertical/CallSheetPreview.jsx`

---

### Phase 7: Additional Sections

**Deliverables**
- Reminders, Extras & Dept. Notes, Advanced Schedule, Notes & Contacts, Quote of the Day
- Page Break section (draggable separator)

**Checklist**
- [x] Section editors + preview renderers (baseline)
- [x] Edit Fields support across sections (baseline)

**Implemented (this phase so far)**
- Added section editors:
  - Extras & Dept. Notes: `src/components/callsheet/ExtrasEditorCard.jsx`
  - Advanced Schedule: `src/components/callsheet/AdvancedScheduleEditorCard.jsx`
  - Quote of the Day: `src/components/callsheet/QuoteEditorCard.jsx`
  - Page break guidance: `src/components/callsheet/builder/EditorPanel.jsx`
- Preview now renders non-schedule sections in Outline order **around** the Schedule table (so Page Break / Reminders / Day Details can appear before or after Schedule based on section ordering):
  - `src/components/callsheet/vertical/CallSheetPreview.jsx`
- Outline “Add” menu includes Phase 7 sections:
  - `src/components/callsheet/builder/LayoutPanel.jsx`

---

### Phase 8: Preview Panel Enhancement

**Deliverables**
- True WYSIWYG preview using the configured layout
- Zoom controls, reset zoom, refresh, mobile toggle, fullscreen
- Shareable preview link (stable URL)

**Checklist**
- [x] Preview controls
- [ ] Fast re-render strategy (memoization/virtualization if needed)

**Implemented (this phase so far)**
- Preview toolbar now includes: zoom in/out, reset zoom, refresh, show mobile toggle, fullscreen, and shareable preview link (copy/open):
  - `src/components/callsheet/builder/PreviewPanel.jsx`
- Preview respects configured layout page size + spacing and supports a mobile paper preset:
  - `src/components/callsheet/vertical/CallSheetPreview.jsx`
- Call sheet page supports `?scheduleId=...` so preview links open the correct schedule:
  - `src/pages/CallSheetPage.jsx`
- `?preview=1` opens a preview-only view (no Outline/Editor panels) for shareable links:
  - `src/components/callsheet/CallSheetBuilder.jsx`, `src/pages/CallSheetPage.jsx`
- Page Break sections now force a print page break and show a clearer “New Page” marker in preview:
  - `src/components/callsheet/vertical/CallSheetPreview.jsx`

---

### Phase 9: Settings & Templates

**Deliverables**
- Settings panel:
  - Call sheet settings: page size, spacing
  - Project settings: footer logo, time/temp format, theme colors
- Template system:
  - Load template (checkboxes: what to apply)
  - Save template (new/update + visibility)
  - Manage templates (CRUD)

**Checklist**
- [ ] Template data model + persistence
- [ ] Apply template logic (layout-only; does not overwrite schedule data)

---

### Phase 10: Publishing & Export

**Deliverables**
- Publish flow/page
- PDF export with layout fidelity
- Excel export
- Sharing/distribution features

**Checklist**
- [ ] Publish page + status model
- [ ] Export parity with preview

---

## Acceptance Criteria (End State)

- All sections can be enabled/disabled/reordered, with persistence.
- Header fully customizable with 3-column layout (variables/text/images).
- Schedule supports Setup/Shot/Banner/Move, checkbox selection, flags, notes, locations.
- Field configuration persists per section and survives reload.
- Live preview updates in real time, supports zoom/mobile/fullscreen.
- Templates can be saved/loaded; template application doesn’t overwrite actual schedule data.
- Settings persist at call sheet and project level.
- Export generates a professional PDF matching preview closely.

---

## Manual Validation Checklist (Living)

- Create a schedule; verify default sections render (enabled + ordered).
- Toggle a section off/on; verify persistence across reload.
- Reorder sections; verify preview and saved layout order match.
- Add schedule entries (including Products); verify preview includes Products column/field.
- Export PDF; verify page breaks + header render correctly.

## Permissions Notes

Call sheet editing writes to schedule-scoped documents:

- V1 config: `clients/{clientId}/projects/{projectId}/schedules/{scheduleId}/callSheet/config`
- V2 layout: `clients/{clientId}/projects/{projectId}/schedules/{scheduleId}/callSheet/layout`

Firestore rules require project member roles:

- Read: `producer|wardrobe|viewer` (or admin)
- Write: `producer|wardrobe` (or admin)

If a user has `viewer` role, the UI should remain read-only and avoid auto-initialization writes (to prevent permission-denied noise).
