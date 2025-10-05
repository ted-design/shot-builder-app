# Pulls Enhancement Implementation Plan

## Overview
This document outlines a comprehensive plan to enhance the Pulls feature with advanced item editing, warehouse fulfillment workflows, change order management, and export capabilities.

---

## Data Model Changes

### 1. Enhanced Pull Item Schema
**Current Schema:**
```javascript
{
  id: string,
  name: string,
  quantity: number,
  notes: string,
  shotId?: string,
  productId?: string
}
```

**New Schema:**
```javascript
{
  id: string,
  // Product identification
  familyId: string,
  familyName: string,
  styleNumber?: string,
  colourId?: string,
  colourName?: string,
  colourImagePath?: string,

  // Size and quantity details
  sizes: [
    {
      size: string,
      quantity: number,
      fulfilled: number,  // tracks partial fulfillment
      status: "pending" | "fulfilled" | "partial" | "substituted"
    }
  ],

  // Metadata
  notes: string,
  gender?: string,  // for sorting/filtering
  category?: string,

  // Fulfillment tracking
  fulfillmentStatus: "pending" | "fulfilled" | "partial" | "substituted",
  fulfilledBy?: string,  // user ID
  fulfilledAt?: Timestamp,

  // Change orders
  changeOrders?: [
    {
      id: string,
      requestedBy: string,
      requestedAt: Timestamp,
      reason: string,
      status: "pending" | "approved" | "rejected",
      substitution: {
        familyId: string,
        familyName: string,
        colourId?: string,
        colourName?: string,
        sizes: [{ size: string, quantity: number }]
      },
      approvedBy?: string,
      approvedAt?: Timestamp,
      rejectionReason?: string
    }
  ]
}
```

### 2. Pull Document Schema Updates
```javascript
{
  // Existing fields...
  id: string,
  projectId: string,
  title: string,
  status: "draft" | "published" | "in-progress" | "fulfilled",
  items: PullItem[],

  // New fields
  sortOrder: "product" | "gender" | "category" | "size" | "manual",

  // Export settings (persisted for re-export)
  exportSettings?: {
    pdfOrientation: "portrait" | "landscape",
    headerText?: string,
    subheaderText?: string,
    includeImages: boolean,
    pageBreakStrategy: "auto" | "by-category" | "by-gender"
  },

  // Sharing
  shareToken?: string,  // for public view-only links
  shareEnabled: boolean,
  shareExpiresAt?: Timestamp,

  // Statistics (computed on publish)
  stats?: {
    totalItems: number,
    totalQuantity: number,
    byGender: { [key: string]: number },
    byCategory: { [key: string]: number }
  }
}
```

---

## Component Architecture

### New Components

#### 1. `/src/components/pulls/PullItemEditor.jsx`
**Purpose:** Edit individual pull item with product selection, size/quantity matrix
**Props:**
```javascript
{
  item: PullItem | null,  // null for new item
  families: ProductFamily[],
  loadFamilyDetails: (familyId) => Promise<Details>,
  onSave: (item: PullItem) => void,
  onClose: () => void,
  canEdit: boolean
}
```

**Features:**
- Reuses `ShotProductAddModal` for product/colour selection
- Size-quantity matrix editor (table with size, quantity, notes columns)
- Add multiple size rows
- Gender/category assignment
- Notes field

#### 2. `/src/components/pulls/PullItemsTable.jsx`
**Purpose:** Display and manage all pull items in tabular format
**Props:**
```javascript
{
  items: PullItem[],
  onEditItem: (item, index) => void,
  onDeleteItem: (index) => void,
  onReorder: (fromIndex, toIndex) => void,
  sortOrder: string,
  onChangeSortOrder: (order) => void,
  canManage: boolean,
  isWarehouse: boolean,
  onToggleFulfillment?: (itemId, sizeId) => void,
  onRequestChange?: (itemId) => void
}
```

**Features:**
- Sortable columns (product, gender, category, total quantity)
- Inline fulfillment checkboxes (warehouse role only)
- Change order indicators
- Expandable rows for size details
- Row actions (edit, delete, request change)

#### 3. `/src/components/pulls/ChangeOrderModal.jsx`
**Purpose:** Warehouse staff request product substitution
**Props:**
```javascript
{
  originalItem: PullItem,
  families: ProductFamily[],
  loadFamilyDetails: (familyId) => Promise<Details>,
  onSubmit: (changeOrder) => void,
  onClose: () => void
}
```

**Features:**
- Show original requested product/sizes
- Product selection for replacement
- Size/quantity matrix for substitute
- Reason text field (required)
- Preview comparison (original vs. substitute)

