# Acceptance Spec — Focus Callsheet Trust Core H

Date: 2026-02-10
Owner: Codex
Domain: Call Sheet (`src-vnext`) day-details location module

## Scope
Ship a producer-safe location details module on the call sheet editor that supports:
1. Modular location blocks on day details.
2. Assigning clear operational labels (Basecamp/Hospital/Parking/Production Office/custom).
3. Linking blocks to existing location library records or creating a new location inline.

## Acceptance Criteria

### AC1 — Modular location blocks in Day Details
- Producer can add and remove location blocks in the Day Details editor.
- Each block persists to `dayDetails.locations`.

### AC2 — Label semantics are explicit
- Each location block supports label presets:
  - `Basecamp`
  - `Hospital`
  - `Parking`
  - `Production Office`
  - `Custom`
- Custom labels are editable text and persist as block title.

### AC3 — Existing/new location linking works
- A block can link to an existing org/project location record.
- A producer can create a new location inline and link it to the active block.
- Newly created locations are assigned to the active project on write.

### AC4 — Legacy compatibility and regression safety
- Legacy day-details location fields map into modern `locations[]` on read.
- Targeted tests pass for mapping behavior.
- Lint/build pass.

## Out of Scope
- Full location profile editing (phone, contacts, images)
- Day details visual redesign outside location module
- Custom entry modal redesign (separate increment)
