# PROOF — Focus Callsheet AB Layout Step (2026-02-11 G)

Date: 2026-02-11
Status: Complete

## Acceptance Scope
See `ACCEPTANCE.md` in this folder.

## Implementation Notes
- Removed dedicated shared-column layout branch from schedule board and replaced it with an integrated full-width highlights lane:
  - `src-vnext/features/schedules/components/ScheduleEntriesBoard.tsx`
- Maintained shared-entry drag/edit/remove behavior by preserving the `shared` container and sortable context in the new lane.
- Kept track columns focused on track-local entries while preserving existing card editing patterns and drag flow.
- Updated user-facing copy to avoid misleading shared-column semantics.

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
1. On a multi-track call sheet, verify only track columns are shown (no third shared column).
2. Verify `Highlights` lane appears in the same schedule editor flow.
3. Add a new highlight from the lane and confirm it appears there.
4. Drag-reorder highlights in the lane and confirm order persists.
5. Edit an existing highlight from the lane and confirm style/time changes persist.
6. Confirm track columns still support drag and edit for track-local entries.
