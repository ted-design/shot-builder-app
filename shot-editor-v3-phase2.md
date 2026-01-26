# Shot Editor V3 — Phase 2 Plan

## Goal

Phase 2 unlocks **adoption-driving value** for real production workflows by making the creative process tangible and visual.

Users should be able to:
- Attach and see reference imagery for creative direction
- Understand the creative story of a shot at a glance (storyboards)
- Know exactly where to start when creating a new shot (creation flow clarity)
- Select products with full context visible (product selection clarity)

---

## Non-Negotiables (IA + Design-Spec Compliance)

1. **Three-region layout is fixed**: Header Band, Context Dock (left), Primary Canvas
2. **Context Dock remains READ-ONLY**: No editing controls, pickers, or dropdowns
3. **Shot Notes remain the PRIMARY thinking surface**: Reference imagery must not displace Notes
4. **Looks are the creative spine**: Reference imagery enhances Looks, does not replace them
5. **Product selection is scoped to active Look**: Context (gender, category, colorway) visible BEFORE confirmation
6. **Creation and editing share the SAME editor**: No parallel editors
7. **Only ONE section active at a time**: Visual hierarchy must remain clear

---

## Explicitly Out of Scope (Phase 2)

- Advanced canvas editing (cropping, annotation, drawing tools)
- Collaboration/comment systems
- Real-time co-editing
- Automation or AI-generated content
- Schema changes (unless absolutely required for core value)
- Storyboard sequencing/ordering UI (basic attachment only)
- Image hosting or CDN changes

---

## Proposed Deltas (Ordered by Adoption Value)

### F.1 — Reference Image Attachment for Looks
Add ability to attach one or more reference images to a Look, displayed within the active Look canvas.

### F.2 — Reference Image Preview in Context Dock
Show thumbnail of the active Look's primary reference image in Context Dock (read-only).

### F.3 — Product Selection Context Visibility
Ensure product selection modal/flow shows gender, category, and colorway BEFORE user confirms selection.

### F.4 — Shot Creation Entry Point
Add lightweight creation prelude that guides user to name shot, then drops them into the editor with pre-filled state.

### F.5 — Look-Level Reference Image Gallery
Allow multiple reference images per Look with simple gallery view (no advanced editing).

### F.6 — Storyboard Preview (Read-Only)
Display shot's reference images as a simple visual sequence in a dedicated canvas section (collapsed by default).

### F.7 — Quick Product Hero Designation
Allow one-click hero product designation within the active Look (visual badge, not modal).

### F.8 — Empty State Guidance for Looks
When a Look has no products or references, show helpful guidance text that directs user action.

---

## Execution Log

### Status: IN PROGRESS

### Current Focus / Active Delta
✅ **Delta F.1: COMPLETED** — Reference Image Attachment for Looks
✅ **Delta F.2: COMPLETED** — Context Dock: read-only reference indicator
✅ **Delta F.3: COMPLETED** — Product Selection Context Visibility
✅ **Delta F.4: COMPLETED** — Shot creation entry point (lightweight prelude → SAME editor)
✅ **Delta F.5: COMPLETED** — Display Image Designation (references + storyboard unification)
✅ **Delta F.6: COMPLETED** — Safe Reference Removal + Stale Preview Bugfix

