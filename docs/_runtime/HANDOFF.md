# HANDOFF — Sprint S19 In Progress (2026-04-02)

## State
S19 implementation complete. Build clean, lint zero, 150 test files / 1573 tests pass. Pending: code review resolution, Codex validation, visual browser verification.

## What Was Built (2 features, 5 new files, 15 modified files)

### Feature 1: Per-Colorway Launch Dates
- **Per-SKU date editing in Colorways section** — `InlineDateField` wired to each `ProductSkuCard` with compact mode. Shows "Family" or "Custom" label, overdue/soon badges.
- **Per-SKU date editing in Requirements section** — `InlineDateField` wired to each `SkuRequirementsRow` with full edit mode.
- **"Apply to all colorways" checkbox** — When editing the family-level launch date in `ProductLaunchDateField`, a checkbox appears: "Apply to all N colorways". Checked = batch updates family + all SKUs atomically via `writeBatch`.
- **`earliestLaunchDate` denormalization fix** — `updateProductSkuLaunchDateWithSync()` batches the SKU write + family `earliestLaunchDate` recomputation in a single `writeBatch`. Prevents shoot readiness from showing stale data.

### Feature 2: Product Version Tracking
- **`ProductVersion` type** with `fieldChanges` array storing structured before→after values per field (enhancement over shot versioning which only stores field names).
- **`productVersioning.ts`** library mirroring `shotVersioning.ts` — `createProductVersionSnapshot()`, `restoreProductVersion()`, `buildFieldChanges()`, `humanizeFieldLabel()`.
- **`useProductVersions` hook** — lazy-load subscription to `productFamilyVersionsPath`, limit 25.
- **`ProductVersionHistorySection` UI** — collapsible panel in Activity tab showing who changed what with before→after values (e.g., "Launch Date: Apr 5 → Apr 10"). Restore capability: admin/producer only, desktop-only.
- **Version snapshots wired into all product write paths** — `updateProductFamilyLaunchDate`, `updateProductSkuLaunchDateWithSync`, `updateProductSkuAssetRequirements`, `applyLaunchDateToAllSkus`, `createProductFamilyWithSkus`, `updateProductFamilyWithSkus`. All best-effort, fire-and-forget.

## Deployment
- No Firestore rules changes needed (version subcollection rules already exist)
- No new collections or fields (all existed in types/rules)
- No new npm dependencies

## Verification Status
- [x] Code review findings resolved (4 fixes: batch guard, dedup timestampToInputValue, restore dialog copy, formatFieldValue Timestamp handling)
- [x] Codex CLI validation — BLOCKED: ChatGPT account does not support any Codex models (gpt-5.4-high, o4-mini all rejected). Code review by claude code-reviewer agent completed instead (zero CRITICAL, 1 HIGH fixed, 4 MEDIUM fixed).
- [x] Visual verification in browser — all features confirmed working:
  - Per-SKU launch date editing in Colorways section (compact InlineDateField)
  - Per-SKU launch date editing in Requirements section (full InlineDateField)
  - "Apply to all 4 colorways" checkbox on family launch date
  - Version history showing "Black: Launch Date: — → May 15, 2026" with user attribution
  - Restore button visible for admin on desktop
- [x] CLAUDE.md updated with S19 infrastructure notes (Section 10)

## What's Next
- [ ] Codex CLI validation (pending)
- [ ] Update Plan.md with S19 checkboxes

## To Resume
Read this file, then `CHECKPOINT.md`, then `CLAUDE.md` Hard Rule #6b (no deferring).