#### 4. `/src/components/pulls/ChangeOrderReviewModal.jsx`
**Purpose:** Producer approves/rejects change orders
**Props:**
```javascript
{
  changeOrder: ChangeOrder,
  originalItem: PullItem,
  onApprove: (changeOrderId) => void,
  onReject: (changeOrderId, reason) => void,
  onClose: () => void
}
```

**Features:**
- Side-by-side comparison
- Approval/rejection buttons
- Rejection reason field
- Approval commits the change to the item

#### 5. `/src/components/pulls/PullExportModal.jsx`
**Purpose:** Configure and export pull (PDF/CSV)
**Props:**
```javascript
{
  pull: Pull,
  items: PullItem[],
  onClose: () => void
}
```

**Features:**
- Format selector (PDF/CSV)
- PDF customization:
  - Orientation (portrait/landscape)
  - Header/subheader text inputs
  - Include images toggle
  - Page break strategy dropdown
- CSV options:
  - Include notes toggle
  - Flatten sizes (one row per size) vs. aggregate
- Preview button
- Download button

#### 6. `/src/components/pulls/PullShareModal.jsx`
**Purpose:** Generate and manage shareable links
**Props:**
```javascript
{
  pull: Pull,
  onClose: () => void,
  onGenerateLink: () => Promise<string>,
  onRevokeLink: () => Promise<void>
}
```

**Features:**
- Generate unique share token
- Copy link button
- Expiration date picker (optional)
- Revoke access button
- Link preview

#### 7. `/src/pages/PullPublicViewPage.jsx`
**Purpose:** Public read-only pull view
**Route:** `/pulls/shared/:shareToken`
**Features:**
- No authentication required
- Read-only item display
- Simplified UI
- Expiration check
- Export to PDF/CSV (with watermark)

### Modified Components

#### 1. `/src/pages/PullsPage.jsx`
**Changes:**
- Update `handleAddPull` to use new item schema
- Update `AutoGeneratePullModal` to map products to new schema
- Remove inline item editing (move to `PullItemEditor`)
- Add delete button styling (✅ completed)

#### 2. `PullDetailsModal` in `/src/pages/PullsPage.jsx`
**Major Refactor Required:**
- Replace simple item list with `PullItemsTable`
- Add "Edit Item" flow opening `PullItemEditor`
- Add "Export" button opening `PullExportModal`
- Add "Share" button opening `PullShareModal`
- Add change order notifications/badges
- Add fulfillment progress indicator
- Warehouse role: show fulfillment checkboxes
- Producer role: show pending change orders section

---

## Utility Functions & Helpers

### 1. `/src/lib/pullItems.js`
```javascript
// Item creation and transformation
export const createPullItemFromProduct = (product) => { ... }
export const mergePullItems = (items) => { ... }  // deduplication
export const calculateItemFulfillment = (item) => { ... }
export const validatePullItem = (item) => { ... }

// Sorting
export const sortPullItems = (items, sortOrder) => { ... }
export const groupPullItems = (items, groupBy) => { ... }
```

### 2. `/src/lib/pullExport.js`
```javascript
// CSV export
export const exportPullToCSV = (pull, items, options) => { ... }
export const generateCSVBlob = (data) => { ... }

// PDF export (enhance existing)
export const exportPullToPDF = (pull, items, settings) => { ... }
```

### 3. `/src/lib/pullSharing.js`
```javascript
// Share token management
export const generateShareToken = () => { ... }
export const validateShareToken = (token, pull) => { ... }
export const getShareableURL = (token) => { ... }
```

### 4. `/src/lib/changeOrders.js`
```javascript
// Change order workflows
export const createChangeOrder = (itemId, substitution, reason, userId) => { ... }
export const approveChangeOrder = (pullId, itemId, changeOrderId, userId) => { ... }
export const rejectChangeOrder = (pullId, itemId, changeOrderId, reason, userId) => { ... }
export const applyChangeOrder = (item, changeOrder) => { ... }  // merge substitution
```

### 5. `/src/lib/rbac.js` (updates)
```javascript
// Add warehouse permissions
export const canFulfillPulls = (role) => { ... }
export const canApproveChangeOrders = (role) => { ... }
```

---

## PDF Template Enhancements

### `/src/lib/pdfTemplates.js` - Update `PullPDF`
**New Features:**
- Accept `settings` prop for customization
- Render header/subheader text
- Support portrait/landscape orientation
- Implement smart page breaks:
  - Track running height
  - Break by category/gender if enabled
  - Ensure size rows stay together
- Include product images conditionally
- Size-quantity breakdown per item
- Fulfillment status indicators
- Change order annotations

