# PROOF — Focus Callsheet Trust Core H

Date: 2026-02-10
Status: Complete

## Acceptance Scope
See `ACCEPTANCE.md` in this folder.

## Implementation Notes
- Added a real location-details module to day details:
  - `src-vnext/features/schedules/components/DayDetailsEditor.tsx`
  - Supports:
    - add/remove modular blocks,
    - label presets (`Basecamp`, `Hospital`, `Parking`, `Production Office`, `Custom`),
    - existing location linking,
    - inline create-location dialog with immediate link back to the active block.
- Added schedules-scoped location hook:
  - `src-vnext/features/schedules/hooks/useLocations.ts`
- Added location write helpers used by callsheet editor:
  - `src-vnext/features/schedules/lib/scheduleWrites.ts`
  - `createLocationAndAssignToProject(...)`
  - `ensureLocationAssignedToProject(...)`
- Hardened day-details location mapping for legacy data:
  - `src-vnext/features/schedules/lib/mapSchedule.ts`
  - `mapDayDetails` now derives `locations[]` from legacy fixed fields/custom arrays when modern `locations` is absent.
  - Added `mapLocationRecord` for schedules location hook mapping.
- Follow-up refinement (post-implementation QA):
  - Selecting an existing library location now always auto-populates day-details `Display Text` and `Details` for that block.
  - New inline-created locations now always auto-populate `Display Text` + `Details`.
  - Address derivation now supports legacy structured location fields (`street`, `unit`, `city`, `province`, `postal`) when a flat `address` value is absent.

## Test Coverage
- Added `src-vnext/features/schedules/components/DayDetailsEditor.test.tsx`
  - verifies add-location block persistence to `dayDetails.locations`
  - verifies inline new-location creation and automatic block linking
- Extended `src-vnext/features/schedules/lib/mapSchedule.test.ts`
  - modern `locations[]` mapping
  - legacy location fallback mapping
  - location record mapping
  - structured-address derivation mapping

## Validation Log
1. Targeted tests:
   - `npm run test -- src-vnext/features/schedules/components/DayDetailsEditor.test.tsx src-vnext/features/schedules/lib/mapSchedule.test.ts src-vnext/features/schedules/lib/projection.test.ts src-vnext/features/schedules/lib/conflicts.test.ts src-vnext/features/schedules/lib/cascade.test.ts src-vnext/features/schedules/lib/autoDuration.test.ts src-vnext/features/schedules/lib/trustChecks.test.ts`
   - Result: 7 files passed, 45 tests passed.
2. Lint:
   - `npm run lint`
   - Result: pass (0 warnings).
3. Build:
   - `npm run build`
   - Result: pass.

## Manual QA Checklist
1. Open `/projects/:id/callsheet?scheduleId=:sid` in builder mode.
2. In Day Details, find the new `Location Details` card under the call-time anchors.
3. Click `Add Location`.
   - Expected: a new block appears (default label suggested, usually `Basecamp` first).
4. Set `Label` preset to `Hospital` (or any preset).
   - Expected: block header updates to that label and persists on reload.
5. In `From Library`, select an existing location.
   - Expected: `Display Text` and `Details` auto-fill when blank; preview day details shows the location under the selected label.
6. Click `New` in a location block, create a new location (name + optional address).
   - Expected: block links to the new location immediately, and data remains after reload.
7. Add a custom label (`Label -> Custom` + `Custom Label` text).
   - Expected: custom title persists and renders in preview day-details locations list.
