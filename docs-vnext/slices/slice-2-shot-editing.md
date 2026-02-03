# Slice 2 — Shot Editing (Producer Core)

> Execution contract — v1.1 2026-01-31 (revised post-review)

## Goals

Replace the legacy shot editor experience with a vNext surface that lets producers prep and operate under time pressure. This is the screen producers live on. Every decision here prioritizes speed of interaction over flexibility of configuration.

While Slice 2 is optimized for production workflows, all concepts (shots, products, assignments, notes, reference images) must remain domain-agnostic and reusable for future product development and lifecycle use cases — nothing in this slice should be fashion-specific or encode industry-specific assumptions into the data model or UI.

The current Slice 1 `ShotDetailPage` provides: inline title edit, status select, description/notes textareas, and family-level-only product/talent/location pickers. Slice 2 upgrades this to production-grade.

---

## In-Scope (Required)

### 1. Shot Detail Page (Desktop: Full Editor, Mobile: Read + Operational)

- Inline title editing (1-click to enter edit mode)
- Status toggle (optimistic with undo toast, same as Slice 1)
- **Shot number field** — e.g., "12A". Not in vNext `Shot` type yet but exists in legacy Firestore documents. Type update only, no schema change.
- **Date field** — `YYYY-MM-DD`. Same situation: exists in Firestore, not typed in vNext.
- Description (plain text, inline edit — existing)
- Notes — **legacy-safe model required** (see Notes Data Integrity below)
- Location picker (existing, may need polish)
- Talent picker (existing, may need polish)
- Product assignment with color/size detail (upgrade — see below)

### 2. Product Assignment Upgrade

The current picker stores only `familyId`/`familyName`. This is insufficient for pull sheet generation, which aggregates on `familyId + colourId`.

Required changes:
- After selecting a product family, present available SKUs (from `productFamilies/{fid}/skus/{skid}` subcollection)
- Allow selection of `colourId`/`colourName` and `size`
- Store the full `ProductAssignment` shape: `{ familyId, familyName, skuId, skuName, colourId, colourName, size, quantity }`
- SKU subcollection query must be lazy-loaded (only on picker open for that family)