**Structure:**
```javascript
export const PullPDF = ({ pull, items, settings }) => {
  const {
    orientation = 'portrait',
    headerText,
    subheaderText,
    includeImages = true,
    pageBreakStrategy = 'auto'
  } = settings || {};

  // Group items according to strategy
  const groups = groupForPrint(items, pageBreakStrategy);

  return (
    <Document>
      <Page size="A4" orientation={orientation}>
        {headerText && <Header>{headerText}</Header>}
        {subheaderText && <Subheader>{subheaderText}</Subheader>}

        {groups.map(group => (
          <Section key={group.id} wrap={false}>
            {group.title && <GroupTitle>{group.title}</GroupTitle>}
            {group.items.map(item => (
              <ItemRow item={item} includeImages={includeImages} />
            ))}
          </Section>
        ))}
      </Page>
    </Document>
  );
};
```

---

## Firestore Rules Updates

### `/firestore.rules`
```
// Add public read access for shared pulls
match /clients/{clientId}/projects/{projectId}/pulls/{pullId} {
  // Existing rules...

  // Public read for shared pulls
  allow read: if resource.data.shareEnabled == true
              && resource.data.shareToken != null
              && request.auth == null;  // anonymous access
}
```

---

## Routes

### New Routes in `/src/App.jsx`
```javascript
// Public route (no auth required)
<Route path="/pulls/shared/:shareToken" element={<PullPublicViewPage />} />
```

---

## Implementation Phases

### **Phase 1: Data Model & Core Editing** (Foundation)
**Files:**
- `src/lib/pullItems.js` (new)
- `src/types/models.ts` (update PullItem interface)
- `src/components/pulls/PullItemEditor.jsx` (new)
- `src/components/pulls/PullItemsTable.jsx` (new)
- `src/pages/PullsPage.jsx` (refactor `PullDetailsModal`)

**Tasks:**
1. Define new PullItem schema with TypeScript types
2. Create `pullItems.js` utility functions
3. Build `PullItemEditor` component
4. Build `PullItemsTable` component
5. Refactor `PullDetailsModal` to use new table
6. Update auto-generation to use new schema
7. Test item CRUD operations

**Estimated Effort:** 4-6 hours

---

### **Phase 2: Warehouse Fulfillment Workflow** (Complex)
**Files:**
- `src/lib/rbac.js` (update)
- `src/lib/changeOrders.js` (new)
- `src/components/pulls/ChangeOrderModal.jsx` (new)
- `src/components/pulls/ChangeOrderReviewModal.jsx` (new)
- `src/pages/PullsPage.jsx` (enhance `PullDetailsModal`)

**Tasks:**
1. Add warehouse permission functions to RBAC
2. Create `changeOrders.js` helper functions
3. Build `ChangeOrderModal` for warehouse staff
4. Build `ChangeOrderReviewModal` for producers
5. Add fulfillment checkboxes to item table (warehouse view)
6. Add change order request button (warehouse view)
7. Add change order review section (producer view)
8. Implement approval/rejection logic
9. Add notification badges for pending change orders
10. Test end-to-end fulfillment workflow

**Estimated Effort:** 6-8 hours

---

### **Phase 3: Export & Sharing** (Moderate)
**Files:**
- `src/lib/pullExport.js` (new)
- `src/lib/pullSharing.js` (new)
- `src/lib/pdfTemplates.js` (enhance)
- `src/components/pulls/PullExportModal.jsx` (new)
- `src/components/pulls/PullShareModal.jsx` (new)
- `src/pages/PullPublicViewPage.jsx` (new)
- `src/App.jsx` (add route)
- `firestore.rules` (update)

**Tasks:**
1. Create CSV export utility with options
2. Enhance PDF template with customization
3. Build `PullExportModal` with format/settings controls
4. Create share token generation utility
5. Build `PullShareModal` for link management
6. Create `PullPublicViewPage` component
7. Add public route to App
8. Update Firestore rules for public access
9. Add share button to `PullDetailsModal`
10. Test all export formats and public sharing

**Estimated Effort:** 5-7 hours

---

### **Phase 4: Sorting & Polish** (Simpler)
**Files:**
- `src/lib/pullItems.js` (enhance)
- `src/components/pulls/PullItemsTable.jsx` (enhance)
- `src/pages/PullsPage.jsx` (enhance)

**Tasks:**
1. Implement sorting functions (product, gender, category, size)
2. Add sort dropdown to `PullItemsTable`
3. Add grouping/categorization headers
4. Persist sort preference in pull document
5. Add visual indicators for sort order
6. Test sorting with various data sets

**Estimated Effort:** 2-3 hours

---

## File Structure Summary

