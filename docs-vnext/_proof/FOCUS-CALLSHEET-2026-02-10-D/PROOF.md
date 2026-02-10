# PROOF — Focus Callsheet Trust Core D

Date: 2026-02-10
Status: Complete

## Acceptance Scope
See `ACCEPTANCE.md` in this folder.

## Implementation Notes
- Added reusable typed time control:
  - `src-vnext/features/schedules/components/TypedTimeInput.tsx`
  - Supports hour/minute/AM-PM, minute-step validation (5-minute increments), optional text mode, clear/cancel/save.
- Replaced free-text day detail time inputs:
  - `src-vnext/features/schedules/components/DayDetailsEditor.tsx`
- Replaced talent/crew override inline free-text with typed control (text override retained):
  - `src-vnext/features/schedules/components/CallOverridesEditor.tsx`
- Replaced schedule day-start free-text field:
  - `src-vnext/features/schedules/components/ScheduleTrackControls.tsx`
- Replaced schedule entry inline time free-text editor:
  - `src-vnext/features/schedules/components/ScheduleEntryCard.tsx`
- Patched direct start-time edit cascade behavior to reorder by edited time and ripple downstream:
  - `src-vnext/features/schedules/components/ScheduleEntriesBoard.tsx`
  - `src-vnext/features/schedules/lib/cascade.ts`
  - `src-vnext/features/schedules/lib/cascade.test.ts`

## Validation Log
1. Targeted tests:
   - `npm run test -- src-vnext/features/schedules/lib/time.test.ts src-vnext/features/schedules/lib/mapSchedule.test.ts src-vnext/features/schedules/lib/transforms.test.ts src-vnext/features/schedules/lib/cascade.test.ts src-vnext/features/schedules/lib/trustChecks.test.ts`
   - Result: 5 files passed, 33 tests passed.
2. Lint:
   - `npm run lint`
   - Result: pass (0 warnings).
3. Build:
   - `npm run build`
   - Result: pass.

## Manual QA Checklist
1. Day details typed time
   - Open Crew Call field, choose hour/min/AM-PM, Save.
   - Expected: value updates immediately and remains on refresh.
2. Talent override text mode
   - In Talent Overrides, switch mode to `Text`, enter `OFF`, Save.
   - Expected: row shows `OFF`; preview talent section shows `OFF`.
3. Crew override time mode
   - In Crew Overrides, set a time using picker, Save.
   - Expected: value displays in 12h; persists.
4. Minute-step enforcement
   - Enter minute value not divisible by 5 (e.g. `07`) and Save.
   - Expected: explicit validation error; no save.
5. Schedule entry time
   - Edit a schedule card time with typed control and Save.
   - Expected: card moves to the correct chronological position in-track (if needed) and downstream entries recascade from the edited entry.
6. Day start field
   - In Tracks panel, set Day Start via typed control.
   - Expected: value persists and normal schedule behavior remains intact.
