# Acceptance Spec — Focus Callsheet Trust Core (2026-02-11 A)

Date: 2026-02-11
Owner: Codex
Domain: Call Sheet (`src-vnext`) add-shot modal usability

## Scope
Improve the call sheet add-shot modal so producers can identify the right shot quickly under pressure.

## Acceptance Criteria

### AC1 — Rich shot context in modal list
- Each shot row displays meaningful context beyond title:
  - shot number (if present),
  - description preview (if present),
  - talent summary (if available),
  - location label (if available),
  - tag chips (if available).

### AC2 — Smarter search matching
- Search matches across:
  - title,
  - shot number,
  - description,
  - talent names,
  - tag labels,
  - location name.

### AC3 — Talent-aware context wiring
- The add-shot modal can consume talent lookup data from the call sheet builder so talent IDs resolve to names.

### AC4 — Regression safety
- Existing add-shot behavior remains intact (unscheduled-only list, track assignment on add).
- Targeted tests pass.
- Lint/build pass.

### AC5 — Tag color consistency
- Tag chips shown in add-shot modal follow the same site-wide tag color system.
- Legacy/non-palette tag colors render with deterministic palette badges (not ad-hoc inline color styles).

## Out of Scope
- Thumbnail/image gallery inside add-shot modal
- Multi-select bulk add in one action
- Advanced filter panel (status/date/tag toggles)
