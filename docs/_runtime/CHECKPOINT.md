# CHECKPOINT — Sprint S29 Implementation Complete (2026-04-10)

## Build clean. Lint zero. 167 test files / 1975 tests passing. Ready for commit + PR.

## Sprint S29 — All Phases Complete

### Phase 0: HTML Mockups
- [x] `mockups/s29-scene-enhancements.html` — 5 sections, dark/light mode, 74KB
- [x] Visually verified in Chrome (claude-in-chrome + local HTTP server)

### Phase 1: Data Model + Scene Notes UI
- [x] Lane type extended (`sceneNumber`, `direction`, `notes`)
- [x] `useLanes` returns `laneById` map + backfills legacy `sceneNumber = sortOrder + 1`
- [x] `createLane` accepts `existingLanes` and auto-increments `sceneNumber`
- [x] `LanePatch` type exported with `direction`, `notes`, `sceneNumber`
- [x] `ShotGroup` type extended with scene metadata
- [x] `SceneDetailSheet.tsx` component (14 tests)
- [x] `SceneContextBanner.tsx` component (10 tests)
- [x] `SceneHeader.tsx` enhanced with sceneNumber + direction + onEdit
- [x] SceneContextBanner + SceneDetailSheet integrated in all 3 surfaces:
  - [x] ShotDetailPage
  - [x] ThreePanelCanvasPanel
  - [x] ThreePanelPropertiesPanel
- [x] `window.prompt()` rename flow replaced by SceneDetailSheet

### Phase 2: Scene Grouping in Table View
- [x] `SceneTableRow.tsx` component (refactored to avoid nested interactives)
- [x] `ShotsTable` accepts `groups`, `collapsedScenes`, scene action callbacks
- [x] `ShotListPage` removes "switch to cards" banner; wires scene grouping
- [x] Orphan `laneId` guard in `groupShots` (with load-race safeguard)
- [x] Backward compat preserved — flat mode unchanged

### Phase 3: Scene-Aware Sub-Numbering
- [x] `indexToLetterSuffix` (base-26, clamped at 701/ZZ)
- [x] `formatSceneShotNumber`
- [x] `parseSceneShotNumber` (scene / flat / legacy formats)
- [x] `computeMaxBaseNumber`
- [x] `projectSceneTargets` (pure helper)
- [x] `buildSceneRenumberUpdates` (pure, testable)
- [x] `previewRenumberWithScenes` (immutable via reduce)
- [x] `renumberShotsWithScenes` (MAX_RENUMBER_SHOTS guard, maxSceneNumberOverride)
- [x] `RenumberShotsDialog` Sequential / By Scene toggle
- [x] Grouped preview with scene headers + color dots
- [x] Warning banner when sequential mode would destroy scene letters
- [x] PDF export padStart removed (handles alphanumeric)
- [x] Export sort fix (localeCompare numeric)

### Phase 4: Easier Scene Assignment + Polish
- [x] "scene" column in `SHOT_TABLE_COLUMNS` (default hidden)
- [x] Scene cell renderer with colored dot + badge
- [x] `ShotRowContext` extended with scene fields
- [x] `SceneAssignPopover.tsx` component (5 tests)
- [x] Wired into ShotsTable with `lanes` + `onAssignScene` props
- [x] `BulkActionBar` button renamed to "Set Scene"

### Phase 5: Verification + Docs
- [x] Internal reviews (architect + code-reviewer + pre-impl audit)
- [x] All CRITICAL + HIGH findings fixed and re-verified
- [x] MEDIUM items 4, 5, 7 (partial), 8, 9 also fixed
- [x] Mockup visually verified
- [x] Full test suite passing
- [x] Dev server starts cleanly
- [x] HANDOFF.md + CHECKPOINT.md updated
- [ ] Commit + PR
- [ ] Deploy Firestore rules
- [ ] User visual smoke test with live data

## Critical File State

**Files changed:** 27 modified, 9 new (including 4 test files + 1 mockup)

**New files:**
- `src-vnext/features/shots/components/SceneDetailSheet.tsx` + test
- `src-vnext/features/shots/components/SceneContextBanner.tsx` + test
- `src-vnext/features/shots/components/SceneTableRow.tsx`
- `src-vnext/features/shots/components/SceneAssignPopover.tsx` + test
- `mockups/s29-scene-enhancements.html`

**Test count delta:** 1905 (S28 baseline) → 1975 (+70 new tests)

## Known Deferred (acceptable per reviewers, documented for follow-up)

- M1: Scene groups still sort by `sortOrder` (not `sceneNumber`) — strategic decision awaiting user input
- M3: Duplicate SceneDetailSheet state in canvas + properties panels (portal-rendered, works but not ideal)
- M7: DnD reorder not auto-disabled for > 500 shots (perf concern, no UX regression)
- L9: Export sort places null shotNumbers first in asc — could move to last with `?? "\uffff"` if desired

## Deployment Checklist

- [ ] `git add` + commit with conventional message
- [ ] Open PR with full test/lint/build status
- [ ] `firebase deploy --only firestore:rules` (new lanes rule)
- [ ] User visual smoke test across table + detail + renumber flows
- [ ] Merge after CI + approval
