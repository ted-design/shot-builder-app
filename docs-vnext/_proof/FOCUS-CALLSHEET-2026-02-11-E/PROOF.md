# PROOF — Focus Callsheet P0/P1 IA + Edit Affordance (2026-02-11 E)

Date: 2026-02-11
Status: Complete

## Acceptance Scope
See `ACCEPTANCE.md` in this folder.

## Implementation Notes
- Wired card-level edit affordance through board sorting wrappers into a dedicated edit side sheet:
  - `src-vnext/features/schedules/components/ScheduleEntriesBoard.tsx`
  - `src-vnext/features/schedules/components/ScheduleEntryEditSheet.tsx`
- Completed P1 card IA cleanup:
  - Track rendered as passive badge, not inline dropdown
  - Edit/remove actions are always visible on cards
  - `src-vnext/features/schedules/components/ScheduleEntryCard.tsx`
- Added behavior coverage:
  - `src-vnext/features/schedules/components/ScheduleEntryCard.test.tsx`

## Validation Log
1. Targeted tests:
   - `npm run test -- src-vnext/features/schedules/components/ScheduleEntryCard.test.tsx src-vnext/features/schedules/components/CallSheetRenderer.test.tsx src-vnext/features/schedules/components/CallSheetOutputControls.test.tsx src-vnext/features/schedules/components/AddShotToScheduleDialog.test.tsx src-vnext/shared/lib/tagColors.test.ts`
   - Result: pass (5 files, 12 tests).
2. Lint:
   - `npm run lint`
   - Result: pass.
3. Build:
   - `npm run build`
   - Result: pass.
4. Typecheck spot-check:
   - `npx tsc --noEmit`
   - Result: fails due pre-existing unrelated type issues in shots/pdf and day-details mapping files; no new errors introduced by this increment.

## Manual QA Checklist
1. In Call Sheet schedule editor, confirm each entry card shows an `Edit entry` control without hover hunting.
2. Click `Edit entry` on a shot entry:
   - update title/time/duration/notes
   - confirm changes persist and card updates.
3. In the sheet for a non-shared entry, change track and confirm move/cascade behavior remains valid.
4. Open a shared/banner entry and confirm no misleading track-move control is shown.
5. Confirm cards show track as compact label and no inline track dropdown overflows card bounds.
