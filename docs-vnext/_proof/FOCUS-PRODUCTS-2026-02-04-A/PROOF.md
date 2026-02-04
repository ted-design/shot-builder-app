# Proof — FOCUS-PRODUCTS-2026-02-04-A

**Domain:** PRODUCTS  
**Focus ID:** FOCUS-PRODUCTS-2026-02-04-A  
**Date:** 2026-02-04  

## Governing docs (contract)

- `docs-vnext/design/experience-spec.md`
- `docs-vnext/engineering/build-strategy.md`
- `docs-vnext/engineering/architecture.md`
- `docs-vnext/ops/firestore-indexes.md`
- `docs/claude-code-tooling.md`
- `docs-vnext/slices/slice-2b-product-library.md`

## Legacy deep analysis (mandatory)

### Key legacy surfaces (reference only)

| Surface | Route | Primary file(s) |
|---|---|---|
| Product library list | `/products` | `src/pages/ProductsPage.jsx` |
| Product detail workspace | `/products/:productId` | `src/pages/ProductDetailPageV3.jsx` |
| Product list view controls | (within list) | `src/components/overview/ViewModeMenu`, `src/components/overview/FieldSettingsMenu` |

### Why legacy behaviors existed (pressure-tested)

- **Gallery vs table:** Producers scan catalogs differently depending on the task: visuals for quick recognition, tables for normalization and auditing fields at speed.
- **Category scaffolding:** “Men → Tops → T‑Shirt” reduces cognitive load versus free-text tags, and keeps filters predictable under time pressure.
- **Field visibility:** Different teams care about different columns/metadata; letting users hide noise increases calm density without losing power.

## Definition of DONE (this focus run)

### Products list (browse)
- View toggle supports **Gallery** and **Table** (desktop); mobile remains read-only and uses Gallery.
- Filters support **Gender → Type → Subcategory** scaffolding (derived from existing fields; no schema changes).
- Sort remains fast and predictable; filter state persists in URL query params.
- Users can toggle visible fields/columns (persisted locally; safe defaults).

### Product editor (trust)
- Clicking **Edit** reliably opens the editor (dedicated editor surface; no modal overflow).
- Popovers/dialogs/dropdowns are **legible** (no transparent surfaces) and layer above fixed nav.

### Non-goals (explicit)
- Product “workspace” features (samples/supply tracking, discussion, documents) are deferred to a separately specced slice; no partial UI.

## Packages log

### WP1 — Fix popup/modals legibility + layering (blocking trust defect)

**Why:** User-reported transparent/illegible popups and “edit does nothing” were breaking trust and blocking basic Product CRUD.

**Change summary**
- Hardened token loading by importing `tokens.css` from the vNext entrypoint (eliminates reliance on CSS `@import` behavior).
- Fixed a shadcn `Select` styling bug (`--radix-…` height var) that could cause broken dropdown sizing.
- Hardened the Dialog primitive so long content can’t render off-screen (scroll clamps to viewport).
- Converted Products editing from a modal to a dedicated cockpit editor page (desktop-only) to eliminate viewport overflow and enable calm, sectioned IA.
- Updated `/products/:fid` to a cockpit-inspired surface (left rail + Overview “bento” + Assets (images) section) without adding Firestore fan-out.

**Touched surfaces**
- `src-vnext/main.tsx`
- `src-vnext/index.css`
- `src-vnext/ui/dialog.tsx`
- `src-vnext/ui/select.tsx`
- `src-vnext/app/routes/index.tsx`
- `src-vnext/features/products/components/ProductListPage.tsx`
- `src-vnext/features/products/components/ProductDetailPage.tsx`
- `src-vnext/features/products/components/ProductEditorPage.tsx`
- `src-vnext/features/products/components/ProductUpsertDialog.tsx`
- `src-vnext/features/products/components/ProductWorkspaceNav.tsx`
- `src-vnext/features/products/components/__tests__/ProductDetailPage.test.tsx`

### WP2 — `/products` view switch + category scaffolding filters + field visibility

**Change summary**
- Added desktop view toggle: Gallery ↔ Table.
- Added scaffolded category filters: `gender` → `type` → `sub` (derived from existing fields).
- Added “Fields” menu for table column visibility (local preference; safe defaults).
- Added removable filter chips + clear action (URL-persisted filters; preference state stays local).

**Touched surfaces**
- `src-vnext/features/products/components/ProductListPage.tsx`
- `src-vnext/features/products/components/ProductFamiliesTable.tsx`
- `src-vnext/features/products/lib/productList.ts`
- `src-vnext/features/products/lib/productList.test.ts`
- `src-vnext/features/products/lib/productPreferences.ts`
- `docs-vnext/slices/slice-2b-product-library.md`

## Legacy schema investigation (workspace collections)

Legacy “workspace” sections (samples/assets/activity) were built as UI scaffolds with in-memory mock data. `src/pages/ProductDetailPageV2.jsx` documents “MOCK DATA (in-memory only, no Firestore)” and only lists **future** collection paths as comments. There are no legacy path helpers or Firestore rules for product workspace collections in this repo today.

## Verification (2026-02-04)

- `npx tsc --noEmit` ✅
- `npm test` ✅
- `npm run lint` ✅ (0 warnings)
- `npm run build` ✅

## Manual QA required

⚠️ Chrome extension unavailable in this session for visual verification.

| Scenario | Steps | Expected |
|---|---|---|
| Popovers legible | Open `/products` → open any Select / Fields dropdown | Popovers have opaque background and readable text |
| Editor opens | Open any product → click “Edit” | Navigates to editor page; content stays within viewport and scrolls |
| View toggle | `/products` → switch Gallery/Table | Both render, no layout glitches |
| Scaffolded filters | Pick Gender → Type → Subcategory | Results update; dependent selects enable progressively |
| Column visibility | Table view → Fields → toggle columns | Table updates; preference persists on refresh |

## Screenshots index

_Screenshots live in `docs-vnext/_proof/FOCUS-PRODUCTS-2026-02-04-A/images/`._
