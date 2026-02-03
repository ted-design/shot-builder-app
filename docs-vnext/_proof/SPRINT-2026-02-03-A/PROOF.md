# Sprint Proof — SPRINT-2026-02-03-A

Date: 2026-02-03
Branch: `vnext/slice-3-call-sheet-assembly`

## Packages

1) WP5 — Proof scaffolding
2) WP1 — Pull sharing + public warehouse view
3) WP2 — Call sheet destination unification
4) WP3 — Org library read surfaces
5) WP4 — Project assets page

## Routes Visited (manual)

- [x] `/projects`
- [x] `/projects/:id/pulls`
- [x] `/projects/:id/pulls/:pid`
- [x] `/pulls/shared/:shareToken`
- [x] `/projects/:id/callsheet`
- [x] `/projects/:id/callsheet?scheduleId=...`
- [x] `/library/talent`
- [x] `/library/locations`
- [x] `/library/crew`
- [x] `/projects/:id/assets`

## Screenshot Index (must be captured in a real browser)

Save screenshots under `docs-vnext/_proof/SPRINT-2026-02-03-A/images/`.

- [x] `pull-share-enabled.png` — Pull detail shows sharing enabled + correct share URL.
- [x] `public-pull-loaded.png` — Public pull page loads from `/pulls/shared/:shareToken`.
- [ ] `public-pull-response-submitted.png` — Warehouse submits an update successfully. (Requires `shareAllowResponses` flag to be enabled on the pull)
- [x] `callsheet-landing-schedules.png` — `/projects/:id/callsheet` shows schedule list/select.
- [x] `callsheet-preview.png` — Call sheet preview renders (preview=1 or non-manager).
- [x] `library-talent.png` — Talent library list.
- [x] `library-locations.png` — Locations library list.
- [x] `library-crew.png` — Crew library list.
- [x] `project-assets.png` — Project assets overview.

## Checks Run (paste outputs or excerpts)

- [x] `npx tsc --noEmit` (2026-02-03)
- [x] `npm test` (2026-02-03)
- [x] `npm run lint` (2026-02-03)
- [x] `npm run build` (2026-02-03)
