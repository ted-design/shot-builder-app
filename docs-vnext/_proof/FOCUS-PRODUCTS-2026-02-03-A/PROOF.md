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

## Legacy deep analysis (what we’re matching / intentionally not matching)

### Key legacy surfaces

| Surface | Route | Primary file(s) |
|---|---|---|
| Product library list | `/products` | `src/pages/ProductsPage.jsx` |
| Product detail workspace | `/products/:productId` | `src/pages/ProductDetailPageV3.jsx` |
| Product workspace modules | (within detail) | `src/components/products/workspace/*` |
| Product modals/forms | (from list) | `src/components/products/NewProductModal.jsx`, `src/components/products/EditProductModal.jsx`, `src/components/products/ProductFamilyForm.jsx` |
| Product import | `/import-products` | `src/pages/ImportProducts.jsx` |

### Legacy behavior map (high-signal)

| Surface | Primary UX pattern | Data reads | Data writes |
|---|---|---|---|
| `/products` list | Dense list cockpit (gallery/table), view presets, selection + batch ops, inline editing | 1x families subscription, plus conditional SKU fan-out for row expansion / wide-preload | Create/edit families + SKUs, batch updates, image upload/delete (Storage) |
| `/products/:id` detail | Sectioned “workspace” viewer, return-to context | One-time family `getDoc` + SKUs `getDocs` | None (editor lives elsewhere) |

### Legacy principles (why it likely looked like that)

- Minimize context switching: edit from list via modal or inline.
- Dense scanning beats “pretty cards” for large catalogs; multiple densities + table focus.
- Batch actions exist because producers need fast bulk normalization (category/status).
- Visual colorway truth matters: swatches + extraction to identify SKUs quickly.

### Legacy problems / debt (what vNext must not repeat)

- Fan-out risk (N+1) via per-family SKU reads and eager preloading.
- Scattered persistence (localStorage presets) can cause “my view is different” drift.
- Inline-edit blur-to-save is fast but increases accidental write risk.
- Detail page is not real-time; can show stale state vs list editors.

## Parity contract (vNext vs legacy)

vNext PRODUCTS is intentionally *not* a 1:1 copy of legacy. Parity is defined by `docs-vnext/slices/slice-2b-product-library.md`.

**Explicit legacy exclusions (by spec / non-goals)**
- No SKU fan-out on `/products` (no “expand family to load SKUs” patterns).
- No inline table editing, no selection/batch actions.
- No legacy workspace sections (samples/assets/activity).
- No import tooling in vNext.

## PRODUCTS “Done” checklist (living)

**Browse**
- [ ] `/products` search + filters + sort (URL-persisted, shareable)
- [ ] No list fan-out (single families subscription; no per-family SKU reads)
- [ ] Calm empty/loading/error states

**Detail**
- [ ] `/products/:fid` renders family + SKUs (stable sort, calm density)
- [ ] Mobile is read-only; desktop editing is gated by role
- [ ] “Return to” preserves list state (no trust loss on back-navigation)

**CRUD**
- [ ] Create family + at least 1 SKU
- [ ] Edit family fields, add/remove SKUs (soft-delete SKUs)
- [ ] Archive/unarchive family (non-destructive)
- [ ] Soft-delete/restore family (when legacy fields exist)

**Images**
- [ ] Upload/replace/remove family header + thumbnail
- [ ] Upload/replace/remove SKU image
- [ ] Thumbnail-first rendering with safe fallbacks (no broken layout)

**Quality gates**
- [ ] `npx tsc --noEmit`
- [ ] `npm test`
- [ ] `npm run lint` (0 warnings)
- [ ] `npm run build`

## Current gaps discovered in this session (to close next)

- `/products/:fid` breadcrumb currently drops list filter state (needs a safe `returnTo` param pattern).
- Family-level archive and soft-delete controls need explicit UI actions (spec-required).
- Thumbnail usage should be consistent (thumbnail-first on list/detail; fallback rules should be predictable).

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
