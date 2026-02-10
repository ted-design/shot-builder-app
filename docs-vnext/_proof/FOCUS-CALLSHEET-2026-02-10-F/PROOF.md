# PROOF — Focus Callsheet Trust Core F

Date: 2026-02-10
Status: Complete

## Acceptance Scope
See `ACCEPTANCE.md` in this folder.

## Implementation Notes
- Added overlap detector:
  - `src-vnext/features/schedules/lib/conflicts.ts`
  - Detects same-track overlap pairs using parsed start times and effective duration logic (explicit duration first, inferred from next start when missing, default duration fallback).
  - Ignores banners and treats track scope explicitly.
- Added overlap unit tests:
  - `src-vnext/features/schedules/lib/conflicts.test.ts`
- Added write-time conflict guard in schedule board:
  - `src-vnext/features/schedules/components/ScheduleEntriesBoard.tsx`
  - Before committing time-sensitive patches, simulates resulting entries and blocks writes that introduce new same-track overlaps.
  - Applies to start-time edits, duration edits, reorder/move patch commits, and cross-track moves.
- Added explicit trust warning for existing overlaps:
  - `src-vnext/features/schedules/lib/trustChecks.ts`
  - New warning id: `track-overlap-conflicts`.
  - Covered by tests in `src-vnext/features/schedules/lib/trustChecks.test.ts`.

## Validation Log
1. Targeted tests:
   - `npm run test -- src-vnext/features/schedules/lib/conflicts.test.ts src-vnext/features/schedules/lib/trustChecks.test.ts src-vnext/features/schedules/lib/cascade.test.ts src-vnext/features/schedules/lib/autoDuration.test.ts`
   - Result: 4 files passed, 33 tests passed.
2. Broader schedule regression sweep:
   - `npm run test -- src-vnext/features/schedules/lib/time.test.ts src-vnext/features/schedules/lib/mapSchedule.test.ts src-vnext/features/schedules/lib/transforms.test.ts src-vnext/features/schedules/lib/trustChecks.test.ts src-vnext/features/schedules/lib/cascade.test.ts src-vnext/features/schedules/lib/autoDuration.test.ts src-vnext/features/schedules/lib/conflicts.test.ts`
   - Result: 7 files passed, 46 tests passed.
3. Lint:
   - `npm run lint`
   - Result: pass (0 warnings).
4. Build:
   - `npm run build`
   - Result: pass.

## Manual QA Checklist
1. Prevent same-track overlap via time edit
   - In one track, set entry A `9:00 AM` duration `60`, then set entry B to `9:30 AM`.
   - Expected: save is blocked and a conflict toast appears; entries remain unchanged.
2. Prevent same-track overlap via duration edit
   - Set entry A `9:00 AM` duration `30`, entry B `9:40 AM`.
   - Increase entry A duration to `60`.
   - Expected: save is blocked with conflict toast.
3. Cross-track simultaneous remains valid
   - Put one entry at `9:00 AM` in Primary and one at `9:00 AM` in Track 2.
   - Expected: no conflict toast; both entries persist.
4. Existing overlap warning visibility
   - Open a schedule that already has same-track overlap data.
   - Expected: `Heads up` shows a schedule conflict warning naming the affected track/entries.
