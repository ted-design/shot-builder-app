# Acceptance Spec — Focus Callsheet AB Layout Step (2026-02-11 G)

Date: 2026-02-11
Owner: Codex
Domain: Call Sheet schedule editor layout (`src-vnext`)

## Scope
Execute the next AB-layout increment by removing the dedicated shared column and integrating highlights into the main schedule flow.

## Acceptance Criteria

### AC1 — No dedicated third shared column
- Multi-track board no longer renders a third column for shared entries.

### AC2 — Highlights stay in editor flow
- Highlights render in a full-width lane within the same schedule flow (above track columns), with add/edit/remove/reorder support.
- Highlights remain backed by shared-entry semantics (`trackId: "shared"` / banner behavior).

### AC3 — Track columns remain focused and stable
- Track columns continue to support existing shot/highlight card edits and drag behavior.

### AC4 — Regression safety
- Existing schedule-card and highlight-entry tests pass.
- `npm run lint` passes.
- `npm run build` passes.

## Out of Scope
- Full time-band matrix renderer for the editor
- In-track shared ghost markers per band
- Shot-level global quick-edit panel inside entry drawer
