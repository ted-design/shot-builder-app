# Proof — FOCUS-SHOTS-2026-02-04-B

**Domain:** SHOTS (Shots List)  
**Focus ID:** FOCUS-SHOTS-2026-02-04-B  
**Date:** 2026-02-04  

## Goal (110% definition)

Ship a producer-grade Shots list surface that is calm, trustworthy, and fast under pressure:
- Switchable **Gallery** and **Table** views (desktop)
- Strong in-context **search**, **filtering**, and **sorting** (URL-persisted)
- User-controlled **field visibility** for dense vs minimal scanning (persisted)

## What shipped

### 1) View toggle (Gallery ↔ Table)
- Desktop-only view switcher (Gallery/Table).
- Table view supports selection/bulk pull creation and status changes.
- Reordering remains in Gallery; Table shows an explicit banner when custom order is active.

### 2) Improved filters + sorting
- Search (`q`) filters by title, shot number, and description (debounced URL update).
- Status filter supports multi-select (`status=todo,in_progress,...`).
- “Missing” trust filters (`missing=products,talent,location,image`) to find gaps quickly.
- Sort now supports `updated` and includes `dir=asc|desc` (created/updated default to `desc`).

### 3) Field visibility toggles
- “Fields” menu controls optional metadata visibility for cards + table.
- Persisted per-client + per-project in localStorage.

## Contracts (Persistence)

### URL query params (shareable)
- `view=table|gallery` (desktop; gallery is the implicit default)
- `q=<search>` (debounced)
- `status=<csv>` (multi-select)
- `missing=<csv>` (multi-select)
- `sort=custom|name|date|status|created|updated`
- `dir=asc|desc` (ignored when `sort=custom`)

### localStorage (non-shareable)
- `sb:shots:list:<clientId>:<projectId>:fields:v1` — field visibility config
- `sb:shots:list:<clientId>:<projectId>:view:v1` — default view when `view` param absent

## Touched Files

- `src-vnext/features/shots/components/ShotListPage.tsx`
- `src-vnext/features/shots/components/ShotCard.tsx`
- `src-vnext/features/shots/components/DraggableShotList.tsx`
- `src-vnext/features/shots/components/__tests__/ShotListPage.test.tsx`

## Automated Checks (2026-02-04)

- `npm run test` ✅
- `npm run lint` ✅ (0 warnings)
- `npm run build` ✅

## Manual QA Required

⚠️ **Chrome extension unavailable** for visual verification in this session.

| Scenario | Steps | Expected |
|---|---|---|
| Toggle views | Open `/projects/:id/shots`, click Gallery/Table buttons | View switches without losing selection state |
| Search | Type into search box | URL `q` updates after brief pause; list filters |
| Multi status filter | Filters → toggle multiple statuses | Shots reflect union of selected statuses; chips removable |
| Missing filters | Filters → toggle “Missing: products/talent/location/image” | Only shots missing all selected criteria are shown |
| Field toggles | Fields → toggle items | Cards/table update immediately and persist on refresh |
| Custom order clarity | Set `sort=custom`, switch to Table | Banner explains reorder is in Gallery; order remains stable |

**User Action:** Run `npm run dev` and verify scenarios above.

## Screenshots Index

_Screenshots live in `docs-vnext/_proof/FOCUS-SHOTS-2026-02-04-B/images/`._

