# Phase 15.1 - Page-Level Dark Mode Implementation Guide

## Overview
This document provides a comprehensive guide for implementing dark mode across all 37 components in Phase 15.1.

## Dark Mode Color Palette (from Phase 15)
- **Background**: `dark:bg-slate-900`
- **Surface**: `dark:bg-slate-800`
- **Border**: `dark:border-slate-700`
- **Text Primary**: `dark:text-slate-100`
- **Text Secondary**: `dark:text-slate-400`
- **Text Tertiary**: `dark:text-slate-500` / `dark:text-slate-600`
- **Primary Button**: `dark:bg-indigo-600`, `dark:hover:bg-indigo-700`
- **Focus Ring**: `dark:focus:ring-indigo-500`

## Status: Files Completed

### ✅ Completed (1/37)
1. `/src/pages/LoginPage.jsx` - DONE

### ⏳ Remaining (36/37)

## Implementation Patterns

### Pattern 1: Page Headers
```jsx
// BEFORE
<div className="border-b border-gray-200 bg-white shadow-sm">
  <h1 className="text-2xl font-bold text-gray-900">Page Title</h1>
  <p className="text-sm text-slate-600">Description</p>
</div>

// AFTER
<div className="border-b border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
  <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Page Title</h1>
  <p className="text-sm text-slate-600 dark:text-slate-400">Description</p>
</div>
```

### Pattern 2: Form Inputs (already handled by Input component)
The `/src/components/ui/input.jsx` component already has dark mode classes, so forms using `<Input>` are covered.

### Pattern 3: Select Elements
```jsx
// BEFORE
<select className="rounded border border-slate-300 px-3 py-2 text-sm">

// AFTER
<select className="rounded border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
```

### Pattern 4: Table Headers
```jsx
// BEFORE
<thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">

// AFTER
<thead className="bg-slate-50 dark:bg-slate-900/40 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
```

### Pattern 5: Table Rows
```jsx
// BEFORE
<tr className="odd:bg-white even:bg-slate-50/40 hover:bg-slate-100">

// AFTER
<tr className="odd:bg-white even:bg-slate-50/40 dark:odd:bg-slate-800 dark:even:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-700">
```

### Pattern 6: Dividers
```jsx
// BEFORE
<div className="divide-y divide-slate-200">
<div className="border-t border-slate-200">

// AFTER
<div className="divide-y divide-slate-200 dark:divide-slate-700">
<div className="border-t border-slate-200 dark:border-slate-700">
```

### Pattern 7: Dropdown/Filter Panels
```jsx
// BEFORE
<div className="absolute z-20 rounded-md border border-slate-200 bg-white p-4 shadow-lg">

// AFTER
<div className="absolute z-20 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-lg">
```

### Pattern 8: Checkbox Inputs (when not using Checkbox component)
```jsx
// BEFORE
<input type="checkbox" className="h-4 w-4 rounded border-gray-300" />

// AFTER
<input type="checkbox" className="h-4 w-4 rounded border-gray-300 dark:border-slate-600 dark:bg-slate-800" />
```

### Pattern 9: Filter Pills/Badges
```jsx
// BEFORE
<button className="bg-primary/10 text-primary border border-primary/20 px-3 py-1">

// AFTER
<button className="bg-primary/10 dark:bg-indigo-900/30 text-primary dark:text-indigo-400 border border-primary/20 dark:border-indigo-700/50 px-3 py-1">
```

### Pattern 10: Alert/Feedback Messages
```jsx
// BEFORE
<div className="bg-emerald-50 text-emerald-700">Success</div>
<div className="bg-red-50 text-red-600">Error</div>
<div className="bg-amber-50 text-amber-700">Warning</div>

// AFTER
<div className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">Success</div>
<div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400">Error</div>
<div className="bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400">Warning</div>
```

## File-by-File Implementation Checklist

### Page Components (12 files)

#### 1. `/src/pages/LoginPage.jsx` ✅
Status: **COMPLETED**

#### 2. `/src/pages/TagManagementPage.jsx`
Key areas:
- Sticky header (line 445)
- Analytics cards (lines 480-540)
- Table header and rows (lines 574-646)
- Modal dialogs (lines 655-877)

Classes to add:
```diff
Line 445: - bg-white shadow-sm
         + bg-white dark:bg-slate-800 shadow-sm
Line 449: - text-gray-900
         + text-gray-900 dark:text-slate-100
Line 451: - text-slate-600
         + text-slate-600 dark:text-slate-400
Line 574: - bg-slate-50 ... text-slate-500
         + bg-slate-50 dark:bg-slate-900/40 ... text-slate-500 dark:text-slate-400
Line 591: - hover:bg-slate-50
         + hover:bg-slate-50 dark:hover:bg-slate-700
Line 669: - border-slate-200 ... text-slate-900
         + border-slate-200 dark:border-slate-700 ... text-slate-900 dark:text-slate-100
```

