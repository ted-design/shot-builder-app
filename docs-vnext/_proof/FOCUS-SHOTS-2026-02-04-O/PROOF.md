# Proof — FOCUS-SHOTS-2026-02-04-O

**Domain:** SHOTS (Shots List — Attached Entities Visibility)  
**Focus ID:** FOCUS-SHOTS-2026-02-04-O  
**Date:** 2026-02-04  

## Problem

On `/projects/:id/shots`, producers could not see which **products**, **talent**, and **location** were attached to a shot without opening the Shot Detail page (counts-only in Table, readiness-only in Gallery).

Under pressure this creates mistrust and slows scanning, because the list is where producers triage and validate plan completeness.

## What Shipped

### 1) Gallery cards show attached entities (not just readiness)

- Gallery cards now show:
  - Location name (or “Location selected” fallback when the id exists but name isn’t resolvable)
  - Talent names (truncated; falls back to “N selected” when only ids are available)
  - **Primary look** product assignment labels (family + colour + size/scope), rendered **one per line**
- Controlled by Fields → **Details** toggles (applies to both Gallery and Table).
- When Details are visible, the redundant “Products / Talent / Location” readiness row is hidden (no double-reporting).
- If there’s no talent or no location, those lines/icons do not render.

### 2) Table view shows attached entities (not just counts)

- Table columns now render truncated, tooltip-backed lists of:
  - Location
  - Products (one per line)
  - Talent (one per line)
- Product and Talent columns widen to support real text scanning.

### 3) Missing filter correctness (products across looks)

- “Missing: products” now checks merged shot assignments across legacy-supported fields (`shot.products[]` + `shot.looks[].products[]`) so Look-based assignments don’t falsely appear as missing.

## Touched Files

- `src-vnext/features/shots/components/ShotListPage.tsx`
- `src-vnext/features/shots/components/ShotCard.tsx`
- `src-vnext/features/shots/components/DraggableShotList.tsx`
- `src-vnext/features/shots/lib/shotListSummaries.ts` (new)
- `src-vnext/features/shots/components/__tests__/ShotListPage.test.tsx`

## Automated Checks (2026-02-04)

- `npm test` ✅
- `npm run lint` ✅ (0 warnings)
- `npm run build` ✅
- `npx tsc --noEmit` ❌ (pre-existing type errors outside this focus; see `src-vnext/features/assets/components/ProjectAssetsPage.tsx` and `src-vnext/features/shots/lib/tagManagementWrites.ts`)

## Manual QA Required

⚠️ Chrome extension unavailable for visual verification in this session.

| Scenario | Steps | Expected |
|---|---|---|
| Gallery shows products/talent/location | `/projects/:id/shots` (Gallery) with shots that have assignments | Card shows attached entities under readiness (truncated) |
| Table shows products/talent/location | Switch to Table view | Location/products/talent cells show readable lists (not counts) |
| Details toggles | Fields → Details → toggle Location/Products/Talent | Entities appear/disappear in both Gallery + Table |
| Missing products respects looks | Assign products inside Look options only (no root `shot.products[]`) → Filters → Missing: products | Shot is **not** considered missing products |

**User Action:** Run `npm run dev` and verify scenarios above.
