# Proof — FOCUS-SHOTS-2026-02-06-C

**Domain:** SHOTS (Shot detail editor trust + UX fixes)  
**Focus ID:** FOCUS-SHOTS-2026-02-06-C  
**Date:** 2026-02-06

## Goal

Address high-friction shot-editor issues reported in production usage:

1. Header/hero could not be reliably disabled.
2. Notes area felt non-editable.
3. Product picker edit flow could not navigate back to change product family.
4. Reference tiles cropped images aggressively.
5. Provide a layout redesign proposal as a wireframe/mockup before live layout changes.

## What Shipped

### 1) Header disable reliability

- `Hide header` now persists `activeLookId` to the active look when hiding.
- This locks cover derivation to the explicit hidden state for that look and prevents fallback hero selection from other sources.

File:
- `src-vnext/features/shots/components/ActiveLookCoverReferencesPanel.tsx`

### 2) Notes/addendum editing UX

- Replaced append-only addendum interaction with direct editable addendum text area.
- Save action now updates full addendum value (trimmed), so users can both enter and edit notes.
- Legacy HTML `notes` remains read-only/sanitized (no destructive rewrite path introduced).

Files:
- `src-vnext/features/shots/components/NotesSection.tsx`
- `src-vnext/features/shots/components/ShotDetailPage.tsx`

### 3) Product picker edit-back behavior

- In edit mode, back from Details now returns to SKU selection instead of closing modal.
- User can then back again to family selection and choose a different product.

File:
- `src-vnext/features/shots/components/ProductAssignmentPicker.tsx`

### 4) Reference image ratio handling

- Updated reference tiles to `object-contain` in both cover/references surfaces.
- Prevents cropping and preserves native image ratio within bounded tiles.

Files:
- `src-vnext/features/shots/components/ActiveLookCoverReferencesPanel.tsx`
- `src-vnext/features/shots/components/ShotLooksSection.tsx`

### 5) Shot editor layout wireframe (mockup-first)

- Added standalone HTML wireframe proposal for visual hierarchy review before live layout rewrite.
- Proposal reduces hero dominance and promotes key metadata/actions higher in the scan path.

File:
- `docs-vnext/_proof/FOCUS-SHOTS-2026-02-06-C/mockups/shot-detail-layout-wireframe.html`

### 6) Shot editor layout implementation aligned to wireframe

- Implemented the approved layout direction in live UI:
  - Hero card now embeds the cover/references rail beside the hero image.
  - Added quick summary cards under hero for Date, Location, Talent, and Products.
  - Prevented left-column stretch against the right rail (`items-start`) to remove the large empty gap.
  - Right rail now focuses on Looks + Products; references are no longer duplicated there.
- Reduced visual imbalance by tuning hero frame height while preserving native image ratio display.

Files:
- `src-vnext/features/shots/components/ShotDetailPage.tsx`
- `src-vnext/features/shots/components/ShotLooksSection.tsx`
- `src-vnext/features/shots/components/ActiveLookCoverReferencesPanel.tsx`
- `src-vnext/features/shots/components/HeroImageSection.tsx`

### 7) Layout follow-up: editable hero meta row + reduced vertical gap

- Reworked page composition so the left column flows independently from the right Looks rail, eliminating the large blank region under Hero when Looks content is tall.
- Moved Description above Hero/Header.
- Converted the hero summary row to editable cards for Date, Location, and Talent; removed Products from this row.
- Moved notes/addendum, comments, and history higher in the left-column flow so primary editing sections stay above the fold.

Files:
- `src-vnext/features/shots/components/ShotDetailPage.tsx`

### 8) Visual polish pass (density + control consistency)

- Tightened vertical spacing in the left-column flow and hero section to reduce scan distance.
- Reduced hero frame height slightly while preserving native image ratio behavior.
- Compacted description block (reduced padding and default editor rows) to avoid excessive empty space.
- Normalized control sizing/typography for the cover/reference action row.
- Added compact modes for top-row location/talent pickers so Date/Location/Talent cards align visually.

Files:
- `src-vnext/features/shots/components/ShotDetailPage.tsx`
- `src-vnext/features/shots/components/HeroImageSection.tsx`
- `src-vnext/features/shots/components/ActiveLookCoverReferencesPanel.tsx`
- `src-vnext/features/shots/components/LocationPicker.tsx`
- `src-vnext/features/shots/components/TalentPicker.tsx`

### 9) Addendum width follow-up

- Updated the notes/addendum + tags area from a 2-column split to a single-column stack.
- This makes producer addendum use the same full content width as comments/history in the left column.

Files:
- `src-vnext/features/shots/components/ShotDetailPage.tsx`

## Tests Updated

- `src-vnext/features/shots/components/NotesSection.test.tsx`
  - updated for editable addendum behavior
- `src-vnext/features/shots/components/ProductAssignmentPicker.test.tsx`
  - added regression test for back navigation in edit mode
- `src-vnext/features/shots/components/__tests__/ActiveLookCoverReferencesPanel.test.tsx`
  - added regression test for hide-header active-look locking

## Validation

- `npm run test -- src-vnext/features/shots/components/NotesSection.test.tsx src-vnext/features/shots/components/ProductAssignmentPicker.test.tsx src-vnext/features/shots/components/__tests__/ActiveLookCoverReferencesPanel.test.tsx` ✅
- `npm run test -- src-vnext/features/shots/components/__tests__/ShotDetailPage.test.tsx src-vnext/features/shots/components/__tests__/ActiveLookCoverReferencesPanel.test.tsx src-vnext/features/shots/components/ProductAssignmentPicker.test.tsx src-vnext/features/shots/components/NotesSection.test.tsx` ✅
- `npm run lint` ✅
- `npx tsc --noEmit` ✅
- `npm run build` ✅

## Manual QA

| Scenario | Steps | Expected |
|---|---|---|
| Hide header from product-derived hero | Open shot with product-derived header, click `Hide header` | Header image clears and stays disabled |
| Edit addendum text | In Notes section, type/modify addendum and click `Save addendum` | Text persists and remains editable |
| Edit existing product, go back | Click existing product in Looks -> Products, press back | Modal goes to SKU step (not close), then family step |
| Reference tiles with portrait/landscape images | Open references panel with mixed orientations | Images are letterboxed/contained, not cropped |
| Layout proposal review | Open mockup HTML file | Wireframe loads and can be reviewed for hierarchy decisions |
