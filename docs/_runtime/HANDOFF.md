# HANDOFF — Sprint S20 Complete (2026-04-02)

## State
S20 implementation complete. Build clean, lint zero, 150 test files / 1574 tests pass. Visual verification done in browser.

## What Was Built

### Feature 1: Shoot Readiness Filtering
- **"Has shoot requirements" toggle** (default ON) — only shows products with active asset requirements (`activeRequirementCount > 0`). Persisted to `localStorage` key `sb:readiness-requirements-filter`.
- **Sample status filter** — dropdown: All, Awaiting samples, Samples arrived, No samples tracked.
- **Search** — client-side filter by product family name.
- **New eligibility condition** — Products with `activeRequirementCount > 0` now appear in readiness even without launch dates or samples (Tier 4).

### Feature 2: Selection UX Overhaul
- **Always-visible checkboxes** on every card (no toggle mode, no "Select" button).
- **Inline [+] quick-add button** per card for single-product add-to-project.
- **Sticky dual-action bar** within the widget: "Clear Dates" + "Add to Project".
- **"All" / "Clear" selection helpers** in the header.

### Feature 3: Sample Cross-Reference
- **Sample ETA displayed** on readiness cards: "2/4 samples arrived, ETA: Apr 10".
- **"X need shoot" count** displayed when `skusWithFlags > 0`.
- **`earliestSampleEta`** added to `ShootReadinessItem` interface and mapped through.

### Feature 4: Bulk Launch Date Clearing
- **BulkClearLaunchDatesDialog** — confirmation dialog listing selected products, warning about readiness view changes.
- Clears family + all SKU dates via `applyLaunchDateToAllSkus` (sequential per-family processing).
- Version snapshots created per-family (existing infrastructure).

### Feature 5: Widget Decomposition
- 881-line monolith → 263-line orchestrator + 4 focused sub-components.
- `ReadinessCard.tsx` (418 lines), `ExpandedFamilySkus.tsx` (169 lines), `ReadinessToolbar.tsx` (98 lines), `readinessFilters.ts` (95 lines).

### Infrastructure
- **`activeRequirementCount`** denormalized field on ProductFamily (approved schema addition).
- `updateProductSkuAssetRequirements` now batch-syncs the count to the family doc.
- `useShootReadiness` Tier 4 eligibility: `activeRequirementCount > 0`.
- **Backfill migration needed**: `activeRequirementCount` is `undefined` for existing products until migrated or requirements are edited.

## Deployment
- No Firestore rules changes needed
- Backfill migration recommended (one-time script to compute `activeRequirementCount` for all families)
- No new npm dependencies

## What's Next
- Run backfill migration for `activeRequirementCount`
- Monitor readiness page performance with Tier 4 eligibility expanding the product set

## To Resume
Read this file, then `CHECKPOINT.md`, then `CLAUDE.md` Hard Rule #6b (no deferring).
