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

## Screenshots index

_Screenshots live in `docs-vnext/_proof/FOCUS-PRODUCTS-2026-02-03-A/images/`._
