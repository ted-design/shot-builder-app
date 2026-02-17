# PROOF — Focus Callsheet Shared-Band Sync (2026-02-11 I)

Date: 2026-02-11
Status: Complete

## Acceptance Scope
See `ACCEPTANCE.md` in this folder.

## Implementation Notes
- Introduced synchronized timeline segmentation logic that partitions local entries around shared highlights:
  - `compareEntriesForTimeline`
  - `timelineSegments` derivation
  - `src-vnext/features/schedules/components/ScheduleEntriesBoard.tsx`
- Replaced duplicated per-track shared markers with single full-width shared bands in the flow.
- Added per-track drop-enabled headers for moving entries into track containers while preserving add actions.
- Preserved local entry card editing + drag/reorder behavior in segmented track rows.

## Validation Log
1. Targeted tests:
   - `npm run test -- src-vnext/features/schedules/components/ScheduleEntryEditSheet.test.tsx src-vnext/features/schedules/components/ScheduleEntryCard.test.tsx src-vnext/features/schedules/components/AddCustomEntryDialog.test.tsx src-vnext/features/schedules/components/CallSheetRenderer.test.tsx`
   - Result: pass (4 files, 8 tests).
2. Lint:
   - `npm run lint`
   - Result: pass.
3. Build:
   - `npm run build`
   - Result: pass.

## Manual QA Checklist
1. Add a shared timeline highlight (e.g., 7:00 Lunch) and verify it appears once as a full-width band.
2. Confirm the band sits at a single aligned height across both track columns.
3. Confirm local entries above/below that band remain editable and draggable.
4. Confirm track header add buttons and drop targets still function.
5. Confirm empty schedule still shows explicit empty state.
