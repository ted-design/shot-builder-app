# Acceptance Spec — Focus Callsheet Cohesive Stream Pass (2026-02-11 H)

Date: 2026-02-11
Owner: Codex
Domain: Call Sheet schedule editor IA (`src-vnext`)

## Scope
Address layout and cohesion feedback from AB step:
- remove standalone highlights section from the board body
- integrate shared highlights into each track’s visible editing stream
- keep track columns full-width and visually aligned with surrounding modules

## Acceptance Criteria

### AC1 — Full-width track layout
- Multi-track grid uses available width without leaving an empty phantom column.

### AC2 — No standalone highlights block
- Schedule board no longer renders highlights as an isolated section card above tracks.

### AC3 — Shared blockers visible in-context
- Shared highlight markers are visible inside each track stream (time-sorted with local entries), with edit/remove access.

### AC4 — Regression safety
- Existing schedule-focused tests pass.
- `npm run lint` passes.
- `npm run build` passes.

## Notes
- This pass prioritizes contextual visibility and cohesion.
- Dedicated drag-reorder for shared markers is deferred while matrix-level timeline interactions are designed.
