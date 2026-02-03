# Proof — FOCUS-PRODUCTS-2026-02-03-A

**Domain:** PRODUCTS  
**Focus ID:** FOCUS-PRODUCTS-2026-02-03-A  
**Date:** 2026-02-03  

## Governing docs (contract)

- `docs-vnext/design/experience-spec.md`
- `docs-vnext/engineering/build-strategy.md`
- `docs-vnext/engineering/architecture.md`
- `docs-vnext/ops/firestore-indexes.md`
- `docs/claude-code-tooling.md`
- `docs-vnext/slices/slice-2b-product-library.md`

## Packages log

### WP1 — Spec + product data contract alignment

**Spec alignment:** Introduces missing product slice spec; aligns vNext types/mappers to existing Firestore fields. No schema changes. No new Firestore reads.

**Change summary**
- Added Product Library slice spec (capabilities + DoD + data contracts).
- Expanded vNext `ProductFamily` / `ProductSku` types to reflect legacy schema fields (optional + resilient).
- Centralized product mapping in vNext and added tests for legacy field aliases.

**Touched surfaces**
- `docs-vnext/slices/slice-2b-product-library.md`
- `src-vnext/shared/types/index.ts`
- `src-vnext/features/products/lib/mapProduct.ts`
- `src-vnext/features/products/hooks/useProducts.ts`
- `src-vnext/features/products/lib/mapProduct.test.ts`

**Checks (2026-02-03)**
- `npx tsc --noEmit` ✅
- `npm test` ✅

### WP2 — `/products` browsing parity (fast + calm, URL-persisted)

**Spec alignment:** Aligned with `docs-vnext/design/experience-spec.md` (in-context search + filters, bookmarkable state). No schema changes. No new Firestore queries (still a single `productFamilies` subscription).

**Change summary**
- Added URL-persisted filters (`q`, `status`, `cat`, `arch`, `del`, `sort`) for shareable/bindable browsing state.
- Improved product card density with trustworthy metadata (active colorways, colors, sizes) using denormalized family fields (no SKU fan-out).
- Centralized filter/sort logic in a pure function with unit tests.

**Touched surfaces**
- `src-vnext/features/products/components/ProductListPage.tsx`
- `src-vnext/features/products/components/ProductFamilyCard.tsx`
- `src-vnext/features/products/lib/productList.ts`
- `src-vnext/features/products/lib/productList.test.ts`

**Checks (2026-02-03)**
- `npx tsc --noEmit` ✅
- `npm test` ✅

**Manual QA required (screenshots pending)**
⚠️ Chrome extension not available in this session for screenshots.

| Scenario | Steps | Expected |
|---|---|---|
| URL-persisted filters | Apply search + status + category + include archived. Refresh page. | State persists and results match filters. |
| No fan-out regression | Open `/products` with a large dataset. | No per-family SKU reads; page remains responsive. |
| Deleted visibility gated | Toggle “Show deleted”. | Deleted families appear with “Deleted” badge; hidden by default. |

### WP3 — Product CRUD (family + colorways + images)

**Spec alignment:** Aligned with `docs-vnext/slices/slice-2b-product-library.md` (desktop-first editor, mobile read-only). No schema changes. No list fan-out. Writes use existing collections/fields.

**Change summary**
- Added a vNext product upsert dialog (create + edit) with safe SKU management and image upload/removal.
- Added role gate for product editing (`canManageProducts`) and hid editors on mobile.
- Implemented product family/SKU writes with denormalized aggregates (`skuCount`, `activeSkuCount`, `skuCodes`, `colorNames`, `sizeOptions`) and best-effort Storage cleanup on replace/remove.

**Touched surfaces**
- `src-vnext/features/products/components/ProductUpsertDialog.tsx`
- `src-vnext/features/products/lib/productWrites.ts`
- `src-vnext/features/products/components/ProductListPage.tsx`
- `src-vnext/features/products/components/ProductDetailPage.tsx`
- `src-vnext/shared/lib/rbac.ts`
- `src-vnext/shared/lib/rbac.test.ts`

**Checks (2026-02-03)**
- `npx tsc --noEmit` ✅
- `npm test` ✅

**Manual QA required (screenshots pending)**
⚠️ Chrome extension not available in this session for screenshots.

| Scenario | Steps | Expected |
|---|---|---|
| Create family + SKU | Desktop: `/products` → “New product” → save. | Product created; navigates to `/products/:fid`; list shows aggregates. |
| Edit SKUs + images | Desktop: `/products/:fid` → “Edit” → add SKU, remove SKU, upload images. | Saves; images render; removed SKU is marked deleted. |
| Mobile gating | Mobile viewport: open `/products` and `/products/:fid`. | No edit controls; read-only UI remains usable. |

### WP4 — `/products/:fid` detail resilience + calm density

**Spec alignment:** Aligned with `docs-vnext/design/experience-spec.md` (mobile read-only, desktop full). No new queries; still 1 doc + 1 subcollection subscription.

**Change summary**
- Product detail shows trustworthy family status/flags (archived/discontinued) and richer classification metadata.
- Colorways render with calm density (sizes summarized; no “pills everywhere”) and stable sort by color name.
- Deleted SKU visibility is gated behind a deliberate toggle (desktop only when deleted exist).

**Touched surfaces**
- `src-vnext/features/products/components/ProductDetailPage.tsx`
- `src-vnext/features/products/components/ProductSkuCard.tsx`
- `docs-vnext/_proof/FOCUS-PRODUCTS-2026-02-03-A/PROOF.md`

**Checks (2026-02-03)**
- `npx tsc --noEmit` ✅
- `npm test` ✅

### WP5 — Focus run verification gates

**Checks (2026-02-03)**
- `npm run lint` ✅ (0 warnings)
- `npm run build` ✅

## Screenshots index

_Screenshots live in `docs-vnext/_proof/FOCUS-PRODUCTS-2026-02-03-A/images/`._