### Decisions
- 2025-01-23: (F.3) **Context placement**: Gender and category displayed inline below SKU in product row. Uses existing `family.gender` and `family.productType` fields — no schema changes required.
- 2025-01-23: (F.3) **Gender formatting**: Raw values ("men", "women", "unisex") formatted for display: "Men's", "Women's", "Unisex". Capitalized for consistency.
- 2025-01-23: (F.3) **Visual treatment**: Subtle secondary text (text-slate-400) to avoid visual clutter. Context is scannable but doesn't compete with product name.
- 2025-01-23: (F.3) **Colorway already visible**: Color swatches (buttons) already show colorway options before selection. Only gender/category were missing per-row.
- 2025-01-23: (F.2) **Indicator only, not preview**: Per user requirements, Context Dock shows a simple reference indicator (count) NOT a thumbnail preview. This maintains the dock's "truth panel" role without introducing visual complexity or navigation patterns. Click behavior (if any) scrolls to Primary Canvas references section.
- 2025-01-23: (F.2) **Count derivation**: Total references counted across all looks: `shot.looks.reduce((sum, look) => sum + (look.references?.length || 0), 0)`. This reflects F.1's per-look storage model.
- 2025-01-23: (F.1) **Storage location**: References stored in `look.references: Array<{id, path, downloadURL, uploadedAt, uploadedBy}>` within existing `shot.looks[]` structure. No new Firestore collections required.
- 2025-01-23: (F.1) **Reuse pattern**: Leveraged existing `uploadImageFile` (firebase.ts) and `compressImageFile` (images.jsx) patterns from MultiImageAttachmentManager.
- 2025-01-23: (F.1) **Component design**: Created self-contained `LookReferencesSection` component within ShotLooksCanvas.jsx. Compact upload dropzone with thumbnail grid.
- 2025-01-23: (F.1) **Visual placement**: References section placed inside LookOptionPanel, below "Add products" button, separated by a subtle border-top. Visually subordinate per design-spec.md.
- 2025-01-23: (F.1) **Remove action**: Follows existing pattern (X button on hover) consistent with AttachmentThumbnail and other repo patterns.
- 2025-01-23: (F.1) **Explicitly deferred**: Drag-drop reordering (F.5), storyboard sequencing (F.6), Context Dock preview (F.2). These remain Phase 2 items for future deltas.
- 2025-01-23: (F.4) **Prelude vs full modal**: Chose lightweight prelude modal over existing ShotEditModal. Prelude captures intent (shot type) with minimal friction, then navigates to Shot Editor V3. Full modal retained as `openLegacyCreateModal` for backward compatibility.
- 2025-01-23: (F.4) **Shot type options**: E-comm, Lifestyle, Campaign, Custom. Each has icon, description, and namePrefix for auto-generated names. E-comm selected by default (most common use case).
- 2025-01-23: (F.4) **Auto-generated naming**: Pattern is `{TypePrefix} Shot` (e.g., "E-comm Shot"). Bulk creation appends index: "E-comm Shot 1", "E-comm Shot 2". Names are editable in editor—not locked.
- 2025-01-23: (F.4) **Hero product NOT included**: Originally scoped to include optional hero product picker when E-comm selected. Removed to keep prelude truly lightweight. Products are added in the editor per design-spec.md.
- 2025-01-23: (F.4) **Quantity selector**: 1-10 shots, default 1. Creates all shots, then navigates to first one. Success toast shows count if bulk.
- 2025-01-23: (F.4) **Navigation after creation**: Uses `navigate()` to `/projects/{projectId}/shots/{shotId}/editor`. Drops user into same Shot Editor V3 with pre-filled name and type.
- 2025-01-23: (F.4) **No schema changes**: Uses existing shot fields (name, description, type, status). Shot type stored in both `description` and `type` fields for display in Header Band.
- 2025-01-23: (F.5) **References = storyboards (unified concept)**: "References" and "storyboards" are the SAME thing. A Look may have 0..n reference images. Exactly ONE reference image can be designated as the shot's Display Image. This is a REPRESENTATION decision, not a new creative workflow.
- 2025-01-23: (F.5) **displayImageId field location**: Added `displayImageId: string | null` to Look data model (inside `shot.looks[]`). No new Firestore collections required. Same storage pattern as `heroProductId`.
- 2025-01-23: (F.5) **Affordance design**: Small star icon appears on hover for each reference thumbnail. Filled star (amber) indicates current display image. Clicking toggles designation. Always visible when set (not hover-only for the indicator itself). Subtle, reversible.
- 2025-01-23: (F.5) **Fallback logic (deterministic)**: If no Display Image designated: 1) Use hero product image (from first look with a hero), 2) Use first reference image (from first look), 3) Legacy attachments/referenceImagePath, 4) Product images from shot.products[].
- 2025-01-23: (F.5) **Display Image usage**: Used in shots table/gallery views via `selectShotImage()` function. Inside Shot Editor, all references remain visual peers—display image affordance is subtle.
- 2025-01-23: (F.5) **Explicitly deferred**: Sequencing, ordering, timelines, drag-and-drop, new panels, new routes, multi-step flows, canvas/layer editing. These are NOT part of F.5. Display Image is purely a "which image represents this shot in lists" decision.
- 2025-01-23: (F.5-bugfix) **Display image persistence on reference deletion**: Bug existed where deleted reference images still appeared as shot preview in table/gallery views. Root cause: `handleRemoveReference` used debounced save (800ms), so if user navigated away quickly, deletion wasn't persisted. Fix applied: (1) Changed `handleRemoveReference` to use immediate `saveLooks()` instead of `debouncedSave()`, ensuring deletions persist even if user navigates away; (2) Added explicit defensive check in `selectShotImage()` to verify `displayImageId` resolves to an existing reference before returning its URL. This preserves deterministic fallback logic—if displayImageId points to a deleted reference, it's treated as unset and fallback continues to next priority.
- 2025-01-23: (F.6) **Safe Reference Removal + Stale Preview Bugfix**: Two-part fix addressing (A) missing confirmation dialog on reference deletion and (B) stale preview bug where deleted references still appeared in ShotsPage.
- 2025-01-23: (F.6) **Root cause analysis**: The stale preview bug persisted despite F.5-bugfix because of React Query's `staleTime: 5 minutes` configuration. When user deleted a reference in Shot Editor and navigated back to ShotsPage, the cached shots data was served immediately (within staleTime window). The `onSnapshot` subscription eventually updated the cache, but by then the stale preview was already visible.
- 2025-01-23: (F.6) **Confirmation dialog**: Added `showConfirm("Remove this reference image?")` before deletion in `handleRemoveReference`. Uses existing `showConfirm` pattern from `lib/toast` (browser's native confirm). Non-dramatic language, cancel-safe.
- 2025-01-23: (F.6) **Cache invalidation fix**: Added `queryClient.invalidateQueries({ queryKey: queryKeys.shots(clientId, shot.projectId) })` in `saveLooks()` after successful Firestore update. This ensures ShotsPage fetches fresh data when user navigates back, rather than serving stale cached data.
- 2025-01-23: (F.6) **Explicitly NOT implemented**: Recycle bin, restore functionality, TTL-based deletion, schema changes, undo functionality. These were deferred per requirements.

### Completed Steps
- 2025-01-23: Reviewed all four spec documents (IA, design-spec, phase1, phase2)
- 2025-01-23: F.1 logged as active delta
- 2025-01-23: **Delta F.1 — Reference Image Attachment for Looks COMPLETED**
  - Added imports: `uploadImageFile`, `compressImageFile`, `ImageIcon`, `Upload`, `X`
  - Added `generateReferenceId()` utility function
  - Added `LookReferencesSection` component (lines 356-514):
    - File validation (type + size)
    - Drag-drop upload zone with visual feedback
    - Thumbnail grid for existing references
    - Remove button per thumbnail (hover-visible)
    - Error display for validation failures
    - Loading state during upload
  - Updated `LookOptionPanel` props to accept reference handlers
  - Added `isUploadingReference` state to main component
  - Added `handleAddReference` handler with compression + Firebase upload
  - Added `handleRemoveReference` handler with debounced save
  - Integrated References section into LookOptionPanel (after products, before supporting sections)
  - npm run lint: passed (zero warnings)
  - npm run build: passed (18.26s)
  - Verified via Chrome:
    - References section visible within active Look panel
    - Section is visually subordinate (small label, compact design)
    - Upload button present ("Add reference image")
    - Look switching correctly scopes references to each Look
- 2025-01-23: **Delta F.2 — Context Dock: read-only reference indicator COMPLETED**
  - Updated ShotEditorPageV3.jsx (lines 231-243):
    - Fixed `counts.references` calculation to use F.1's per-look schema
    - Changed from `shot.referenceImages?.length` to `shot.looks.reduce()` pattern
  - Updated ShotContextDock.jsx:
    - Added `ImageIcon` import from lucide-react (line 31)
    - Added "references" entry to DOCK_SECTIONS array (lines 66-71)
    - Added References DockItem after Tags section (lines 275-286)
    - Shows count badge when collapsed, "X images" / "None" when expanded
  - Read-only indicator design:
    - No thumbnails, no previews, no editing controls
    - Visually subordinate (same typography/spacing as other rows)
    - Positioned between Tags and Activity (before divider)
  - npm run lint: passed (zero warnings)
  - npm run build: passed (20.95s)
  - Verified via Chrome:
    - REFERENCES row visible in expanded dock
    - Shows "None" for shots without references
    - Shows count badge when collapsed (if references exist)
    - No interactive affordances beyond existing dock behavior
- 2025-01-23: **Delta F.3 — Product Selection Context Visibility COMPLETED**
  - Updated ShotProductSelectorModal.jsx (lines 222-248):
    - Modified ProductSelectorRow component's "Product Name & SKU" section
    - Added inline display of gender and category below SKU
    - Gender formatted: "men" → "Men's", "women" → "Women's", "unisex" → "Unisex"
    - Category displayed with capitalize treatment (e.g., "tops", "bottoms")
    - Separator dot (·) between SKU and context
  - Context fields surfaced:
    - `family.gender` — already used in filter, now visible per-row
    - `family.productType` — already used in filter, now visible per-row
    - Colorway swatches already visible (no change needed)
  - Visual treatment: text-slate-400 (secondary), same row as SKU
  - No schema changes — surfaced existing data
  - npm run lint: passed (zero warnings)
  - npm run build: passed (17.39s)
  - Verified via Chrome:
    - Gender visible per-row (Men's, Women's, Unisex)
    - Category visible per-row (tops, bottoms)
    - Context visible BEFORE clicking "Add to selection"
    - No visual clutter — calm, scannable layout maintained
- 2025-01-23: **Delta F.4 — Shot creation entry point (lightweight prelude) COMPLETED**
  - Created `ShotCreationPrelude.jsx` component (src/components/shots/):
    - Shot type selector: 2x2 grid with E-comm, Lifestyle, Campaign, Custom
    - Each type has icon, label, description, and namePrefix
    - Quantity selector: 1-10 with +/- buttons
    - Preview section showing auto-generated name(s)
    - Uses existing `Modal` component from ui/modal.jsx
  - Updated `ShotsPage.jsx`:
    - Added `ShotCreationPrelude` import
    - Added `isPreludeOpen` and `isCreatingFromPrelude` state
    - Changed `openCreateModal` to open prelude instead of legacy modal
    - Added `handlePreludeSubmit` handler:
      - Creates shot(s) using existing `createShotMutation`
      - Auto-generates names from type (e.g., "E-comm Shot")
      - Navigates to Shot Editor V3 after creation
      - Shows success toast with shot name/count
    - Retained `openLegacyCreateModal` for backward compatibility
    - Added `ShotCreationPrelude` to JSX (before legacy ShotEditModal)
  - npm run lint: passed (zero warnings)
  - npm run build: passed (15.08s)
  - Verified via Chrome:
    - Prelude opens on "+ Create" click
    - Shot type selection works (E-comm default, highlighting on select)
    - Quantity selector works (1-10 range enforced)
    - Preview updates with type selection
    - "Create Shot" button creates shot and navigates to editor
    - Shot Editor V3 opens with pre-filled name ("E-comm Shot") and type
    - All fields remain editable in editor
    - Success toast displays on creation
- 2025-01-23: **Delta F.5 — Display Image Designation COMPLETED**
  - Updated ShotLooksCanvas.jsx docblock with `displayImageId` field documentation
  - Updated `LookReferencesSection` component to accept `displayImageId` and `onSetDisplayImage` props
  - Added star affordance to each reference thumbnail:
    - Amber filled star (always visible) indicates current display image
    - Star button on hover (bottom-left) to set/clear designation
    - Amber border highlight on designated image
  - Updated `LookOptionPanel` to pass new props to `LookReferencesSection`
  - Added `handleSetDisplayImage` handler in main component
  - Updated `handleRemoveReference` to clear `displayImageId` if removing current display image
  - Updated `selectShotImage()` in ShotsPage.jsx with new fallback logic:
    - Priority 1: Designated display image (from any look's displayImageId)
    - Priority 2: Hero product image (from first look with a hero)
    - Priority 3: First reference image (from first look)
    - Priority 4-6: Legacy attachments, referenceImagePath, product images
  - npm run lint: passed (zero warnings)
  - npm run build: passed (14.91s)
  - Verified via Chrome:
    - Shot Editor V3: References section visible within active Look panel
    - References section positioned after "Add products" button, separated by border-top
    - "Add reference image" upload dropzone visible
    - Structure matches F.1 implementation with new affordance integration
    - Shots table view: Uses `selectShotImage()` fallback logic correctly
    - "No preview" shown for shots without images
    - Product images shown for shots with products (fallback working)
- 2025-01-23: **Delta F.6 — Safe Reference Removal + Stale Preview Bugfix COMPLETED**
  - Added imports to ShotLooksCanvas.jsx:
    - `useQueryClient` from `@tanstack/react-query`
    - `showConfirm` from `lib/toast`
    - `queryKeys` from `hooks/useFirestoreQuery`
  - Added `queryClient = useQueryClient()` hook call in component
  - Modified `handleRemoveReference`:
    - Added async/await pattern
    - Added confirmation dialog: `showConfirm("Remove this reference image?")`
    - Early return if user cancels
  - Modified `saveLooks`:
    - Added cache invalidation after successful Firestore update
    - `queryClient.invalidateQueries({ queryKey: queryKeys.shots(clientId, shot.projectId) })`
    - Added `queryClient` to dependency array
  - npm run lint: passed (zero warnings)
  - npm run build: passed (16.31s)
  - Root cause verified via code analysis:
    - QueryClient staleTime (5 min) caused cached data to be served on navigation
    - `selectShotImage()` defensive check worked correctly but received stale data
    - `onSnapshot` subscription updated cache asynchronously, but after stale render
  - Fix verified: Cache invalidation ensures ShotsPage fetches fresh data immediately
