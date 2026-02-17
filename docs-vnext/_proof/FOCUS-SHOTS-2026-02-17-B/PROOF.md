# Proof — FOCUS-SHOTS-2026-02-17-B

**Domain:** SHOTS (Notes Preview Density + Linkability)
**Focus ID:** FOCUS-SHOTS-2026-02-17-B
**Date:** 2026-02-17

## Goal

Address trust/usability regressions from the first notes-visibility pass:
1. Notes truncation was too aggressive.
2. Gallery card spacing had an unnecessary gap caused by drag-handle layout.
3. URLs in notes previews were not clickable.

## Implemented

1. Added `NotesPreviewText` component for safe URL-aware note rendering in list surfaces.
   - Detects `https://...` and `www....` URLs.
   - Renders links with `target="_blank"` and stop-propagation behavior so card/row click handlers do not hijack link clicks.
2. Relaxed notes preview truncation budgets:
   - Gallery card preview length increased and clamp expanded.
   - Visual card preview length increased and clamp expanded.
   - Table preview length increased and clamp expanded.
3. Removed phantom vertical gap in gallery cards:
   - Drag handle (`leadingControl`) now renders inline with the header status control instead of reserving its own row.
   - Selection checkbox row remains only when selection mode is active.
4. Added test coverage for clickable note URLs in list cards.

## Files Changed

- `src-vnext/features/shots/components/ShotCard.tsx`
- `src-vnext/features/shots/components/ShotVisualCard.tsx`
- `src-vnext/features/shots/components/ShotListPage.tsx`
- `src-vnext/features/shots/components/NotesPreviewText.tsx` (new)
- `src-vnext/features/shots/components/__tests__/ShotListPage.test.tsx`
- `docs-vnext/_proof/FOCUS-SHOTS-2026-02-17-B/PROOF.md`

## Verification

- `npm run test -- src-vnext/features/shots/components/__tests__/ShotListPage.test.tsx` ✅
- `npm run lint` ✅
- `npm run build` ✅

## Manual QA

1. In Gallery view, confirm no extra blank row appears between notes preview and product/talent/location details while reorder handles are present.
2. In Gallery/Visual/Table, confirm longer notes snippets render before truncating.
3. Add a URL in `notesAddendum` and confirm it is clickable from list previews.
4. Click the URL and confirm it opens in a new tab (and does not navigate into shot detail from card-row click handlers).
