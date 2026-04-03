# CHECKPOINT — Sprints S19 + S20 Complete (2026-04-03)

## 5 PRs merged. Build clean. Lint zero. 150 test files / 1574 tests pass.

## PR History
| PR | Title | Lines |
|----|-------|-------|
| #382 | feat: per-colorway launch dates, product version tracking | +1,697 / -182 |
| #383 | feat: shoot readiness overhaul — filtering, selection UX, sample cross-reference | +1,258 / -833 |
| #384 | fix: mobile card targets, date order, filter default | +25 / -8 |
| #385 | fix: sample count denormalization + filter logic correction | +115 / -10 |
| #386 | chore: backfill migration for denormalized counts | +189 |

## Key Infrastructure Added
- `ProductVersion` type with `fieldChanges` (before→after)
- `productVersioning.ts` — versioning library (382 lines)
- `activeRequirementCount` on ProductFamily (denormalized, atomic sync)
- `sampleCount` / `samplesArrivedCount` / `earliestSampleEta` now maintained atomically via `writeBatch` in sample CRUD
- Widget decomposed: `ShootReadinessWidget` 881→263 lines + 5 sub-components
- Backfill migration script: `scripts/migrations/2026-04-backfill-denormalized-counts.ts`
