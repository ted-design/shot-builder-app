# VN-SHOT-04-product-assign-save-gate — Visual Proof

- **Branch:** `vnext/slice-3-call-sheet-assembly`
- **HEAD at time of proof:** `e711749f3585b48b17a34586ae334f60406b5303`
- **Date:** 2026-02-03T02:02:14Z
- **Dev server:** Foreground `npm run dev` on `:5174`, stopped with `pkill` after proof capture. No background dev server used for future deltas.

## Route
`/projects/K5UpgJI9qeIz2l2oIKQg/shots/1Ub0ZvJBVHgv2J3op2Iy`

## Steps to Reproduce

### Failure Path (save-gate retains dialog)
1. Open shot detail page
2. Click "Add product" — picker dialog opens (screenshot 01)
3. Select family "All Season Ankle Socks" → select SKU "Black" → reach Details step
4. Set browser to Offline (DevTools or Playwright `context.setOffline(true)`)
5. Click "Confirm" — button changes to "Saving..." (disabled), dialog stays open (screenshot 02)
6. Selections preserved: family, SKU, sizeScope, quantity all intact

### Success Path (dialog closes on persistence)
7. Restore network (go back online)
8. `resolveStoragePath` resolves, `updateDoc` succeeds, `onSave` returns `true`
9. Dialog closes, assignment row "All Season Ankle Socks / Black · All sizes" appears in Products list (screenshot 03)

### Mobile Read-Only
10. Resize viewport to 375x812
11. Products section shows assignments read-only — no "Add product" button, no remove (X) buttons (screenshot 04)

## Screenshots

| File | Proves |
|------|--------|
| `01-desktop-picker-open.png` | Picker dialog opens with family selection list |
| `02-desktop-save-failure-retains.png` | Offline: "Saving..." button disabled, dialog stays open, selections preserved, offline banner visible |
| `03-desktop-save-success.png` | Online: dialog closed, new assignment row visible in Products list with thumbnail |
| `04-mobile-readonly.png` | 375px viewport: Products shows assignments read-only, no edit affordances |

## Gates (ALL PASSED)

### `npx tsc --noEmit`
Clean — no output.

### `npm run lint`
```
> eslint . --ext .js,.jsx,.ts,.tsx --max-warnings=0
```
Clean — zero warnings.

### `npm run build`
```
✓ built in 8.09s
```
No errors.

### `npm test`
```
Test Files  102 passed | 2 skipped (104)
     Tests  1412 passed | 27 skipped (1439)
```
All pass. 4 new tests from `ProductAssignmentPicker.test.tsx` included.
