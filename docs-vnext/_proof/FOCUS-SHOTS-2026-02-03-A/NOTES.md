# Notes — FOCUS-SHOTS-2026-02-03-A

## Decisions

- Notes integrity: `shot.notes` (legacy HTML) remains immutable in vNext surfaces; operational additions go to `shot.notesAddendum` only.
- Ordering: prefer Firestore-backed `shot.sortOrder` for canonical ordering; avoid local-only ordering for shared trust.

## Risks / Watchouts

- Firestore indexes: avoid introducing new required composite indexes by sorting client-side when feasible; reads remain bounded.
- Large projects: reorder writes must not exceed Firestore batch limits; prefer single-doc `sortOrder` adjustments with sparse integer gaps.

## Follow-ups (if found)

- None yet.

