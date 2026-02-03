# Notes — FOCUS-SHOTS-2026-02-03-A

## Decisions

- Notes integrity: `shot.notes` (legacy HTML) remains immutable in vNext surfaces; operational additions go to `shot.notesAddendum` only.
- Ordering: prefer Firestore-backed `shot.sortOrder` for canonical ordering; avoid local-only ordering for shared trust.
- Ordering migration: legacy local-only table order (`localStorage`) is not auto-applied to Firestore; instead we offer an explicit “Use my order” action to avoid surprising global changes.
- Reorder safety: disable drag reorder while searching/filtering so producers don’t accidentally change global order based on a subset view.
- Undo UX: extended toast events to support an action button so reorder can provide a true “Undo” affordance.
- Mobile operational parity: status changes are allowed on mobile (Limited mode) with Undo; `?readonly=1` disables status + addendum mutations.
- Tags: normalize tag display by label (object tags) with safe fallback for string tags to prevent unreadable summaries.
- Pull trust: treat `shot.products` + `shot.looks[].products` as one merged assignment set when generating pulls to prevent “assigned but missing” failures.
- Slice 2 alignment: tags are read-only on shot detail; tag CRUD happens only in the Library/Tags surface.

## Risks / Watchouts

- Firestore indexes: avoid introducing new required composite indexes by sorting client-side when feasible; reads remain bounded.
- Large projects: reorder writes must not exceed Firestore batch limits; prefer single-doc `sortOrder` adjustments with sparse integer gaps.
- Product duplication: when both legacy and look sources exist, dedupe assignments per-shot before aggregating pull items to avoid inflated quantities.
- Tag data shape drift: tag arrays can contain strings or objects; normalize at render boundaries to avoid silent non-rendering.

## Follow-ups (if found)

- None yet.
