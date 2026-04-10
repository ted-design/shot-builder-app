# HANDOFF — Sprint S29: Scene Enhancement (2026-04-10)

## State
Sprint S29 implementation COMPLETE. Build clean. Lint zero. 167 test files / 1975 tests passing. Not yet committed or deployed. Ready for PR.

## What Was Built

Sprint S29 closes three gaps in the S28 scene system:
1. Scene grouping only worked in card view — now works in **table view** too
2. Scenes had only a name and color — now support **scene number, creative direction, and production notes**
3. Shot numbering ignored scenes — now supports **letter-suffix sub-numbering** (51A, 51B, 51C) relative to the scene number

### Data Model (Phase 1)
- Extended `Lane` interface with 3 optional fields: `sceneNumber?: number`, `direction?: string`, `notes?: string`
- `useLanes` hook now exposes `laneById: Map<string, Lane>` and auto-backfills `sceneNumber = sortOrder + 1` for legacy lanes that lack it
- `createLane` accepts `existingLanes` param and auto-increments `sceneNumber` as `max(existing) + 1`
- `LanePatch` type extended and exported from `laneActions.ts`
- `ShotGroup` type extended with optional `color`, `sceneNumber`, `direction` scene metadata
- `groupShots` scene branch populates metadata from new `laneById` lookup parameter

### Scene UI Components (Phase 1 UI)
- **NEW `SceneDetailSheet.tsx`** — Right-side slide-over sheet for editing scene properties. Fields: name, number, color (6 swatches), creative direction (≤500 chars), production notes (≤5000 chars). Blur-only saves (no debounced keystroke writes). `useRef` init gate prevents Firestore snapshot echoes from clobbering in-progress edits.
- **NEW `SceneContextBanner.tsx`** — Thin banner shown at top of shot detail when shot belongs to a scene. Shows color dot, `#sceneNumber sceneName`, truncated direction preview, "View scene" link.
- **Enhanced `SceneHeader.tsx`** — Shows `#sceneNumber` prefix, direction preview, "Edit Scene" dropdown item.
- **Integration:** SceneContextBanner + SceneDetailSheet in all 3 surfaces (ShotDetailPage, ThreePanelCanvasPanel, ThreePanelPropertiesPanel) for parity.

### Table Grouping (Phase 2)
- **NEW `SceneTableRow.tsx`** — Scene header row for the table (single `<td colSpan>`, 3px left color bar, chevron toggle, kebab menu with Edit/Ungroup/Delete). Uses `<div>` + sibling `<button>` to avoid nested interactive elements.
- `ShotsTable.tsx` accepts new `groups`, `collapsedScenes`, `onToggleSceneCollapse`, `onEditScene`, `onDeleteScene`, `onUngroupScene`, `laneById`, `lanes`, `onAssignScene` props
- `ShotListPage.tsx` removed the "Grouping is available in Card view" banner and wires scene grouping to the table
- Orphan `laneId` guard in `groupShots` with size>0 check to prevent load-race flicker

### Scene-Aware Sub-Numbering (Phase 3)
- **New functions in `shotNumbering.ts`:**
  - `indexToLetterSuffix(index)` — base-26 letter encoding (0→A, 25→Z, 26→AA, 701→ZZ, clamped)
  - `formatSceneShotNumber(sceneNumber, indexInScene)` — composes "51" + "A" → "51A"
  - `parseSceneShotNumber(shotNumber)` — regex parser for scene / flat / legacy formats
  - `computeMaxBaseNumber(shots)` — extracts highest base from all formats
  - `projectSceneTargets` (private helper) — pure projection of scene groups + ungrouped onto numbering targets
  - `buildSceneRenumberUpdates` — pure Firestore update list builder (testable without mocks)
  - `previewRenumberWithScenes` — dry-run preview, immutable via `reduce`
  - `renumberShotsWithScenes` — Firestore batch writer, uses `buildSceneRenumberUpdates`, `MAX_RENUMBER_SHOTS=2000` guard, `maxSceneNumberOverride` param for cross-filter safety
- **Enhanced `RenumberShotsDialog.tsx`** — Sequential / By Scene mode toggle, grouped preview with scene headers + color dots, warning when sequential mode would destroy existing scene letter suffixes

