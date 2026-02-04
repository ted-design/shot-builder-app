# Slice 4 — Comments (Shot Collaboration)

> Execution contract — v1.0 2026-02-04

## Goal

Enable lightweight, producer-grade collaboration on **shots** via a timestamped comment thread.

This slice deliberately ships **comments only** (no deep audit/version history UI). Version history remains a separate capability.

## Firestore Contract

### Collection

`clients/{clientId}/shots/{shotId}/comments/{commentId}`

### Document shape

```ts
{
  body: string
  createdAt: Timestamp
  createdBy: string
  createdByName: string | null
  createdByAvatar: string | null
  deleted: boolean
}
```

### Rules

- Read: any authenticated user within the client.
- Create: authenticated user; `createdBy` must equal `request.auth.uid`.
- Update: author-only; immutable fields (`createdBy`, `createdAt`, `createdByName`, `createdByAvatar`) must not change.
- Delete: author-only (UI uses soft-delete via `deleted: true`).

## UX Contract (Shot Detail)

- Explicit states: loading / error / empty.
- Desktop + mobile: comment list is readable and stable.
- Write access: `admin | producer | crew` can add and delete their own comments; `viewer` is read-only.
- Deleted comments remain visible as “Deleted comment” with author + time preserved.

## Definition of Done

- [ ] Shot detail shows a real-time comment thread ordered by `createdAt`.
- [ ] Users with write access can add comments; failures never silently drop input.
- [ ] Users can soft-delete their own comments with a confirmation dialog.
- [ ] Firestore rules already enforce author ownership and immutable fields; UI behavior matches rules.
- [ ] Tests cover: empty state, create, delete gating.

