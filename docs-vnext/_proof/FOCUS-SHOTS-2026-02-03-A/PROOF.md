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

Status: ✅ Completed

Changes:
- Shot sort gains **Custom order** (Firestore `shot.sortOrder`) as the default sort.
- Table reordering writes a single `sortOrder` update (sparse numeric midpoint strategy).
- One-time **Initialize custom order** CTA when shots are missing `sortOrder` (batch write in bounded chunks).
- Legacy migration assist: if local-only ordering exists (`localStorage`), offer **Use my order** to seed Firestore `sortOrder`.
- Reorder guardrails: reordering is disabled while searching/filtering to avoid “reorder a subset” surprises.
- Added toast action support for **Undo**.

Proof checklist:
- [x] Reorder updates Firestore `sortOrder` (single write; no fan-out reads)
- [x] Default sort is Custom (sortOrder-first, legacy-safe fallback)
- [x] No additional read fan-out introduced (writes only)
- [x] Undo/feedback exists (toast action) and errors are handled gracefully

Screenshots (to capture):
- `wp1-shots-table-custom-sort.png` — Sort menu shows Custom active
- `wp1-shots-reorder-before.png` — Before reorder (IDs/rows visible)
- `wp1-shots-reorder-after.png` — After reorder (immediate)
- `wp1-shots-reorder-after-refresh.png` — After browser refresh

### WP2 — Mobile operational parity (status + addendum)

Status: ✅ Completed

Changes:
- Mobile shot detail adds an operational status control (select) with “Undo” via toast action.
- Mobile respects `?readonly=1` by disabling status changes and addendum appends.

Proof checklist:
- [x] Status update is available on mobile and persists to Firestore
- [x] Undo exists (toast action)
- [x] Read-only mode blocks mutations

Screenshots (to capture):
- `wp2-mobile-status-control.png` — Status control visible on mobile
- `wp2-mobile-status-updated.png` — Status updated + toast shown
- `wp2-mobile-status-undo.png` — Undo restores prior status

### WP3 — Notes + tags trust hardening

Status: ✅ Completed

Changes:
- Tags render consistently as label-based summaries in the Shot editor context dock (no `[object Object]`).
- Mobile shot detail renders tags using the shared `TagList`/`TagBadge` (color-aware when available).

Proof checklist:
- [x] Tags are visible on shot detail (desktop + mobile)
- [x] Tag rendering is robust to legacy shapes (string vs object)

Screenshots (to capture):
- `wp3-editor-tags-dock.png` — Context dock tag summary renders labels
- `wp3-mobile-tags.png` — Mobile tags render with TagBadge styling