#### 3. `/src/pages/TalentPage.jsx`
Key areas:
- Sticky header card (line 404-441)
- Feedback messages (line 447-455)
- TalentCard components (lines 42-108)

Classes to add:
```diff
Line 404: - bg-white/95 ... backdrop-blur
         + bg-white/95 dark:bg-slate-800/95 ... backdrop-blur
Line 408: - text-slate-900
         + text-slate-900 dark:text-slate-100
Line 443: - text-slate-600
         + text-slate-600 dark:text-slate-400
Line 449-450: Apply Pattern 10 for feedback messages
```

#### 4. `/src/pages/ProductsPage.jsx`
Key areas:
- Sticky header (line 1620-1664)
- Batch selection banner (line 1667-1748)
- Filter panel (line 1764-1850)
- Modals (lines 1983-2090)
- CreateProductCard (line 182)
- ProductActionMenu (line 227)
- Table view (line 1505)

Classes to add:
```diff
Line 1620: - border-gray-200 bg-white
          + border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800
Line 1624: - text-gray-900
          + text-gray-900 dark:text-slate-100
Line 1626: - text-slate-600
          + text-slate-600 dark:text-slate-400
Line 1645: - border-slate-300 ... text-sm
          + border-slate-300 dark:border-slate-600 ... text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100
Line 1667: - bg-primary/5
          + bg-primary/5 dark:bg-indigo-900/30
Line 1787: - border-slate-200 bg-white
          + border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800
Line 182: - border-slate-300 bg-slate-50
         + border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-900/40
Line 190: - text-slate-700
         + text-slate-700 dark:text-slate-300
Line 227: - border-slate-200 bg-white/95
         + border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95
Line 1506: - bg-slate-50
          + bg-slate-50 dark:bg-slate-900/40
Line 1331: - odd:bg-white even:bg-slate-50/40
          + odd:bg-white even:bg-slate-50/40 dark:odd:bg-slate-800 dark:even:bg-slate-800/50
```

#### 5. `/src/pages/ProjectsPage.jsx`
Key areas:
- Sticky header (line 326)
- Filter panel (line 361)
- ProjectCards component (external file - handle separately)

Classes to add:
```diff
Line 326: - border-gray-200 bg-white
         + border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800
Line 329: - text-gray-900
         + text-gray-900 dark:text-slate-100
Line 332: - text-slate-600
         + text-slate-600 dark:text-slate-400
Line 361: - border-slate-200 bg-white
         + border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800
Line 429: - border-slate-200 bg-white
         + border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400
```

#### 6. `/src/pages/ShotsPage.jsx` (VERY LARGE FILE)
This file requires careful systematic updates across many sections:
- Sticky header
- Filter panels
- Sort controls
- Shot cards/rows
- Modals

Due to file size, use Pattern 1-10 above systematically.

#### 7. `/src/pages/PullsPage.jsx`
Key areas:
- Page header (line 295-300)
- Pull cards (line 377)
- AutoGeneratePullModal (line 589)
- PullDetailsModal (line 1108)

#### 8. `/src/pages/PlannerPage.jsx`
Key areas to implement dark mode - needs systematic review of all UI elements

#### 9. `/src/pages/LocationsPage.jsx`
Similar patterns to TalentPage - use same approach

#### 10. `/src/pages/AdminPage.jsx`
Admin panel tables and settings

#### 11. `/src/pages/PullPublicViewPage.jsx`
Public-facing page - ensure good contrast

#### 12. `/src/pages/dev/ImageDiagnosticsPage.jsx`
Dev tools page

### Modal Components (20 files)

**Note**: Most modal styling is handled by the base `/src/components/ui/modal.jsx` which already has dark mode classes. Focus on modal **content**.

#### Common Modal Pattern
```jsx
// Modal header
<div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4">
  <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Title</h2>
  <p className="text-sm text-slate-600 dark:text-slate-400">Description</p>
</div>

// Modal content with form
<div className="px-6 py-4 space-y-4">
  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Label</label>
</div>

// Modal footer
<div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4">
  ...
</div>
```

#### Files to Update:
1. `/src/components/planner/PlannerExportModal.jsx`
2. `/src/components/dashboard/ProjectCreateModal.jsx`
3. `/src/components/ProductSelectorModal.jsx`
4. `/src/components/PDFExportModal.jsx`
5. `/src/components/dashboard/ProjectEditModal.jsx`
6. `/src/components/locations/LocationCreateModal.jsx`
7. `/src/components/locations/LocationEditModal.jsx`
8. `/src/components/products/EditProductModal.jsx`
9. `/src/components/products/NewColourwayModal.jsx`
10. `/src/components/products/NewProductModal.jsx`
11. `/src/components/pulls/BulkAddItemsModal.jsx`
12. `/src/components/pulls/ChangeOrderModal.jsx`
13. `/src/components/pulls/ChangeOrderReviewModal.jsx`
14. `/src/components/pulls/PullExportModal.jsx`
15. `/src/components/pulls/PullShareModal.jsx`
16. `/src/components/shots/ShotProductAddModal.jsx`
17. `/src/components/talent/TalentCreateModal.jsx`
18. `/src/components/talent/TalentEditModal.jsx`
19. `/src/components/shots/ShotEditModal.jsx`
20. `/src/components/common/BatchImageUploadModal.jsx`

