# Proof — FOCUS-SHOTS-2026-02-03-A

**Domain:** SHOTS  
**Focus ID:** FOCUS-SHOTS-2026-02-03-A  
**Date:** 2026-02-03  

## Governing docs (contract)

- `docs-vnext/design/experience-spec.md`
- `docs-vnext/engineering/build-strategy.md`
- `docs-vnext/engineering/architecture.md`
- `docs/claude-code-tooling.md`
- `docs-vnext/slices/slice-2-shot-editing.md`

## Packages log

### WP1 — Assigned products truth (union + dedupe)

**Spec alignment:** Aligned with `docs-vnext/slices/slice-2-shot-editing.md` (trust: “products assigned” must not contradict editor reality). No schema changes. No new Firestore reads.

**Change summary**
- Introduced a shared derivation for “assigned products” count that unions:
  - `shot.products[]` (legacy/direct)
  - `shot.looks[].products[]` (V3 editor)
  - fallback: `shot.productIds[]` only when no product objects exist
- Wired this count into:
  - Shot Editor V3 context counts (dock + mobile reader chips)
  - Shots “Visual Gallery” cards (product count line)

**Touched surfaces**
- `src/pages/ShotEditorPageV3.jsx`
- `src/pages/ShotsPage.jsx`
- `src/lib/shotAssignedProducts.js`
- `src/lib/__tests__/shotAssignedProducts.test.js`

**Checks (2026-02-03)**
- `npx tsc --noEmit` ✅
- `npm test` ✅

**Manual QA required (Chrome proof pending)**
⚠️ Chrome extension not available in this session for screenshots.

| Scenario | Steps | Expected |
|---|---|---|
| Look-only products show as assigned | Create/choose a shot where products exist only under `looks[].products` (not `shot.products`). Visit shot list + visual gallery + editor. | Counts show non-zero products everywhere. |
| Legacy products still count | Use a shot with only `shot.products`. | Counts match previous behavior. |
| Legacy `productIds` fallback counts | Use a shot with only `productIds` populated. | Counts show assigned products (even without full product objects). |

### WP2 — Canonical shot detail route (spec parity)

**Spec alignment:** Aligned with `docs-vnext/design/experience-spec.md` route map (`/projects/:id/shots/:sid`). No schema changes.

**Change summary**
- Added canonical route: `/projects/:projectId/shots/:shotId` → Shot Editor V3 surface.
- Kept backwards compatibility: `/projects/:projectId/shots/:shotId/editor` now redirects to the canonical route (query string preserved).
- Updated internal navigation callers (shots list, planner, call sheet) to link to the canonical route while preserving `returnTo=*` behavior.

**Touched surfaces**
- `src/App.jsx`
- `src/pages/ShotsPage.jsx`
- `src/pages/PlannerPage.jsx`
- `src/components/callsheet/CallSheetBuilder.jsx`
- `src/components/shots/__tests__/ShotReaderView.status.test.jsx`

**Checks (2026-02-03)**
- `npx tsc --noEmit` ✅
- `npm test` ✅

**Manual QA required (Chrome proof pending)**
⚠️ Chrome extension not available in this session for screenshots.

| Scenario | Steps | Expected |
|---|---|---|
| Canonical route works | Open any shot via UI. | URL is `/projects/:projectId/shots/:shotId` and editor loads. |
| Legacy editor route redirects | Manually open `/projects/:projectId/shots/:shotId/editor?returnTo=planner`. | Redirects to `/projects/:projectId/shots/:shotId?returnTo=planner`. |
| Return context preserved | From planner/callsheet, open shot. | Shot header “return” behavior still works (query preserved). |

### WP3 — Remove legacy inline editor hazards (trust hardening)

**Spec alignment:** Aligned with `docs-vnext/slices/slice-2-shot-editing.md` (notes integrity + no accidental overwrite paths). No schema changes.

**Change summary**
- Removed the dead inline “editingShot” + autosave/editor logic from `src/pages/ShotsPage.jsx`.
- This eliminates an unsafe write path that could overwrite legacy `shot.notes` HTML and tags from the list surface if reactivated by accident.

**Touched surfaces**
- `src/pages/ShotsPage.jsx`

**Checks (2026-02-03)**
- `npx tsc --noEmit` ✅
- `npm test` ✅

**Manual QA required (Chrome proof pending)**
⚠️ Chrome extension not available in this session for screenshots.

| Scenario | Steps | Expected |
|---|---|---|
| Edit flow still works | From shots list (cards/table/visual), click a shot. | Navigates to `/projects/:projectId/shots/:shotId` and editor loads. |
| Create prelude still works | Click create shot prelude and submit. | Creates and navigates to canonical shot route. |

### WP4 — Verification gates (focus sign-off)

**Checks (2026-02-03)**
- `npm run lint` ✅ (0 warnings)
- `npm run build` ✅

## Screenshots index

_Screenshots live in `docs-vnext/_proof/FOCUS-SHOTS-2026-02-03-A/images/`._
