# Acceptance Spec — Focus Callsheet Trust Core C

Date: 2026-02-10
Owner: Codex
Domain: Call Sheet (`src-vnext` builder surface)

## Scope
This increment targets the active production path shown in QA screenshots:
1. Time-entry consistency for `Talent Overrides`, `Crew Overrides`, and day-detail anchor times.
2. Canonical persistence (`HH:MM`) for valid times.
3. Explicit rejection of malformed time-like values (ex: `24:00`) on save.
4. Read-time sanitization so previously bad values do not continue rendering in editor/preview.

## Acceptance Criteria

### AC1 — One classifier for override time entry
- Talent/Crew override save path uses one shared time classifier.
- Valid time input stores canonical `HH:MM`.
- Text override input (ex: `OFF`, `O/C`) stores `callText` and clears `callTime`.
- Malformed time-like input shows explicit error and does not persist.

### AC2 — Day details use the same time rules
- Crew Call, Shooting Call, Breakfast, 1st Meal, 2nd Meal, Est. Wrap accept valid time and persist `HH:MM`.
- Malformed time-like input is rejected with explicit error and not persisted.

### AC3 — Render consistency
- Renderer formats valid `HH:MM` to 12h display.
- Override renderer prefers `callTime`, then `callText`, then default call.
- Malformed stored values no longer display after mapping.

### AC4 — Regression safety
- Targeted schedule/lib tests pass with added coverage for classifier and map sanitization.
- Lint and build gates pass.

## Out of Scope
- New client override section (not present in current `src-vnext` call sheet surface)
- Modal/layout redesign
- Schedule cascade/reorder logic changes
