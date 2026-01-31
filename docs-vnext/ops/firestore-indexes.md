# Firestore Indexes — vNext

## Index Policy

Keep server-side Firestore queries minimal to avoid index explosion.

- **One canonical query per collection** that requires a composite index.
- All other sorts and filters are **client-side** against the already-subscribed dataset.
- Do not add new composite indexes without explicit approval.
- The dev-only `indexUrl` surfaced by `useFirestoreCollection` error handling links directly to the Firebase Console to create missing indexes.

## Required Indexes

### Shots List

**Collection:** `clients/{clientId}/shots`

**Query:**
```typescript
where("projectId", "==", projectId),
where("deleted", "==", false),
orderBy("sortOrder", "asc")
```

**Composite Index:**

| Field | Order |
|---|---|
| `projectId` | Ascending |
| `deleted` | Ascending |
| `sortOrder` | Ascending |

**Scope:** Collection

**Status:** Required for Slice 2 shot list. All other sort modes (name, date, status, created) are client-side sorts of the subscribed array.

## Dev-Only Index URL

When a query fails with `failed-precondition` (missing index), the app:

1. Shows a neutral message: "This view requires a database index that hasn't been created yet."
2. In `import.meta.env.DEV` mode only, renders a clickable link to the Firebase Console index creation page.
3. In production, the link is hidden. Users see only the neutral message.

This is handled in `src-vnext/shared/hooks/useFirestoreCollection.ts`.

## Adding New Indexes

1. Confirm the query cannot be served by client-side filtering of an existing subscription.
2. Document the query shape and required index fields here.
3. Create the index in Firebase Console for all environments (dev, staging, prod).
4. Verify the query works after the index finishes building.
