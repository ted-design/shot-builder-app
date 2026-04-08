# HANDOFF — Sprint S25: UX Course Correction (2026-04-07)

## State
4 workstreams implemented with 10 agents, 2 validation passes, 4 code reviews. Build clean, lint zero. 160 test files / 1847 tests pass. Firestore rules updated (1 line: `withdrawn` vote decision).

## What Was Built

### 1. Casting Share Enhancement
- **Portfolio images bug fixed** — `galleryUrls` were resolved but never rendered. Now shown as `PortfolioThumbnailStrip` (4 thumbnails + "+N" overflow)
- **Casting session images** — `resolveTalentForShare.ts` now resolves `castingSessions[].images[].path` into `castingImageUrls` (capped at 12). Shown prominently in detail overlay as "Casting Photos"
- **Vote withdrawal** — `'withdrawn'` added to allowed decision values in Firestore rules. Clicking same vote button writes `decision: 'withdrawn'` (not null). UI treats as "not voted". Excluded from tallies and progress
- **Labeled measurements** — Replaced cryptic `W25 · D2` with `Height: 5'10.5" · Waist: 25" · Dress: 2` using shared `formatLabeledMeasurements`
- **Comment-only** — Comments persist locally without a vote. Hint: "Vote to save your note"
- **TalentDetailSheet** — Right-side Sheet showing full talent profile (large headshot, casting photos, portfolio, measurements, vote buttons). Opens from "View full profile" link or card click
- **PublicCastingCard extracted** — 728→619 lines in main page
- Files: `PublicCastingCard.tsx` (new), `PortfolioThumbnailStrip.tsx` (new), `TalentDetailSheet.tsx` (new), `PublicCastingReviewPage.tsx` (modified), `resolveTalentForShare.ts` (modified), `CastingCard.tsx` (modified)

### 2. Link Management Improvements
- **Pull shares bug fixed** — Removed `where("shareEnabled", "==", true)` filter that hid disabled pulls. Disabled shares now visible with "Disabled" badge
- **Open/Preview action** — ExternalLink icon button opens public page in new tab
- **Summary stats bar** — `ShareLinkStats` shows "3 active · 1 disabled · 1 expired" with color-coded dots
- **Engagement improvements** — All types show meaningful data: "12 shots", "3 talent · 7 votes", "8 items" (previously "--" for non-casting)
- **Expandable rows** — Click row to see up to 10 content items (shot titles, talent names, pull items). "and X more" overflow
- **29 unit tests** for mappers and status computation
- Files: `ShareLinkStats.tsx` (new), `ShareLinkExpandedDetail.tsx` (new), `shareLinkTypes.test.ts` (new), `useShareLinks.ts`, `shareLinkTypes.ts`, `ShareLinkRow.tsx`, `SharedLinksPage.tsx` (modified)

### 3. Talent Deletion Safety
- **Soft delete** — `softDeleteTalent` uses `updateDoc` with `deleted: true, deletedAt, deletedBy, updatedBy`. No images deleted (preserved for undo)
- **Undo toast** — 5-second sonner toast with "Undo" button that calls `undoDeleteTalent`
- **Dependency checking** — `checkTalentDependencies` queries shots (`talentIds array-contains`) and casting board entries (per-project doc existence check). Client-side `deleted !== true` filter (not server-side `where`)
- **Enhanced confirmation** — `DeleteTalentDialog` shows loading spinner, dependency list (collapsible shots/casting boards), typed "DELETE" confirmation
- **Query filters** — Both `useTalentLibrary` and `useTalent` (picker) now filter `deleted !== true` via `useMemo`
- Old `deleteTalent` deprecated with JSDoc
- Files: `talentDependencies.ts` (new), `DeleteTalentDialog.tsx` (new), `talentWrites.ts`, `TalentDialogs.tsx`, `LibraryTalentPage.tsx`, `useTalentLibrary.ts`, `usePickerData.ts` (modified)

### 4. Talent Detail Panel Redesign
- **551→195 line orchestrator** + 5 extracted section components
- **TalentHeroZone** — 176px headshot, `heading-page` name (no truncation), agency, gender badge, upload/remove
- **TalentContactSection** — Email, phone, URL (agency/gender moved to hero)
- **TalentMeasurementsSection** — Grouped by Stature/Body/Clothing using `MEASUREMENT_CATEGORY_GROUPS`
- **TalentNotesSection** — Bounded textarea (max-h-[240px])
- **TalentPortfolioSection** — grid-cols-2, DnD, ImageLightbox on click
- **InlineEdit enhanced** — `showEditIcon` prop adds pencil icon on hover. Keyboard accessible (role="button", tabIndex, Enter/Space)
- **Tab bar** — ARIA-compliant with arrow key navigation
- **Shared ImageLightbox** — Gallery navigation, keyboard + swipe, replaces one-off headshot dialog
- Files: 5 new section components, `TalentDetailPanel.tsx` (rewritten), `InlineEdit.tsx` (enhanced), `ImageLightbox.tsx` (new shared)

### Shared Infrastructure (Phase 0)
- `ImageLightbox` — `src-vnext/shared/components/ImageLightbox.tsx`
- `formatLabeledMeasurements` — overloaded: compact mode (string) / labeled mode (array)
- `MEASUREMENT_CATEGORY_GROUPS` — Stature/Body/Clothing, gender-aware
- `TalentRecord` type — added `deleted`, `deletedAt`, `deletedBy` fields
- `ResolvedCastingTalent` type — added `castingImageUrls` field

## Firestore Rules Change
- Added `'withdrawn'` to casting vote decision enum (lines 223 and 236)
- **Must be deployed**: `firebase deploy --only firestore:rules`

## What's Next
- Deploy Firestore rules to production
- Visual verification of all 4 workstreams in the live dev server
- Update Plan.md, Architecture.md, CLAUDE.md with S25 infrastructure

## Verification
- Build: clean (`npm run build`)
- Lint: zero warnings (`npm run lint`)
- Tests: 160 files / 1847 passing (`npm test`)
- TypeScript: zero errors in all modified files
