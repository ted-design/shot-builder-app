# Production Hub vNext - Internal UX Audit Report

**Date:** March 31, 2026  
**Status:** Comprehensive Code Review  
**Scope:** Production Hub vNext codebase at `/src-vnext/`

---

## Executive Summary

This audit examined the Production Hub vNext codebase across 7 key UX areas reported by users. The codebase is built with React 18.3, Firebase 10.0.0, React Router 6.30.1, and uses shadcn/ui components with Tailwind CSS. The codebase demonstrates production-ready patterns with comprehensive state management, form handling, and component architecture.

**Key Findings:**
- ✓ Single shot deletion exists with soft-delete pattern
- ✗ No batch/multi-select deletion implemented
- ✓ Three distinct view modes (gallery, visual, table) with customizable fields
- ✓ Shot readiness computation implemented with priority levels
- ✗ No route transition animations present
- ✓ PDF export system fully implemented with templates
- ✗ Talent/Locations use card/grid views only (no table views)
- ✗ No image cropping/canvas editing (image upload only)

---

## 1. Shot Deletion

### Current Implementation

**Single Shot Deletion: EXISTS**

- **Location:** `/src-vnext/features/shots/components/ShotLifecycleActionsMenu.tsx` (Lines 160-183)
- **Function:** `softDeleteShot()` from `/src-vnext/features/shots/lib/shotLifecycleActions.ts` (Lines 228-239)

**Code Details:**
```typescript
// ShotLifecycleActionsMenu.tsx:160-183
const handleDelete = async () => {
  if (!clientId || disabled || busyAction) return
  if (deleteText.trim() !== "DELETE") return
  setBusyAction("delete")
  try {
    await softDeleteShot({
      clientId,
      shotId: shot.id,
      user,
    })
    toast.success("Shot deleted", {
      description: "Removed from this project's active shot list.",
    })
    navigate(`/projects/${shot.projectId}/shots`)
  } catch (err) {
    toast.error("Failed to delete shot", ...)
  }
}

// shotLifecycleActions.ts:228-239
export async function softDeleteShot(args: SoftDeleteShotArgs): Promise<void> {
  const { clientId, shotId, user } = args
  const path = shotPath(shotId, clientId)
  const ref = doc(db, path[0]!, ...path.slice(1))

  await updateDoc(ref, {
    deleted: true,
    deletedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...(user?.uid ? { updatedBy: user.uid } : {}),
  })
}
```

**Deletion Type:** SOFT DELETE (sets `deleted: true` and `deletedAt` timestamp)

**UX Pattern:**
- Confirmation dialog requires typing "DELETE" to confirm
- Only accessible from shot detail page via dropdown menu
- Toast shows "Removed from this project's active shot list"
- Navigates back to shots list after deletion

**Component Tree:**
```
ShotDetailPage / ThreePanelCanvasPanel
  └─ ShotLifecycleActionsMenu
     ├─ DropdownMenu with "Delete shot…" option
     └─ Dialog with text confirmation ("DELETE")
```

### Batch Deletion: MISSING

**Evidence:** 
- ShotListPage.tsx (Lines 82-84) has selection state (`selectedIds`, `selectionMode`)
- Selection bar exists for display, but no batch delete action
- Line 105-107 shows "canBulkPull" flag but no "canBulkDelete"

```typescript
// ShotListPage.tsx:82-84
const [selectionMode, setSelectionMode] = useState(false)
const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
```

**Files Checked:**
- ShotListPage.tsx (921 lines) - No batch delete logic
- ShotListToolbar.tsx - Only sort/filter/search controls
- ShotsTable.tsx (393 lines) - Selection checkbox UI, no delete handlers
- BulkShotWrites.ts - Only handles bulk creation, not deletion

**Missing Features:**
1. No batch delete action in selection toolbar
2. No bulk delete API function
3. No confirmation dialog for multiple shots
4. No delete-to-archive conversion

