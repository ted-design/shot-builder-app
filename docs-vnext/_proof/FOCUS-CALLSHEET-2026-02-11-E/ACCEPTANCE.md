# Acceptance Spec — Focus Callsheet P0/P1 IA + Edit Affordance (2026-02-11 E)

Date: 2026-02-11
Owner: Codex
Domain: Call Sheet schedule editor (`src-vnext`)

## Scope
Complete P0 + P1 for schedule-card usability:
- P0: explicit edit affordance and entry edit surface
- P1: denser, readable card information architecture with non-interactive track metadata

## Acceptance Criteria

### AC1 — Explicit edit action is visible on cards
- Every schedule entry card exposes a visible `Edit entry` action (not hover-only).
- Edit action opens a dedicated editor surface for the selected entry.

### AC2 — Entry edit surface is operational
- Entry edit side sheet supports immediate updates for title, time, duration, and notes.
- Non-shared entries can move tracks from the side sheet.
- Shared/banner entries do not expose misleading track reassignment controls.

### AC3 — Card IA removes always-visible track dropdown
- Schedule cards no longer render track-assignment dropdowns inline.
- Cards show track as a passive badge only when relevant.

### AC4 — Regression safety
- Updated tests cover edit affordance and passive-track rendering behavior.
- `npm run lint` passes.
- `npm run build` passes.

## Out of Scope
- AB schedule-layout redesign (time-banded stream)
- Shared-column structural redesign
- Shot editing model changes beyond schedule entry surface
