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

- [ ] `/projects`
- [ ] `/projects/:id/pulls`
- [ ] `/projects/:id/pulls/:pid`
- [ ] `/pulls/shared/:shareToken`
- [ ] `/projects/:id/callsheet`
- [ ] `/projects/:id/callsheet?scheduleId=...`
- [ ] `/library/talent`
- [ ] `/library/locations`
- [ ] `/library/crew`
- [ ] `/projects/:id/assets`

## Screenshot Index (must be captured in a real browser)

Save screenshots under `docs-vnext/_proof/SPRINT-2026-02-03-A/images/`.

- [ ] `pull-share-enabled.png` — Pull detail shows sharing enabled + correct share URL.
- [ ] `public-pull-loaded.png` — Public pull page loads from `/pulls/shared/:shareToken`.
- [ ] `public-pull-response-submitted.png` — Warehouse submits an update successfully.
- [ ] `callsheet-landing-schedules.png` — `/projects/:id/callsheet` shows schedule list/select.
- [ ] `callsheet-preview.png` — Call sheet preview renders (preview=1 or non-manager).
- [ ] `library-talent.png` — Talent library list.
- [ ] `library-locations.png` — Locations library list.
- [ ] `library-crew.png` — Crew library list.
- [ ] `project-assets.png` — Project assets overview.

## Checks Run (paste outputs or excerpts)

- [x] `npx tsc --noEmit` (2026-02-03)
- [x] `npm test` (2026-02-03)
- [ ] `npm run lint` (at least once per sprint)
- [ ] `npm run build` (at least once per sprint)
