# Proof — FOCUS-SHOTS-2026-02-10-A

**Domain:** SHOTS (PDF Export Trust — Phase 1)  
**Focus ID:** FOCUS-SHOTS-2026-02-10-A  
**Date:** 2026-02-10

## Goal

Ship Phase 1 trust fixes for shots PDF export:
- Align hero image resolution behavior with on-screen cards.
- Make missing export images explicit (no silent drops).
- Surface image readiness in export dialogs before download.

## Implemented

1. **Hero resolution parity with shots UI**
   - `buildShotsPdfRows` now resolves hero images using `downloadURL` before `path`, matching shot card behavior.
   - Added row-level export flags:
     - `heroImageRequested`
     - `heroImageMissing`

2. **Explicit fallback inside PDF**
   - Table layout shows `Image unavailable` in hero cells when image embedding fails.
   - Card layout shows a visible fallback tile (`Image unavailable`) when a hero was requested but not embedded.

3. **Preflight image report in export dialogs**
   - Project/export dialog now reports `resolved/requested` hero images and warns when missing images will be marked in the PDF.
   - Single-shot export dialog now reports hero availability state before export.
   - Success toast includes missing-image note when applicable.

4. **Unit coverage**
   - Added `buildShotsPdfRows` tests covering:
     - downloadURL-first resolution priority
     - missing-image flagging
     - disabled-hero bypass

## Files Changed

- `src-vnext/features/shots/lib/buildShotsPdfRows.ts`
- `src-vnext/features/shots/lib/shotsPdfTemplates.tsx`
- `src-vnext/features/shots/components/ShotsPdfExportDialog.tsx`
- `src-vnext/features/shots/components/ShotPdfExportDialog.tsx`
- `src-vnext/features/shots/lib/buildShotsPdfRows.test.ts`

## Verification

- `npm run test -- src-vnext/features/shots/lib/buildShotsPdfRows.test.ts` ✅
- `npm run lint` ✅
- `npm run build` ✅

## Manual QA

1. Open `/projects/:id/shots` with shots that include mixed hero image sources (some resolvable, some broken/legacy).
2. Open **Export** dialog and keep **Include hero images** on.
3. Confirm preflight text shows resolved/requested count and warning when missing.
4. Export PDF (table and cards layouts).
5. Confirm missing heroes are explicitly labeled `Image unavailable` in the PDF output.

