# Proof — FOCUS-SHOTS-2026-02-10-D

**Domain:** SHOTS (PDF Export Fine-Tuning — Phase 3B.1 + 3B.2)  
**Focus ID:** FOCUS-SHOTS-2026-02-10-D  
**Date:** 2026-02-10

## Goal

Finalize Phase 3B by shipping:
- deterministic contact-sheet density behavior (especially landscape 2-up),
- improved portrait run-sheet legibility,
- producer-facing export controls for density, addendum detail, and run-sheet columns.

## Implemented

1. **Deterministic contact-sheet row packing (3B.1)**
   - Replaced flexible wrap-based card flow with explicit 2-card line packing for 2-up modes.
   - Contact sheets now render fixed-width paired card rows with stable gutters in landscape and max-density portrait.

2. **Higher-density card presets (3B.1)**
   - Tuned spacing and text budgets for `compact` and `max` density modes.
   - `max` mode now aggressively constrains description/addendum/talent/products and uses denser hero/text sizing to increase cards-per-page.

3. **Portrait run-sheet readability tuning (3B.1)**
   - Added portrait-specific table typography and row compaction.
   - Added compact status pills with short labels in dense portrait tables to prevent awkward wrapping.
   - Tightened portrait text budgets for description/talent/products at high visible-column counts.

4. **New export customization controls (3B.2)**
   - Added **Contact sheet density** control: `Standard`, `Compact`, `Maximum`.
   - Added **Addendum detail** control: `Full text` vs `Summary`.
   - Added **Run sheet column toggles**: Hero, Date, Location, Talent, Products, Status, Addendum section.
   - Persisted all new settings in local storage (`pdfExport:v2`) with backward compatibility fallback to `v1`.

## Files Changed

- `src-vnext/features/shots/components/ShotsPdfExportDialog.tsx`
- `src-vnext/features/shots/lib/shotsPdfTemplates.tsx`

## Verification

- `npm run test -- src-vnext/features/shots/lib/buildShotsPdfRows.test.ts` ✅
- `npm run lint` ✅
- `npm run build` ✅

## Manual QA

1. Export **Contact Sheet / Landscape** in `Standard` and `Maximum` density.
   - Confirm 2-up deterministic row packing with stable gutter and no fallback to single full-width cards.
2. Export **Contact Sheet / Portrait / Maximum**.
   - Confirm increased per-page card density and controlled text growth.
3. Export **Run Sheet / Portrait** with all columns ON.
   - Confirm status badges remain legible and rows do not collapse into unreadable wrapping.
4. Toggle run-sheet columns OFF/ON (e.g., hide Products, hide Hero, hide Addendum section) and confirm export output matches toggles.
5. Toggle addendum detail between `Full text` and `Summary` and confirm truncation behavior changes in both layouts.
