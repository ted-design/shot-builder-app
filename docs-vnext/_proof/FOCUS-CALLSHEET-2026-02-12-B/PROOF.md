# PROOF — Focus Callsheet Timeline Grouping Simplification (2026-02-12 B)

Date: 2026-02-12
Status: Complete

## Acceptance Scope
See `ACCEPTANCE.md` in this folder.

## Implementation Notes
- Reworked schedule-row time formatting in canonical renderer:
  - `src-vnext/features/schedules/components/CallSheetRenderer.tsx`
  - Added compact duration formatter (`2h`, `1h 30m`, `45m`)
  - Entry rows now show start time + duration stack instead of start/end range.
  - Final polish pass tightened spacing/leading and top-aligned time blocks for cleaner print-scale readability.
- Reworked advanced schedule-row time formatting and removed explicit overlap-band range headers:
  - `src-vnext/features/schedules/components/AdvancedScheduleBlockSection.tsx`
  - Overlap groups still render side-by-side grids, but no longer print explicit band range headings.
- Added/updated tests:
  - `src-vnext/features/schedules/components/CallSheetRenderer.test.tsx`
  - Added assertions for compact duration display and absence of legacy range labels.

## Validation Log
1. Targeted tests:
   - `npm run test -- src-vnext/features/schedules/components/CallSheetRenderer.test.tsx src-vnext/features/schedules/components/CallSheetOutputControls.test.tsx`
   - Result: pass (2 files, 7 tests).
2. Lint:
   - `npm run lint`
   - Result: pass.
3. Build:
   - `npm run build`
   - Result: pass.

## Manual QA Checklist
1. Open a multi-track call sheet with overlapping entries.
2. Confirm there are no visible overlap range-group headings (for example `9:10 AM–9:40 AM` group labels).
3. Confirm each entry card shows start time and a second-line compact duration.
4. Confirm entries still appear side-by-side when simultaneous.
