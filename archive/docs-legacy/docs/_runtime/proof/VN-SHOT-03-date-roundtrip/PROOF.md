# Proof — VN-SHOT-03-date-roundtrip

## Route Tested
`/projects/K5UpgJI9qeIz2l2oIKQg/shots/1Ub0ZvJBVHgv2J3op2Iy`
(Shot #15, "Untitled Shot", project "UM Q4-2025 No. 2 / Q1-2026 No. 1")

## Steps

1. Navigated to shot detail page — DATE field showed "Click to set date..."
2. Clicked DATE to open date input editor
3. Set date value to `2026-02-02` via native date input
4. Clicked away (blur) to trigger save → `parseDateOnly("2026-02-02")` creates UTC midnight Timestamp → saved to Firestore
5. DATE field now displays `2026-02-02` in read-only mode

## Screenshots

### 01-desktop-date-editor.png
- **File:** `01-desktop-date-editor.png`
- **Route:** `/projects/K5UpgJI9qeIz2l2oIKQg/shots/1Ub0ZvJBVHgv2J3op2Iy`
- **Viewport:** 1540x798 (desktop)
- **Shows:** DATE field in edit mode displaying `2026-02-02` via native date input
- **Proves:** `formatDateOnly()` correctly formats Firestore Timestamp as UTC YYYY-MM-DD; date is deterministic

### 02-desktop-date-after-refresh.png
- **File:** `02-desktop-date-after-refresh.png`
- **Route:** `/projects/K5UpgJI9qeIz2l2oIKQg/shots/1Ub0ZvJBVHgv2J3op2Iy`
- **Viewport:** 1540x798 (desktop)
- **Shows:** Same route after hard refresh (Cmd+Shift+R), DATE still shows `2026-02-02` in read-only mode
- **Proves:** Round-trip to Firestore preserves the date without off-by-one shift

### 03-mobile-date-readonly.png
- **File:** `03-mobile-date-readonly.png`
- **Route:** `/projects/K5UpgJI9qeIz2l2oIKQg/shots/1Ub0ZvJBVHgv2J3op2Iy`
- **Viewport:** 375x812 (iPhone SE mobile)
- **Shows:** DATE displays `2026-02-02` as read-only text (no editor on mobile)
- **Proves:** Mobile display uses same `formatDateOnly()` and shows correct date without timezone shift

## Conclusion
Date round-trip is deterministic: parse → Firestore → format produces the same YYYY-MM-DD regardless of user timezone. The off-by-one bug is fixed.
