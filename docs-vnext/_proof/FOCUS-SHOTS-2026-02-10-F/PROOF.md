# Proof — FOCUS-SHOTS-2026-02-10-F

**Domain:** SHOTS (PDF Export Fine-Tuning — Phase 3D)  
**Focus ID:** FOCUS-SHOTS-2026-02-10-F  
**Date:** 2026-02-10

## Goal

Complete Phase 3D by improving practical readability controls and investigating/mitigating addendum character glitches in PDF output.

## Implemented

1. **Producer addendum glyph hardening (root-cause mitigation)**
   - Added `normalizePdfTextForRender()` in the PDF row builder.
   - Text now normalizes problematic pasted Unicode/control characters before PDF rendering:
     - smart quotes/dashes normalized,
     - zero-width/control characters stripped,
     - non-breaking spaces normalized,
     - uncommon bullets normalized to print-safe separators.
   - Applied this normalization to title, shot number, location/talent/products lines, description, and `notesAddendum` in exported rows.

2. **Contact-sheet readability control (dense mode support)**
   - Added `hideEmptyMeta` option (`Hide empty date/location`) for contact-sheet exports.
   - Contact cards now conditionally hide `No date`/`No location` placeholders when the toggle is on.

3. **Export predictability UX**
   - Added an estimated page count hint in the export dialog (`Estimated pages: ~N`), based on layout, orientation, density, and visibility settings.

4. **Verification coverage update**
   - Extended `buildShotsPdfRows` tests to verify text normalization behavior and addendum sanitization for PDF-safe rendering.

## Files Changed

- `src-vnext/features/shots/lib/buildShotsPdfRows.ts`
- `src-vnext/features/shots/lib/buildShotsPdfRows.test.ts`
- `src-vnext/features/shots/lib/shotsPdfTemplates.tsx`
- `src-vnext/features/shots/components/ShotsPdfExportDialog.tsx`

## Verification

- `npm run test -- src-vnext/features/shots/lib/buildShotsPdfRows.test.ts` ✅
- `npm run lint` ✅
- `npm run build` ✅

## Manual QA

1. Paste addendum text containing smart quotes, em dashes, bullets, and non-breaking spaces; export PDF and verify output is clean/readable (no stray replacement glyphs).
2. Export contact sheet with `Hide empty date/location` ON and verify cards with missing date/location omit those placeholder tokens.
3. Toggle layout/orientation/density/columns and confirm estimated page hint updates immediately.
