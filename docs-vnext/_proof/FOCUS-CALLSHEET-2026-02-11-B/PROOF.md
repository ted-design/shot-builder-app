# PROOF — Focus Callsheet Trust Core (2026-02-11 B)

Date: 2026-02-11
Status: Complete

## Acceptance Scope
See `ACCEPTANCE.md` in this folder.

## Implementation Notes
- Added canonical output color defaults constant:
  - `src-vnext/features/schedules/lib/callSheetConfig.ts`
  - `DEFAULT_CALLSHEET_COLORS`
- Added `Reset Defaults` control in output colors section:
  - `src-vnext/features/schedules/components/CallSheetOutputControls.tsx`
  - Applies all three fields (`primary`, `accent`, `text`) in one patch.
  - Disabled when current values already match defaults.
- Updated builder to use shared defaults constant (no hardcoded drift):
  - `src-vnext/features/schedules/components/CallSheetBuilderPage.tsx`

## Test Coverage
- Added:
  - `src-vnext/features/schedules/components/CallSheetOutputControls.test.tsx`
- Test verifies:
  - reset action dispatches canonical default patch,
  - reset action disables in already-default state.

## Validation Log
1. Targeted tests:
   - `npm run test -- src-vnext/features/schedules/components/CallSheetOutputControls.test.tsx src-vnext/features/schedules/components/AddShotToScheduleDialog.test.tsx src-vnext/shared/lib/tagColors.test.ts`
   - Result: pass.
2. Lint:
   - `npm run lint`
   - Result: pass.
3. Build:
   - `npm run build`
   - Result: pass.

## Manual QA Checklist
1. Open call sheet builder output panel.
2. Change one or more of Primary/Accent/Text colors.
3. Click `Reset Defaults`.
   - Expected: all three inputs return to default values immediately.
4. Without changing colors, verify `Reset Defaults` is disabled.
