# Proof — FOCUS-SHOTS-2026-02-05-A

**Domain:** SHOTS (Shots List)  
**Focus ID:** FOCUS-SHOTS-2026-02-05-A  
**Date:** 2026-02-05  

## Goal (110% definition)

Bring the vNext shot list (`/projects/:id/shots`) from “flat + basic” to producer-grade:
- A **scanable**, image-forward surface (Gallery + Visual view)
- Calm but powerful **filters/sort/grouping** (URL-persisted, shareable)
- Trustworthy **ordering semantics** (no silent `sortOrder` corruption)
- At-a-glance **readiness** + **insights** for planning under pressure

## What Shipped

### 1) Views: Gallery + Visual + Table
- Added **Visual** view (`view=visual`) for image-first scanning.
- Gallery remains the default card view; Table remains the dense grid view.
- Explicit banners explain when **reordering** is not available (Table/Visual).

### 2) Trust Fix: Reorder Is View-Safe
- Reordering is disabled while **search/filters** are active (and while **grouping** is active).
- UI shows an explicit banner with one-click actions to clear blockers.

Why: the reorder persistence path assumes it receives the full ordered list; reordering a filtered subset can corrupt global `sortOrder`.

### 3) Group By (Desktop)
- Added `group=` with: `status`, `date`, `talent`, `location`.
- Grouped rendering works for Gallery + Visual views.
- Table view remains ungrouped with an explicit banner prompting users to switch to card views for grouping.

### 4) Filters (Upgraded)
- Filters moved into a **Sheet** (mobile bottom sheet, desktop right sheet).
- Added single-select filters:
  - `talent=<talentId>`
  - `location=<locationId>`
  - `tag=<tagId>`
- Status + Missing filters remain multi-select (`status=csv`, `missing=csv`).

### 5) Display (Fields) UX Cleanup
- Fields moved into a **Display Sheet** with view-specific options:
  - Visual view: shot number, tags (hero image is always shown)
  - Gallery: card + details toggles + presets
  - Table: column toggles
- Added quick presets: **Storyboard** and **Prep**.

### 6) Readiness + Insights
- Readiness indicators are now always available when enabled, with compact icon-only mode when details are shown.
- Added an **Insights strip** showing totals + per-status + missing counts; clicking pills applies/removes filters.

### 7) Thumbnails: No Grey Letterboxing
- Gallery + Visual hero thumbnails now render with `object-cover` so images fill their containers (no visible grey background bars).

### 8) Share Links: Creation + Public View
- Shot share link creation now goes through a callable Cloud Function (`createShotShareLink`) instead of a direct Firestore write (more reliable; bypasses client rules edge cases).
- vNext callable Functions are now explicitly configured for `northamerica-northeast1` (fixes public share link resolution + public pull updates).
- Share failures now surface the underlying error code/message (instead of a generic toast).

## Contracts (Persistence)

### URL query params (shareable)
- `view=table|visual|gallery` (desktop; `gallery` is implicit default)
- `group=status|date|talent|location` (desktop; omitted means none)
- `q=<search>` (debounced)
- `status=<csv>` (multi-select)
- `missing=<csv>` (multi-select; AND semantics)
- `talent=<talentId>` (single-select)
- `location=<locationId>` (single-select)
- `tag=<tagId>` (single-select)
- `sort=custom|name|date|status|created|updated`
- `dir=asc|desc` (ignored when `sort=custom`)

### localStorage (non-shareable)
- `sb:shots:list:<clientId>:<projectId>:fields:v1` — display field visibility config
- `sb:shots:list:<clientId>:<projectId>:view:v1` — default view when `view` param absent

## Touched Files

- `src-vnext/features/shots/components/ShotListPage.tsx`
- `src-vnext/features/shots/components/ShotCard.tsx`
- `src-vnext/features/shots/components/ShotVisualCard.tsx`
- `src-vnext/features/shots/components/__tests__/ShotListPage.test.tsx`

## Automated Checks (2026-02-05)

- `npm run lint` ✅ (0 warnings)
- `npx tsc --noEmit` ✅
- `npm test` ✅
- `npm run build` ✅

## Manual QA Required

⚠️ **Chrome extension unavailable** for visual verification in this session.

| Scenario | Steps | Expected |
|---|---|---|
| View modes | Open `/projects/:id/shots`, switch Gallery/Visual/Table | Each view renders correctly; no layout thrash |
| Thumbnails | In Gallery and Visual views, inspect hero thumbs | Thumbnails fill their frames (no visible grey letterbox bars) |
| Share link | Click `Share` → `Create link` → open link in an incognito window | Link is created; public page loads and shows the shot list |
| Group by | Set `group=date` and `group=status` | Section headers appear with correct counts; Table shows guidance banner |
| Filters sheet | Click `Filters` | Sheet opens (bottom on mobile, right on desktop); selections apply immediately |
| Talent/location/tag filters | Pick a talent/location/tag | List filters as expected; chip appears and removes correctly |
| Reorder safety | With `q` or any filter active, try to reorder | Reorder controls are disabled and banner explains why |
| Readiness indicators | Toggle Display fields; inspect missing states | Missing items show as visible indicators (not silent absence) |
| Insights pills | Click status/missing pills | Filters toggle on/off and counts update |

**User Action:** Run `npm run dev` and verify scenarios above.

## Screenshots Index

_Screenshots live in `docs-vnext/_proof/FOCUS-SHOTS-2026-02-05-A/images/`._
