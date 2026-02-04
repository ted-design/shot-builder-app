# Proof — FOCUS-SHOTS-2026-02-04-L

**Domain:** SHOTS (Cover image selection)  
**Focus ID:** FOCUS-SHOTS-2026-02-04-L  
**Date:** 2026-02-04  

## Goal

Stop silently forcing the first attached product image as the shot header image when the user intends **no** cover product, while still supporting:
- **Auto** cover (first product image) when desired
- Explicit **None**
- Explicit cover product choice

## What Shipped

- Looks → **Cover product (optional)** now has explicit modes:
  - **Auto (first product)** — uses the first product image in the active look
  - **None** — do not use a product image for the shot header
  - Specific product options — use that product’s image
- Cover derivation is **locked to the Active look** when `activeLookId` is set (matches UI: “Cover follows Active look”).

## Touched Files

- `src-vnext/features/shots/components/ShotLooksSection.tsx`
- `src-vnext/features/shots/lib/mapShot.ts`
- `src-vnext/features/shots/lib/mapShot.test.ts`
- `src-vnext/features/shots/components/__tests__/ShotLooksSection.test.tsx`

## Automated Checks (2026-02-04)

- `npm test` ✅
- `npm run lint` ✅ (0 warnings)
- `npm run build` ✅

## Manual QA Required

⚠️ Chrome extension unavailable for visual verification in this session.

| Scenario | Steps | Expected |
|---|---|---|
| Disable product cover | Shot → Looks → Cover product = **None** | Header/cover no longer uses first product image |
| Auto cover | Set Cover product = **Auto (first product)** | Header shows first attached product image (if any) |
| Explicit product cover | Select a specific attached product | Header shows that product’s image |

**User Action:** Run `npm run dev` and verify scenarios above.

