# Notes — FOCUS-SHOTS-2026-02-03-A

## Decisions

- “Assigned products” is derived from shot doc only (no extra reads): union of `shot.products[]` + `shot.looks[].products[]` (deduped), with a legacy fallback to `shot.productIds[]` only when no product objects exist.
- Canonical shot detail URL is `/projects/:projectId/shots/:shotId` (experience spec). The legacy `/editor` suffix is supported via redirect for backwards compatibility.

## Tradeoffs

- Dedupe key is intentionally simple (familyId + colourId + sizeScope + sizeKey) to avoid overstating counts when the same assignment appears in both legacy and look-based locations.

## Follow-ups (explicitly out of scope)

- Add canonical shot detail route per `experience-spec.md` (planned WP2).
- Remove/neutralize dead inline-editor/autosave code in `src/pages/ShotsPage.jsx` (planned WP3).