### Scene Assignment (Phase 4)
- **Scene column** added to `shotTableColumns.ts` (default hidden, order 14)
- **Scene cell renderer** in `shotColumnRenderers.tsx` — colored dot + scene name badge or em-dash. `ShotRowContext` extended with `sceneName`, `sceneColor`. `computeShotRowContext` accepts optional `laneById`.
- **NEW `SceneAssignPopover.tsx`** — Popover with None/ungrouped, scene list with color dots + `#sceneNumber`, checkmark on active
- `BulkActionBar.tsx` — Renamed "Group into Scene" button to "Set Scene"

### Pre-Existing Bug Fixes (discovered during audit)
- **CRITICAL** `blockDataResolvers.ts` — Export sort used `Number(shotNumber)` which returns `NaN` for alphanumeric. Fixed to `localeCompare` with `{ numeric: true, sensitivity: "base" }`.
- 4 export files (`ShotGridBlockPdf`, `ShotDetailBlockPdf`, `ShotGridBlockView`, `ShotDetailBlockView`) — Removed `padStart(3, "0")` which produced "05A" from "5A". Now displays raw shotNumber with em-dash fallback.

### Firestore Rules
- Added explicit `match /lanes/{laneId}` rule with `direction.size() <= 500` and `notes.size() <= 5000` validation, placed BEFORE the wildcard catch-all.

## Review Cycle (Internal)

**Pre-Implementation Audit (code-reviewer):**
- CRITICAL: Export sort NaN → fixed
- HIGH: 4× padStart on shotNumber → fixed
- MEDIUM: Three-panel parity flagged for implementation planning

**Data Model + Numbering Review (code-reviewer):**
- CRITICAL: previewRenumberWithScenes sortOrder divergence from write function → fixed with globalSortOrder counter
- HIGH: indexToLetterSuffix clamping at 701 (ZZ) → fixed
- HIGH: Missing MAX_RENUMBER_SHOTS guard on renumberShotsWithScenes → fixed
- HIGH: push mutation in numbering functions → deferred initially, fully fixed in final review
- MEDIUM: Missing direction/notes null write in createLane → fixed
- MEDIUM: Simplified direction truncation

**Architecture Review (architect) — 13 findings:**
- CRITICAL: `createLane` missing `existingLanes` in ShotListPage → every new scene would collide at sceneNumber=1 → fixed
- HIGH: Legacy lane sceneNumber backfill → fixed with read-time fallback in `useLanes.mapLane`
- HIGH: Orphan laneId produces phantom groups → fixed with guard in `groupShots`
- HIGH: Debounced direction write causes multi-user conflict → removed, blur-only
- HIGH: Sequential renumber silently destroys scene letters → warning banner added
- MEDIUM: Type-safe `LanePatch` export → fixed
- MEDIUM: Scene number validation (non-negative integer) → fixed

**Full Sprint Review (code-reviewer) — 23 findings:**
- CRITICAL: Initial test regression from orphan guard (5 tests) → fixed, backward-compat restored, new orphan test added
- CRITICAL: `RenumberShotsDialog` scene mode is dead code — `lanes`/`groupKey` props not passed from ShotListPage → FIXED (Phase 3 UI now reachable)
- HIGH: `SceneDetailSheet` re-render trap — Firestore snapshot echoes would clobber in-progress edits → fixed with `useRef` init gate + 2 new regression tests
- HIGH: Mutation violations in `previewRenumberWithScenes`, `renumberShotsWithScenes`, `ScenePreviewRows` → rewrote using `reduce` + extracted pure `buildSceneRenumberUpdates` / `projectSceneTargets` helpers
- HIGH: Nested interactive HTML in SceneTableRow (button inside button) → refactored to `<div>` + sibling `<button>`
- HIGH: No Firestore rule size validation for lanes → added explicit rule with 500/5000 char limits
- HIGH: Missing unit tests for `renumberShotsWithScenes` → added 5 tests for `buildSceneRenumberUpdates`
- MEDIUM: Unused `updateLane` import → removed
- MEDIUM: O(n) `lanes.find()` in ShotListPage → replaced with `laneById.get()`
- MEDIUM: `maxSceneNumberOverride` param for cross-filter safety → added
- Codex CLI independent review attempted — `gpt-5.4-high` unavailable on ChatGPT account (known limitation). Internal 2-tier review (architect + code-reviewer) was the substitute.

## Files

