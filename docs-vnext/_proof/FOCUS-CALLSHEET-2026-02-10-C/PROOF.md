# PROOF — Focus Callsheet Trust Core C

Date: 2026-02-10
Status: Complete

## Acceptance Scope
See `ACCEPTANCE.md` in this folder.

## Root-Cause Clarification
- The QA screenshots came from `src-vnext/features/schedules/...` call sheet, not legacy `src/components/callsheet/...`.
- This increment applies fixes on the active `src-vnext` surface.

## Implementation Notes
- Added shared classifier in `src-vnext/features/schedules/lib/time.ts`:
  - `classifyTimeInput(input, { allowText })`
  - classifies: `time | text | empty | invalid-time`
  - canonicalizes valid time to `HH:MM`
- Updated override save behavior in `src-vnext/features/schedules/components/CallOverridesEditor.tsx`:
  - Talent/Crew override saves now use classifier
  - time override -> `callTime=HH:MM, callText=null`
  - text override -> `callTime=null, callText=text`
  - malformed time-like -> explicit toast error, no write
  - override row display now formats valid `callTime` to 12h, keeps text overrides as-is
- Updated day-detail saves in `src-vnext/features/schedules/components/DayDetailsEditor.tsx`:
  - Crew/Shooting/Breakfast/1st/2nd/Wrap use same classifier
  - malformed time-like input rejected with toast
  - valid input persisted as canonical `HH:MM`
- Added read-time sanitization in `src-vnext/features/schedules/lib/mapSchedule.ts`:
  - Day details times normalized to canonical valid time or null
  - Talent/Crew `callTime`/`callText` normalized with time-or-text semantics
  - invalid stored values like `24:00` no longer leak into mapped UI data
- Updated renderer formatting in `src-vnext/features/schedules/components/CallSheetRenderer.tsx`:
  - day detail times render as 12h from canonical values
  - talent/crew rows show `callTime` (formatted) or `callText` fallback

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

## Manual QA Checklist (Visible Deltas)
1. Talent override invalid time rejection
   - In `Talent Overrides`, edit a row call time to `24:00`, then click away.
   - Expected: error toast appears, value does not persist as `24:00`.
2. Talent override text mode
   - Set talent override to `OFF`.
   - Expected: row shows `OFF` (text override), preview talent section shows `OFF`.
3. Crew override invalid time rejection
   - In `Crew Overrides`, edit a row call time to `24:00`, blur.
   - Expected: error toast appears, value does not persist.
4. Day details canonical + 12h display
   - Edit `Crew Call` to `18:30`.
   - Expected: saves successfully; display reads `6:30 PM` in editor and preview.
5. Legacy bad value cleanup
   - If a row had old `24:00` persisted, refresh page.
   - Expected: mapped row no longer displays `24:00`; fallback/default behavior applies.
