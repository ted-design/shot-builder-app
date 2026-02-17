# Proof — FOCUS-SHOTS-2026-02-17-A

**Domain:** SHOTS (List Display Notes Visibility)
**Focus ID:** FOCUS-SHOTS-2026-02-17-A
**Date:** 2026-02-17

## Goal

Enable producers to surface shot notes in any shots list view (Gallery, Visual, Table) with display-level control and trust-safe preview behavior.

## Implemented

1. Added `notes` to persisted shots list display fields (`sb:shots:list:<clientId>:<projectId>:fields:v1`).
2. Added Notes toggle controls in Display sheet for:
   - Gallery cards
   - Visual cards
   - Table columns
3. Added notes rendering to:
   - `ShotCard` (gallery/mobile cards)
   - `ShotVisualCard` (visual mode)
   - `ShotsTable` (table mode notes column)
4. Added shared helper `getShotNotesPreview()` to keep note preview rules consistent:
   - prefer `notesAddendum`
   - fallback to legacy `notes` HTML via safe text preview
5. Updated display presets:
   - Storyboard: notes off
   - Prep: notes on
6. Added test coverage for notes visibility in table, gallery, and visual modes.

## Files Changed

- `src-vnext/features/shots/components/ShotListPage.tsx`
- `src-vnext/features/shots/components/ShotCard.tsx`
- `src-vnext/features/shots/components/ShotVisualCard.tsx`
- `src-vnext/features/shots/lib/shotListSummaries.ts`
- `src-vnext/features/shots/components/__tests__/ShotListPage.test.tsx`
- `docs-vnext/_proof/FOCUS-SHOTS-2026-02-17-A/PROOF.md`

## Verification

- `npm run test -- src-vnext/features/shots/components/__tests__/ShotListPage.test.tsx` ✅
- `npm run lint` ✅
- `npm run build` ✅

## Manual QA

1. Open `/projects/:id/shots` and confirm Display panel includes Notes toggles in Gallery, Visual, and Table modes.
2. Enable Notes in Gallery and verify note snippet appears on cards.
3. Switch to Visual, enable Notes, verify note snippet appears under shot title.
4. Switch to Table, enable Notes, verify Notes column renders snippets.
5. For a shot with both `notesAddendum` and `notes`, verify list views show addendum text first.
