# Proof — FOCUS-IMAGES-2026-02-04-B

**Domain:** IMAGES (Pre-upload validation)  
**Focus ID:** FOCUS-IMAGES-2026-02-04-B  
**Date:** 2026-02-04  

## Goal

Fail fast before any upload attempt with clear, producer-friendly errors:
- Unsupported image types (e.g., GIF, SVG)
- HEIC/HEIF (not currently supported in browser canvas pipeline)
- Empty/oversized files

## What Shipped

- Shared preflight validator: `validateImageFileForUpload(file)`
  - Allowed: JPG/JPEG, PNG, WebP
  - Rejects HEIC/HEIF with explicit guidance
  - Rejects empty files and extremely large inputs (>25MB)
- Wired into all vNext image uploads:
  - Shot hero uploads
  - Shot reference uploads (both Looks and Cover images panel)
  - Product image uploads (via shared compression pipeline)
- File inputs now restrict selectable types where we upload immediately (`accept="image/png,image/jpeg,image/webp"`).

## Touched Files

- `src-vnext/shared/lib/uploadImage.ts`
- `src-vnext/shared/lib/uploadImage.test.ts`
- `src-vnext/features/shots/components/HeroImageSection.tsx`
- `src-vnext/features/shots/components/ShotLooksSection.tsx`
- `src-vnext/features/shots/components/ActiveLookCoverReferencesPanel.tsx`
- `src-vnext/features/products/lib/productWrites.ts`

## Automated Checks (2026-02-04)

- `npm test` ✅
- `npm run lint` ✅ (0 warnings)
- `npm run build` ✅

## Manual QA Required

⚠️ Chrome extension unavailable for visual verification in this session.

| Scenario | Steps | Expected |
|---|---|---|
| Reject HEIC | Try uploading an iPhone `.heic` | Toast explains HEIC unsupported; no upload attempt |
| Reject GIF | Try uploading a `.gif` | Toast explains unsupported type |
| Accept JPG/PNG | Upload a `.jpg` or `.png` | Upload proceeds normally |

**User Action:** Run `npm run dev` and verify scenarios above.

