# Notes — FOCUS-SHOTS-2026-02-03-A

## Decisions

- Notes integrity: `shot.notes` (legacy HTML) remains immutable in vNext surfaces; operational additions go to `shot.notesAddendum` only.
- Ordering: prefer Firestore-backed `shot.sortOrder` for canonical ordering; avoid local-only ordering for shared trust.
- Ordering migration: legacy local-only table order (`localStorage`) is not auto-applied to Firestore; instead we offer an explicit “Use my order” action to avoid surprising global changes.
- Reorder safety: disable drag reorder while searching/filtering so producers don’t accidentally change global order based on a subset view.
- Undo UX: extended toast events to support an action button so reorder can provide a true “Undo” affordance.
- Mobile operational parity: status changes are allowed on mobile (Limited mode) with Undo; `?readonly=1` disables status + addendum mutations.
- Tags: normalize tag display by label (object tags) with safe fallback for string tags to prevent unreadable summaries.

## Risks / Watchouts

- Firestore indexes: avoid introducing new required composite indexes by sorting client-side when feasible; reads remain bounded.
- Large projects: reorder writes must not exceed Firestore batch limits; prefer single-doc `sortOrder` adjustments with sparse integer gaps.

## Follow-ups (if found)

- None yet.
