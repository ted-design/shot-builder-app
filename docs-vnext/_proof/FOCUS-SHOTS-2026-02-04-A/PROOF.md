# Proof — FOCUS-SHOTS-2026-02-04-A

**Domain:** SHOTS  
**Focus ID:** FOCUS-SHOTS-2026-02-04-A  
**Date:** 2026-02-04  

## Problem

Existing product assignments on Shot Detail did not render thumbnails. If a user deleted and re-added the same product, the thumbnail would appear.

## Root Cause

- Legacy shot product assignments store image **storage paths** on the assignment object (notably `thumbnailImagePath` / `colourImagePath`).
- vNext `mapShot` only mapped `thumbUrl`/`skuImageUrl`/`familyImageUrl`, so legacy image fields were dropped.
- vNext `ProductAssignmentPicker` rendered thumbnails via a raw `<img src=...>` which does not work for Firebase Storage paths (needs download URL resolution).
- Older vNext assignments could also be missing denormalized thumb fields entirely, requiring a safe lookup fallback.

## Fix

- `mapShot` now preserves legacy shot product image paths by mapping them into vNext `ProductAssignment` fields (`thumbUrl`, `skuImageUrl`, `familyImageUrl`).
- `ProductAssignmentPicker` now resolves Firebase Storage paths to download URLs for thumbnails.
- When denormalized thumb fields are missing, `ProductAssignmentPicker` falls back to reading the referenced product family/SKU docs to locate an image path.

## Touched Files

- `src-vnext/features/shots/lib/mapShot.ts`
- `src-vnext/features/shots/lib/mapShot.test.ts`
- `src-vnext/features/shots/hooks/usePickerData.ts`
- `src-vnext/features/shots/components/ProductAssignmentPicker.tsx`
- `src-vnext/features/shots/components/ProductAssignmentPicker.test.tsx`

## Automated Checks (2026-02-04)

- `npm run test` ✅
- `npm run lint` ✅ (0 warnings)
- `npm run build` ✅

## Manual QA Required

⚠️ **Chrome extension unavailable** for visual verification in this session.

| Scenario | Steps | Expected |
|---|---|---|
| Legacy assignments show thumbnails | Open a shot that already has products assigned (created before this change). | Product rows show thumbnails without needing delete/re-add. |
| vNext assignments missing denormalized thumb still show | Open a shot with products that have no `thumbUrl` stored. | Thumbnail appears via family/SKU lookup fallback. |
| SKU picker thumbnails render | Shot Detail → Products → Add product → select family → SKU step. | SKU rows show thumbnails when `imagePath` or family image exists. |
| No regressions in product remove/edit | Remove a product, edit a product assignment, re-open shot. | Writes succeed; UI remains stable. |

**User Action:** Run `npm run dev` and verify the scenarios above.

## Screenshots Index

_Screenshots live in `docs-vnext/_proof/FOCUS-SHOTS-2026-02-04-A/images/`._

