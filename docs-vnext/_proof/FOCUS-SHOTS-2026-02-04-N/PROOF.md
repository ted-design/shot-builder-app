# Proof — FOCUS-SHOTS-2026-02-04-N

**Domain:** SHOTS (Cover image UX hardening)  
**Focus ID:** FOCUS-SHOTS-2026-02-04-N  
**Date:** 2026-02-04  

## Goal

1) Improve shot header image rendering so it doesn’t crop unpredictably across viewports.  
2) Allow clearing/hiding the header cover **without deleting** reference images.

## What Shipped

- Header rendering:
  - Hero/cover image now renders in a stable **16:9** container using `object-contain` (no surprise cropping).
- Cover semantics:
  - Clearing reference cover (`displayImageId = null`) now actually clears the reference cover (no implicit “first reference” fallback).
  - New **Hide header** action clears manual hero + reference cover + product cover for the Active look (without deleting references/products).
- Convenience:
  - Uploading the first reference image to a look defaults it as cover when no cover is set yet.

## Touched Files

- `src-vnext/features/shots/lib/mapShot.ts`
- `src-vnext/features/shots/lib/mapShot.test.ts`
- `src-vnext/features/shots/components/HeroImageSection.tsx`
- `src-vnext/features/shots/components/ShotLooksSection.tsx`
- `src-vnext/features/shots/components/ActiveLookCoverReferencesPanel.tsx`

## Automated Checks (2026-02-04)

- `npm test` ✅
- `npm run lint` ✅ (0 warnings)
- `npm run build` ✅

## Manual QA Required

⚠️ Chrome extension unavailable for visual verification in this session.

| Scenario | Steps | Expected |
|---|---|---|
| Stable rendering | Resize desktop window / mobile viewport | Header image does not “crop jump”; full image stays visible (letterboxed) |
| Clear cover without deleting | Shot → Cover images → Clear cover | Header no longer uses that reference image |
| Hide header without deleting | Shot → Cover images → Hide header | Header becomes empty; reference thumbnail remains |

**User Action:** Run `npm run dev` and verify scenarios above.

