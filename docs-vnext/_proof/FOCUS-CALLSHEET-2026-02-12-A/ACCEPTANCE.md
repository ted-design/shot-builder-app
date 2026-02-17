# Acceptance Spec — Focus Callsheet Output Signal Cleanup (2026-02-12 A)

Date: 2026-02-12
Owner: Codex
Domain: Call Sheet output renderer (`src-vnext`) preview/export scan clarity

## Scope
Improve schedule output scanability by removing redundant track metadata labels in advanced rendering while restoring shot-tag visibility in the canonical call sheet renderer.

## Acceptance Criteria

### AC1 — Redundant advanced-track labels are removed from output
- Advanced schedule output no longer prints:
  - per-row track badges (`Primary`, `Track 2`, etc.),
  - shared applicability text (`Applies to: ...`),
  - overlap label (`Simultaneous`),
  - per-column track-name headers.

### AC2 — Simultaneous/shared semantics remain visually obvious
- Simultaneous entries still render side-by-side in overlap bands.
- Shared/full-width entries still render as full-width rows in the schedule flow.

### AC3 — Shot tags render in call sheet schedule rows
- Canonical renderer shows shot tags when present on shot docs.
- Tag visuals use the shared tag badge system for consistent color normalization.
- Applies to both single-stream and advanced multi-stream schedule rendering paths.

### AC4 — Tag field visibility is configurable in output controls
- `ScheduleBlockFields` includes `showTags` in vNext renderer config.
- Output controls expose a `Tags` toggle.
- Config read/write normalization includes `scheduleBlockFields.showTags`.

### AC5 — Regression safety
- Targeted call-sheet renderer/output tests pass.
- `npm run lint` passes with zero warnings.
- `npm run build` passes.

## Out of Scope
- Schedule editor track controls/layout
- Track data model or projection math
- New call sheet section types
