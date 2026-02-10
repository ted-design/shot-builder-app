# Acceptance Spec — Focus Callsheet Trust Core B

Date: 2026-02-10
Owner: Codex
Domain: Call Sheet (time-entry consistency across talent/crew/client)

## Scope
This increment is intentionally narrow and execution-safe:
1. Use one canonical time-entry interpretation path for talent, crew, and client call rows.
2. Normalize accepted times to canonical 24h `HH:MM` for storage while keeping text overrides for `call` fields.
3. Reject invalid time-like input explicitly (no silent coercion, no invalid `HH:MM` persistence).

## Why
Current behavior is inconsistent:
- Crew accepts typed `AM/PM` parsing paths while talent/client rely on ad hoc regex + browser `type="time"` behavior.
- Some time-like invalid values can be persisted as `callTime`.
- Department crew precall bulk entry does not match per-row parsing semantics.

This drift reduces producer trust and makes time entry unpredictable under pressure.

## Acceptance Criteria

### AC1 — Canonical Time Parser/Classifier for Callsheet People Fields
Given any callsheet people time input (talent/client/crew),
- valid time input must resolve through one shared parser/classifier,
- accepted times persist as canonical `HH:MM`,
- invalid time-like input is rejected explicitly.

Pass conditions:
- a shared helper exists and is used by all three surfaces,
- invalid range values (e.g. `24:99`) are never written as `callTime`.

### AC2 — `call` Fields Preserve Time-or-Text Semantics Consistently
For talent/client/crew call fields:
- valid time input stores `callTime` and clears `callText`,
- non-time text (e.g. `OFF`, `O/C`) stores `callText` and clears `callTime`,
- malformed time-like input does not silently become text or invalid time.

Pass conditions:
- behavior is consistent across all three components,
- invalid entry reverts to last persisted value in the editor draft.

### AC3 — Time-Only Fields Use the Same Validity Rules
For time-only fields in this scope (`setTime` / `wrapTime` / department precall time entry):
- valid times persist as canonical `HH:MM`,
- invalid or non-time input is rejected (not converted to text for time-only fields).

Pass conditions:
- talent/client `set` and talent `wrap` parsing uses the shared helper,
- crew department bulk precall uses the same parser logic as per-row crew call input.

### AC4 — Regression Safety
- Existing crew time helper tests remain green.
- New targeted tests cover canonical classification and invalid-time rejection logic.

## Out of Scope (Explicit)
- Visual redesign of roster cards/modals
- Replacing table cell inputs with full popover TimePicker widgets
- Schedule timing cascade/reordering logic changes
- Call sheet preview layout/renderer changes

## Proof Required
1. Unit test output for targeted time helper/test files.
2. Lint/build gate results.
3. Updated proof log documenting implemented behavior and validation.
