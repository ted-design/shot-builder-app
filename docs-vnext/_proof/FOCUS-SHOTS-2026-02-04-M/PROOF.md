# Proof — FOCUS-SHOTS-2026-02-04-M

**Domain:** SHOTS (Cover references in header)  
**Focus ID:** FOCUS-SHOTS-2026-02-04-M  
**Date:** 2026-02-04  

## Goal

Make it producer-obvious that the **shot header cover** can be driven by a selected **reference image** (per Active look), with a thumbnail grid + “Set as cover” controls adjacent to the hero image.

## What Shipped

- Shot Detail left column (under the hero image) now includes **Cover images**:
  - Thumbnail grid of **Active look** reference images
  - **Set as cover** (writes `looks[].displayImageId`)
  - **Clear cover**
  - **Add image** + remove image (Active look)
- If a **manual hero upload** is enabled (`hero.webp`), the panel clearly indicates it overrides reference/product cover until reset.

## Data Contract (unchanged)

- Uses existing: `shot.looks[].references[]` + `shot.looks[].displayImageId`
- No schema migration, no rules changes.

## Touched Files

- `src-vnext/features/shots/components/ShotDetailPage.tsx`
- `src-vnext/features/shots/components/ActiveLookCoverReferencesPanel.tsx`
- `src-vnext/features/shots/components/__tests__/ActiveLookCoverReferencesPanel.test.tsx`

## Automated Checks (2026-02-04)

- `npm test` ✅
- `npm run lint` ✅ (0 warnings)
- `npm run build` ✅

## Manual QA Required

⚠️ Chrome extension unavailable for visual verification in this session.

| Scenario | Steps | Expected |
|---|---|---|
| Upload reference + set cover | Shot → Cover images → Add image → click star on a thumbnail | Header image switches to selected reference cover |
| Clear reference cover | Shot → Cover images → Clear cover | Header falls back to cover product/auto (or empty if None) |
| Manual override warning | Upload a manual hero (Replace) | Panel indicates manual override; reference cover won’t show until reset |

**User Action:** Run `npm run dev` and verify scenarios above.

