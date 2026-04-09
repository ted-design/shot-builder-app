# CHECKPOINT — Sprint S27: Course Correction (2026-04-09)

## Build clean. Lint zero. 162 test files / 1892 tests pass.

## Sprint S27 — Implementation Progress
- [x] WS1: Crew permissions in Firestore rules (13 read rules fixed)
- [x] WS2a: firestoreSanitize utility + merge undefined error fix
- [x] WS2b: Cross-gender/category conflict detection in merge wizard
- [x] WS3: Talent picker — only Booked visible by default
- [x] WS4: Renumber shots with filters + custom start number
- [x] WS5: Batch operations — status, tags, location, talent
- [x] WS6: Internal casting page enrichment (votes, profiles, detail sheet)
- [ ] Visual verification + documentation updates

## New Files Created
- `src-vnext/shared/lib/firestoreSanitize.ts` (28 lines)
- `src-vnext/shared/lib/__tests__/firestoreSanitize.test.ts` (100 lines)
- `src-vnext/features/shots/lib/bulkShotUpdates.ts` (170 lines)
- `src-vnext/features/shots/components/BulkActionBar.tsx` (258 lines)
- `src-vnext/features/casting/hooks/useCastingVoteAggregates.ts` (293 lines)
- `src-vnext/features/casting/components/AdminTalentDetailSheet.tsx` (275 lines)
- `src-vnext/features/shots/lib/__tests__/shotNumbering.test.ts` (agent-created, 19 tests)

## What's Next
- Code review findings — address CRITICAL/HIGH
- Deploy Firestore rules
- Visual verification in Chrome
- Commit + PR
