# Proof — FOCUS-SHOTS-2026-02-03-A

Date: 2026-02-03

## Scope

Domain: SHOTS

In-scope (Slice 2 parity):
- Shot list: default ordering, dense table scan, navigation to editor
- Shot detail editor (desktop): notes trust surface, hero/reference image, assignments
- Shot detail (mobile): read + operational (status + addendum)

Non-goals:
- Products domain work (CRUD flows, V3 workspace changes)
- Pulls domain work (beyond ensuring compatibility)
- Call sheet domain work
- Rich-text authoring for legacy `shot.notes` (TipTap)

## Verification constraints

- No background servers run by the agent.
- If Claude-in-Chrome capture is unavailable, screenshots must be captured manually and saved under `docs-vnext/_proof/FOCUS-SHOTS-2026-02-03-A/images/`.

### Manual QA Required (if no Chrome capture)

| Scenario | Steps | Expected |
|---|---|---|
| Shot list loads | Go to `/projects/:projectId/shots` | Shots render; empty state is calm; no console errors |
| Custom ordering persists | In table view, set sort to Custom, reorder 2 shots, refresh | Order remains the same after refresh |
| Custom order is shared | Open same project in a second browser/profile | Order matches (based on `sortOrder`) |
| Non-custom sort override | Switch sort to Date/Status and back to Custom | UI indicates override; switching back restores custom order |
| Mobile operational | On narrow viewport, open a shot editor URL | Status change works; addendum appends; HTML notes remain read-only |

## Packages

### WP0 — Proof scaffold

Status: ✅ Completed

Changes:
- Created proof folder and templates

Artifacts:
- `docs-vnext/_proof/FOCUS-SHOTS-2026-02-03-A/PROOF.md`
- `docs-vnext/_proof/FOCUS-SHOTS-2026-02-03-A/NOTES.md`

Routes visited:
- N/A (doc-only)

Screenshots:
- Pending (see manual QA table above)

### WP1 — Canonical shot ordering (Firestore `sortOrder`)

Status: ⏳ Pending

Proof checklist:
- [ ] Reorder updates Firestore `sortOrder` (single write or bounded batch)
- [ ] Default sort is Custom (sortOrder-first, legacy-safe fallback)
- [ ] No additional read fan-out introduced
- [ ] Undo/feedback exists (toast) and errors are handled gracefully

Screenshots (to capture):
- `wp1-shots-table-custom-sort.png` — Sort menu shows Custom active
- `wp1-shots-reorder-before.png` — Before reorder (IDs/rows visible)
- `wp1-shots-reorder-after.png` — After reorder (immediate)
- `wp1-shots-reorder-after-refresh.png` — After browser refresh

### WP2 — Mobile operational parity (status + addendum)

Status: ⏳ Pending

### WP3 — Notes + tags trust hardening

Status: ⏳ Pending

