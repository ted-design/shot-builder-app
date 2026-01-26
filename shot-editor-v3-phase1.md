# Shot Editor V3 — Phase 1 Aggressive Reset Plan

## Goal

Rapidly reset Shot Editor V3 so it FEELS like a real workspace:
- Clear hierarchy
- Clear focus
- Clear separation between context and editing

This phase prioritizes FEEL and COHERENCE over completeness.

---

## Non-Negotiable Constraints

- Follow `design-spec.md` at all times
- Prefer removal over patching
- Accept temporary loss of functionality if it restores clarity
- No schema changes
- No feature expansion

---

## Phase 1 Scope

### A. Context Dock Reset

Actions:
- Remove ALL editing controls from the Context Dock
- Convert dock to read-only summary rows only
- Ensure clicking a row focuses the corresponding canvas section

Decisions to log:
- Final list of rows retained
- Rows explicitly removed or deferred

---

### B. Primary Canvas Reassertion

Actions:
- Ensure Shot Notes is visually dominant and first
- Add visible formatting toolbar to Shot Notes
- Improve visual affordance so Notes feel like a creative surface

Decisions to log:
- Notes visual treatment
- Toolbar behavior

---

### C. Looks Structural Reset

Actions:
- Introduce explicit active Look state
- Add tab/segment control for Looks
- Ensure only active Look is editable
- De-emphasize non-active Looks

Decisions to log:
- Look switching behavior
- Visual dominance rules

---

### D. Supporting Sections Cleanup

Actions:
- Collapse Logistics, Talent, etc. by default
- Remove or label unfinished sections as "Planned"
- Prevent these sections from competing with Notes or Looks

Decisions to log:
- Which sections are visible
- Which are hidden

---

## Explicitly Out of Scope (Phase 1)

- Guided shot creation
- Reference images
- Image canvas
- Collaboration
- Comments

These are Phase 2+ items.

---

## Verification Checklist (Required)

- Visual inspection in browser
- Editor feels calm and intentional
- User can immediately answer:
  - Where do I start?
  - What am I working on?
  - What is context vs editable?

If not, STOP and revise before proceeding.

---

## Header Band — Identity & Derived Truth

**Purpose:**
Anchor identity and global state.

**Rules:**
- Shallow height
- No scrolling responsibility
- No complex editing flows

**Contains:**
- Shot Name (inline editable, human-authored > auto)
- Shot Number / ID (secondary)
- Status badge
- Derived chips (hero product, colorway)
- Global actions (duplicate, more)

**Explicitly forbidden:**
- Product selection
- Notes
- Looks
- Talent
- Location
- Any form-like structures

---

## Context Dock (Left) — Read-Only Truth Panel

**Purpose:**
Answer: *"What is true about this shot right now?"*

**Rules:**
- Read-only
- No dropdowns
- No pickers
- No inline editing
- No hover-revealed controls

**Allowed rows:**
- Status
- Products summary
- Talent summary
- Location summary
- Tags summary
- Activity (read-only)

**Interaction rule:**
- Clicking a row scrolls or focuses the corresponding section in the Primary Canvas

If a row requires editing, it does NOT belong in the Context Dock.

---

## Primary Canvas — Where Work Happens

**Purpose:**
All creative and decision-making activity.

**Narrative order (fixed):**
1. Shot Notes
2. Looks
3. Supporting Sections (collapsed by default)

Only ONE section should feel active at a time.

---

## Shot Notes — Primary Thinking Surface

Shot Notes are NOT a textarea.
They are the primary creative thinking surface.

**Rules:**
- Always visible
- Always editable (unless readonly)
- Visible formatting toolbar required
- Visually inviting and framed

If users do not instinctively start typing here, the editor has failed.

---

## Looks — Creative Spine

**Mental model:**
A shot has ONE primary Look and zero or more alternate Looks.

**Rules:**
- One Look is always active
- Only the active Look is editable
- Non-active Looks are scannable but inert

**Structure:**
- Tabbed or segmented Look selector
- Active Look Canvas containing:
  - Hero product
  - Supporting products
  - Persistent context (gender, colorway)

Looks are creative arguments, not configuration checklists.

