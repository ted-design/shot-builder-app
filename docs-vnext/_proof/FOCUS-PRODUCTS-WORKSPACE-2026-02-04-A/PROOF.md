# Proof — FOCUS-PRODUCTS-WORKSPACE-2026-02-04-A

**Domain:** PRODUCTS (Workspace)  
**Focus ID:** FOCUS-PRODUCTS-WORKSPACE-2026-02-04-A  
**Date:** 2026-02-04  

## Governing docs (contract)

- `docs-vnext/design/experience-spec.md`
- `docs-vnext/engineering/build-strategy.md`
- `docs-vnext/engineering/architecture.md`
- `docs-vnext/slices/slice-2c-product-workspace.md`
- `docs/claude-code-tooling.md`

## Legacy investigation (collections)

**Goal:** Confirm whether legacy already has Firestore collections for product workspace features.

Findings:
- Legacy workspace UI was scaffolded with **in-memory mock data**: `src/pages/ProductDetailPageV2.jsx:1076`.
- Only **future** Firestore paths were listed as comments (not implemented): `src/pages/ProductDetailPageV2.jsx:1081`.
- No repo-level Firestore path helpers or security rules existed for:
  - `productFamilies/{fid}/samples`
  - `productFamilies/{fid}/documents`
  - `productFamilies/{fid}/comments`

Conclusion: No existing legacy collections/rules were present in this repo; schema extension is required for vNext.

## Definition of DONE (this focus run)

### Samples
- Add sample (type/status/size run/scope + shipping fields).
- Update sample (including status).
- Delete sample (soft-delete, hidden by default).
- Filters: status, type, scope.

### Assets (Documents)
- Upload PDF/image documents to product family.
- List documents with name/size/uploader/time.
- Download documents (Storage URL).
- Delete documents (metadata + best-effort Storage delete).

### Activity
- Comment thread (create + delete own).
- Timeline derived from product created/updated + sample/doc activity.

### UX trust
- No overflow/off-screen forms; sections are scroll-safe.
- Explicit empty/loading/error states.
- Mobile: read-only safe; mutations disabled.

## Data contract shipped

New subcollections under:
- `clients/{clientId}/productFamilies/{familyId}/samples/{sampleId}`
- `clients/{clientId}/productFamilies/{familyId}/documents/{documentId}`
- `clients/{clientId}/productFamilies/{familyId}/comments/{commentId}`

Storage path:
- `docs/productFamilies/{familyId}/{documentId}/{filename}`

## Verification (2026-02-04)

- `npx tsc --noEmit` ✅
- `npm test` ✅
- `npm run lint` ✅ (0 warnings)
- `npm run build` ✅

## Deployment (rules)

Deployed to Firebase project `um-shotbuilder`:
- Firestore rules (`firestore.rules`) ✓ deployed (verification: “already up to date”)
- Storage rules (`storage.rules`) ✓ deployed (verification: “already up to date”)

## Post-deploy hotfix (UI crash)

Issue: Radix Select forbids `SelectItem value=""`. The Samples scope picker used an empty-string value for “All colorways”, which crashed `/products/:fid?section=samples`.

Fix: Use a sentinel option value (`"__all__"`) and map it to internal empty selection.

- Commit: `f78cc53`
- User verified: “it works”

## Manual QA required

⚠️ Chrome extension unavailable in this session for visual verification.

| Scenario | Steps | Expected |
|---|---|---|
| Samples add/edit | Open `/products/:fid?section=samples` → Add sample → Save → change status | Sample appears, edits persist, status updates visible |
| Sample soft-delete | Open sample → Delete sample | Sample hidden from default list |
| Document upload | `/products/:fid?section=assets` → Upload document | Document appears in list with Download |
| Document delete | Delete document | Document removed; storage delete best-effort |
| Comments | `/products/:fid?section=activity` → Post comment → Delete own | Comment appears then shows Deleted/hidden appropriately |
| Mobile safety | Mobile viewport → product workspace sections | Read-only, no broken interactions |

## Screenshots index

_Screenshots live in `docs-vnext/_proof/FOCUS-PRODUCTS-WORKSPACE-2026-02-04-A/images/`._
