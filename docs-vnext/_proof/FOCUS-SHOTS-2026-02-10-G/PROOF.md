# Proof — FOCUS-SHOTS-2026-02-10-G

**Domain:** SHOTS (PDF Export Fine-Tuning — Phase 3D Follow-up)  
**Focus ID:** FOCUS-SHOTS-2026-02-10-G  
**Date:** 2026-02-10

## Goal

Complete requested Phase 3D follow-up by shipping:
1) calibrated export page estimator,
2) recommended defaults by layout/orientation,
3) explicit “best for speed/readability” guidance in the export UI.

## Implemented

1. **Estimator calibration**
   - Recalibrated density coefficients in `estimateShotsPdfPages()` using observed export outputs.
   - Contact-sheet and run-sheet estimates now align more closely with real page counts from the current shots dataset.
   - Updated copy to clarify estimate is calibrated and content-dependent.

2. **Recommended defaults by layout/orientation**
   - Added `applyRecommendedDefaults(layout, orientation)` and invoked it:
     - when export opens without saved prefs,
     - when user changes layout or orientation.
   - Recommended profile:
     - Contact sheet: `Compact`, `Description ON`, `Addendum Summary`, `Hide empty date/location` ON for landscape and OFF for portrait.
     - Run sheet: `Producer review` preset.

3. **Guidance copy for faster decision-making**
   - Added density guidance text describing when to use Standard/Compact/Maximum.
   - Added run-sheet preset guidance text describing intended use.
   - Added explicit note that defaults auto-adjust on layout/orientation changes.

## Files Changed

- `src-vnext/features/shots/components/ShotsPdfExportDialog.tsx`

## Verification

- `npm run test -- src-vnext/features/shots/lib/buildShotsPdfRows.test.ts` ✅
- `npm run lint` ✅
- `npm run build` ✅

## Manual QA

1. Open shots export dialog with no stored prefs and verify recommended defaults are applied.
2. Switch layout and orientation and verify defaults re-seed to the recommended profile.
3. Check density/preset helper copy reflects current selection.
4. Compare estimated pages to generated PDFs across all four variants (contact/run × portrait/landscape).
