# Proof — FOCUS-IMAGES-2026-02-04-A

**Domain:** IMAGES (Upload reliability + WebP enforcement)  
**Focus ID:** FOCUS-IMAGES-2026-02-04-A  
**Date:** 2026-02-04  

## Goal

1) Fix shot reference uploads failing due to Storage rules mismatch.  
2) Ensure image uploads are stored as **WebP** for size optimization (no original format blobs for images).

## Root Cause (Reference upload failure)

vNext shot hero + reference uploads use Storage paths:

- `clients/{clientId}/shots/{shotId}/hero.webp`
- `clients/{clientId}/shots/{shotId}/references/{refId}.webp`

But `storage.rules` previously only allowed writes under `/images/**`, `/docs/**`, and legacy `/orgs/**`, so uploads to `/clients/**` were denied.

## What Shipped

- Storage rules now allow authenticated, scoped writes to:
  - `clients/{clientId}/shots/{shotId}/**`
- Image conversion:
  - `src-vnext/shared/lib/uploadImage.ts` exports `compressImageToWebp()` and rejects HEIC with a clear message.
  - `createProductDocument()` converts image uploads to WebP before uploading (documents can still be PDFs).
- Error surfacing:
  - Shot hero upload and reference uploads now toast the underlying error message/code (permission denied, unsupported file type, etc.).

## Touched Files

- `storage.rules`
- `src-vnext/shared/lib/uploadImage.ts`
- `src-vnext/features/shots/components/HeroImageSection.tsx`
- `src-vnext/features/shots/components/ShotLooksSection.tsx`
- `src-vnext/features/shots/components/ActiveLookCoverReferencesPanel.tsx`
- `src-vnext/features/products/lib/productWorkspaceWrites.ts`

## Automated Checks (2026-02-04)

- `npm test` ✅
- `npm run lint` ✅ (0 warnings)
- `npm run build` ✅

## Manual QA Required

⚠️ Chrome extension unavailable for visual verification in this session.

| Scenario | Steps | Expected |
|---|---|---|
| Upload reference cover | Shot → Cover images → Add image | Upload succeeds; selecting cover works |
| Upload HEIC | Try uploading an iPhone `.heic` | Error explains HEIC unsupported (asks for JPG/PNG) |
| Upload hero | Shot → Replace | Upload succeeds; any failure shows actionable error |

**User Action:** Run `npm run dev` and verify scenarios above.

