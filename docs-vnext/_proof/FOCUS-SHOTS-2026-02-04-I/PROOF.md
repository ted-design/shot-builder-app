# Proof — FOCUS-SHOTS-2026-02-04-I

**Domain:** SHOTS (Cover / Hero Fallback + Create Trust)  
**Focus ID:** FOCUS-SHOTS-2026-02-04-I  
**Date:** 2026-02-04  

## Goals

1) If no dedicated hero image is uploaded, allow producers to choose which **product image** drives the shot cover.
2) Prevent “shot didn’t persist” confusion when new shots are hidden by active filters/search.

## What Shipped

### 1) Cover product selection (colorway-aware)

- Look options → **Cover product (optional)** now supports selecting a specific colorway (SKU id) when available.
- Cover derivation now accepts `heroProductId` as either `familyId` (legacy) or `skuId` (preferred).

### 2) Cover fallback when nothing is explicitly selected

- If there is no selected reference image and no cover product selected, cover derivation falls back to the **first product image** available in the active look.
- Also includes a last-resort fallback for legacy shots that have `products[]` but no looks.

### 3) Create shot visibility trust

- After creating a shot, we show a success toast.
- If the shot is likely hidden by current filters/search (e.g. status filter excludes `todo`, or search query doesn’t match the new title), we show a toast with **Show shot** which clears filters and opens the new shot detail.

## Touched Files

- `src-vnext/features/shots/components/ShotLooksSection.tsx`
- `src-vnext/features/shots/lib/mapShot.ts`
- `src-vnext/features/shots/lib/mapShot.test.ts`
- `src-vnext/features/shots/components/CreateShotDialog.tsx`
- `src-vnext/features/shots/components/ShotListPage.tsx`

## Automated Checks (2026-02-04)

- `npm run test` ✅
- `npm run lint` ✅ (0 warnings)
- `npm run build` ✅

## Manual QA Required

⚠️ Chrome extension unavailable for visual verification in this session.

| Scenario | Steps | Expected |
|---|---|---|
| Choose cover product | Shot Detail → Looks → add 2 products with images → set Cover product | Shot card/table cover updates to selected product image |
| Cover fallback | Clear Cover product + no references set | Cover uses first product image instead of going blank |
| Legacy root products | Open a legacy shot with `products[]` but no looks | Cover still shows a product image if available |
| Create under active filters | On Shots list set Status filter to exclude `todo` or set a search query → create new shot | Toast warns it’s hidden; **Show shot** clears filters and opens shot |

**User Action:** Run `npm run dev` and verify scenarios above.

