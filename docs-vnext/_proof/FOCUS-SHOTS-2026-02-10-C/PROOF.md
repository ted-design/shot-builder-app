# Proof — FOCUS-SHOTS-2026-02-10-C

**Domain:** SHOTS (PDF Export Fine-Tuning — Phase 3A)  
**Focus ID:** FOCUS-SHOTS-2026-02-10-C  
**Date:** 2026-02-10

## Goal

Improve export readability and page efficiency using structural tuning only (no new user-facing controls yet):
- better landscape contact-sheet density,
- better run-sheet behavior in portrait,
- clearer status legibility,
- controlled text growth to reduce runaway row/card heights.

## Implemented

1. **Orientation-aware contact sheet flow**
   - Landscape contact sheet now uses a 2-up grid container (`49%` card cells) instead of full-width single-column cards.
   - Landscape card variant uses a compact hero frame and side-by-side talent/products sections.

2. **Orientation-aware run sheet tuning**
   - Run sheet column flex ratios now vary by orientation (landscape vs portrait) to improve scanability.
   - Portrait run sheet uses compact hero thumbnails and tighter line budgets.

3. **Text growth control**
   - Added deterministic `compactText()` truncation for description/addendum blocks (orientation-specific budgets).
   - Added tighter orientation-based line budgets for talent/products in run sheet and contact cards.

4. **Status legibility hardening**
   - Status pill text no longer forces uppercase, reducing awkward wrapping/hyphen-like breaks in narrow columns.

5. **Single-shot export orientation tuning**
   - Shot detail export hero frame is slightly shorter in landscape for improved balance.

## Files Changed

- `src-vnext/features/shots/lib/shotsPdfTemplates.tsx`

## Verification

- `npm run test -- src-vnext/features/shots/lib/buildShotsPdfRows.test.ts` ✅
- `npm run lint` ✅
- `npm run build` ✅

## Manual QA

1. Export **Contact Sheet (Landscape)** and verify:
   - cards render in 2-up flow,
   - card height is controlled (less vertical bloat),
   - scan speed is improved vs previous 1-up landscape output.
2. Export **Run Sheet (Portrait)** and verify:
   - status labels no longer split awkwardly,
   - rows are more compact but still readable.
3. Export **Run Sheet (Landscape)** and verify:
   - line wrapping remains stable for products/addendum,
   - no column collapse at first-page density.
4. Export a single shot in landscape and verify hero proportion feels balanced.

