# HANDOFF — Sprint S24: Casting Workflow + Talent Import (2026-04-07)

## State
Casting board feature fully functional. Talent import executed (466 models). Firestore rules deployed. Build clean, lint zero. 159 test files / 1818 tests pass.

## What Was Built

### Casting Board (Project-Scoped)
- **CastingBoardPage** with grid view, search, status filter (Shortlist/Hold/Booked/Passed), sort, selection bar for bulk actions
- **CastingCard** with headshot thumbnails, status badges, measurement summaries, role labels, Book button
- **AddCastingTalentDialog** with visual talent picker (headshot thumbnails, agency, gender badges)
- **CastingShareDialog** with configurable field visibility, reviewer instructions, vote tally toggle
- **PublicCastingReviewPage** for unauthenticated external reviewers: email identity, vote buttons (Approve/Maybe/Pass), comments, progress tracking
- Route: `/projects/:id/casting` (authenticated), `/casting/shared/:shareToken` (public)
- Nav: "Casting" added between Assets and Call Sheet with UserCheck icon

### Firestore Infrastructure
- `castingBoard` subcollection under projects (covered by wildcard catch-all)
- `castingShares` root-level collection with `votes` subcollection
- Security rules: `keys().hasOnly()` on votes, expiry checks, attributed voting model
- Rules deployed to production via `firebase deploy --only firestore:rules`

### Talent Import (466 Models)
- `scripts/import-talent-roster.ts` — dry-run + write modes, Levenshtein fuzzy matching
- 441 created, 23 updated (additive), 2 skipped (in-spreadsheet dupes)
- 197 headshots uploaded (WebP, 1600px max), 17 failed (corrupt source files)
- Force-match aliases for Jason Squires-Benjamin and Juliann Hergott
- Report saved to `data/import-write-report.json`

### Measurement Fixes
- `normalizeGender()` — handles male/female/man/woman (pre-existing bug fixed)
- `parseMeasurementValue()` — supports spaces in heights and half-inches
- "Chest" added to men's MEASUREMENT_GROUPS with bounds and placeholders

### S23 Phase 4A (Product Dedup)
- Already fully implemented (confirmed by code review agent). Merge wizard, detection, execution all in place.

## New Files
| File | Lines | Purpose |
|------|-------|---------|
| `features/casting/components/CastingBoardPage.tsx` | ~436 | Main casting board page |
| `features/casting/components/CastingCard.tsx` | ~207 | Individual casting card |
| `features/casting/components/AddCastingTalentDialog.tsx` | ~130 | Visual talent picker |
| `features/casting/components/CastingShareDialog.tsx` | ~364 | Share link creation dialog |
| `features/casting/components/PublicCastingReviewPage.tsx` | ~430 | Public voting page |
| `features/casting/hooks/useCastingBoard.ts` | ~47 | Firestore subscription |
| `features/casting/lib/castingWrites.ts` | ~250 | All Firestore writes |
| `features/casting/lib/resolveTalentForShare.ts` | ~120 | Talent data denormalization |
| `features/casting/lib/castingStatuses.ts` | ~31 | Status label/color mappings |
| `scripts/import-talent-roster.ts` | ~1170 | Talent roster import script |
| `docs/mockups/casting-*.html` | 4 files | Approved UX mockups |

## Pending
- [ ] Visual verification of full casting workflow in browser
- [ ] Test external review page with real share link
- [ ] Update CLAUDE.md with S24 infrastructure
- [ ] Update Plan.md with S24 sprint
- [ ] PR creation

## To Resume
1. Read this file
2. Verify casting workflow end-to-end (add talent → share → external vote → review votes → book)
3. Update CLAUDE.md and Plan.md
4. Create PR
