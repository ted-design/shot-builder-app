# HANDOFF — Sprint S23: Production Workflow Precision (2026-04-07)

## State
Phases 1-3 + 4B complete. Phase 4A (product deduplication) pending user mockup review. Build clean, lint zero. 158 test files / 1782 tests pass. Production build succeeds.

## What Was Built

### Phase 1: Critical Bug Fixes
- **Ghost shot fix (3 vectors):** (a) `backfillShotDates.ts` no longer touches `deleted` field, (b) `requestWrites.ts` idempotency guard checks `absorbedAsShotId`, (c) client-side defense filter in `useShotListState`
- **Launch date sort fix:** `skuById` threaded to sort comparator. SKU launch date no longer falls back to family aggregate — if SKU has no date, returns null
- **Filter typography:** Missing filter labels now Title Case (Products, Talent, Location, Hero Image)
- **Code review fixes:** SKU data threading in drag view + grouped card view, inline type imports cleaned

### Phase 2: Column & Display Enhancements
- **Shot number column:** Dedicated `#` column (pinned, order 1, 56px, tabular-nums). Removed from title cell
- **Reqs column types:** Shows "On-fig e-comm", "Lifestyle" etc. instead of "2 needed". Falls back to count for family-level data
- **Style number display:** Shown below product names in `text-2xs text-[var(--color-text-subtle)]` in both table and card views
- **Sort cache optimization:** Pre-computed sort keys for launchDate/requirements (O(N) instead of O(N log N))

### Phase 3: Advanced Filtering System
- **9 filter fields:** Status, Tag, Talent, Location, Product, Missing, Launch Date, Has Requirements, Has Hero Image
- **7 operators:** is, is not, is before, is on or after, is between, has no value, equals
- **URL persistence:** Single `filters` param with compact serialization
- **Backward compatible:** Legacy URL params auto-migrate on first load
- **UI:** Condition-based filter sheet with add/remove/update, operator switching, value pickers per field type
- **Files:** filterConditions.ts, filterSerializer.ts, filterEngine.ts + 98 tests
- **State:** useShotListState rewritten — conditions drive everything, backward-compat derived fields

### Phase 4B: Sample Tracking Links
- **Carrier auto-detection:** DHL (10-digit), UPS (1Z*), FedEx (12/15-digit), USPS (20-22 digit), Canada Post (13-16 alpha)
- **Deep links:** Clickable external-link icon on sample rows → opens carrier tracking page
- **Edit form hint:** "Detected: DHL — click to fill" when tracking entered but no carrier
- **32 tests** for all carriers + edge cases

## New Files
| File | Lines | Purpose |
|------|-------|---------|
| `features/shots/lib/filterConditions.ts` | ~80 | Filter types + metadata |
| `features/shots/lib/filterSerializer.ts` | ~140 | URL serialization + legacy migration |
| `features/shots/lib/filterEngine.ts` | ~190 | Condition evaluation engine |
| `features/shots/lib/filterConditions.test.ts` | ~60 | 8 metadata tests |
| `features/shots/lib/filterSerializer.test.ts` | ~200 | 32 serialization tests |
| `features/shots/lib/filterEngine.test.ts` | ~350 | 58 evaluation tests |
| `features/shots/components/AddFilterMenu.tsx` | ~99 | Filter field picker popover |
| `features/shots/components/FilterConditionRow.tsx` | ~124 | Single condition row UI |
| `features/shots/components/FilterValuePicker.tsx` | ~249 | Value input switcher |
| `shared/lib/carrierDetection.ts` | ~105 | Carrier detection + URL generation |
| `shared/lib/carrierDetection.test.ts` | ~130 | 32 carrier detection tests |
| `docs/mockups/product-merge-wizard.html` | ~325 | Interactive merge wizard mockup |

## Pending
- [ ] User review of product merge wizard mockup
- [ ] Phase 4A: Product deduplication implementation (after mockup approval)
- [ ] Git commit + PR
- [ ] CLAUDE.md update for S23 infrastructure
- [ ] Plan.md checkbox updates

## To Resume
1. Read this file
2. Check if user approved the merge wizard mockup
3. If yes, implement Phase 4A
4. If not, iterate on mockup based on feedback