---

## 2. Shot Views

### Current Implementation

**THREE DISTINCT VIEW MODES: EXISTS**

**Type Definition:** `/src-vnext/features/shots/lib/shotListFilters.ts` (Line 11)
```typescript
export type ViewMode = "gallery" | "visual" | "table"
```

#### View Mode Details

| Mode | Location | Renders | Properties |
|------|----------|---------|-----------|
| **Gallery** | ShotCard.tsx | Grid of card items | Title, hero thumb, readiness badge |
| **Visual** | ShotVisualCard.tsx | Enhanced grid layout | Title, description, image, location |
| **Table** | ShotsTable.tsx (393 lines) | Data table | Fully customizable (11 fields) |

**Property Customization: YES**

Default fields in `/src-vnext/features/shots/lib/shotListFilters.ts` (Lines 30-43):
```typescript
export const DEFAULT_FIELDS: ShotsListFields = {
  heroThumb: true,
  shotNumber: true,
  description: true,
  notes: false,
  readiness: true,
  tags: true,
  date: true,
  location: true,
  products: true,
  links: false,
  talent: true,
  updated: false,
}
```

**UI Controls:** `/src-vnext/features/shots/components/ShotListDisplaySheet.tsx`

Users can:
- Toggle individual fields on/off
- Select presets: "Storyboard", "Full Details", "Compact" (Lines 76-100)
- Reset to defaults
- View is stored in localStorage with key pattern: `{storageKeyBase}:displayPrefs:v1`

#### Gallery View
- **File:** ShotCard.tsx
- **Shows:** Title, hero image thumb, status, readiness badge, optional shot number
- **Responsive:** Yes (mobile and desktop optimized)
- **Interactive:** Click to open detail view

#### Visual View
- **File:** ShotVisualCard.tsx  
- **Shows:** Hero image, title, description preview, location, products, talent
- **Layout:** Grid with larger cards than gallery
- **Behavior:** Similar to gallery but more detailed

#### Table View
- **File:** ShotsTable.tsx (393 lines)
- **Columns:** 12 possible columns (all customizable)
- **Features:**
  - Inline status editing (ShotStatusSelect component)
  - Hero image thumbnail (40x40px)
  - Multi-select checkboxes
  - Column ordering matches field toggles
  - Responsive table with horizontal scroll

**Differences Between Gallery and Visual:**
- Gallery: Compact cards, primarily visual focus
- Visual: Larger cards with extended text/product info
- Table: Columnar format, text-focused, sortable

**Code Evidence:**
```typescript
// ShotListPage.tsx - View mode state (line 127)
const [viewMode, setViewMode] = useState<ViewMode>(() => {
  const stored = window.localStorage.getItem(...)
  return (stored as ViewMode) || "gallery"
})

// ShotListToolbar.tsx - View mode selector (line 40)
readonly viewMode: ViewMode
readonly onViewModeChange: (mode: ViewMode) => void
```

### Toggle/Customize Support

**Full support for customization:**
- Display sheet provides checkboxes for each field
- Changes persist to localStorage
- Applies to all views that support field display
- Gallery/Visual ignore some fields (simplified rendering)
- Table view uses all field settings

---

## 3. Shoot Readiness / Product Selection

### Priority Computation

**Location:** `/src-vnext/features/products/lib/shootReadiness.ts`

**Main Function:** `computeSuggestedShootWindow()` (Lines 30-128)

**Priority Levels Computed:**

The system uses a **confidence-based readiness model** rather than simple low/medium/high tags:

```typescript
export type ShootWindow = {
  readonly suggestedStart: Date | null
  readonly suggestedEnd: Date | null
  readonly confidence: "high" | "medium" | "low"
  readonly constraints: ReadonlyArray<string>
  readonly tier: "full" | "request_only" | "samples_only"
}
```

**Priority Determination Logic:**

