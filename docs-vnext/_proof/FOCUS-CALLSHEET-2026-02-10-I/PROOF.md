# PROOF — Focus Callsheet Trust Core I

Date: 2026-02-10
Status: Complete

## Acceptance Scope
See `ACCEPTANCE.md` in this folder.

## Implementation Notes
- Replaced legacy custom-entry type picker with single highlight composer:
  - `src-vnext/features/schedules/components/AddCustomEntryDialog.tsx`
  - Inputs: title, description, emoji, style variant, color.
  - Added quick emoji preset palette for fast one-click selection (manual emoji input still supported).
- Added highlight metadata to schedule entry contract:
  - `src-vnext/shared/types/index.ts`
  - `ScheduleEntryHighlight` and `ScheduleEntry.highlight`.
- Persisted highlight metadata during custom-entry writes:
  - `src-vnext/features/schedules/lib/scheduleWrites.ts`
- Mapped highlight metadata on read:
  - `src-vnext/features/schedules/lib/mapSchedule.ts`
- Updated schedule board add flow to new model:
  - `src-vnext/features/schedules/components/ScheduleEntriesBoard.tsx`
  - Track-local add writes `setup` + highlight metadata.
  - Shared add writes shared banner semantics + highlight metadata.
- Updated schedule card display semantics:
  - `src-vnext/features/schedules/components/ScheduleEntryCard.tsx`
  - Highlight entries now render with style color/variant and optional emoji.
  - Existing entries now support inline title editing (including shot and shared highlight cards) via click-to-edit title control.
- Updated preview rendering semantics:
  - `src-vnext/features/schedules/components/CallSheetRenderer.tsx`
  - `src-vnext/features/schedules/components/AdvancedScheduleBlockSection.tsx`

## Test Coverage
- Added `src-vnext/features/schedules/components/AddCustomEntryDialog.test.tsx`
  - verifies single highlight model and payload shape.
- Added `src-vnext/features/schedules/components/ScheduleEntryCard.test.tsx`
  - verifies inline title editing saves updated title.
- Extended `src-vnext/features/schedules/lib/mapSchedule.test.ts`
  - verifies highlight metadata mapping.

## Validation Log
1. Targeted tests:
   - `npm run test -- src-vnext/features/schedules/components/AddCustomEntryDialog.test.tsx src-vnext/features/schedules/lib/mapSchedule.test.ts src-vnext/features/schedules/components/DayDetailsEditor.test.tsx`
   - Result: 3 files passed, 12 tests passed.
2. Lint:
   - `npm run lint`
   - Result: pass (0 warnings).
3. Build:
   - `npm run build`
   - Result: pass.

## Manual QA Checklist
1. Open call sheet builder and click `+` in a track.
2. Confirm modal title is `Add Highlight Block` and there is no Setup/Break/Move/Banner selector.
3. Create highlight with emoji/title/description/style/color.
   - Expected: block appears in track with chosen style and emoji.
4. Create highlight from Shared column.
   - Expected: appears in Shared and preview shows highlight styling + emoji.
5. Verify existing legacy `break`/`move` rows still render and behave as before.
