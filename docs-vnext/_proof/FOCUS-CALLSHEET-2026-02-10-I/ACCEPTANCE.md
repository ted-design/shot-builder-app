# Acceptance Spec — Focus Callsheet Trust Core I

Date: 2026-02-10
Owner: Codex
Domain: Call Sheet (`src-vnext`) custom entry modal redesign

## Scope
Replace type-driven custom entry creation (`Setup/Break/Move/Banner`) with a single flexible highlight-block model:
1. Title + description + optional emoji.
2. Style controls (solid/outline + color).
3. Shared semantics preserved when added from Shared lane.

## Acceptance Criteria

### AC1 — Single highlight composer replaces type selector
- Add Custom Entry modal no longer asks for setup/break/move/banner type.
- Modal captures:
  - title,
  - description,
  - optional emoji,
  - style variant (`solid` or `outline`),
  - color.

### AC2 — Persistence contract is explicit
- New custom entries persist highlight style metadata (`variant`, `color`, `emoji`).
- Description persists in the entry note/description field.
- Shared-lane adds persist as shared banner semantics (`trackId: "shared"`, all-track applicability).

### AC3 — Rendering reflects new style semantics
- Schedule cards display emoji + highlight styling.
- Preview renderer and advanced schedule projection renderer display emoji + style treatment for highlight entries.

### AC4 — Backward compatibility + regression safety
- Existing legacy entries (`setup`, `break`, `move`, `banner`) remain readable and editable.
- Targeted tests pass.
- Lint/build pass.

## Out of Scope
- Full custom-entry inline edit panel (beyond existing card editing)
- Migration script for historical custom entry type normalization
- New timeline behavior changes for rhythm entry logic
