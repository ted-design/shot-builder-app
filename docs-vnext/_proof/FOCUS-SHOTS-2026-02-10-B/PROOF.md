# Proof — FOCUS-SHOTS-2026-02-10-B

**Domain:** SHOTS (PDF Export Design/Layout — Phase 2)  
**Focus ID:** FOCUS-SHOTS-2026-02-10-B  
**Date:** 2026-02-10

## Goal

Upgrade the shots export from a plain data dump into a producer-grade document with:
- clear visual hierarchy,
- scanable metadata,
- deliberate image treatment,
- and consistent print readability.

## Implemented

1. **Full template redesign**
   - Rebuilt `shotsPdfTemplates.tsx` with a new visual system:
     - stronger header typography,
     - summary chips,
     - upgraded table ("Run sheet") layout,
     - upgraded card ("Contact sheet") layout,
     - dedicated single-shot detail layout.

2. **Hero image presentation upgrade**
   - Hero images now render in framed containers with `objectFit: "contain"` for better fidelity and less destructive cropping.
   - Missing/unavailable images are rendered as explicit, styled placeholders.

3. **Status and metadata readability**
   - Added status pills with tonal colors by state (`todo`, `in_progress`, `on_hold`, `complete`).
   - Improved title/meta spacing and section labels for rapid scanning.

4. **Export dialog UX language**
   - Renamed layout options to domain-meaningful labels:
     - `Contact sheet` (cards)
     - `Run sheet` (table)
   - Default list export layout now favors the more visual contact-sheet mode.

## Files Changed

- `src-vnext/features/shots/lib/shotsPdfTemplates.tsx`
- `src-vnext/features/shots/components/ShotsPdfExportDialog.tsx`

## Verification

- `npm run test -- src-vnext/features/shots/lib/buildShotsPdfRows.test.ts` ✅
- `npm run lint` ✅
- `npm run build` ✅

## Manual QA

1. Open `/projects/:id/shots`.
2. Export PDF with **Layout = Contact sheet** and verify:
   - visual hierarchy feels calm and deliberate,
   - hero image framing is readable and not aggressively cropped,
   - status pills and sections are scanable.
3. Export PDF with **Layout = Run sheet** and verify:
   - metadata columns remain readable for larger shot counts,
   - hero/image placeholders are explicit when unavailable.
4. Open a single shot (`/projects/:id/shots/:sid`) and export:
   - hero is prominent,
   - detail sections (description, addendum, talent, products) are structured and legible.

