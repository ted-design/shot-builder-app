# Acceptance Spec — Focus Callsheet Trust Core D

Date: 2026-02-10
Owner: Codex
Domain: Call Sheet (`src-vnext`) time-entry UX

## Scope
Implement one reusable typed time-entry control and replace free-text time entry where it is currently active in the call sheet workflow:
1. Day details time fields.
2. Talent/Crew override time fields.
3. Schedule entry time field.
4. Schedule day-start field.

## Acceptance Criteria

### AC1 — Shared control exists
- A reusable control supports:
  - hour input (1-12, step 1),
  - minute input (0-55, step 5),
  - AM/PM selector,
  - clear/cancel/save actions.
- It is used by all in-scope fields above.

### AC2 — Text override mode remains available where needed
- Talent/Crew override fields support both:
  - typed time mode,
  - text override mode (e.g. `OFF`, `O/C`).
- Day details and schedule timing fields remain time-only.

### AC3 — Existing validation contracts remain intact
- Invalid values are rejected with explicit feedback.
- Valid values persist through existing canonicalization path (`HH:MM` storage).

### AC4 — Regression safety
- Existing targeted schedule/time tests pass.
- Lint/build gates pass.

## Out of Scope
- New client override section (not currently present in `src-vnext` call sheet surface)
- Schedule timing cascade/reorder behavior changes
- Visual redesign beyond the time control itself