---

## Product Selection Rules

- Product selection is ALWAYS scoped to the active Look
- Context (gender, category, colorway) must be visible BEFORE confirmation
- Blind "add to cart" behavior is forbidden

---

## Supporting Sections (Logistics, Talent, etc.)

**Rules:**
- Collapsed by default
- Explicitly secondary
- No unfinished sections competing with core work

If not ready, hide or label as "Planned".

---

## Shot Creation vs Shot Editing

Creation and editing use the SAME editor.

Creation may add a lightweight guided prelude, but must drop the user into the same editor with pre-filled state.

Parallel editors are forbidden.

---

## Enforcement Rule

If any UI, interaction, or component cannot be cleanly placed within this IA, it does not ship.

This document overrides convenience, legacy patterns, and partial parity.

---

## Execution Log

### Status: IN PROGRESS

### Current Focus / Active Delta

✅ **Delta A.1: COMPLETED**
✅ **Delta B.1: COMPLETED** — Shot Notes: Primary thinking surface
✅ **Delta C.1: COMPLETED** — Looks: Explicit active Look state + Look tabs/segmented selector
✅ **Delta D.1: COMPLETED** — Supporting Sections: Remove "Coming soon" language, make unfinished sections feel intentional
✅ **Delta E.1: COMPLETED** — Fix subtitle/subheading HTML leakage in Header Band

---

### Todos
- [x] Document review and acknowledgement
- [x] Code discovery / violation identification
- [x] A. Context Dock Reset
- [x] B. Primary Canvas Reassertion (B.1 Shot Notes complete)
- [x] C. Looks Structural Reset (C.1 active Look state + tabs complete)
- [x] D. Supporting Sections Cleanup (D.1 "Coming soon" → "Planned" complete)
- [ ] Verification Checklist

### Decisions Made
- 2025-01-23: Context Dock editing controls identified as primary violation. Will remove TalentMultiSelect, LocationSelect, TagEditor. These editing capabilities may be relocated to Primary Canvas in future phase, but Phase 1 focuses on restoring read-only dock clarity.
- 2025-01-23: Retained `locationOptions` prop to allow location name resolution for display. All other editing-related props removed.
- 2025-01-23: Tags section enhanced to show tag names (comma-separated) in addition to count, matching Talent section pattern.
- 2025-01-23: (B.1) Shot Notes visible toolbar is essential per design-spec.md ("Must include a visible formatting toolbar"). Changed `hideToolbar={true}` to `hideToolbar={false}`.
- 2025-01-23: (B.1) Notes surface framing uses existing design tokens: `shadow-sm` (matches ShotLooksCanvas pattern), `border-slate-200 dark:border-slate-700`, and `ring-1 ring-inset` for intentional depth. No new design tokens introduced.
- 2025-01-23: (C.1) "Primary" vs "Alt" labeling: Derived from array index. Index 0 = "Primary", Index 1+ = "Alt A", "Alt B", etc. (using `String.fromCharCode(64 + index)`). This is a UI-only display concern; stored `label` field retained for backward compatibility.
- 2025-01-23: (C.1) Active look state is local UI state only (`activeLookId`), no schema changes. Default to first look's ID, or null if no looks exist.
- 2025-01-23: (C.1) Tab selector integrates "+ Add Look" button when looks exist; header button shown only when no looks exist (empty state).
- 2025-01-23: (D.1) "Coming soon" → "Planned" per design-spec.md ("If not ready, hide or label as 'Planned'"). Changed from italic text to small pill badge for more intentional appearance.
- 2025-01-23: (D.1) Supporting sections (Logistics, Talent) remain visible but collapsed by default. Sections are functional placeholders (not hidden) to indicate planned capabilities without competing with Notes/Looks.
- 2025-01-23: (E.1) HTML leakage fix approach: "strip tags" chosen over "safe render". Rationale: description field is plain text per design-spec.md Header Band rules ("No complex editing flows"). HTML content is legacy data from rich text editor that shouldn't exist in description field. Strip tags is minimal, deterministic, and avoids introducing rich text rendering complexity to Header Band.

