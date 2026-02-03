# Sprint Proof — SPRINT-2026-02-03-D

Date: 2026-02-03
Branch: `vnext/slice-3-call-sheet-assembly`

## Packages

1) WP1 — Shots list fidelity + pull generation (producer→warehouse loop)
2) WP2 — Call sheet output polish (trust + export)

## Routes Visited (manual)

- [ ] `/projects`
- [ ] `/projects/:id/shots`
- [ ] `/projects/:id/shots/:sid`
- [ ] `/projects/:id/pulls`
- [ ] `/projects/:id/pulls/:pid`
- [ ] `/pulls/shared/:shareToken`
- [ ] `/projects/:id/callsheet?scheduleId=...` (desktop)
- [ ] `/projects/:id/callsheet?scheduleId=...&preview=1` (mobile viewport)

## Screenshot Index (you will capture in a real browser)

Save under `docs-vnext/_proof/SPRINT-2026-02-03-D/images/`.

- [ ] `01-shots-list-names.png` — Shot cards show correct shot names (non-empty) and optional shot number.
- [ ] `02-shots-list-hero-image.png` — At least one shot card shows the expected reference/hero image (if available in data).
- [ ] `03-pull-generate-from-shots.png` — Selected shots → create pull sheet dialog/flow.
- [ ] `04-pull-detail-items.png` — Pull detail shows aggregated items with sizes/quantities.
- [ ] `05-public-pull-fulfillment.png` — Public pull link loads and can submit an update when responses enabled.
- [ ] `06-callsheet-preview-header.png` — Call sheet preview header (project + schedule + date) and export entrypoint visible.

## Checks Run (paste outputs or excerpts)

- [ ] `npx tsc --noEmit` (WP1)
- [ ] `npm test` (WP1)
- [ ] `npx tsc --noEmit` (WP2)
- [ ] `npm test` (WP2)
- [ ] `npm run lint` (sprint)
- [ ] `npm run build` (sprint)

