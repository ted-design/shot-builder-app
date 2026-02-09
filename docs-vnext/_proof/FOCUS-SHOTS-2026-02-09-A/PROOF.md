# Proof — FOCUS-SHOTS-2026-02-09-A

**Domain:** SHOTS (Add Product flow in Shot Detail / Looks rail)  
**Focus ID:** FOCUS-SHOTS-2026-02-09-A  
**Date:** 2026-02-09

## Goal

Implement Option 1 (Smart Search Modal) for `Add product` in the Shot editor:

1. Remove 3-dropdown-first friction while keeping gender/type/subcategory filtering.
2. Eliminate cramped modal layout and horizontal content pressure.
3. Add in-flow options to create a new product or add a new colorway without leaving Shot Detail.

## What Shipped

### 1) Search-first family step with chip filters

- Replaced the old `Gender / Type / Subcategory` select row with:
  - primary search input
  - tappable filter chips for gender/type/subcategory
  - clear-filters action
  - count + active scope summary
- Product family list now renders in a full-width scroll region with no horizontal scroll dependency.

File:
- `src-vnext/features/shots/components/ProductAssignmentPicker.tsx`

### 2) Wider modal layout (desktop-friendly, mobile-safe bounds)

- Updated dialog sizing from narrow picker modal to a wider bounded dialog:
  - `w-[min(960px,calc(100vw-1rem))]`
  - `max-h` with internal vertical scroll
- Preserved mobile-safe viewport bounds and step flow.

File:
- `src-vnext/features/shots/components/ProductAssignmentPicker.tsx`

### 3) In-flow create product / add colorway actions

- Added `Create product` entry in Family step (no route navigation required).
- Added `Add colorway` action in SKU step (including no-colorway empty state).
- Wired both actions to vNext `ProductUpsertDialog` directly from the picker.
- Create path keeps user in shot flow and auto-selects the newly created family once available.

Files:
- `src-vnext/features/shots/components/ProductAssignmentPicker.tsx`
- `src-vnext/features/products/components/ProductUpsertDialog.tsx`
- `src-vnext/features/shots/components/ShotLooksSection.tsx`

### 4) Safety hardening for edit-in-place colorway operations

- Expanded product family/SKU mapping in shot picker hooks to preserve key fields used by product editing paths (`status`, `archived`, `sizes`, etc.), avoiding partial-data overwrite risks.

File:
- `src-vnext/features/shots/hooks/usePickerData.ts`

### 5) Test update for new UI structure

- Updated a picker assertion that now correctly handles duplicate "Women" text nodes (filter chip + row badge).

File:
- `src-vnext/features/shots/components/ProductAssignmentPicker.test.tsx`

## Validation

- `npm run test -- src-vnext/features/shots/components/ProductAssignmentPicker.test.tsx` ✅
- `npm run test -- src-vnext/features/shots/components/__tests__/ShotLooksSection.test.tsx` ✅
- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- `npm run build` ✅

## Mockups

Pre-implementation options remain in:

- `docs-vnext/_proof/FOCUS-SHOTS-2026-02-09-A/mockups/option-1-smart-search-modal.html`
- `docs-vnext/_proof/FOCUS-SHOTS-2026-02-09-A/mockups/option-2-split-drawer.html`
- `docs-vnext/_proof/FOCUS-SHOTS-2026-02-09-A/mockups/option-3-inline-composer.html`
