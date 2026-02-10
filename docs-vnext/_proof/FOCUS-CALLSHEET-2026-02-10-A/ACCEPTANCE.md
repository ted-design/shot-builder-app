# Acceptance Spec — Focus Callsheet Trust Core A

Date: 2026-02-10
Owner: Codex
Domain: Call Sheet (Schedule timing + track applicability semantics)

## Scope
This increment is intentionally narrow and execution-safe:
1. Time edits made from schedule cards must follow the same cascade/gapless timing path as drag-based scheduling edits.
2. Shared-to-all banner semantics must be canonical for both `trackId: "shared"` and legacy/quick-banner `trackId: "all"`.
3. No visual redesign or modal IA overhaul in this increment.

## Why
Current behavior allows timing drift when editing via time picker and has split semantics for all-track banners (`"all"` vs `"shared"`), reducing producer trust.

## Acceptance Criteria

### AC1 — Time Edit Uses Canonical Timing Path
Given cascade is ON and a user edits an entry `startTime` from a Day Stream card:
- downstream entries in that same track are updated deterministically (gapless),
- any required previous-entry duration adjustment is applied,
- non-time fields in the same save action (title/color/marker/etc.) are still persisted.

Pass conditions:
- Time-edit save no longer writes only a direct `startTime` update when cascade math is required.
- Writes are emitted as a merged single/batch schedule update plan consistent with gapless helpers.

### AC2 — Shared-To-All Semantics Are Canonical
For applicability classification:
- `trackId: "shared"` and `trackId: "all"` must both resolve to kind `"all"` with all lane track IDs.

Pass conditions:
- canonical helper returns equivalent all-track applicability for both representations.
- behavior is covered by unit tests.

### AC3 — Regression Safety
- Existing gapless/cascade helper tests remain green.
- New tests covering AC2 pass.

## Out of Scope (Explicit)
- Rebuilding custom entry modal IA/UX
- Shot picker visual redesign
- Day details information architecture changes
- Full renderer architecture consolidation (modern/legacy toggle removal)

## Proof Required
1. Unit test output for targeted files.
2. Updated proof log documenting what changed and validation results.
