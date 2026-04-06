# HANDOFF — Permissions Fix + Admin Comment Moderation (2026-04-05)

## State
All fixes implemented and deployed. Build clean, 206 tests pass. Firestore rules deployed twice (P0 then P2).

## What Was Fixed

### Firestore Rules: Admin User Doc CREATE — P0 (deployed)
- `firestore.rules:333` — CREATE rule was self-only, blocking admin invite of existing Firebase Auth users
- Fixed: `isAdmin() || (isAuthed() && request.auth.uid == userId)`
- Resolves: "missing or insufficient permissions" when inviting andrew@unboundmerino.com

### Export Reports: saveReport Defensive Hardening — P1
- `useExportReports.ts` — `setDoc(merge: true)` → `updateDoc` for save path

### Admin Comment Moderation — P2 (deployed)
- Shot + product comment Firestore rules: added `isAdmin()` to update rule (Option C — full immutable field protection for everyone)
- `ShotCommentsSection.tsx` — admins see "Remove" button on others' comments, with confirm dialog
- `ProductActivitySection.tsx` — same pattern, with confirm dialog for admin moderation
- Request comments unchanged (immutable audit trail by design)
- Admin-only (not producers). Write functions reused unchanged.

## Previous State (S19 + S20)
S19 + S20 fully complete. 5 PRs merged to main (#382-#386). Backfill migration executed.

## What Was Built

### Sprint S19 (PR #382) — Per-Colorway Launch Dates + Product Version Tracking
- Per-SKU inline launch date editing in Colorways + Requirements sections
- "Apply to all colorways" checkbox on family launch date
- `earliestLaunchDate` denormalization fix (atomic batch sync)
- Product version tracking with before→after field changes (`ProductVersionFieldChange`)
- Version history UI in Activity tab with restore capability
- 26 unit tests for versioning library

### Sprint S20 (PRs #383-#386) — Shoot Readiness Overhaul
- **Widget decomposition:** 881→263 lines + 5 focused sub-components
- **Filtering toolbar:** search, sort, "Has shoot requirements" toggle, sample status filter
- **Selection UX:** always-visible checkboxes, inline [+] quick-add, sticky dual-action bar
- **Sample cross-reference:** ETA dates + arrival counts on cards, "X need shoot" badges
- **Bulk launch date clearing:** confirmation dialog with sequential per-family processing
- **`activeRequirementCount`** denormalized field on ProductFamily (approved, backfilled)
- **Sample count denormalization fix:** `createProductSample` and `updateProductSample` now atomically sync `sampleCount`, `samplesArrivedCount`, `earliestSampleEta` to family doc via `writeBatch`
- **Filter logic correction:** "Has shoot requirements" shows products with launch dates AND/OR requirements (not requirements-only)
- **Mobile UX fix:** card body tap expands/collapses on mobile (< 768px), navigates on desktop
- **Shoot window date fix:** start clamped to never exceed end for overdue products
- **Backfill migration** executed: 215 families, all 4 denormalized fields populated

## Deployment
- **Firestore rules deployed** (user doc CREATE fix + comment moderation)
- No new npm dependencies
- Backfill migration already executed (215 families)

## What's Next
- Canvas image editor backlog (S19 original backlog item)
- Monitor denormalized counts for drift (self-corrects on next sample/requirement interaction)

## To Resume
Read this file, then `CHECKPOINT.md`, then `CLAUDE.md` Hard Rule #6b (no deferring).
