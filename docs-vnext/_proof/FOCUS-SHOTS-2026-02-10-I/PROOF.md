# Proof — FOCUS-SHOTS-2026-02-10-I

**Domain:** SHOTS (PDF Export Phase 3E)  
**Focus ID:** FOCUS-SHOTS-2026-02-10-I  
**Date:** 2026-02-10

## Goal

Implement Phase 3E end-to-end:
1. `3e.1` deterministic contact-sheet density with explicit cards/page override,
2. `3e.2` addendum/text glyph hardening to prevent PDF symbol corruption,
3. `3e.3` run-sheet row density plus readability guardrails.

## Implemented

### 1) Contact-sheet deterministic packing + cards/page override (`3e.1`)

- Added export control: **Cards per page** (`Auto`, `4`, `6`, `8`) in the Shots export dialog.
- Persisted this setting in localStorage (`pdfExport:v2`) and wired it into PDF document generation.
- Added deterministic packing logic in templates:
  - resolved effective density profile by orientation + override,
  - target cards-per-page calculation,
  - fixed card heights by profile,
  - explicit chunking with `break` boundaries to control page packing.
- Updated page estimator to use the same target model so estimate/actual alignment is improved.

### 2) Addendum/text glyph hardening (`3e.2`)

- Strengthened `normalizePdfTextForRender()`:
  - expanded punctuation/symbol normalization (quotes, dashes, bullets, ellipsis, math symbols, TM/R/C),
  - transliteration for accented/special Latin characters,
  - stripping unsupported non-ASCII glyphs after transliteration,
  - whitespace/control cleanup.
- This is a producer-trust safety measure to avoid random replacement glyphs in generated PDFs.

### 3) Run-sheet row density + readability guardrails (`3e.3`)

- Added export control: **Run sheet row density** (`Comfortable`, `Compact`).
- Added table rendering modes for compact rows:
  - tighter row heights,
  - tighter cell paddings,
  - compact text sizing/budgets,
  - compact status/hero treatment where needed.
- Added readability guardrails in the modal:
  - warns when portrait + many columns is too dense,
  - warns when full addendum + many portrait columns risks legibility,
  - warns when compact density is likely unnecessary for sparse column sets.

## Files Changed

- `src-vnext/features/shots/components/ShotsPdfExportDialog.tsx`
- `src-vnext/features/shots/lib/shotsPdfTemplates.tsx`
- `src-vnext/features/shots/lib/buildShotsPdfRows.ts`
- `src-vnext/features/shots/lib/buildShotsPdfRows.test.ts`
- `docs-vnext/_proof/FOCUS-SHOTS-2026-02-10-I/PROOF.md`

## Verification

- `npm run test -- src-vnext/features/shots/lib/buildShotsPdfRows.test.ts` ✅
- `npm run lint` ✅
- `npm run build` ✅

## Manual QA

1. Export contact sheet in landscape with density `Standard/Compact/Maximum` and verify page count is monotonic (`Standard >= Compact >= Maximum` in total pages).
2. Export contact sheet with cards/page override (`4`, `6`, `8`) and verify resulting pages follow selected target profile.
3. Paste addendum text containing smart quotes, em-dash, bullets, trademark symbol, accented characters, and emoji; export and verify rendered text contains safe readable substitutions (no garbled symbols).
4. Export run sheet in portrait with 6+ columns and full addendum; verify guardrail warnings appear in modal.
5. Toggle run sheet row density between `Comfortable` and `Compact`; verify visual row density difference in output.
