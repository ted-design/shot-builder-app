# Proof — FOCUS-SHOTS-2026-02-17-C

**Domain:** SHOTS (Lifecycle Actions + Dedicated Reference Links)  
**Focus ID:** FOCUS-SHOTS-2026-02-17-C  
**Date:** 2026-02-17

## Goal

Ship producer-safe shot lifecycle controls and replace notes-only URL handling with a dedicated, icon-first reference links section.

## Implemented

1. Added a dedicated `referenceLinks` shot field contract:
   - `[{ id, title, url, type }]` where `type` is `web | video | document`.
   - Added normalization + URL/type inference helpers.
   - Wired mapping from Firestore into vNext shot model.

2. Added Shot Detail **Reference links** section:
   - Renders links as icon + title rows (web/video/document).
   - Shows hostname secondary text.
   - Full URL revealed on hover (tooltip).
   - Click opens link in a new tab.
   - Producer/admin/crew desktop editing supports add/remove.

3. Added Shot Detail **Lifecycle actions** menu (producer/admin desktop):
   - Duplicate in project (unique copy title, shot number reset).
   - Copy to another project (new shot doc, lane cleared, shot number reset).
   - Move to another project (project reassignment, lane cleared).
   - Delete shot (soft-delete with typed `DELETE` confirmation).

4. Added Shot List lifecycle action access (producer/admin desktop):
   - Lifecycle menu is now available in gallery cards, visual cards, and table rows.
   - Table view now includes an explicit `Actions` column.
   - Hook usage was lifted to page scope so we do not create project/shot subscriptions per-card.

5. Added one-time notes migration prompt for structured links:
   - Detects URLs in `notesAddendum` and suggests import into `referenceLinks`.
   - Dedupes against existing links and normalizes domains/URLs.
   - Prompt supports `Import links` and `Not now` (shot-scoped localStorage dismissal).

6. Added shot-list display option for formatted reference links:
   - `Display` panel now supports toggling `Reference links` as a shot property.
   - Rendered in gallery cards, visual cards, and table view with icon + title formatting.
   - Table rows render links as safe new-tab anchors without triggering row navigation.

7. Added editing workflow for existing reference links:
   - Each link row now supports edit mode for `title`, `url`, and `type`.
   - Save path enforces URL normalization and duplicate URL guardrails.
   - Existing remove behavior remains available.

8. Updated slice contract notes (`slice-2-shot-editing.md`) to reflect lifecycle + links extension and remove outdated deferred markers.

## Files Changed

- `src-vnext/shared/types/index.ts`
- `src-vnext/features/shots/lib/referenceLinks.ts` (new)
- `src-vnext/features/shots/lib/referenceLinks.test.ts` (new)
- `src-vnext/features/shots/lib/mapShot.ts`
- `src-vnext/features/shots/lib/mapShot.test.ts`
- `src-vnext/features/shots/lib/shotVersioning.ts`
- `src-vnext/features/shots/components/CreateShotDialog.tsx`
- `src-vnext/features/shots/lib/updateShot.test.ts`
- `src-vnext/features/shots/lib/shotLifecycleActions.ts` (new)
- `src-vnext/features/shots/lib/shotLifecycleActions.test.ts` (new)
- `src-vnext/features/shots/lib/notesLinkMigration.ts` (new)
- `src-vnext/features/shots/lib/notesLinkMigration.test.ts` (new)
- `src-vnext/features/shots/components/ShotReferenceLinksSection.tsx` (new)
- `src-vnext/features/shots/components/ShotReferenceLinksSection.test.tsx` (new)
- `src-vnext/features/shots/components/NotesSection.tsx`
- `src-vnext/features/shots/components/ShotLifecycleActionsMenu.tsx` (new)
- `src-vnext/features/shots/components/ShotDetailPage.tsx`
- `src-vnext/features/shots/components/ShotCard.tsx`
- `src-vnext/features/shots/components/ShotVisualCard.tsx`
- `src-vnext/features/shots/components/DraggableShotList.tsx`
- `src-vnext/features/shots/components/ShotListPage.tsx`
- `src-vnext/features/shots/components/__tests__/ShotListPage.test.tsx`
- `docs-vnext/slices/slice-2-shot-editing.md`
- `docs-vnext/_proof/FOCUS-SHOTS-2026-02-17-C/PROOF.md`

## Verification

- `npm run test -- src-vnext/features/shots/components/__tests__/ShotListPage.test.tsx src-vnext/features/shots/components/ShotReferenceLinksSection.test.tsx src-vnext/features/shots/lib/notesLinkMigration.test.ts src-vnext/features/shots/lib/shotLifecycleActions.test.ts src-vnext/features/shots/components/__tests__/ShotDetailPage.test.tsx` ✅
- `npm run lint` ✅
- `npm run build` ✅

## Manual QA

1. Open `/projects/:id/shots/:sid` as producer/admin:
   - Confirm kebab actions menu appears near Share/Export.
2. Duplicate:
   - Run **Duplicate in project** and confirm a new shot is created with `(Copy)` naming and blank shot number.
3. Copy:
   - Run **Copy to another project…** and confirm new shot exists in target project with lane cleared.
4. Move:
   - Run **Move to another project…** and confirm current shot navigates into target project detail route.
5. Delete:
   - Run **Delete shot…**, verify `DELETE` gate blocks accidental confirmation, then confirm shot disappears from current project shot list.
6. Reference links:
   - Add web/video/document links and verify icon + title rendering.
   - Hover each row to see full URL tooltip.
   - Click each row and confirm new-tab navigation.
7. Shot list lifecycle actions:
   - In gallery, visual, and table views, confirm each row/card shows the shot lifecycle kebab menu.
   - In table view, confirm `Actions` column appears and does not trigger row-open on click.
8. Notes URL migration prompt:
   - On a shot with URLs in `notesAddendum` and no `referenceLinks`, confirm import prompt appears once.
   - Click **Import links** and verify links are appended + prompt dismisses.
   - On another shot, click **Not now** and verify prompt remains dismissed for that shot.
9. Shot list reference-link property:
   - Open **Display** and enable **Reference links**.
   - Confirm link rows appear as icon + title in cards/table for shots with `referenceLinks`.
10. Reference link editing:
    - In Shot Detail > Reference links, click the edit icon on any link.
    - Update title, URL, and type, save changes, and verify row updates persist.
