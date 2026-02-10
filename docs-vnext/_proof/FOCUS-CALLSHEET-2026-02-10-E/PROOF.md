# PROOF — Focus Callsheet Trust Core E

Date: 2026-02-10
Status: Complete

## Acceptance Scope
See `ACCEPTANCE.md` in this folder.

## Implementation Notes
- Added auto-duration inference engine:
  - `src-vnext/features/schedules/lib/autoDuration.ts`
  - Computes fill patches per track, only for non-banner entries with missing/invalid duration where adjacent start-time delta is valid and positive.
- Wired auto-duration into schedule board lifecycle:
  - `src-vnext/features/schedules/components/ScheduleEntriesBoard.tsx`
  - Applies auto-fill patches via `batchUpdateScheduleEntries` with fingerprint/in-flight guard to avoid duplicate writes and support follow-up passes.
- Fixed direct-start edit cascade interaction:
  - `src-vnext/features/schedules/lib/cascade.ts`
  - When edited entry has missing duration, cascade now infers duration from the next explicit start before shifting downstream rows.
- Added unit coverage:
  - `src-vnext/features/schedules/lib/autoDuration.test.ts`
  - Cases: basic fill, preserve explicit duration, skip invalid delta/banner, multi-track isolation.
  - `src-vnext/features/schedules/lib/cascade.test.ts`
  - Added case for direct-start edit with missing duration inferring from next explicit start.

## Validation Log
1. Targeted tests:
   - `npm run test -- src-vnext/features/schedules/lib/autoDuration.test.ts src-vnext/features/schedules/lib/cascade.test.ts`
   - Result: 2 files passed, 10 tests passed.
2. Lint:
   - `npm run lint`
   - Result: pass (0 warnings).
3. Build:
   - `npm run build`
   - Result: pass.

## Manual QA Checklist
1. Auto-fill on missing duration (same track)
   - In one track, create two entries with start times `9:40 AM` then `10:00 AM`.
   - Clear the first entry’s duration field (leave blank) and save.
   - Expected: first entry duration auto-updates to `20` and second entry remains at `10:00 AM`.
2. Preserve explicit duration
   - Set first entry duration to `30` while second remains at `10:00 AM`.
   - Expected: duration stays `30` (no auto overwrite).
3. Track isolation
   - Repeat step 1 on `Track 2` while `Primary` has no missing durations.
   - Expected: only `Track 2` missing duration auto-fills.
4. Shared/banner exclusion
   - Add a banner in Shared.
   - Expected: no duration auto-fill behavior is applied to banner rows.
