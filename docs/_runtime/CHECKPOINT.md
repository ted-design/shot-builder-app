# CHECKPOINT — Sprint S20 Complete (2026-04-02)

## Build clean. Lint zero. 150 test files / 1574 tests pass.

## Files Changed

### New Files (6)
| File | Purpose | Lines |
|------|---------|-------|
| `features/dashboard/components/ReadinessCard.tsx` | Extracted card with sample cross-reference | 418 |
| `features/dashboard/components/ExpandedFamilySkus.tsx` | Extracted SKU rows | 169 |
| `features/dashboard/components/ReadinessToolbar.tsx` | Search + sort + filter controls | 98 |
| `features/dashboard/components/BulkClearLaunchDatesDialog.tsx` | Bulk date clearing dialog | 113 |
| `features/dashboard/lib/readinessFilters.ts` | Pure filter + sort functions | 95 |

### Modified Files (8)
| File | Change |
|------|--------|
| `shared/types/index.ts` | Added `activeRequirementCount` to ProductFamily |
| `features/products/lib/mapProduct.ts` | Map `activeRequirementCount` |
| `features/products/lib/productWorkspaceWrites.ts` | Batch-sync `activeRequirementCount` |
| `features/products/hooks/useShootReadiness.ts` | Tier 4 eligibility + `skusWithFlags` + `earliestSampleEta` |
| `features/products/lib/shootReadiness.ts` | Added `earliestSampleEta` to ShootReadinessItem |
| `features/products/components/SkuRequirementsRow.tsx` | Thread `allSkus` to asset requirements write |
| `features/dashboard/components/ShootReadinessWidget.tsx` | Decomposed + filters + selection UX + dual action bar (881→263 lines) |
| `features/dashboard/components/ShootReadinessWidget.test.tsx` | Updated for new UI structure + new filter tests |

## Stats
- 150 test files, 1574 tests pass (1 new test added)
- Lint: zero warnings
- Build: clean
- Widget decomposed: 881 → 263 lines orchestrator