1. **Confidence Level** (HIGH/MEDIUM/LOW):
   - **HIGH:** All samples arrived AND launch window ≥14 days
   - **MEDIUM:** Partial readiness or adequate timeline (0-14 days)
   - **LOW:** Deadline passed, no timeline, or missing critical data

2. **Tier Classification:**
   - **"full"** - Launch date + samples + deadline all present
   - **"request_only"** - Only deadline, no samples/launch
   - **"samples_only"** - Only samples, no launch/deadline

3. **Key Constraints Tracked** (Lines 60-117):
   - "Launch date requires shoot completion 14 days before"
   - "Shot request deadline is tighter constraint"
   - "All samples arrived"
   - "Waiting on sample arrival"
   - "Samples pending with no ETA"
   - "Window is overdue or too tight"
   - "Deadline has passed"

**Input Parameters:**
```typescript
interface ShootReadinessItem {
  readonly familyId: string
  readonly familyName: string
  readonly launchDate: Timestamp | null          // Product launch date
  readonly totalSkus: number
  readonly skusWithFlags: number
  readonly samplesArrived: number
  readonly samplesTotal: number
  readonly readinessPct: number
  readonly shootWindow: ShootWindow | null
  readonly requestDeadline?: string | null        // Shoot request deadline
}
```

**Past Launch Window Handling:**

Lines 112-117 show explicit logic:
```typescript
} else if (latestShootMs !== null && latestShootMs <= now) {
  confidence = "low"
  constraints.push("Deadline has passed")
}
```

When a product's launch date is in the past (and shoot deadline has passed):
- Confidence becomes "low"
- Constraint message added: "Deadline has passed"
- `suggestedEnd` is set to the passed deadline date
- Tier remains computed based on what data exists

**Visual Display:** `/src-vnext/features/dashboard/components/ShootReadinessWidget.tsx`

The widget displays:
- Product family name
- Confidence badge (HIGH ✓ / MEDIUM / LOW in color-coded badges)
- Readiness percentage bar (green ≥80%, amber ≥40%, red <40%)
- Sample status (e.g., "12/15 samples")
- Shoot window dates (start/end)
- Expandable constraint details

### Product Selection from Shoot Readiness

**File:** `/src-vnext/features/dashboard/components/ShootReadinessWidget.tsx`

**Selection Pattern:**

Users can select product families from the readiness widget to bulk-add to projects:

```typescript
// Lines 13-15
import {
  useProductSelection,
  makeFamilySelectionId,
} from "@/features/products/hooks/useProductSelection"
```

**Granularity of Selection:**
- Products selected as **product families** (not SKUs/colorways)
- Selection ID format: `makeFamilySelectionId(familyId, familyName)`
- Later: Converted to shots via BulkAddToProjectDialog

**Bulk Add Dialog:** `/src-vnext/features/products/components/BulkAddToProjectDialog.tsx`

Once families are selected, the dialog offers:
```typescript
type Granularity = "family" | "sku"
```

Users can choose:
1. **Add by Family** - One shot per product family
2. **Add by SKU** - One shot per SKU (more granular)

**Code Evidence:**
```typescript
// BulkAddToProjectDialog.tsx:29-48
function buildFamilyItems(families: readonly SelectedFamily[]): BulkShotItem[] {
  const seen = new Set<string>()
  const result: BulkShotItem[] = []
  for (const f of families) {
    if (!seen.has(f.familyId)) {
      seen.add(f.familyId)
      result.push({ familyId: f.familyId, familyName: f.familyName })
    }
  }
  return result
}

function buildSkuItems(skus: readonly SelectedSku[]): BulkShotItem[] {
  return skus.map((s) => ({
    familyId: s.familyId,
    familyName: s.familyName,
    skuId: s.skuId,
    skuName: s.skuName,
  }))
}
```

**Limitation:** No specific colorway/SKU selection from Shoot Readiness widget itself. Granularity choice only appears in the bulk add dialog.

