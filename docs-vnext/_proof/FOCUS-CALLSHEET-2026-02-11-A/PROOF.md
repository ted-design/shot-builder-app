# PROOF — Focus Callsheet Trust Core (2026-02-11 A)

Date: 2026-02-11
Status: Complete

## Acceptance Scope
See `ACCEPTANCE.md` in this folder.

## Implementation Notes
- Upgraded add-shot modal row density and context:
  - `src-vnext/features/schedules/components/AddShotToScheduleDialog.tsx`
  - Now shows shot number, description preview, talent summary, location, and tag chips.
- Expanded search indexing:
  - modal search now matches title, shot number, description, talent names, tag labels, and location name.
- Added talent lookup wiring from callsheet builder:
  - `src-vnext/features/schedules/components/CallSheetBuilderPage.tsx`
  - `src-vnext/features/schedules/components/ScheduleEntriesBoard.tsx`
  - add-shot modal receives talent records for name resolution.
- Added dialog accessibility description (`DialogDescription`) for modal semantics.
- Added deterministic tag color normalization in shared badge rendering:
  - `src-vnext/shared/lib/tagColors.ts`
  - `src-vnext/shared/components/TagBadge.tsx`
  - legacy/non-palette colors now resolve to stable palette keys by tag id for consistent visuals across screens.

## Test Coverage
- Added:
  - `src-vnext/features/schedules/components/AddShotToScheduleDialog.test.tsx`
  - `src-vnext/shared/lib/tagColors.test.ts`
- Test verifies:
  - richer metadata rendering,
  - search by talent name,
  - result filtering behavior,
  - deterministic tag color normalization for legacy/non-palette values.

## Validation Log
1. Targeted tests:
   - `npm run test -- src-vnext/features/schedules/components/AddShotToScheduleDialog.test.tsx src-vnext/shared/lib/tagColors.test.ts`
   - Result: pass.
2. Lint:
   - `npm run lint`
   - Result: pass.
3. Build:
   - `npm run build`
   - Result: pass.

## Manual QA Checklist
1. Open call sheet builder and click `Add Shot`.
2. Confirm each row shows richer context (description/talent/location/tags when available).
3. Search by a talent name that appears in a shot.
   - Expected: matching shot remains, non-matching shots are filtered out.
4. Add a shot to a non-primary track.
   - Expected: add behavior and track assignment remain correct.
