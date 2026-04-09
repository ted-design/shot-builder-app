# HANDOFF — Sprint S27: Course Correction (2026-04-09)

## State
Sprint S27 IN PROGRESS. 7 of 8 workstreams implemented. Build clean. Lint zero. 162 test files / 1892 tests passing. Code review running.

## What Was Built

### WS1: Crew Permissions Fix (CRITICAL)
- Added `'crew'` to ~13 `hasProjectRole()` READ rule arrays in `firestore.rules`
- Crew users with project membership can now list projects, read schedules, departments, pulls, activities, etc.
- Write rules unchanged — crew remains read-only on administrative resources
- **Requires deploy:** `firebase deploy --only firestore:rules`

### WS2a: Product Merge Undefined Error Fix
- Created `src-vnext/shared/lib/firestoreSanitize.ts` — recursive `undefined` stripping utility
- Applied `sanitizeForFirestore()` to 4 `batch.set()`/`batch.update()` calls in `productMergeWrites.ts`
- Refactored duplicate sanitize functions in `ShotLooksSection.tsx` and `ActiveLookCoverReferencesPanel.tsx` to use shared import
- 14 unit tests for sanitize utility

### WS2b: Cross-Gender Merge Detection
- Added `hasGenderConflict` and `hasCategoryConflict` flags to `DuplicateGroup` type in `productDedup.ts`
- Red warning banner in `MergeDetectionPanel` when gender/category differs
- Mandatory confirmation checkbox in `MergeComparePanel` when gender differs ("I confirm these products should be merged despite different genders")
- Gender/Category rows in comparison table highlighted red instead of amber
- 7 new tests (39 total dedup tests)

### WS3: Talent Picker — Only Booked Visible
- Restructured `TalentPickerContent` in `TalentPicker.tsx`
- "Currently assigned" section at top for non-booked selected talent
- "Booked" group always expanded
- Hold, Shortlist, Other groups collapsed behind individual toggles with count badges
- Toggles use design token colors (amber for hold, gray for shortlist)

### WS4: Renumber Shots With Filters + Custom Start
- Added `startNumber` parameter to `renumberShots()` and `previewRenumber()` in `shotNumbering.ts`
- Added `suggestStartNumber()` helper for auto-suggesting start numbers
- Updated `RenumberShotsDialog` with start number input and filtered-subset warning banner
- Removed `disabled={hasActiveFilters}` from toolbar — renumber always available
- Dynamic label: "Renumber visible shots" when filters active
- 38 shot numbering tests (19 in each test file)

### WS5: Batch Operations on Shots
- Created `bulkShotUpdates.ts` with 5 batch write functions: status, tags (apply/remove), location, talent (add/merge)
- Extracted `BulkActionBar.tsx` from ShotListPage — includes inline Status Select, Tags Popover, Location Popover, Talent Popover
- ShotListPage reduced from 820 → 771 lines
- All batch ops: writeBatch chunked at 250, max 500 cap, toast feedback

### WS6: Internal Casting Page Enrichment
- Created `useCastingVoteAggregates` hook — subscribes to all castingShares + votes for project, aggregates per-talent
- Created `AdminTalentDetailSheet` — headshot, measurements, portfolio, vote tally bar, reviewer feedback list
- Enhanced `CastingCard` — real vote tally replaces "No votes yet", clickable headshot opens detail sheet
- Wired into `CastingBoardPage` — vote aggregates loaded, detail sheet rendered

## What's Next
- Deploy Firestore rules to production
- Visual verification of all 7 workstreams in Chrome
- Code review findings — address any CRITICAL/HIGH issues
- Commit and PR

## Key Files Modified
- `firestore.rules` — crew permissions
- `src-vnext/shared/lib/firestoreSanitize.ts` — NEW
- `src-vnext/features/products/lib/productMergeWrites.ts` — sanitize applied
- `src-vnext/features/products/lib/productDedup.ts` — conflict flags
- `src-vnext/features/products/components/MergeDetectionPanel.tsx` — warning banner
- `src-vnext/features/products/components/MergeComparePanel.tsx` — confirm checkbox
- `src-vnext/features/shots/components/TalentPicker.tsx` — booked-only default
- `src-vnext/features/shots/lib/shotNumbering.ts` — startNumber param
- `src-vnext/features/shots/components/RenumberShotsDialog.tsx` — start input + warning
- `src-vnext/features/shots/components/ShotListToolbar.tsx` — renumber always enabled
- `src-vnext/features/shots/components/ShotListPage.tsx` — BulkActionBar extraction
- `src-vnext/features/shots/lib/bulkShotUpdates.ts` — NEW
- `src-vnext/features/shots/components/BulkActionBar.tsx` — NEW
- `src-vnext/features/casting/hooks/useCastingVoteAggregates.ts` — NEW
- `src-vnext/features/casting/components/AdminTalentDetailSheet.tsx` — NEW
- `src-vnext/features/casting/components/CastingCard.tsx` — vote tally
- `src-vnext/features/casting/components/CastingBoardPage.tsx` — wiring

## Verification
- Build: clean (`npm run build`)
- Lint: zero warnings (`npm run lint`)
- Tests: 162 files / 1892 passing (`npm test`)