**Flow:**
1. User selects families in ShootReadinessWidget
2. Opens BulkAddToProjectDialog
3. Chooses "Family" or "SKU" granularity
4. Selects target project
5. `bulkCreateShotsFromProducts()` creates shots

---

## 4. Priority Tags

**COVERED UNDER SECTION 3 - Shoot Readiness**

The priority system is **confidence-based**, not traditional tag-based:
- No "priority" field on shots
- Confidence computed at product family level
- Displays in ShootReadinessWidget with badges
- Constraints provide additional context

The computation is sophisticated with 3 confidence levels and detailed constraint tracking.

---

## 5. Page Transitions / Route Animations

### Current State: NO ANIMATIONS

**Router Setup:** `/src-vnext/app/App.tsx` (Lines 1-21)

```typescript
export function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <SearchCommandProvider>
            <AppRoutes />
            <Toaster position="bottom-right" richColors closeButton />
          </SearchCommandProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
```

**Evidence of NO animations:**
1. No `framer-motion` import
2. No `AnimatePresence` wrapper
3. No `motion.*` components
4. BrowserRouter directly wraps AppRoutes

**Package Analysis:**

From `/package.json`, animation libraries checked:
- ❌ framer-motion - NOT installed
- ❌ react-transition-group - NOT installed
- ❌ react-spring - NOT installed

