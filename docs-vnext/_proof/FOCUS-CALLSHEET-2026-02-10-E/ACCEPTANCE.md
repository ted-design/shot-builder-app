# Acceptance Spec — Focus Callsheet Trust Core E

Date: 2026-02-10
Owner: Codex
Domain: Call Sheet (`src-vnext`) schedule auto-duration

## Scope
Implement auto-duration inference for schedule entries so missing durations are filled from adjacent start times within the same track.

## Acceptance Criteria

### AC1 — Missing duration auto-fills from adjacent explicit starts
- Given two adjacent entries in the same track with valid start times,
- When the first entry has missing/invalid duration,
- Then duration is auto-populated as `nextStart - currentStart` (minutes).

### AC2 — Explicit duration is never overwritten
- Entries that already have a valid duration (`> 0`) are unchanged.

### AC3 — Track isolation and shared safety
- Auto-fill runs independently per track.
- Banner/shared entries are excluded.

### AC4 — Regression safety
- Targeted schedule tests pass.
- Lint/build pass.

## Out of Scope
- Redesign of duration UI control
- New overlap prevention rules beyond current cascade model
