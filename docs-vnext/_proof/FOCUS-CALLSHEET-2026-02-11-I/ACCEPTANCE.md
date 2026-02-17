# Acceptance Spec — Focus Callsheet Shared-Band Sync (2026-02-11 I)

Date: 2026-02-11
Owner: Codex
Domain: Call Sheet schedule editor timeline cohesion (`src-vnext`)

## Scope
Fix cross-track synchronization drift where the same timeline highlight appeared at different vertical positions per track.

## Acceptance Criteria

### AC1 — Shared highlight rendered once per time position
- Shared timeline highlights render as single full-width bands in the schedule flow (not duplicated per column at different heights).

### AC2 — Track rows synchronize around shared bands
- Local entry rows are segmented around shared bands so both track columns align vertically across the same schedule milestones.

### AC3 — Track actions preserved
- Track headers keep add-shot/add-highlight actions.
- Local entries retain drag/reorder/edit behavior.

### AC4 — Regression safety
- Schedule-focused tests pass.
- `npm run lint` passes.
- `npm run build` passes.

## Out of Scope
- Drag-reordering shared timeline bands in this matrix pass
- Full matrix-level cross-row drag affordances beyond current local-entry behavior