```
src/
├── components/
│   └── pulls/                          # NEW DIRECTORY
│       ├── PullItemEditor.jsx          # NEW - Edit individual items
│       ├── PullItemsTable.jsx          # NEW - Display items with sorting
│       ├── ChangeOrderModal.jsx        # NEW - Request substitutions
│       ├── ChangeOrderReviewModal.jsx  # NEW - Approve/reject changes
│       ├── PullExportModal.jsx         # NEW - Export configuration
│       └── PullShareModal.jsx          # NEW - Share link management
│
├── lib/
│   ├── pullItems.js                    # NEW - Item utilities
│   ├── pullExport.js                   # NEW - CSV/PDF export
│   ├── pullSharing.js                  # NEW - Share token management
│   ├── changeOrders.js                 # NEW - Change order workflows
│   ├── pdfTemplates.js                 # MODIFIED - Enhanced PDF
│   └── rbac.js                         # MODIFIED - Warehouse permissions
│
├── pages/
│   ├── PullsPage.jsx                   # MODIFIED - Refactor modal
│   └── PullPublicViewPage.jsx          # NEW - Public view route
│
├── types/
│   └── models.ts                       # MODIFIED - Updated interfaces
│
└── App.jsx                             # MODIFIED - Add public route
```

---

## Testing Checklist

### Phase 1: Core Editing
- [ ] Create new pull with new item schema
- [ ] Edit existing items
- [ ] Add multiple sizes to single item
- [ ] Delete items
- [ ] Validate required fields
- [ ] Test with products without sizes
- [ ] Auto-generate pull with new schema

### Phase 2: Fulfillment
- [ ] Warehouse user can check off items
- [ ] Partial fulfillment tracking works
- [ ] Change order request creates record
- [ ] Producer sees pending change orders
- [ ] Approve change order updates item
- [ ] Reject change order retains original
- [ ] Notifications/badges display correctly
- [ ] Permission checks work correctly

### Phase 3: Export & Sharing
- [ ] CSV export includes all data
- [ ] PDF renders with custom header/subheader
- [ ] PDF portrait/landscape modes work
- [ ] PDF page breaks correctly
- [ ] Share link generates successfully
- [ ] Public view displays read-only pull
- [ ] Share link expiration works
- [ ] Revoke link prevents access
- [ ] Firestore rules allow public read

### Phase 4: Sorting
- [ ] Sort by product name
- [ ] Sort by gender
- [ ] Sort by category
- [ ] Sort by size
- [ ] Grouping headers display correctly
- [ ] Sort preference persists

---

## Risks & Considerations

### Data Migration
**Issue:** Existing pulls use old item schema
**Solution:** Write migration utility or handle gracefully:
```javascript
const normalizePullItem = (item) => {
  // If new schema, return as-is
  if (item.familyId && item.sizes) return item;

  // Convert old schema to new
  return {
    id: item.id,
    familyId: item.productId || 'unknown',
    familyName: item.name || 'Unknown Product',
    sizes: [{ size: 'One Size', quantity: item.quantity || 1, fulfilled: 0, status: 'pending' }],
    notes: item.notes || '',
    fulfillmentStatus: 'pending'
  };
};
```

### Performance
**Issue:** Large pulls with many items/sizes
**Solution:**
- Paginate item table if > 50 items
- Lazy-load change order details
- Optimize Firestore queries with indexes

### Security
**Issue:** Public share links expose data
**Solution:**
- Implement token expiration
- Rate limit public endpoint
- Exclude sensitive fields in public view
- Add option to disable sharing per pull

### Concurrency
**Issue:** Multiple users editing same pull
**Solution:**
- Optimistic locking with version field
- Real-time subscription updates in modal
- Show "edited by X" indicator

---

## Next Steps

1. **Review this plan** - Confirm approach and priorities
2. **Choose starting phase** - Recommend Phase 1 (foundation)
3. **Gather any additional requirements** - Missing features?
4. **Begin implementation** - Systematic, tested development

---

## Questions for Clarification ✅ ANSWERED

1. **Product variations:** ✅ Items track gender/category automatically from product families, with manual override option

2. **Fulfillment granularity:** ✅ Partial fulfillment per size is permitted. Track original vs fulfilled quantities to show modifications

3. **Change order scope:** ✅ Change orders can substitute with multiple products (1-to-many or many-to-many)

4. **Export permissions:** ✅ Public share links are view-only in browser (no PDF/CSV export)

5. **Sorting persistence:** ✅ Default sort: Gender first, then alphabetical by product/style name

6. **Auto-generation:** ✅ **Option A - Full Aggregation**
   - Aggregate by unique product+colour combinations across all selected lanes
   - Combine all sizes for same product+colour into single pull item
   - Track shot IDs in item metadata for reference
   - Example: 3 shots with "Black Merino Crew M" → One item with "Size M: Qty 3"

---

**Total Estimated Effort:** 17-24 hours of focused development
**Recommended Timeline:** 3-4 development sessions
**Complexity Level:** High (requires careful state management, role-based rendering, and data model changes)
