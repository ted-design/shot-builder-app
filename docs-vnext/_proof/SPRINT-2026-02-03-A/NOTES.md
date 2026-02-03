# Notes — SPRINT-2026-02-03-A

## Decisions

- Standardize Call Sheet route to `/projects/:projectId/callsheet`; keep `/schedule` as a redirect alias.
- Print-to-PDF uses a readiness gate + timeout before `window.print()`; no timing heuristics.

## Tradeoffs

- Mobile builder redirects to dashboard; preview remains accessible on mobile (`?preview=1`).
- Print overlay is rendered in the portal DOM and explicitly hidden in print CSS to avoid artifacts.

## Follow-ups

- Add Claude-in-Chrome screenshots listed in `docs-vnext/_proof/SPRINT-2026-02-03-A/PROOF.md`.
