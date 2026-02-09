# Proof — FOCUS-PRODUCTS-2026-02-09-A

**Domain:** PRODUCTS  
**Focus ID:** FOCUS-PRODUCTS-2026-02-09-A  
**Date:** 2026-02-09

## Goal

Raise Product Editor trust and throughput in three pain areas:

1. Remove free-text classification drift (Type/Subcategory) by switching to managed dropdowns.
2. Make classification values team-manageable in-flow (create/edit/archive).
3. Reduce colorway authoring friction with a fast bulk-add path.

## What Shipped

### 1) Taxonomy-backed classification contract

Added org-scoped product classification documents:

- `clients/{clientId}/productClassifications/{classificationId}`

Each doc stores:
- `gender`
- `typeKey`, `typeLabel`
- `subcategoryKey`, `subcategoryLabel` (nullable for type-only)
- `archived`
- `createdAt`, `updatedAt`, `createdBy`, `updatedBy`

Files:
- `src-vnext/shared/lib/paths.ts`
- `src-vnext/shared/types/index.ts`
- `src-vnext/features/products/lib/productClassifications.ts`
- `src-vnext/features/products/hooks/useProductClassifications.ts`
- `src-vnext/features/products/lib/productClassificationWrites.ts`
- `firestore.rules`

### 2) Product Editor classification UX upgrade

`/products/new` and `/products/:fid/edit` now use dropdowns for:
- Gender
- Type
- Subcategory

Behavior:
- Type/Subcategory options are scaffolded from managed classification docs.
- If no managed docs exist yet, editor still falls back to existing product family values.
- Editors can reclassify the product family directly from the classification toolbar.
- New type/subcategory values can be created inline from the same toolbar.

Files:
- `src-vnext/features/products/components/ProductEditorPage.tsx`

### 3) Inline classification creation (toolbar)

Inside the classification toolbar, producers can:
- Add a new Type for the selected gender
- Add a new Subcategory under the selected type
- Immediately reclassify the current product using the newly added values

### 4) Faster colorway authoring

Added a “Quick add colorways” area in Product Editor:
- Paste comma/newline-separated names
- Generate multiple colorway rows in one action
- Duplicate detection prevents re-adding existing active names

File:
- `src-vnext/features/products/components/ProductEditorPage.tsx`

### 5) IA readability polish for classification labels

Product surfaces now humanize classification keys for display (e.g. `hoodies-sweaters` → `Hoodies Sweaters`):

- Product cards
- Product table
- Product detail classification panel

Files:
- `src-vnext/features/products/components/ProductFamilyCard.tsx`
- `src-vnext/features/products/components/ProductFamiliesTable.tsx`
- `src-vnext/features/products/components/ProductDetailPage.tsx`

### 6) Option 1 revision after usability review

Initial Taxonomy Rail pattern was rolled back after in-app review due to confusion.
The live editor now uses a single, focused classification toolbar:

- No right-side taxonomy panel
- One classification surface for select + create
- Reclassification remains product-family level (applies to all colorways)

File:
- `src-vnext/features/products/components/ProductEditorPage.tsx`

### 7) Post-review fine tuning (screenshots)

Adjusted editor based on in-app review screenshots:

- Removed confusing taxonomy menu/rail
- Consolidated classification controls to one toolbar
- Added inline type/subcategory creation where reclassification happens
- Improved quick-add colorway UX:
  - parsed/new/existing preview counts before apply
  - disabled add action when no net-new colorways are present

## Wireframe / Mockup Options

Static HTML options (responsive, review-only):

- `docs-vnext/_proof/FOCUS-PRODUCTS-2026-02-09-A/mockups/option-1-taxonomy-rail.html`
- `docs-vnext/_proof/FOCUS-PRODUCTS-2026-02-09-A/mockups/option-2-guided-flow.html`
- `docs-vnext/_proof/FOCUS-PRODUCTS-2026-02-09-A/mockups/option-3-table-studio.html`

## Validation

- `npx tsc --noEmit` ✅
- `npm run test -- src-vnext/features/products/lib/productClassifications.test.ts src-vnext/features/products/lib/productList.test.ts` ✅
- `npm run lint` ✅
- `npm run build` ✅

## Manual QA checklist

| Scenario | Steps | Expected |
|---|---|---|
| Classification dropdowns | Open `/products/:fid/edit` → Classification | Type/Subcategory are selects, not free-text fields |
| Inline classification create | In Classification toolbar, add type/subcategory | New values appear in Type/Subcategory dropdowns immediately |
| Quick add colorways | Paste `Forest, Navy, Oxblood` and add | Rows are created in one action; duplicates are ignored |
| Mobile safety | Open product editor on mobile route | Desktop-only guard remains intact |
