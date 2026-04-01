# HANDOFF — Sprint S16 (2026-04-01)

## State
S16 complete (all 7 phases). Branch: vnext/s15-ux-overhaul, 35+ commits ahead of main. PR #376 open (includes S15 + S16).

## What Was Built
- **S16a:** Bug fixes (gender labels, HTML notes, checkbox layout, text overflow)
- **S16b:** Shared components (ViewModeToggle, SearchBar, usePersistedViewMode)
- **S16c:** Interactive table system (5/5 tables with resize, visibility, reorder, keyboard nav)
- **S16d:** 8 MEDIUM review issues resolved
- **S16e:** Shoot readiness: per-colorway selection, gender badges, requirement status, sort
- **S16f:** Call sheet: typography tokens, section bands, spacing tokens, crew call prominence
- **S16g:** Talent detail: headshot lightbox, spacing, overflow, tab bar

## Design System
- `docs/DESIGN_SYSTEM.md` — permanent enforcement document, referenced from CLAUDE.md Hard Rule #3
- Must be read before any UI work. Covers shared components, tokens, table patterns, spacing.

## What's Next
1. Merge PR #376 to main
2. S17: Canvas editor (Fabric.js vs Konva.js evaluation)
3. S16 backlog: ShotsTable column reorder, CallSheetCastTable resize persistence

## To resume
Read `docs/SESSION_RESUME.md` then `docs/DESIGN_SYSTEM.md`
