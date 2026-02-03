# Proof Log — SPRINT-2026-02-03-B

Date: 2026-02-03
Branch: `vnext/slice-3-call-sheet-assembly`

## Scope (Work Packages)

1. WP1 — Fix schedule trust data
2. WP2 — Upgrade CallSheetRenderer parity
3. WP3 — Preview mode + RBAC gating
4. WP4 — Persisted config + toggles UI
5. WP5 — Print/export with readiness gate

## Routes Verified (manual)

- `/projects`
- `/projects/:id/shots`
- `/projects/:id/schedules`
- `/projects/:id/callsheet?scheduleId=:sid`
- `/projects/:id/callsheet?scheduleId=:sid&preview=1`

## Screenshots (Claude-in-Chrome required)

Saved under: `docs-vnext/_proof/SPRINT-2026-02-03-B/images/`

- (pending) `01-wp2-callsheet-preview-desktop.png` — Canonical renderer shows schedule + day details + talent/crew sections.
- (pending) `02-wp3-preview-mode-mobile.png` — `?preview=1` renders read-only on mobile (no redirect).
- (pending) `03-wp5-export-print-portal.png` — Print/export view renders cleanly (no sidebar/chrome).

## Key UI States Verified (manual)

- [ ] Call sheet builder loads with schedule selected
- [ ] Trust warnings appear when data missing (talent calls)
- [ ] Preview mode renders read-only, no mutations
- [ ] Export blocks until ready (or errors with timeout)

## Engineering Checks

- [x] `npx tsc --noEmit` (WP1)
- [x] `npm test` (WP1)
- [x] `npx tsc --noEmit` (WP2)
- [x] `npm test` (WP2)

## Progress Log

- WP1 complete: derive `participatingTalentIds` locally from `entries + shots` (no extra Firestore fan-out), and ensure new schedule entries get a monotonic `order` (prevents duplicate orders after deletes).
- WP2 complete: `CallSheetRenderer` now joins `ScheduleEntry.shotId` → `Shot` for shot number/title/description, and surfaces talent + location inline per entry; adds a real Notes section (from day details).
