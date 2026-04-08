# HANDOFF — Sprint S26: Shots Experience Overhaul (2026-04-08)

## State
Phase 4 (Shots Page Visual Polish) COMPLETE. All 4 phases done. Build clean. Lint zero.

## Sprint S26 Status
1. **Launch Date Fix** — Phase 1 COMPLETE (prior session)
2. **Table Reorder** — Phase 2 COMPLETE (prior session)
3. **Shot Detail UX** — Phase 3 COMPLETE (prior session)
4. **Shots Page Polish** — Phase 4 COMPLETE (this session)

## Phase 4 — What Was Built (this session)

### WS4a — Inline Filter Dropdowns (`ShotListToolbar.tsx`, `ShotListPage.tsx`)
- Removed "Filters" button and "Display" button from toolbar
- Added **Status** inline Popover dropdown: checkboxes for Draft/In Progress/On Hold/Shot with live counts from `insights.statusCounts`. Active state: blue border + tinted background + count badge on trigger
- Added **Missing** inline Popover dropdown: checkboxes for Products/Talent/Location/Image with counts. Same active state pattern
- "More filters" ghost button for advanced conditions (tag, talent, location, product, date range). Highlighted with count badge when advanced conditions are active. Opens `ShotListFilterSheet` unchanged
- **Removed insights bar entirely** — status/missing counts now live inside the dropdown popovers
- Active filter badges row (removable chips) kept below toolbar
- Compact "Showing X of Y" counter added inline in toolbar (right of spacer, left of view toggle)
- `ShotListDisplaySheet` no longer rendered (file kept, unused)

### WS4b — Renumber in Sort Dropdown
- `SelectSeparator` + `SelectItem value="__renumber__"` added at bottom of sort Select
- Only rendered when `canReorder` is true
- Disabled with visual mute when `hasActiveFilters` is true (guard: prevents number collisions on filtered views)
- `onValueChange` intercepts `__renumber__` value, opens `RenumberShotsDialog`, does NOT update sort key

### WS4c — Design System Audit
- Both modified files: zero hardcoded hex colors, zero `text-[Npx]` patterns confirmed via lint + grep
- All colors use `var(--color-*)` CSS tokens
- Typography uses semantic classes (`text-2xs`, `text-xs`, `text-sm`)

## What's Next
- Sprint S26 fully complete — PR/merge for all phases
- Recreate existing casting share links (old shares have 12-image cap)
- E2E auth emulator fix (pre-existing)

## Key Files Modified (Phase 4)
- `src-vnext/features/shots/components/ShotListToolbar.tsx` — replaced Filters/Display buttons with inline Status/Missing Popover dropdowns + Showing counter + Renumber in sort
- `src-vnext/features/shots/components/ShotListPage.tsx` — removed insights bar, removed ShotListDisplaySheet, wired new toolbar props, added extraFilterCount

## Previous Phase (Phase 3 — Shot Detail UX Overhaul)

### WS3a — Layout Hierarchy (`ShotDetailPage.tsx`)
- Description section moved above Hero Image section
- ProductSummaryStrip added after Hero Image (shows colorway circles + product names + "X products across Y looks")
- Sidebar widened: `xl:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]` (was 300-360px)
- Sidebar gets `xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto` for tall content

### WS3b — Enhanced Sidebar Product Display (`ProductAssignmentPicker.tsx`)
- Thumbnails enlarged to `h-11 w-11` (`large` prop on CollapsibleThumb)
- Product name + style number (`font-mono text-2xs`) + colorway + launch date on second line
- Always loads family doc (regardless of thumb availability) to show style number
- "Details" button per row triggers ProductQuickViewPopover

### WS3c — Product Quick-View Popover (`ProductQuickViewPopover.tsx` — NEW)
- Popover anchored `side="left"` to avoid covering sidebar
- Shows: product image (120px), style number (font-mono), colorway, launch date, sample count
- "Open product page →" link navigates to `/products/{familyId}`
- Content only mounts when open (lazy load)

### WS3d — Talent Picker with Casting Status (`TalentPicker.tsx`)
- `useCastingBoard` imported; called inside `TalentPickerContent` (subscription only when picker is open)
- Groups talent by: Booked (blue badge) → Hold (amber) → Shortlist (gray) → Other
- Falls back to flat ungrouped list when no casting board entries
- `passed` talent treated as "other" (not shown as a labeled group)

### WS3e — Location Picker Project Filtering (`LocationPicker.tsx`)
- `projectId?: string` prop added
- When `projectId` provided: project locations appear in "This project" group, others in "All locations" group
- Divider only shown when both groups are non-empty
- Falls back to flat list if no project filtering

### WS3f — Navigation Enhancement (`ShotDetailPage.tsx`)
- Back button: `← Back to Shots` text (was bare ArrowLeft icon)
- Breadcrumb added: Projects / {projectName} / Shots / #{shotNumber}
- Shots breadcrumb link preserves `window.location.search` (filter state)
- Deleted shot guard: if `shot.deleted === true`, redirect to shots list + toast

## What's Next
- Phase 4: Shots page visual polish (insights bar, unified column settings, design system audit)
- Recreate existing casting share links (old shares have 12-image cap)

## Key Files Modified
- `src-vnext/features/shots/components/ShotDetailPage.tsx`
- `src-vnext/features/shots/components/TalentPicker.tsx`
- `src-vnext/features/shots/components/LocationPicker.tsx`
- `src-vnext/features/shots/components/ProductAssignmentPicker.tsx`
- `src-vnext/features/shots/components/ProductQuickViewPopover.tsx` (NEW)
- `src-vnext/features/shots/components/ProductSummaryStrip.tsx` (NEW)

## Previous Sprint (S25)
PR #401 merged. 4 workstreams: casting share, link management, talent deletion, talent detail redesign. 160 files / 1847 tests.

## What Was Built

### 1. Casting Share Enhancement
- **Portfolio images bug fixed** — `galleryUrls` were resolved but never rendered. Now shown as `PortfolioThumbnailStrip` (4 thumbnails + "+N" overflow)
- **Casting session images** — `resolveTalentForShare.ts` resolves ALL casting session images (30/session, 60 total cap) with session grouping (`ResolvedCastingSession` type: title, date, imageUrls). Shown prominently in detail overlay grouped by session
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
