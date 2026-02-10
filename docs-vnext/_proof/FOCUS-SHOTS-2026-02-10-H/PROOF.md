# Proof — FOCUS-SHOTS-2026-02-10-H

**Domain:** SHOTS (PDF Export Modal Stability Hotfix)  
**Focus ID:** FOCUS-SHOTS-2026-02-10-H  
**Date:** 2026-02-10

## Goal

Stop export-dialog flicker/regression introduced during Phase 3D follow-up while preserving new export controls.

## Root Cause

Two reactive loops were causing repeated state churn in the modal:

1. **Load-preferences effect re-fired while open**
   - The load effect depended on `layout` and `orientation` while also setting related state.
   - Result: repeated preference/default reapplication in active dialog sessions.

2. **Shot-array identity churn retriggered heavy effects**
   - Preview and hero preflight effects depended on raw `shots` array identity.
   - Parent re-renders could supply a new array instance with unchanged data, retriggering both effects and causing visible UI flicker.

## Implemented

1. **Scoped load-preferences effect to open lifecycle**
   - Removed `layout` and `orientation` from load effect dependency list.
   - Effect now runs from open/storage context, not every layout/orientation state transition.

2. **Stabilized shot-dependent effect dependencies**
   - Added `timestampDependencyKey()` helper.
   - Added `shotsDependencyKey` memo from shot ids/order/status/media/location/counts/updatedAt.
   - Updated preview and hero preflight effects to depend on `shotsDependencyKey` instead of raw `shots` reference.

## Files Changed

- `src-vnext/features/shots/components/ShotsPdfExportDialog.tsx`
- `docs-vnext/_proof/FOCUS-SHOTS-2026-02-10-H/PROOF.md`

## Verification

- `npm run lint` ✅
- `npm run test -- src-vnext/features/shots/lib/buildShotsPdfRows.test.ts` ✅
- `npm run build` ✅

## Manual QA

1. Open `Shots > Export` repeatedly and confirm no modal flicker on initial open.
2. Toggle scope/layout/orientation and confirm modal remains stable.
3. Open scope dropdown and interact with controls; verify dialog does not visibly remount/churn.
4. Confirm hero availability helper text updates normally and does not thrash.
