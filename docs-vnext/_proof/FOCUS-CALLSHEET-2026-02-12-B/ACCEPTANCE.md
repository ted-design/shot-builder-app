# Acceptance Spec — Focus Callsheet Timeline Grouping Simplification (2026-02-12 B)

Date: 2026-02-12
Owner: Codex
Domain: Call Sheet output renderer (`src-vnext`) advanced schedule readability

## Scope
Reduce schedule-preview clutter in multi-track output by removing explicit time-band grouping labels and changing entry time presentation to start-time + compact duration.

## Acceptance Criteria

### AC1 — Multi-track time-band grouping labels removed
- Advanced multi-track schedule output no longer shows explicit range headers for grouped overlap bands (for example `9:10 AM–9:40 AM` section labels).
- Simultaneous entries remain rendered side-by-side using existing projection semantics.

### AC2 — Entry time presentation updated
- Schedule entry cards render:
  - start time in primary emphasis,
  - duration on a second line in lighter text.
- End time is no longer shown as `start–end` range on each entry card.

### AC3 — Applies to single-stream and advanced schedule rows
- Single-stream renderer rows and advanced multi-track rows both use the same start-time + duration pattern.

### AC4 — Regression safety
- Updated renderer tests pass.
- `npm run lint` passes with zero warnings.
- `npm run build` passes.

## Out of Scope
- Schedule projection math changes
- Track model changes
- Schedule editor drag/matrix redesign
