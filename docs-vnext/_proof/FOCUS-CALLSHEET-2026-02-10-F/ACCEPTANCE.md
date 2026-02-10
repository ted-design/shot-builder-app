# Acceptance Spec — Focus Callsheet Trust Core F

Date: 2026-02-10
Owner: Codex
Domain: Call Sheet (`src-vnext`) overlap/conflict safety

## Scope
Prevent new same-track schedule overlaps at write time and surface any existing overlaps as explicit trust warnings.

## Acceptance Criteria

### AC1 — New same-track overlaps are blocked
- For start-time edits, duration edits, and cross-track moves:
  - if the proposed write introduces a new overlap in any affected track,
  - the write is not committed,
  - a clear conflict toast is shown.

### AC2 — Simultaneous work across different tracks remains valid
- Overlap checks are track-local.
- Entries in different tracks may share the same time range.

### AC3 — Existing overlap state is explicit
- Trust checks include a warning when overlapping entries already exist in a track.
- Warning includes enough context to identify affected track/entries.

### AC4 — Regression safety
- Targeted schedule tests pass.
- Lint/build pass.

## Out of Scope
- Full visual redesign of conflict UI in cards
- Auto-healing legacy overlaps
- Changes to cross-track simultaneous band rendering
