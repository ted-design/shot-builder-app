# Slice 2B — Product Library (vNext)

> Draft v1 — 2026-02-03

This slice delivers a trustworthy, producer-grade Product Library in vNext: fast browsing, safe CRUD, and robust image handling — without introducing new Firestore schema or read fan-out.

## Governing docs

- `docs-vnext/design/experience-spec.md`
- `docs-vnext/engineering/architecture.md`
- `docs-vnext/engineering/build-strategy.md`
- `docs-vnext/ops/firestore-indexes.md`

## Scope

### Included routes

| Route | Surface | Mobile | Desktop | Scope |
|---|---|---:|---:|---|
| `/products` | Product Library | ✓ Read | ✓ Full | Org |
| `/products/new` | Product Create | ✗ Desktop Only | ✓ Full | Org |
| `/products/:fid` | Product Detail | ✓ Read | ✓ Read + Actions | Org |
| `/products/:fid/edit` | Product Edit | ✗ Desktop Only | ✓ Full | Org |

### Included capabilities (parity)

**Browse**
- Search by style name / style number / color name (family aggregates).
- Filter by status (active/discontinued) and archive state.
- Category scaffolding filters derived from existing fields: **Gender → Type → Subcategory**.
- Sort (default: style name A→Z).
- Dense, calm grid and list/table patterns; no “pills everywhere”.
- Desktop view switch between **Gallery** and **Table**; table column visibility is user-configurable (preference, not domain data).

**CRUD**
- Create product family with at least 1 SKU (colorway).
- Edit family fields + SKU list (add/edit/remove).
- Archive/unarchive (non-destructive).
- Soft-delete/restore (if legacy data already uses `deleted` / `deletedAt` fields).

**Images**
- Upload/replace/remove family header image and thumbnail image.
- Upload/replace/remove SKU image.
- Render images from existing Storage paths; never assume thumbnails exist.

### Exclusions (explicit non-goals)

- CSV import tooling.
- “Workspace” extensions (samples/supply tracking, discussion comments, documents) unless explicitly specced later.
- Cross-entity fan-out (e.g., querying shots to compute usage). If `shotIds` exists on the product family doc it may be displayed as a count only.

## Data contract (no schema changes)

vNext must honor the existing legacy shapes (field names may vary historically). The mapping layer must accept aliases and render safely.

### Product Family document

**Collection:** `clients/{clientId}/productFamilies/{fid}`

**Read pattern:** real-time subscription (single collection) for `/products`

**Key fields (existing)**
- Identity: `styleName`, `styleNumber`, `previousStyleNumber?`
- Classification: `gender`, `productType?`, `productSubcategory?`
- Status: `status` (e.g. `active`, `discontinued`), `archived` (boolean)
- Notes: `notes` (legacy may be string or array)
- Images: `headerImagePath?`, `thumbnailImagePath?`
- Sizes: `sizes?` (base family sizes)
- Aggregates (denormalized): `skuCount`, `activeSkuCount`, `skuCodes[]`, `colorNames[]`, `sizeOptions[]`, `shotIds[]`
- Soft-delete (if present): `deleted`, `deletedAt`
- Audit: `createdAt`, `updatedAt`, `createdBy`, `updatedBy`

### Product SKU (colorway) document

**Collection:** `clients/{clientId}/productFamilies/{fid}/skus/{skid}`

**Read pattern:** real-time subscription (subcollection) for `/products/:fid`

**Key fields (existing)**
- Identity: `colorName` (legacy alias: `name`), `skuCode?`
- Status: `status`, `archived`
- Sizes: `sizes[]`
- Image: `imagePath?`
- Color metadata: `colorKey?`, `hexColor?` (legacy alias: `colourHex?`)
- Soft-delete: `deleted`, `deletedAt`
- Audit: `createdAt`, `updatedAt`, `createdBy`, `updatedBy`

## Performance & trust constraints (non-negotiable)

- No N+1 reads. `/products` must not fetch SKUs per family.
- Avoid new composite indexes. Prefer client-side filtering against the subscribed family list.
- Editing must not rely on optimistic creates. Await Firestore confirmation before reflecting new entities.

## Definition of Done

**UX**
- Producer can browse and find products quickly (search + filters) on desktop.
- Mobile renders read-only surfaces without broken interactions.
- Empty/loading/error states are explicit and calm.
- Popovers/dialogs/dropdowns are legible and layer above fixed navigation.

**Correctness**
- Uses existing Firestore collections and fields only; no schema changes.
- Image paths are compatible with legacy Storage conventions.
- RBAC hides or disables edit controls for non-edit roles.

**Reliability**
- Safe fallbacks for missing or legacy-variant fields (aliases supported).
- Destructive operations require confirmation.

**Quality**
- `npx tsc --noEmit` passes.
- `npm test` passes.
- `npm run lint` and `npm run build` must pass before focus sign-off (tracked in proof).
