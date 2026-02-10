# Proof — FOCUS-SHOTS-2026-02-10-E

**Domain:** SHOTS (PDF Export Fine-Tuning — Phase 3C)  
**Focus ID:** FOCUS-SHOTS-2026-02-10-E  
**Date:** 2026-02-10

## Goal

Execute the next hardening pass for shots exports:
- fix landscape contact-sheet pagination instability,
- increase practical density separation between Compact vs Maximum,
- improve portrait run-sheet behavior for long content,
- add quick run-sheet preset bundles on top of manual toggles.

## Implemented

1. **Contact-sheet pagination hardening**
   - Two-up contact rows now render with row-level `wrap={false}` so paired cards move to the next page together instead of splitting into footer-adjacent corruption.

2. **Contact-sheet Maximum density tuning**
   - Reduced dense hero footprint and tightened max-mode text budgets.
   - Replaced dense boxed description/addendum blocks with compact inline labels (`Desc`, `Add`) to reduce vertical expansion.
   - Tightened dense talent/product typography to increase card throughput.

3. **Run-sheet portrait tuning + defaults for long content**
   - Updated default run-sheet columns to hide addendum section by default.
   - Tightened portrait budgets for description/addendum and expanded short-status usage in portrait.
   - Increased dense-portrait trigger sensitivity to apply compact behavior earlier.

4. **Run-sheet quick presets (3C UX addition)**
   - Added preset selector with:
     - `Producer review`
     - `Wardrobe run`
     - `Talent blocking`
     - `Custom (manual)`
   - Presets apply bundled defaults for columns + description/addendum settings while preserving manual column controls.

## Files Changed

- `src-vnext/features/shots/lib/shotsPdfTemplates.tsx`
- `src-vnext/features/shots/components/ShotsPdfExportDialog.tsx`

## Verification

- `npm run test -- src-vnext/features/shots/lib/buildShotsPdfRows.test.ts` ✅
- `npm run lint` ✅
- `npm run build` ✅

## Manual QA

1. Export **Contact Sheet / Landscape / Maximum** and verify no bottom-of-page card corruption or overlap.
2. Compare **Landscape Compact vs Maximum** and confirm Maximum materially increases usable density.
3. Export **Run Sheet / Portrait** with long descriptions/addendum and confirm row wrapping remains readable.
4. In run-sheet layout, switch presets and confirm:
   - columns update immediately,
   - description/addendum behavior changes as expected,
   - manual toggles move preset to `Custom (manual)`.