**New (9):**
- `src-vnext/features/shots/components/SceneDetailSheet.tsx`
- `src-vnext/features/shots/components/SceneContextBanner.tsx`
- `src-vnext/features/shots/components/SceneTableRow.tsx`
- `src-vnext/features/shots/components/SceneAssignPopover.tsx`
- `src-vnext/features/shots/components/SceneAssignPopover.test.tsx` (5 tests)
- `src-vnext/features/shots/components/__tests__/SceneDetailSheet.test.tsx` (14 tests)
- `src-vnext/features/shots/components/__tests__/SceneContextBanner.test.tsx` (10 tests)
- `mockups/s29-scene-enhancements.html` (74KB, 5 sections, dark/light mode)

**Modified (27):**
- `src-vnext/shared/types/index.ts` (Lane)
- `src-vnext/features/shots/hooks/useLanes.ts` (laneById, backfill)
- `src-vnext/features/shots/hooks/useShotListState.ts` (laneById thread-through)
- `src-vnext/features/shots/lib/laneActions.ts` (createLane existingLanes, LanePatch export)
- `src-vnext/features/shots/lib/shotListFilters.ts` (ShotGroup, orphan guard, scene field)
- `src-vnext/features/shots/lib/shotNumbering.ts` (6 new functions + helpers)
- `src-vnext/features/shots/lib/shotNumbering.test.ts` (+39 tests total 59)
- `src-vnext/features/shots/lib/shotTableColumns.ts` (scene column)
- `src-vnext/features/shots/lib/shotTableColumns.test.ts` (column count)
- `src-vnext/features/shots/lib/shotColumnRenderers.tsx` (scene cell)
- `src-vnext/features/shots/lib/__tests__/sceneGrouping.test.ts` (+1 orphan test)
- `src-vnext/features/shots/components/SceneHeader.tsx` (sceneNumber, direction, onEdit)
- `src-vnext/features/shots/components/ShotsTable.tsx` (groups, laneById, scene assign)
- `src-vnext/features/shots/components/ShotListPage.tsx` (scene wiring, SceneDetailSheet)
- `src-vnext/features/shots/components/ShotDetailPage.tsx` (SceneContextBanner + sheet)
- `src-vnext/features/shots/components/ThreePanelLayout.tsx` (laneById threading)
- `src-vnext/features/shots/components/ThreePanelCanvasPanel.tsx` (banner + sheet)
- `src-vnext/features/shots/components/ThreePanelPropertiesPanel.tsx` (banner + sheet)
- `src-vnext/features/shots/components/RenumberShotsDialog.tsx` (scene mode toggle + grouped preview)
- `src-vnext/features/shots/components/BulkActionBar.tsx` (button label rename)
- `src-vnext/features/export/lib/blockDataResolvers.ts` (localeCompare sort)
- `src-vnext/features/export/lib/pdf/blocks/ShotGridBlockPdf.tsx` (no padStart)
- `src-vnext/features/export/lib/pdf/blocks/ShotDetailBlockPdf.tsx` (no padStart)
- `src-vnext/features/export/components/blocks/ShotGridBlockView.tsx` (no padStart)
- `src-vnext/features/export/components/blocks/ShotDetailBlockView.tsx` (no padStart)
- `src-vnext/features/export/components/__tests__/ShotGridBlockView.test.tsx` (test adjustment)
- `firestore.rules` (lanes size validation)

## Next Steps

1. **Visual smoke test with live data** — Requires logged-in Firebase user. User should verify: (a) table view scene grouping, (b) scene detail sheet editing flow, (c) scene context banner on shot detail, (d) renumber by scene, (e) scene assign popover from table cell.
2. **Deploy Firestore rules** — `firebase deploy --only firestore:rules` (adds lane size validation)
3. **Commit + PR** — Suggested title: `feat: S29 scene enhancement — table grouping, notes, letter-suffix numbering`. Include test/lint/build status in PR description.
4. **Follow-up items (not blocking merge):**
   - M1: Scene group sort by `sceneNumber` instead of `sortOrder` (strategic — may want to discuss with user)
   - M3: Lift `SceneDetailSheet` state from two panels to `ThreePanelLayout` to avoid duplicate sheet instances
   - M7: Disable DnD reorder when shot count > 500 (perf)
   - L9: Consider moving blanks-last in export sort (`?? "\uffff"`)

## Verification Status

- **Tests:** 167 files / 1975 passing (includes 39 new scene numbering + 24 new component tests)
- **Lint:** zero warnings
- **Build:** clean (`npm run build` ~12s)
- **Dev server:** starts and renders shell correctly
- **HTML mockup:** visually verified in Chrome, matches implementation design
- **Codex CLI:** unavailable (gpt-5.4-high not supported on ChatGPT account — known limitation)