### Specialized Components (5 files)

#### 1. `/src/components/ui/StatusBadge.jsx` ⚠️ CRITICAL
Semantic colors need dark mode variants with proper contrast:

```jsx
// Current pattern (example)
const STATUS_COLORS = {
  'active': 'bg-emerald-100 text-emerald-800',
  'pending': 'bg-amber-100 text-amber-800',
  'error': 'bg-red-100 text-red-800',
};

// Add dark mode
const STATUS_COLORS = {
  'active': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-400',
  'pending': 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-400',
  'error': 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400',
};
```

#### 2. `/src/components/ui/TagBadge.jsx` ⚠️ CRITICAL
Color swatches need dark-friendly borders:

```jsx
// Add border for visibility in dark mode
<span className="rounded-full px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 border border-transparent dark:border-blue-700/50">
```

#### 3. `/src/components/ui/ProgressBar.jsx`
```jsx
// Background and fill
<div className="bg-slate-200 dark:bg-slate-700 h-2 rounded-full">
  <div className="bg-primary dark:bg-indigo-500 h-full rounded-full" style={{width: `${percent}%`}} />
</div>
```

#### 4. `/src/components/ui/SearchCommand.jsx`
Command palette styling - check if uses Cmd+K library styles

#### 5. `/src/components/ui/FilterPresetManager.jsx`
Dropdown panels and preset chips

#### 6. `/src/components/ui/ToastProvider.jsx`
Toast notifications - likely uses library styles, may need theme configuration

## Quick Reference: Most Common Replacements

### Text Colors
```
text-gray-900        → text-gray-900 dark:text-slate-100
text-slate-900       → text-slate-900 dark:text-slate-100
text-slate-800       → text-slate-800 dark:text-slate-200
text-slate-700       → text-slate-700 dark:text-slate-300
text-slate-600       → text-slate-600 dark:text-slate-400
text-slate-500       → text-slate-500 dark:text-slate-500 (unchanged)
text-primary         → text-primary dark:text-indigo-400
```

### Background Colors
```
bg-white             → bg-white dark:bg-slate-800
bg-slate-50          → bg-slate-50 dark:bg-slate-900
bg-slate-100         → bg-slate-100 dark:bg-slate-800
bg-gray-50           → bg-gray-50 dark:bg-slate-900
```

### Border Colors
```
border-gray-200      → border-gray-200 dark:border-slate-700
border-slate-200     → border-slate-200 dark:border-slate-700
border-slate-300     → border-slate-300 dark:border-slate-600
divide-slate-200     → divide-slate-200 dark:divide-slate-700
```

### Hover States
```
hover:bg-slate-50    → hover:bg-slate-50 dark:hover:bg-slate-700
hover:bg-slate-100   → hover:bg-slate-100 dark:hover:bg-slate-700
hover:bg-gray-100    → hover:bg-gray-100 dark:hover:bg-slate-700
```

## Testing Checklist

After implementing all changes:

1. ✅ Run tests: `npm test`
2. ✅ Verify all 253 tests still pass
3. ✅ Visual QA in browser:
   - Toggle dark mode on each page
   - Check form inputs are readable
   - Check all modals have proper contrast
   - Check StatusBadge colors are visible
   - Check TagBadge color swatches are visible
   - Check table headers/rows are readable
   - Check filter panels/dropdowns

## Implementation Timeline Estimate

- Pages (12 files): ~45-60 minutes
- Modals (20 files): ~30-45 minutes (simpler, base modal done)
- Specialized (5 files): ~15-30 minutes
- Testing: ~15 minutes

**Total: 1.5-2.5 hours**

## Notes

- Card component already has dark mode ✅
- Button component already has dark mode ✅
- Input component already has dark mode ✅
- Modal base already has dark mode ✅
- SidebarLayout already has dark mode ✅

The bulk of work is adding dark mode classes to:
- Page headers
- Table rows/headers
- Select elements
- Filter panels
- Modal content
- Alert/feedback messages

## Completion Tracking

Update this section as files are completed:

```
Pages: 1/12 complete (8.3%)
Modals: 0/20 complete (0%)
Specialized: 0/5 complete (0%)
Overall: 1/37 complete (2.7%)
```
