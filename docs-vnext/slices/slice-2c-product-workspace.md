# Slice 2C — Product Workspace (Samples, Documents, Activity)

> Draft v1 — 2026-02-04

This slice extends the Product cockpit into a producer-grade workspace: supply tracking (samples), supporting materials (documents), and a discussion/activity surface.

It is intentionally scoped to **Products** only (org-level). It does not introduce a global activity feed or cross-entity fan-out.

## Governing docs

- `docs-vnext/design/experience-spec.md`
- `docs-vnext/engineering/architecture.md`
- `docs-vnext/engineering/build-strategy.md`
- `docs-vnext/ops/firestore-indexes.md`

## Scope

### Included routes

| Route | Surface | Mobile | Desktop | Scope |
|---|---|---:|---:|---|
| `/products/:fid` | Product Workspace | ✓ Read | ✓ Full | Org |

### Included capabilities

**Workspace IA**
- Left rail sections: **Overview**, **Colorways**, **Samples**, **Assets**, **Activity**
- Overview uses a bento-style section launcher + quick stats.
- Explicit empty/loading/error states per section.

**Samples (supply tracking)**
- Track sample entries by **type**: `shoot`, `pre_production`, `bulk`
- Track lifecycle **status**: `requested`, `in_transit`, `arrived`, `returned`, `issue`
- Optional fields: `eta`, `carrier`, `tracking`, `notes`
- Optional **scope** to a specific colorway (`scopeSkuId`)
- Soft-delete supported (`deleted: true`)

**Assets (documents)**
- Upload and list supporting documents (PDF + images)
- Download via Storage URL resolution
- Delete supported (removes metadata and attempts Storage delete)

**Activity**
- Comment thread with timestamps and author attribution.
- Lightweight timeline derived client-side from created/updated timestamps across the workspace collections.

### Mobile behavior

- `/products/:fid` remains readable on mobile.
- Mutations (add sample, upload/delete document, post/delete comment) are **disabled** on mobile to preserve reliability.

## Data contract (schema extension)

This slice introduces **new subcollections** under product families:

- `clients/{clientId}/productFamilies/{familyId}/samples/{sampleId}`
- `clients/{clientId}/productFamilies/{familyId}/documents/{documentId}`
- `clients/{clientId}/productFamilies/{familyId}/comments/{commentId}`

### Sample document

```ts
type ProductSampleType = "shoot" | "pre_production" | "bulk"
type ProductSampleStatus = "requested" | "in_transit" | "arrived" | "returned" | "issue"

interface ProductSample {
  type: ProductSampleType
  status: ProductSampleStatus
  sizeRun: string[]
  carrier: string | null
  tracking: string | null
  eta: Timestamp | null
  arrivedAt: Timestamp | null
  notes: string | null
  scopeSkuId: string | null
  deleted: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
  createdBy: string | null
  updatedBy: string | null
}
```

### Document metadata

```ts
interface ProductDocument {
  name: string
  storagePath: string
  contentType: string | null
  sizeBytes: number | null
  deleted: boolean
  createdAt: Timestamp
  createdBy: string
  createdByName: string | null
  createdByAvatar: string | null
}
```

### Comment document

```ts
interface ProductComment {
  body: string
  createdAt: Timestamp
  createdBy: string
  createdByName: string | null
  createdByAvatar: string | null
  deleted: boolean
}
```

## Storage contract

Documents are stored separately from images:

- `docs/productFamilies/{familyId}/{documentId}/{filename}`

Allowed content types:
- `application/pdf`
- `image/*`

Max size:
- 25MB per document

## Security / RBAC

- Reads: authenticated users in the client can read samples/documents/comments.
- Writes:
  - Samples + Documents: `admin` or `producer`/`wardrobe`
  - Comments: author-only updates/deletes; create requires `createdBy == auth.uid`

## Definition of Done

- Producer can:
  - Add/edit/delete samples
  - Upload/download/delete documents
  - Post and delete their own comments
- UI remains calm and legible (no overflow, explicit states, no transparent popovers).
- `npx tsc --noEmit`, `npm test`, `npm run lint`, `npm run build` pass.

