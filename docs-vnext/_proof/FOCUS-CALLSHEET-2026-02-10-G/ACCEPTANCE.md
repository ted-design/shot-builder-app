# Acceptance Spec — Focus Callsheet Trust Core G

Date: 2026-02-10
Owner: Codex
Domain: Call Sheet (`src-vnext`) shared-banner semantics

## Scope
Make banner entries truly shared in persisted semantics and remove misleading primary-track assignment behavior.

## Acceptance Criteria

### AC1 — Canonical shared marker on write
- New banner entries persist with `trackId: "shared"`.
- Banner applicability persists as all current schedule tracks (`appliesToTrackIds`).

### AC2 — Legacy compatibility retained
- Legacy `trackId: "all"` entries normalize to shared semantics.
- Shared/banners continue to render in Shared lanes/sections.

### AC3 — No misleading track accounting
- Track entry counts and track-scoped scheduling logic exclude shared banners.

### AC4 — Regression safety
- Targeted schedule tests pass.
- Lint/build pass.

## Out of Scope
- Banner visual redesign
- Non-banner shared semantics expansion
- Historical data backfill/migration scripts