### Completed Steps
- 2025-01-23: Reviewed all three spec documents (IA, design-spec, phase1 plan)
- 2025-01-23: Identified Context Dock violations via code inspection
- 2025-01-23: **Delta A.1 — Context Dock Reset COMPLETED**
  - Removed `TalentMultiSelect` component and import
  - Removed `LocationSelect` component and import
  - Removed `TagEditor` component and import
  - Removed Firestore write handlers (`handleTagsChange`, `handleTalentChange`, `handleLocationChange`)
  - Removed Firestore imports (`doc`, `updateDoc`, `serverTimestamp`, `db`, `shotsPath`)
  - Removed `useRef` import (no longer needed)
  - Removed `Link` and `ExternalLink` imports (no longer needed)
  - Removed `LocationEmptyState` component
  - Removed props: `clientId`, `projectId`, `user`, `readOnly`, `talentOptions`, `locationsLoading`
  - Kept `locationOptions` for location name resolution
  - Updated docblock to reflect read-only design contract
  - All rows now display read-only summaries only
  - Verified via browser: no interactive controls in Context Dock region
- 2025-01-23: **Delta B.1 — Shot Notes: Primary Thinking Surface COMPLETED**
  - Changed `hideToolbar={true}` to `hideToolbar={false}` in ShotNotesCanvas.jsx (line 457)
  - Enhanced visual surface framing with `shadow-sm`, `border-slate-200 dark:border-slate-700`, and `ring-1 ring-inset ring-slate-100 dark:ring-slate-700/50`
  - Updated comment to reference design-spec.md requirement
  - Verified via browser: formatting toolbar now visible (Bold, Italic, Underline, Strikethrough, Code, Paragraph, Lists, Blockquote, Link, Color, Undo/Redo)
  - Verified via browser: Notes surface feels like an intentional "start here" card with subtle depth
  - npm run lint: passed (zero warnings)
  - npm run build: passed (18.73s)
- 2025-01-23: **Delta C.1 — Looks: Active Look state + tabs COMPLETED**
  - Added `getLookLabel(order)` function: index 0 → "Primary", 1+ → "Alt A", "Alt B", etc.
  - Added `activeLookId` local UI state, defaults to first look's ID
  - Added `LookTabSelector` component: segmented control with tabs for each look + integrated "+" button
  - Updated sync effect to ensure activeLookId stays valid when looks change externally
  - Updated `handleAddOption` to auto-activate newly created look
  - Updated `handleRemoveLook` to switch to first look if active look is removed
  - Changed render to show only the active look's panel (per design-spec: "Only the active Look is editable")
  - Non-active looks are represented only in tabs (scannable but inert)
  - Primary look tab shows star icon (amber when active)
  - Verified via browser: tab selector visible, switching works, labels correct
  - npm run lint: passed (zero warnings)
  - npm run build: passed (15.79s)
- 2025-01-23: **Delta D.1 — Supporting Sections: "Coming soon" → "Planned" COMPLETED**
  - Replaced "Coming soon" with "Planned" badge in LogisticsPlaceholder (line 86)
  - Replaced "Coming soon" with "Planned" badge in TalentPlaceholder (line 102)
  - Changed from italic div to styled span pill badge for intentional appearance
  - Sections remain collapsed by default (defaultCollapsed={true} already set)
  - Verified via browser: sections collapsed on load, expand to show "Planned" badge
  - npm run lint: passed (zero warnings)
  - npm run build: passed (18.74s)
- 2025-01-23: **Delta E.1 — Fix subtitle/subheading HTML leakage in Header Band COMPLETED**
  - Added `stripHtmlTags()` helper function at top of ShotEditorHeaderBandV3.jsx (lines 41-48)
  - Applied to description display (line 706): `stripHtmlTags(shot?.description || shot?.type) || "No description"`
  - Applied to style condition (line 696): ensures empty HTML like `<p></p>` triggers italic "No description" placeholder
  - Applied to edit draft initialization (line 521): users see clean text when clicking to edit
  - Verified via browser: Header Band now shows "No description" instead of raw `<p></p>` tags
  - No schema changes, no stored data changes
  - npm run lint: passed (zero warnings)
  - npm run build: passed (15.67s)
