# PROOF — Focus Callsheet Trust Core G

Date: 2026-02-10
Status: Complete

## Acceptance Scope
See `ACCEPTANCE.md` in this folder.

## Implementation Notes
- Banner write semantics are now canonical shared:
  - `src-vnext/features/schedules/components/AddCustomEntryDialog.tsx`
  - `src-vnext/features/schedules/components/ScheduleEntriesBoard.tsx`
  - Banner add flow now writes `trackId: "shared"` and all-track `appliesToTrackIds`.
- Legacy marker compatibility:
  - `src-vnext/features/schedules/lib/mapSchedule.ts`
  - `trackId: "all"` is normalized to `"shared"` on map.
- Projection shared semantics hardened:
  - `src-vnext/features/schedules/lib/projection.ts`
  - Entries with `trackId` marker `shared/all` are treated as all-track banner applicability.
- Shared entries excluded from track-scoped counts/conflicts:
  - `src-vnext/features/schedules/components/ScheduleTrackControls.tsx`
  - `src-vnext/features/schedules/lib/conflicts.ts`

## Test Coverage
- `src-vnext/features/schedules/lib/mapSchedule.test.ts`
  - Added legacy `all -> shared` mapping assertion.
- `src-vnext/features/schedules/lib/projection.test.ts`
  - Added shared-marker and legacy-all marker all-track applicability assertions.
- `src-vnext/features/schedules/lib/conflicts.test.ts`
  - Added guard that shared-marker entries are excluded from same-track conflict checks.

## Validation Log
1. Targeted tests:
   - `npm run test -- src-vnext/features/schedules/lib/mapSchedule.test.ts src-vnext/features/schedules/lib/projection.test.ts src-vnext/features/schedules/lib/conflicts.test.ts src-vnext/features/schedules/lib/trustChecks.test.ts src-vnext/features/schedules/lib/cascade.test.ts src-vnext/features/schedules/lib/autoDuration.test.ts`
   - Result: 6 files passed, 40 tests passed.
2. Lint:
   - `npm run lint`
   - Result: pass (0 warnings).
3. Build:
   - `npm run build`
   - Result: pass.

## Manual QA Checklist
1. Add a banner from Shared (or Add Entry -> Banner).
   - Expected saved semantics: no Primary assignment behavior; banner appears in Shared section.
2. Reload the page and preview.
   - Expected: banner remains shared, rendered as shared/applicable to all tracks.
3. Add/move regular track entries.
   - Expected: track counts reflect only track-local entries (shared banners do not inflate a track count).
