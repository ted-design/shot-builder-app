# Proof — FOCUS-SHOTS-2026-02-06-A

**Domain:** SHOTS (Gallery IA/UI refinement)  
**Focus ID:** FOCUS-SHOTS-2026-02-06-A  
**Date:** 2026-02-06

## Goal

Refine Gallery card information architecture to improve scanability under resize pressure:
- Keep shot title + shot description as one contiguous text block
- Prevent title truncation pressure from hero thumbnail and status controls
- Remove reorder-handle overlap on top of hero thumbnails
- Preserve source image aspect ratio in Gallery while enforcing bounded size

## What Shipped

### 0) Follow-up pass (same focus, same day)

Applied producer-requested gallery refinements:
- Remove all hero-image placeholder chrome (no grey fallback blocks)
- Render nothing when a shot has no active hero/header image
- Move title + description to the top-left of the card
- Use a tighter metadata layout (talent + location side-by-side when both are present)
- Remove redundant readiness icon row when explicit property rows are shown
- Group tags into labeled buckets (`Gender`, `Priority Tag`, `Media`, `Other`)

### 0B) Data-driven tag grouping (same focus, same day)

Tag grouping on Gallery cards is now driven by explicit tag metadata instead of label heuristics:
- Added `category` support on `ShotTag` (`priority | gender | media | other`)
- Tag creation/editing surfaces now assign and persist category
- Gallery grouping uses stored category values (with default-tag id fallback for legacy tags)

### 0C) Visual hierarchy refinement (same focus, same day)

Applied a second-pass hierarchy treatment to make Gallery cards easier to scan under dense data:
- Added a clearer content rhythm: title/description → control row → detail body → tags
- Rebalanced the body into a responsive split (`details` + `hero image`) so right-side space is used intentionally
- Promoted field clarity by rendering `Talent`, `Location`, and `Products` as compact labeled blocks instead of flat lines
- Reduced product noise by previewing first two product lines with `+N more` overflow indicator
- Added subtle structural separation for tag groups with per-group containers and a top divider

### 0D) Typography + spacing micro-pass (same focus, same day)

Applied a token-only calmness pass (no layout structure changes):
- Tightened typography hierarchy (`14px` title, `11px` secondary/body copy, calmer tracking for micro labels)
- Smoothed vertical rhythm between sections and metadata groups
- Softened visual weight of readiness and tag containers for lower contrast noise
- Kept all interaction and IA order unchanged; this pass is presentation-only

### 0E) Screenshot-driven calmness tweak (same focus, same day)

After full-page review at gallery scale:
- Removed extra border chrome from nested metadata/readiness blocks
- Increased value-text contrast inside metadata blocks
- Slightly reduced internal card gap to tighten scan cadence on large shot counts
- Kept layout, behavior, and grouping unchanged (token-only adjustment)

### 0F) Final polish micro-pass (same focus, same day)

- Increased shot title emphasis on desktop only (`md:text-[15px]`) while keeping mobile scale unchanged
- Reduced status select trigger width to reclaim horizontal breathing room on gallery cards

### 1) Card IA: Controls separated from core text

- `ShotCard` now uses a dedicated top control row (reorder handle/selection, shot number, status).
- Shot title and description now render together directly below controls, in the same stack.
- This removes the prior “sandwiched” title layout where title width competed with image + status.

### 2) Reorder handle placement and behavior

- Drag handle moved out of absolute overlay positioning.
- Handle now lives in the card’s leading control slot, so it no longer covers the hero image.
- Handle uses hover/focus reveal (`group-hover` + `focus-visible`) for lower visual noise in desktop Gallery.
- Mobile behavior remains safe because mobile reordering uses explicit up/down controls, not the drag handle.

### 3) Gallery hero thumbnail rendering contract

- Gallery thumbnails now render with native aspect ratio preservation (`object-contain`).
- Longest side is bounded to `150px` (`max-w-[150px]` + `max-h-[150px]`).
- This removes forced 16:9 cropping for portrait/tall reference images while keeping a predictable visual ceiling.
- No placeholder/fallback block is rendered when a shot has no hero image.

## Touched Files

- `src-vnext/features/shots/components/ShotCard.tsx`
- `src-vnext/features/shots/components/DraggableShotList.tsx`
- `src-vnext/features/shots/components/TagEditor.tsx`
- `src-vnext/features/shots/components/TagManagementPage.tsx`
- `src-vnext/features/shots/hooks/useAvailableTags.ts`
- `src-vnext/features/shots/lib/mapShot.ts`
- `src-vnext/features/shots/lib/tagManagementWrites.ts`
- `src-vnext/shared/lib/tagCategories.ts`
- `src-vnext/shared/lib/defaultTags.ts`
- `src-vnext/shared/types/index.ts`
- `src-vnext/features/shots/components/__tests__/ShotListPage.test.tsx`

## Manual QA Required

| Scenario | Steps | Expected |
|---|---|---|
| Title/description adjacency | Open `/projects/:id/shots` in Gallery | Description sits directly below title with no disconnected gap |
| Resize resilience | Narrow desktop window width across breakpoints | Title no longer collapses because of image+status pressure in the same row |
| Handle placement | In custom sort Gallery, hover a shot card | Reorder handle appears in control row and does not overlap thumbnail |
| Image ratio bounds | Use mixed source images (16:9, 4:5, 9:16) | Each image keeps source ratio, longest side capped at 150px |
| No image placeholder | Open a shot card with no hero image | No image frame/placeholder appears |
| Metadata density | Use cards with both talent + location | Talent and location render in a shared row with better horizontal space use |
| Tag grouping | Use tags like Women / High Priority / Video | Tags appear under labeled groups: Gender / Priority Tag / Media |
| Card hierarchy | Open mixed cards (with image/products/tags) | Eye path is stable: title block first, controls second, detail body third, tags last |
| Typography calmness | Compare gallery cards before/after with same data | Text hierarchy reads cleaner with less label noise and more consistent spacing cadence |
| Border noise at scale | Review full-page gallery with many cards | Nested box chrome no longer competes with content hierarchy |

## Notes

- This focus intentionally supersedes the prior Gallery `object-cover` decision from `FOCUS-SHOTS-2026-02-05-A` for the Gallery view only, based on producer feedback prioritizing source-ratio fidelity over frame-fill cropping.