**Installed Animation Support:**
- ✓ @dnd-kit/* (drag-and-drop only)
- ✓ react-resizable-panels (panel animations only)
- ✓ CSS transitions via Tailwind (inline styles)

**Navigation Behavior:**
- Instant page transitions
- No fade-in/fade-out
- No slide animations
- No loading state transitions (except internal spinners)

**Example Navigation:**
```typescript
// ShotListPage.tsx:62
navigate(`/projects/${projectId}/shots/${shotId}`)
```

Direct navigation with no animation wrapper.

**Three-Panel Layout:** `/src-vnext/features/shots/components/ThreePanelLayout.tsx`

Uses react-resizable-panels for panel animations, but not route transitions.

### Recommendation Areas:
- Route transition animations would enhance perceived performance
- Could add fade-in effect to route components
- Consider framer-motion for AnimatePresence + page variants

---

## 6. Export/PDF System

### Current Implementation: FULLY FEATURED

**Export Capabilities:**

1. **Single Shot PDF Export**
   - File: `/src-vnext/features/shots/components/ShotPdfExportDialog.tsx` (150+ lines)
   - Customization options: Orientation, hero image, description, notes inclusion

2. **Batch/Multiple Shots PDF Export**
   - File: `/src-vnext/features/shots/components/ShotsPdfExportDialog.tsx`
   - Supports exporting multiple selected shots

**PDF Templates:**
- File: `/src-vnext/features/shots/lib/shotsPdfTemplates.tsx`
- Uses `@react-pdf/renderer` library (version 3.4.4)
- Component: `ShotDetailPdfDocument` renders shot data as PDF

**Export Dialog Features:**

From ShotPdfExportDialog.tsx (Lines 43-100):

```typescript
export function ShotPdfExportDialog({
  open,
  onOpenChange,
  projectName,
  shot,
  talentNameById,
  locationNameById,
  storageKeyBase,
}: {
  readonly open: boolean
  readonly onOpenChange: (next: boolean) => void
  readonly projectName: string
  readonly shot: Shot
  readonly talentNameById?: ReadonlyMap<string, string> | null
  readonly locationNameById?: ReadonlyMap<string, string> | null
  readonly storageKeyBase?: string | null
})
```

**User Controls:**
```typescript
const [orientation, setOrientation] = useState<ShotsPdfOrientation>("portrait")
const [includeHero, setIncludeHero] = useState(true)
const [includeDescription, setIncludeDescription] = useState(true)
const [includeNotesAddendum, setIncludeNotesAddendum] = useState(true)
```

**Customization Options:**
1. **Orientation:** Portrait or Landscape
2. **Include Hero Image:** Checkbox
3. **Include Description:** Checkbox
4. **Include Notes Addendum:** Checkbox

**Preferences Persistence:**
- Stored in localStorage with key: `${storageKeyBase}:shotPdfExport:v1`
- Automatically restores user preferences on dialog open

**PDF Download Function:**
```typescript
// Lines 14-23
function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
```

**Filename Generation:**
```typescript
function safeFileName(name: string): string {
  return name.replace(/[^\w\s.-]+/g, "").trim().replace(/\s+/g, " ")
}
```

**PDF Image Handling:**
- File: `/src-vnext/features/shots/lib/resolvePdfImageSrc.ts`
- Converts images to base64 for PDF embedding
- Uses canvas API for image processing
- Handles JPEG compression (JPEG_QUALITY constant)

```typescript
const canvas = document.createElement("canvas")
canvas.width = width
canvas.height = height
const ctx = canvas.getContext("2d")
if (!ctx) throw new Error("Missing canvas 2d context")
// ... image drawing logic
return canvas.toDataURL("image/jpeg", JPEG_QUALITY)
```

**Batch Shot PDF Building:**
- File: `/src-vnext/features/shots/lib/buildShotsPdfRows.ts`
- Function: `buildShotsPdfRows()` organizes multiple shots for PDF
- Handles layout, grouping, and row organization

**UI Locations:**
- ShotListPage.tsx: "Export" button in toolbar (line 37)
- ShotDetailPage.tsx: Export action in menu
- Shots Table: Selection export action

**Dependencies:**
```json
"@react-pdf/renderer": "^3.4.4"
```

### Templates & Customization

PDF templates support:
- ✓ Single shot layout
- ✓ Multiple shots per page
- ✓ Product information display
- ✓ Hero image embedding
- ✓ Talent/Location references
- ✓ Tags display
- ✓ Readiness indicators

---

## 7. Talent/Locations Views

### Talent Views: CARD/GRID ONLY (NO TABLE)

**File:** `/src-vnext/features/library/components/LibraryTalentPage.tsx` (100+ lines)

**View Type:** Custom grid/card layout with detail panel

**Features:**
- Search filtering (query field)
- Filter sheet (TalentSearchFilters) for advanced filtering
- Detail panel view (TalentDetailPanel.tsx)
- Headshot thumbnails (HeadshotThumb.tsx)
- Casting brief mode with scoring

**Code Evidence:**
```typescript
// LibraryTalentPage.tsx:1-100
// No table component imported
// No viewMode selection
// Only uses card/detail layouts

// Lines 49-50: Only detail panel references
import { TalentDetailPanel } from "@/features/library/components/TalentDetailPanel"
```

**Layout Components:**
- HeadshotThumb.tsx - Renders talent thumbnail images
- TalentDetailPanel.tsx - Side panel with full talent details
- TalentSearchFilters.tsx - Advanced filter controls
- TalentInlineEditors.tsx - Inline editing in detail panel

**View Structure:**
```
LibraryTalentPage
├── SearchBar (query)
├── FilterToolbar
├── TalentGrid (custom layout)
│   └── TalentCard items
│       ├── Headshot thumbnail
│       └── Name + quick info
└── TalentDetailPanel (side)
    ├── Full details
    ├── Headshot gallery
    └── Casting sessions
```

**No Table View:** The component uses grid layout with detail panel, not columnar table.

### Locations Views: CARD/GRID ONLY (NO TABLE)

**File:** `/src-vnext/features/library/components/LibraryLocationsPage.tsx` (100+ lines)

**View Type:** Simple list with inline editing

**Features:**
- Simple text search (location name, address, phone, notes)
- Click to navigate to detail page
- Create location dialog
- No grid/card visual, just list navigation

**Code Evidence:**
```typescript
// LibraryLocationsPage.tsx:31-46
const filtered = useMemo(() => {
  const q = query.trim().toLowerCase()
  if (!q) return locations
  return locations.filter((loc) => {
    const name = loc.name.toLowerCase()
    const address = (loc.address ?? "").toLowerCase()
    const phone = (loc.phone ?? "").toLowerCase()
    const notes = (loc.notes ?? "").toLowerCase()
    return (...)
  })
}, [locations, query])
```

**View Structure:**
```
LibraryLocationsPage
├── SearchBar (query)
├── LocationsList
│   └── LocationItem (navigate to detail)
│       └── Name display
└── LocationDetailPage (separate route)
    ├── Photo
    ├── Address, phone, notes
    └── Inline editors
```

**Location Detail Page:** `/src-vnext/features/library/components/LocationDetailPage.tsx`

Full detail editing available on dedicated page:
- Photo upload/management
- Name, address, phone inline editing
- Notes textarea
- Delete location

**No Table Views:** Neither talent nor locations have table/columnar views.

**Comparison with Shots:**

| Feature | Shots | Talent | Locations |
|---------|-------|--------|-----------|
| Card View | ✓ Gallery | ✓ Grid | ✗ None |
| Table View | ✓ Table | ✗ Missing | ✗ Missing |
| Detail Panel | ✓ (Desktop three-panel) | ✓ Side panel | ✓ Separate page |
| View Toggle | ✓ (gallery/visual/table) | ✗ Single view | ✗ Single view |
| Search | ✓ Query | ✓ Query | ✓ Query |
| Filters | ✓ Advanced | ✓ Advanced | ✗ Search only |

### Recommendation:
Table views for Talent and Locations would enable:
- Batch operations (delete, assign to projects)
- Column sorting
- Inline field editing
- Comparison view of multiple records

---

## 8. Image Editing

### Current Capabilities: IMAGE UPLOAD ONLY (NO EDITING)

**Hero Image Upload:** `/src-vnext/features/shots/components/HeroImageSection.tsx`

**Features:**
```typescript
// Lines 31-45
const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file || !clientId) return

  // Reset input so same file can be re-selected
  e.target.value = ""

  try {
    validateImageFileForUpload(file)
  } catch (err) {
    toast.error("Upload failed", { description: formatUploadError(err) })
    return
  }

  setUploading(true)
  try {
    const result = await uploadHeroImage(file, clientId, shotId)
    // ... update shot
  }
}
```

**Available Controls:**
- ✓ Upload new image
- ✓ Replace existing image  
- ✓ Reset to auto (if manually set)
- ✗ Crop/resize
- ✗ Canvas editing
- ✗ Color adjustment
- ✗ Filter effects

**Image Processing (PDF Only):**
- File: `/src-vnext/features/shots/lib/resolvePdfImageSrc.ts`
- **Purpose:** Prepare images for PDF export
- **Processing:**
  - Canvas-based image scaling
  - JPEG compression
  - Base64 encoding

```typescript
// Lines 1-30
const JPEG_QUALITY = 0.85
const MAX_PDF_IMAGE_WIDTH = 400
const MAX_PDF_IMAGE_HEIGHT = 600

async function resolvePdfImageSrc(
  imagePath: string,
  options?: { readonly width?: number; readonly height?: number },
): Promise<string> {
  const width = options?.width ?? MAX_PDF_IMAGE_WIDTH
  const height = options?.height ?? MAX_PDF_IMAGE_HEIGHT

  const img = new Image()
  img.src = imagePath

  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Missing canvas 2d context")

  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY)
}
```

**Note:** This is PDF-specific image processing, not user-facing editing.

**Image Data Structure:**
From `/src-vnext/features/shots/lib/mapShot.ts`, crops are stored:
```typescript
cropData: obj["cropData"]
```

But no UI component implements crop UI.

### What's Missing:
1. **Image Cropping Tool** - No crop dialog or component
2. **Canvas Editor** - No canvas manipulation UI
3. **Inline Image Editing** - No editor on shot detail
4. **Resize Controls** - No dimension adjustment
5. **Filter/Effects** - No adjustment sliders

### What Could Be Added:
- `react-easy-crop` or `easy-image-cropper` library for cropping
- Canvas-based drawing tools for annotations
- Image adjustment sliders (brightness, contrast, etc.)

---

## Summary Table

| Feature | Status | Location | Fully Implemented |
|---------|--------|----------|------------------|
| Single Shot Delete | ✓ | ShotLifecycleActionsMenu.tsx | Yes |
| Batch Delete | ✗ | Missing | No |
| Gallery View | ✓ | ShotCard.tsx | Yes |
| Visual View | ✓ | ShotVisualCard.tsx | Yes |
| Table View | ✓ | ShotsTable.tsx | Yes |
| Customizable Fields | ✓ | ShotListDisplaySheet.tsx | Yes |
| Shoot Readiness | ✓ | shootReadiness.ts | Yes |
| Priority Logic | ✓ | shootReadiness.ts | Yes (confidence-based) |
| Product Selection | ✓ | BulkAddToProjectDialog.tsx | Yes (family/SKU) |
| Page Transitions | ✗ | App.tsx | No |
| Single Shot PDF | ✓ | ShotPdfExportDialog.tsx | Yes |
| Batch PDF Export | ✓ | ShotsPdfExportDialog.tsx | Yes |
| PDF Customization | ✓ | ShotPdfExportDialog.tsx | Yes (4 options) |
| Talent Table View | ✗ | Missing | No |
| Locations Table View | ✗ | Missing | No |
| Image Cropping | ✗ | Missing | No |
| Image Canvas Editor | ✗ | Missing | No |

---

## Code Statistics

**Total Files Analyzed:** 50+ components and libraries

**Key Files by Size:**
- ShotListPage.tsx: 921 lines (main shots list coordinator)
- ShotsTable.tsx: 393 lines (table view component)
- shotLifecycleActions.ts: 240 lines (shot operations)
- ShootReadinessWidget.tsx: 150+ lines (readiness display)
- ShotPdfExportDialog.tsx: 150+ lines (PDF export dialog)

**Testing Coverage:**
- 30+ test files found in `__tests__/` directories
- Comprehensive unit tests for:
  - Shot lifecycle (copy, move, delete)
  - PDF generation
  - Filters and sorting
  - Batch operations
  - Talent/Location operations

---

## Recommendations

### High Priority (User Impact)
1. **Implement Batch Delete** - Add delete action to shot selection toolbar
2. **Add Table Views for Talent/Locations** - Enable batch operations and column sorting
3. **Page Transition Animations** - Improve perceived performance with fade/slide effects
4. **Image Cropping Tool** - Allow users to edit shot hero images

### Medium Priority (Experience Enhancement)
5. **Advanced Product Selection** - Allow SKU/colorway selection in Shoot Readiness widget
6. **Batch Location/Talent Operations** - Based on table view implementation
7. **Export Presets** - Save and recall PDF export configurations

### Low Priority (Polish)
8. **Image Adjustment UI** - Brightness, contrast sliders
9. **Talent Headshot Gallery View** - Better visual browsing
10. **Location Photo Gallery** - Photo management improvements

---

## Conclusion

The Production Hub vNext codebase demonstrates solid architectural foundations with:
- ✓ Sophisticated readiness computation
- ✓ Three-view system with customization
- ✓ Comprehensive PDF export capabilities
- ✓ Soft-delete pattern for data safety

Key gaps identified:
- ✗ No batch operations for shots/talent/locations
- ✗ No page transition animations
- ✗ Image editing limited to upload only
- ✗ Limited view modes for library features

The codebase is production-ready and well-tested, with clear opportunities for UX enhancement through the recommendations above.

