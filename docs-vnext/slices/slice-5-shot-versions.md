# Slice 5 — Shot Version History + Restore

> Execution contract — v1.0 2026-02-04

## Why This Exists (Producer Trust)

Shots are edited under pressure. Mistakes happen, and “undo” is not enough across refreshes, devices, or multiple collaborators.

Version history provides:
- A **recoverable safety net** (restore a prior known-good state)
- A lightweight **change log** that supports accountability under stress

This slice intentionally ships a **minimal**, calm surface: History list + Restore. It is not a deep audit system.

## Firestore Contract

### Collection

`clients/{clientId}/shots/{shotId}/versions/{versionId}`

### Document shape

```ts
type ShotVersionChangeType = "create" | "update" | "rollback"

{
  snapshot: Record<string, unknown>
  createdAt: Timestamp
  createdBy: string
  createdByName: string | null
  createdByAvatar: string | null
  changeType: ShotVersionChangeType
  changedFields: string[]
}
```

### Snapshot content rules (restore-safe)

- `snapshot` stores restore-relevant shot fields (not the subcollections).
- `id`, `createdAt`, `createdBy`, `clientId`, `projectId` are not restored even if present in the snapshot.
- Restore writes `updatedAt` and `updatedBy` (if available) at restore time.

### Security rules

Already present in `firestore.rules`:
- Read: any user with client access
- Create: authed; `createdBy == request.auth.uid`
- Update/Delete: forbidden (immutable)

## UX Contract (Shot Detail)

- “History” is a secondary card below core editing surfaces.
- Readable by any shot editor role; restore is **producer/admin desktop-only**.
- Restore is gated behind an explicit confirmation describing overwrite risk.
- Explicit states: loading / error / empty.

## Definition of Done

- [ ] Any meaningful shot mutation writes an immutable version snapshot.
- [ ] Shot Detail shows a history list ordered by most recent.
- [ ] Producer/admin can restore a prior version; restore creates a new `rollback` version entry.
- [ ] No save path is blocked by version logging failures (trust > availability).
- [ ] `npm test`, `npm run lint`, `npm run build` all pass.

