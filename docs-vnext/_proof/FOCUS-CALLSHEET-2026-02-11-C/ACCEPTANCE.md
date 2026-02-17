# Acceptance Spec — Focus Callsheet Trust Core (2026-02-11 C)

Date: 2026-02-11
Owner: Codex
Domain: Call Sheet (`src-vnext`) output accent color semantics

## Scope
Make output `accent` color configuration visibly meaningful in the canonical call sheet renderer.

## Acceptance Criteria

### AC1 — Accent token is wired into renderer
- `CallSheetRenderer` reads `config.colors.accent` and exposes it as a document-level CSS variable.

### AC2 — Accent has visible semantic usage
- Accent is used in renderer metadata labels and emphasis markers (not only stored in config).
- Applies to schedule metadata labels and call override emphasis.
- Works in both standard schedule rows and advanced schedule projection rows.

### AC3 — Regression safety
- Existing output rendering remains intact.
- Targeted tests pass.
- Lint/build pass.

## Out of Scope
- Full visual redesign of call sheet templates
- Additional color controls beyond existing `primary` / `accent` / `text`
