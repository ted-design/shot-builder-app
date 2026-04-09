# HANDOFF — Sprint S28: Shot Scenes + Three-Panel Parity (2026-04-09)

## State
Sprint S28 IN PROGRESS. Build clean. Lint zero. 164 test files / 1905 tests pass. Awaiting final code review.

## What Was Built

### WS1: Three-Panel Bug Fixes (CRITICAL)
- **TalentPicker projectId**: Added `projectId={shot.projectId}` to `ThreePanelPropertiesPanel.tsx` — talent dropdown was showing ALL org-wide talent instead of project-scoped
- **LocationPicker projectId**: Same fix for location picker
- **ProductSummaryStrip**: Added import + conditional render to `ThreePanelCanvasPanel.tsx` — product thumbnails were completely missing from center panel

### WS2: Three-Panel Parity Fixes (from architect audit)
- **Deleted shot guard** (CRITICAL): Added `useRef`-gated `useEffect` in `ThreePanelLayout.tsx` — deselects + toasts when shot is soft-deleted while selected
- **ShotVersionHistorySection** (HIGH): Added to `ThreePanelPropertiesPanel.tsx` below comments
- **ShotLifecycleActionsMenu** (HIGH): Added to `ThreePanelCanvasPanel.tsx` header bar (duplicate/move/archive)
- **ShotsShareDialog** (HIGH): Added share button + dialog to `ThreePanelLayout.tsx` + `ThreePanelCanvasPanel.tsx`

### WS3: Shot Scenes Infrastructure
- **Lane type**: `shared/types/index.ts` — `{ id, name, projectId, clientId, sortOrder, color?, timestamps, createdBy }`
- **Path helper**: `shared/lib/paths.ts` — `laneDocPath`
- **useLanes hook**: `features/shots/hooks/useLanes.ts` — Firestore subscription + laneNameById map
- **CRUD actions**: `features/shots/lib/laneActions.ts` — createLane (name validation), updateLane (LanePatch type), deleteLane, assignShotsToLane (MAX_BULK_OPS=500, projectId), ungroupAllShotsFromLane
- **GroupKey extension**: Added `"scene"` to GroupKey type, scene case in `groupShots()` with lane order + alphabetical fallback
- **State wiring**: `useShotListState` accepts laneNameById + laneOrder, passes to groupShots

### WS4: Shot Scenes UI
- **SceneHeader component**: Collapsible header with accent color bar, name, count badge, context menu (Rename, Ungroup All, Delete Scene). Ungrouped variant with muted styling.
- **ScenePicker dropdown**: Assign/move/remove shots from scenes. Shows color dots. "None (ungrouped)" option.
- **GroupIntoSceneDialog**: Two-tab dialog (Create New + Add to Existing) with name input, 6-color picker, existing scene radio list with counts.
- **Toolbar integration**: "Scenes" toggle button (with Layers icon) in ShotListToolbar, visible when lanes exist
- **Card view integration**: SceneHeader renders as collapsible group dividers. Shots contained within bordered scene containers. Collapse state tracked in ShotListPage.
- **BulkActionBar**: "Group into Scene" primary button added before Delete

### WS5: Tests
- 9 scene grouping tests: groups by laneId, ungrouped last, sorts by laneOrder, handles empty, unknown lanes, alphabetical fallback, preserves shot order
- SCENE_COLORS validation: 6 colors, unique keys, valid hex
- 1905 total tests (up from 1892)

## Review Cycle
- Initial code review (Wave 1 fixes): APPROVED — zero CRITICAL/HIGH findings
- Senior code review (infrastructure): H1 deleted guard re-fire fixed (useRef gate), H2 projectId validation added, M1 LanePatch narrowed, M2 MAX_BULK_OPS added, m1-m5 all addressed
- Final senior code review: IN PROGRESS (background)

## Firestore Rules
- No changes needed — lanes collection covered by existing wildcard catch-all at line 731
- Read: admin + producer + all project roles. Write: admin + producer + warehouse.

## Key Files Created
- `src-vnext/features/shots/hooks/useLanes.ts` — Firestore subscription hook
- `src-vnext/features/shots/lib/laneActions.ts` — CRUD + batch operations
- `src-vnext/features/shots/components/SceneHeader.tsx` — collapsible scene header
- `src-vnext/features/shots/components/ScenePicker.tsx` — scene assignment dropdown
- `src-vnext/features/shots/components/GroupIntoSceneDialog.tsx` — bulk scene dialog
- `src-vnext/features/shots/lib/__tests__/sceneGrouping.test.ts` — 9 grouping tests
- `src-vnext/features/shots/lib/__tests__/laneActions.test.ts` — validation tests
- `mockups/s28-shot-scenes.html` — 4-panel interactive mockup (approved)

## Key Files Modified
- `src-vnext/shared/types/index.ts` — Lane interface added
- `src-vnext/shared/lib/paths.ts` — laneDocPath helper
- `src-vnext/features/shots/lib/shotListFilters.ts` — "scene" GroupKey + groupShots case
- `src-vnext/features/shots/hooks/useShotListState.ts` — lane data wiring
- `src-vnext/features/shots/components/ThreePanelLayout.tsx` — deleted guard, share dialog
- `src-vnext/features/shots/components/ThreePanelCanvasPanel.tsx` — ProductSummaryStrip, lifecycle menu, share button
- `src-vnext/features/shots/components/ThreePanelPropertiesPanel.tsx` — projectId props, version history
- `src-vnext/features/shots/components/ShotListPage.tsx` — useLanes, scene grouping, collapse state, dialog
- `src-vnext/features/shots/components/ShotListToolbar.tsx` — Scenes toggle button
- `src-vnext/features/shots/components/BulkActionBar.tsx` — "Group into Scene" button

## What's Next
- Final code review results (background agent)
- ScenePicker in ThreePanelPropertiesPanel (assign scene from properties panel)
- Scene breadcrumb in ThreePanelCanvasPanel ("Part of: Scene Name")
- Table view scene grouping (currently card view only)
- Visual verification via dev server
- PR creation
