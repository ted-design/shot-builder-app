# PROOF — Focus Callsheet Trust Core (2026-02-11 C)

Date: 2026-02-11
Status: Complete

## Acceptance Scope
See `ACCEPTANCE.md` in this folder.

## Implementation Notes
- Wired `accent` into canonical renderer root style variables:
  - `src-vnext/features/schedules/components/CallSheetRenderer.tsx`
  - Adds `--doc-accent` when `config.colors.accent` is present.
- Applied accent semantics to renderer metadata/emphasis:
  - shot number + metadata labels (`Talent`, `Location`) in schedule rows
  - day details labels (`Weather`, location titles)
  - overridden time emphasis in Talent/Crew rows
- Applied the same accent semantics to advanced schedule rendering:
  - `src-vnext/features/schedules/components/AdvancedScheduleBlockSection.tsx`
  - shot number + metadata labels
  - simultaneous-band label

## Test Coverage
- Updated:
  - `src-vnext/features/schedules/components/CallSheetRenderer.test.tsx`
- Test verifies:
  - renderer sets `--doc-accent` from config,
  - schedule shot-number accent labels read from accent variable.

## Validation Log
1. Targeted tests:
   - `npm run test -- src-vnext/features/schedules/components/CallSheetRenderer.test.tsx src-vnext/features/schedules/components/CallSheetOutputControls.test.tsx src-vnext/features/schedules/components/AddShotToScheduleDialog.test.tsx src-vnext/shared/lib/tagColors.test.ts`
   - Result: pass.
2. Lint:
   - `npm run lint`
   - Result: pass.
3. Build:
   - `npm run build`
   - Result: pass.

## Manual QA Checklist
1. Open call sheet builder and change `Output -> Colors -> Accent`.
2. Open Preview.
3. Confirm accent appears on schedule metadata labels and override-time emphasis.
4. With multi-track/simultaneous schedule rows, confirm accent appears in advanced schedule labels as well.
