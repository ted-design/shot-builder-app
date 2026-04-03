# HANDOFF — Sprints S19 + S20 Complete (2026-04-03)

## State
S19 + S20 fully complete. 5 PRs merged to main (#382-#386). Backfill migration executed. Build clean, lint zero, 1574 tests pass.

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
- No Firestore rules changes
- No new npm dependencies
- Backfill migration already executed (215 families)

## What's Next
- Canvas image editor backlog (S19 original backlog item)
- Monitor denormalized counts for drift (self-corrects on next sample/requirement interaction)

## To Resume
Read this file, then `CHECKPOINT.md`, then `CLAUDE.md` Hard Rule #6b (no deferring).
