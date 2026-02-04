# Proof — FOCUS-SHOTS-2026-02-04-C

**Domain:** SHOTS (Shot Editor — Look Options)  
**Focus ID:** FOCUS-SHOTS-2026-02-04-C  
**Date:** 2026-02-04  

## Goal

Bring back the legacy “multiple look options” workflow in vNext:
- Create multiple look options (Primary + alternates)
- Assign products per look
- Choose an optional “hero product” per look
- Attach reference images per look and choose a single cover image for the shot

## Key Decisions (Trust > Parity)

- **No schema migration.** Uses the existing `shot.looks[]` field contract (legacy-compatible).
- **One cover selection per shot.** Setting a cover reference clears `displayImageId` on all other looks to prevent conflicting covers.
- **Pull generation includes look products.** A producer shouldn’t lose pull accuracy by using look options instead of shot-level products.
- **Image safety.** Cover/hero thumbnails resolve Firebase Storage paths at render time (works with legacy path-based data).

## What Shipped

### 1) Look Options Editor (desktop edit, mobile read-only)
- New “Looks” panel on Shot Detail.
- Add Primary/Alt looks; delete looks (confirm).
- Products per look via existing vNext product assignment picker.
- Optional hero product selection per look.

### 2) Reference images + cover selection
- Upload multiple reference images per look (cap: 10).
- Mark one reference as the shot cover (stored as `displayImageId` on a single look).
- Remove references (confirm) and auto-clear cover if removed.

### 3) Cover derivation improvements
- `mapShot` now derives `shot.heroImage` from:
  1) `heroImage` (manual override)  
  2) look `displayImageId` references  
  3) look `heroProductId` (product image)  
  4) first reference fallback  
  5) attachments / legacy reference image field

### 4) Downstream correctness
- Pull generation merges products from `shot.products[]` + `shot.looks[].products[]` (deduped).
- Shots list readiness + table counts use the same merged view.

## Touched Files

- `src-vnext/shared/types/index.ts`
- `src-vnext/features/shots/lib/mapShot.ts`
- `src-vnext/features/shots/lib/mapShot.test.ts`
- `src-vnext/shared/lib/shotProducts.ts`
- `src-vnext/shared/lib/shotProducts.test.ts`
- `src-vnext/shared/lib/uploadImage.ts`
- `src-vnext/features/shots/components/ShotLooksSection.tsx`
- `src-vnext/features/shots/components/ShotDetailPage.tsx`
- `src-vnext/features/shots/components/HeroImageSection.tsx`
- `src-vnext/features/shots/components/ShotCard.tsx`
- `src-vnext/features/shots/components/ShotListPage.tsx`
- `src-vnext/features/pulls/lib/buildPullItemsFromShots.ts`
- `src-vnext/features/pulls/lib/buildPullItemsFromShots.test.ts`
- `src-vnext/features/pulls/lib/createPullFromShots.ts`

## Automated Checks (2026-02-04)

- `npm run test` ✅
- `npm run lint` ✅ (0 warnings)
- `npm run build` ✅

## Manual QA Required

⚠️ **Chrome extension unavailable** for visual verification in this session.

| Scenario | Steps | Expected |
|---|---|---|
| Add looks | Shot Detail → Looks → “Add Primary”, then “Add Alt” | Tabs show Primary/Alt labels; state persists on refresh |
| Assign products per look | In a look, add 2 products | Product list persists; shot readiness shows products assigned |
| Hero product selection | Select a hero product | Hero persists; cover can fall back to hero product if no cover reference set |
| Reference upload | Add 2 reference images to a look | Thumbnails render; persists on refresh |
| Set cover reference | Click star on a reference | “Cover” badge shows; only one cover exists across looks |
| Delete reference | Remove the cover reference | Cover selection clears automatically |
| Pull generation | Select shots → Create pull sheet | Pull items include look-assigned products |

**User Action:** Run `npm run dev` and verify scenarios above.

## Screenshots Index

_Screenshots live in `docs-vnext/_proof/FOCUS-SHOTS-2026-02-04-C/images/`._

