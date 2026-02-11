# Acceptance Spec — Focus Callsheet Highlight Editability (2026-02-11 F)

Date: 2026-02-11
Owner: Codex
Domain: Call Sheet schedule entry editing (`src-vnext`)

## Scope
Allow existing highlight/banner entries to update style metadata after creation.

## Acceptance Criteria

### AC1 — Highlight style is editable from entry sheet
- For highlight-compatible entries, the edit sheet exposes:
  - emoji input + emoji presets
  - style variant (`solid` / `outline`)
  - color picker + preset swatches

### AC2 — Updates persist to entry highlight metadata
- Style changes write to `entry.highlight` on the schedule entry document.
- Card and preview rendering reflects updated emoji/color/variant.

### AC3 — Guardrails by entry type
- Shot entries do not show highlight style controls.

### AC4 — Regression safety
- Targeted tests cover highlight-style editing and shot-entry guardrails.
- `npm run lint` passes.
- `npm run build` passes.
