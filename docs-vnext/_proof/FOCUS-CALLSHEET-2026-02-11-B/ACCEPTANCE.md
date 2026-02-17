# Acceptance Spec — Focus Callsheet Trust Core (2026-02-11 B)

Date: 2026-02-11
Owner: Codex
Domain: Call Sheet (`src-vnext`) output color controls

## Scope
Add a producer-safe reset affordance for call sheet output colors so styling can be recovered instantly after experimentation.

## Acceptance Criteria

### AC1 — Reset defaults action exists
- Output controls show a `Reset Defaults` action in the `Colors` section.
- Clicking it applies the canonical default color set for:
  - `primary`
  - `accent`
  - `text`

### AC2 — Reset behavior is explicit and stable
- Reset writes all three color fields in one patch.
- Reset action is disabled when current colors already match defaults.

### AC3 — Regression safety
- Existing color pickers still patch individual fields as before.
- Targeted tests pass.
- Lint/build pass.

## Out of Scope
- Color palette redesign
- Additional color tokens beyond `primary`/`accent`/`text`