**`sizeScope` is required.** The legacy `shotProductSchema` includes a `sizeScope` field (`"all"` / `"single"` / `"pending"`) which controls how pull sheet quantities are derived. Legacy workflows depend on this:
- `"all"` — product is needed in all available sizes (pull sheet generates one line per size from the SKU's size list)
- `"single"` — product is needed in one explicit size (pull sheet generates one line for the selected size)
- `"pending"` — size scope not yet decided (pull sheet treats as "One Size" placeholder; producer must resolve before fulfillment)

The product picker MUST support `sizeScope` selection alongside color and size. The full `ProductAssignment` storage shape is: `{ familyId, familyName, skuId, skuName, colourId, colourName, size, sizeScope, quantity }`.

The vNext `ProductAssignment` type in `shared/types/index.ts` must be updated to include `sizeScope?: "all" | "single" | "pending"`.

### 3. Notes Data Integrity (CRITICAL — Legacy HTML Preservation)

Legacy notes are stored as rich HTML (TipTap editor, up to 50K chars). The `notes` field on shot documents contains formatted HTML in production. A plain-text editor that writes back to this field will **destroy existing formatting irreversibly**.

**Safe model chosen: Read-only HTML rendering + append-only plain-text addendum.**

Rules:
- The shot detail page MUST render existing `notes` content as sanitized HTML (read-only, using the existing `sanitizeHtml.ts` utility).
- No save path may strip, sanitize-and-rewrite, or overwrite existing HTML in the `notes` field.
- A new **"Producer Addendum"** plain-text field is provided below the rendered notes for on-set additions. This field writes to a separate `notesAddendum` field on the shot document (plain text, append-only semantics in the UI).
- On mobile, both the rendered HTML notes and the addendum field are visible. The addendum field is editable (operational action). The HTML notes are read-only.
- Rich text editing of the `notes` field itself is deferred to a future slice when TipTap is integrated.

**Firestore impact:** `notesAddendum` is a new optional string field on the shot document. This is the sole new field introduced in Slice 2. It is a simple string — no schema migration, no structural change.

### 4. Reference Images

- Upload at least 1 reference image per shot (detail page only — desktop)
- Display hero image on **shot detail page** (full size)
- **Shot list cards:** hero image display is conditional on pre-sized thumbnails. If Firebase Storage thumbnail generation (via extension or Cloud Function) is available, display thumbnails on list cards. If thumbnail generation is not guaranteed at Slice 2 ship time, **defer inline list images** and show a small icon/placeholder instead. Full images in large lists will destroy scroll performance.
- Uses existing Firebase Storage patterns and `shots/{shotId}/` storage paths
- Basic upload + display only. Advanced crop/zoom/rotation is deferred.
- Must port or rewrite minimal image upload utility from legacy `imageHelpers.js`

### 5. Manual Shot Ordering (Required)

Shot sequencing is essential to production flow. Producers arrange shots in a specific shooting order, and this order must be respected everywhere: shot list, schedule selection (Slice 3), and call sheet (Slice 4).

- Producer must be able to reorder shots via drag-and-drop (desktop) or up/down controls (mobile fallback)
- Order is persisted via the existing `sortOrder: number` field on shot documents
- The shot list default view must respect `sortOrder` as the primary sort
- When sorting by other criteria (status, date), the UI must clearly indicate that custom order is overridden
- New shots receive a `sortOrder` value that places them at the end of the list

### 6. Shot List Enhancements

- Sort by: name, date, status, creation date (custom order is default)
- Filter by: status
- Visual readiness indicator per shot card:
  - Products assigned? (yes/no indicator)
  - Talent assigned? (yes/no indicator)
  - Location set? (yes/no indicator)
- These are derived from the shot document fields — no fan-out queries

### 7. Read-Only Tag Display

Legacy shot documents may contain `tags: [{id, label, color}]` arrays. Removing tag display would strip context from existing projects.

- Shot detail page MUST render existing tags as read-only colored badges
- Shot list cards SHOULD display tag badges if present
- Tag creation, editing, and deletion remain deferred (no write path for tags in this slice)
- vNext `Shot` type must include `tags?: ReadonlyArray<{ readonly id: string; readonly label: string; readonly color: string }>`

### 8. Mobile Operational Actions

- Status changes (same as Slice 1)
- Add/edit producer addendum notes (plain text — see Notes Data Integrity)
- View rendered HTML notes (read-only)
- View all shot details (read-only for assignments, products, talent, location)
- View tags (read-only)
- Reference image viewable but not uploadable on mobile

---

## Out-of-Scope (Deferred)

| Capability | Reason |
|---|---|
| Rich text notes editing (TipTap) | Existing HTML notes rendered read-only. Full TipTap editor deferred. See Notes Data Integrity. |
| Looks/visual options | E-commerce-specific workflow. Not blocking for general production. |
| Tag creation/editing/deletion | Read-only display of existing tags is in-scope. Tag write operations deferred. |
| Move/copy shot between projects | Rare operation. |
| Version history panel | Audit trail via activity feed (future slice). |
| Active editors / presence | Rare concurrent editing. |
| Bulk actions from shot list | Desktop convenience. Single-shot operations sufficient for launch. |
| Column configuration / density | Personal preference. |
| Advanced image crop/zoom/rotation | Basic upload sufficient for launch. |
| Shot deletion | Soft-delete exists in Slice 1. No changes needed. |
| Hero image thumbnails on shot list cards | Deferred if pre-sized thumbnail generation is not available. See Reference Images. |

---

## Producer-Critical Behaviors Preserved

1. **Speed of status changes.** Status toggle must be 1-tap on mobile, 1-click on desktop. No modal, no confirmation for non-destructive transitions. Undo toast for reversal.

2. **Product assignment drives pull sheets.** If a producer assigns products without color/size/sizeScope, the pull sheet is broken. The picker MUST support sizeScope selection. `"all"` generates multi-size pull lines; `"single"` generates one explicit size line.

3. **Notes data integrity.** Legacy notes contain rich HTML that producers spent hours writing. vNext MUST NOT destroy this content. Existing notes render as read-only HTML. New on-set additions go to the addendum field. No save path may overwrite or strip the `notes` field.

4. **Notes survive to set.** Both rendered HTML notes and the plain-text addendum must be readable on mobile without scrolling past other UI. On the detail page, notes should be prominent, not buried.

5. **Shot order is production order.** Producers arrange shots in a deliberate shooting sequence. This order must be preserved via `sortOrder`, controllable via drag-and-drop (desktop) or up/down controls, and respected downstream in schedule selection (Slice 3) and call sheet rendering (Slice 4).

6. **Visual readiness scanning.** From the shot list, a producer must see at a glance: does this shot have products? talent? location? Missing items should be visually distinct (not just absent).

7. **Date for scheduling.** Shot date is essential for call sheet assembly (Slice 3). Without it, shots cannot be placed on a schedule.

8. **Reference image as communication.** A single hero image per shot communicates intent faster than any text field. Must be visible on the shot detail page. List card thumbnails are conditional on thumbnail availability (see Reference Images).

9. **Tags as context.** Existing tags on legacy shots must remain visible. Removing tag display strips context producers used for categorization.

---

## Firestore Impact

- **No new collections.**
- **One new field:** `notesAddendum?: string` on shot documents (plain text, append-only semantics in UI). This is the sole new field in Slice 2.
- **Existing fields now typed:** `shotNumber`, `date`, `heroImage`, `tags`, `sizeScope` (on ProductAssignment), and full `ProductAssignment` shape already exist on legacy shot documents in production Firestore.
- **Type updates required in `shared/types/index.ts`:**
  - `Shot`: add `shotNumber?: string`, `date?: Timestamp`, `notesAddendum?: string`, `tags?: ReadonlyArray<{ readonly id: string; readonly label: string; readonly color: string }>`
  - `ProductAssignment`: add `sizeScope?: "all" | "single" | "pending"`
- **Storage paths.** Reference images use existing `shots/{shotId}/` storage paths. No new storage rules needed.
- **SKU reads.** Product picker upgrade requires reading `productFamilies/{fid}/skus/{skid}`. Path builder already exists in `shared/lib/paths.ts` as `productFamilySkusPath`.

---

## Prerequisites

| Prerequisite | Source | Status |
|---|---|---|
| Shot CRUD (create, read, update, list) | Slice 1 | Done |
| Shot status toggle with optimistic update | Slice 1 | Done |
| Product family picker (family-level) | Slice 1 | Done (needs upgrade) |
| Talent picker | Slice 1 | Done |
| Location picker | Slice 1 | Done |
| Inline editing component | Slice 1 | Done |
| Firebase Storage integration | Legacy | Needs port |

---

## Definition of Done

### UX
- [ ] Producer can edit shot title inline (1-click to enter edit mode)
- [ ] Producer can change shot status in <=1 tap on mobile, <=1 click on desktop
- [ ] Producer can assign products with color, size, and sizeScope — pull sheet generation produces correct items
- [ ] Producer can assign talent (multi-select) and location (single-select)
- [ ] Producer can set shot date and shot number
- [ ] Producer can upload at least 1 reference image per shot (desktop)
- [ ] Producer can read existing HTML notes and write to the addendum field on mobile
- [ ] Existing HTML notes are never overwritten or stripped by any save path
- [ ] Shot list shows visual readiness indicators (products/talent/location presence)
- [ ] Shot list respects custom `sortOrder` as default sort
- [ ] Producer can reorder shots via drag-and-drop (desktop) or up/down controls
- [ ] Shot list supports sorting by status and date (with clear indicator that custom order is overridden)
- [ ] Existing tags display as read-only colored badges on shot detail and list cards
- [ ] All shot fields persist correctly to Firestore (no data loss on save)
- [ ] Mobile shot detail is read + operational (status, addendum notes) — no structural editing

### Correctness
- [ ] Product assignments include colourId, size, and sizeScope when selected
- [ ] sizeScope "all" generates correct multi-size pull lines; "single" generates one line
- [ ] Pull sheet generation from Slice 1 still works correctly with upgraded product assignments
- [ ] Shot number and date fields round-trip to Firestore without data loss
- [ ] Image upload stores to correct Firebase Storage path
- [ ] Hero image displays on shot detail page; list card thumbnails only if pre-sized thumbnails available
- [ ] `notesAddendum` field persists to Firestore without touching the `notes` HTML field
- [ ] `sortOrder` updates persist atomically (no lost reorder on concurrent edits)

### Quality
- [ ] `npm run lint` passes with zero warnings
- [ ] `npm run build` produces valid production build
- [ ] Unit tests cover shot update logic, product assignment shape, and sizeScope handling
- [ ] Component tests cover product picker with SKU + sizeScope selection
- [ ] Component tests verify HTML notes render read-only (no write path)
- [ ] Mobile layout usable on 375px viewport

---

## Known Risks

1. **Product picker complexity.** Upgrading from family-only to family+color+size+sizeScope requires reading the SKU subcollection and presenting a multi-step selection flow. This adds a Firestore query per picker open. Must be lazy-loaded.

2. **Image upload port.** Firebase Storage upload patterns exist in legacy but have not been ported to vNext. Need to port or write minimal equivalent of `imageHelpers.js`.

3. **Shot number field verification.** Field exists in legacy schema but must confirm it exists on production Firestore documents before adding to vNext type. Risk: UI shows empty fields.

4. **HTML notes rendering safety.** Existing `notes` field contains TipTap HTML. Must use `sanitizeHtml.ts` (existing utility) for rendering. No `dangerouslySetInnerHTML` without sanitization. Must verify sanitizer handles all TipTap output constructs.

5. **Thumbnail availability.** Hero image display on shot list cards depends on pre-sized thumbnails. If Firebase Storage does not have a thumbnail generation pipeline, list card images must be deferred to avoid scroll performance degradation on lists of 50+ shots.

6. **sortOrder atomicity.** Drag-and-drop reordering updates `sortOrder` on multiple shot documents. Must use a batched write to avoid partial reorder if network drops mid-update.

---

## Appendix A: Legacy Shot Editor Capability Inventory

Source: `src/pages/ShotEditorPageV3.jsx`, `src/components/shots/ShotEditModal.jsx`, `src/components/shots/ShotTableView.jsx`

| Capability | Legacy Component | Field/Type | Producer Reliance |
|---|---|---|---|
| Title editing | ShotEditModal, InlineEdit | `title: string` | High |
| Shot number | ShotEditModal | `shotNumber: string` | High |
| Status toggle | ShotTableView inline dropdown | `status: "todo" / "in_progress" / "complete" / "on_hold"` | Critical |
| Description | ShotEditModal | `description: string` (max 200 chars) | Medium |
| Date | ShotEditModal | `date: Timestamp` (YYYY-MM-DD) | High |
| Location picker | LocationSelect | `locationId: string`, `locationName: string` | High |
| Product assignment | ShotProductSelectorModal, ShotProductAddModal | `products: ProductAssignment[]` with colourId, size, sizeScope, status | Critical |
| Talent assignment | TalentMultiSelect | `talent: string[]` (talentId refs) | High |
| Notes (rich text) | ShotNotesCanvas (TipTap) | `notes: string` (HTML, max 50K chars), autosave, version history | Critical |
| Reference images | MultiImageAttachmentManager | Up to 10 attachments with crop/zoom/rotation | High |
| Hero image | ImageCropPositionEditor | `referenceImagePath`, `referenceImageCrop` | Medium |
| Tags | TagEditor | `tags: [{id, label, color}]` | Medium |
| Looks/visual options | ShotLooksCanvas | Per-look products + references, hero product | Low-Medium |
| Move/copy to project | ShotEditModal advanced actions | `onMoveToProject`, `onCopyToProject` | Low |
| Version history | VersionHistoryPanel | `noteVersions` subcollection | Low |
| Active editors | ActiveEditorsBar | Real-time presence | Low |
| Bulk status/tag/delete | BulkOperationsToolbar | Multi-select + toolbar | Medium |
| Drag reorder | ShotTableView DnD | `sortOrder: number` | Medium |
| Column config | FieldSettingsMenu | `viewPrefs` object | Low |
| Density control | DensityMenu | compact/normal/spacious | Low |
| Sort/filter/group | SortMenu, FilterMenu, GroupByMenu | Multiple sort keys, status/tag/location filters | Medium |
| Search | Toolbar search input | Text search across name, description, notes, products, talent | Medium |
| Insights sidebar | InsightsSidebar | Shot totals, stats | Low |

---

## Revision Notes (Post-Review)

**v1.1 — 2026-01-31:** Applied mandatory changes from external architectural review.

1. **Notes Data Integrity (Critical).** Replaced plain-text notes model with safe legacy-preserving approach: read-only HTML rendering of existing `notes` field + new `notesAddendum` plain-text field. No save path may overwrite or strip existing HTML. Rich text editing (TipTap) remains deferred.

2. **Manual Shot Ordering (Required).** Moved drag-and-drop / manual ordering from Deferred to Required. `sortOrder` is the default sort. Producer must have explicit control over shot sequence. Order is respected in schedule selection (Slice 3) and call sheet rendering (Slice 4).

3. **sizeScope (Required).** Moved from Deferred to Required. Product picker must support `sizeScope` (`"all"` / `"single"` / `"pending"`) because legacy pull-sheet generation depends on it. `ProductAssignment` type updated to include `sizeScope`.

4. **Shot List Thumbnails (Reevaluated).** Hero image on list cards is conditional on pre-sized thumbnail availability. If thumbnail generation is not available, list card images are deferred. Hero image on detail page is always required.

5. **Read-Only Tags (Added).** Existing tags on legacy shot documents must be rendered as read-only colored badges. Tag write operations remain deferred.
