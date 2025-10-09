# Phase 11E: Extended Bulk Operations - Development Session

**Status**: ✅ In Progress
**Branch**: `feat/phase11e-extended-bulk-operations`
**Start Date**: 2025-10-09

## Objective

Extend the bulk operations system introduced in Phase 11C to support editing multiple shot properties beyond tags. This enables users to efficiently update location, date, type, and project assignment for multiple shots at once.

## Context

- **Phase 11C** (Complete): Introduced bulk tagging system with BulkTaggingToolbar component
- **Phase 11D** (Complete): Added Tag Management Dashboard for organizing tags
- **Current State**: 14 phases complete, PRs #176 and #177 ready for review
- **Patterns Established**:
  - Set-based selection (O(1) lookups)
  - Firestore batch writes (500 operation limit)
  - Race condition protection with `isProcessingBulk` flag
  - serverTimestamp() for updatedAt tracking
  - Toast notifications for user feedback

## Phase 11E Scope

### 1. Bulk Location Editing
- Select multiple shots
- Set location for all selected shots
- Maintain reverse index (location.shotIds)
- Clear location option

### 2. Bulk Date Editing
- Select multiple shots
- Set scheduled date for all selected shots
- Clear date option
- Date picker UI component

### 3. Bulk Type Editing
- Select multiple shots
- Change shot type for all selected shots
- Dropdown with predefined types
- Clear type option

### 4. Bulk Move to Project
- Select multiple shots
- Move shots to a different project
- Update projectId field
- Maintain reverse indexes
- Confirmation prompt for destructive action

### 5. Bulk Copy to Project
- Select multiple shots
- Duplicate shots to a different project
- Create new documents with new IDs
- Copy all properties except timestamps
- Set createdAt/updatedAt for new documents

## Technical Implementation Plan

### Architecture Changes

#### Component Structure
```
src/components/shots/
├── BulkTaggingToolbar.jsx (existing)
└── BulkOperationsToolbar.jsx (new - extends tagging toolbar)
    ├── Tag operations section (from BulkTaggingToolbar)
    ├── Property operations section (new)
    │   ├── Location dropdown
    │   ├── Date picker
    │   ├── Type dropdown
    │   └── Project operations (move/copy)
    └── Shared UI patterns
```

#### ShotsPage.jsx Extensions
Add new bulk operation handlers:
- `handleBulkSetLocation(locationId)`
- `handleBulkSetDate(dateValue)`
- `handleBulkSetType(typeValue)`
- `handleBulkMoveToProject(targetProjectId)`
- `handleBulkCopyToProject(targetProjectId)`

### Implementation Details

#### 1. Bulk Location Handler
```javascript
const handleBulkSetLocation = useCallback(async (locationId) => {
  // Validation
  if (!canEditShots || selectedShots.length === 0) return;
  if (isProcessingBulk) {
    toast.info({ title: "Please wait", description: "Another operation is in progress." });
    return;
  }

  setIsProcessingBulk(true);
  try {
    let batch = writeBatch(db);
    let updateCount = 0;

    // Get location name for denormalization
    const locationName = locationId
      ? locations.find((loc) => loc.id === locationId)?.name || null
      : null;

    // Process shots in batches of 500
    for (let i = 0; i < selectedShots.length; i++) {
      const shot = selectedShots[i];
      const shotDocRef = docRef(...currentShotsPath, shot.id);

      batch.update(shotDocRef, {
        locationId: locationId || null,
        locationName: locationName,
        updatedAt: serverTimestamp()
      });
      updateCount++;

      // Commit every 500 operations
      if (updateCount === 500) {
        await batch.commit();
        batch = writeBatch(db);
        updateCount = 0;
      }
    }

    // Commit remaining operations
    if (updateCount > 0) {
      await batch.commit();
    }

    // Update reverse indexes (location.shotIds)
    // This happens in the onSnapshot listener for shots
    // which maintains the reverse indexes

    toast.success({
      title: "Location updated",
      description: `Updated location for ${selectedShots.length} shot${
        selectedShots.length === 1 ? "" : "s"
      }.`,
    });

    // Clear selection
    setSelectedShotIds(new Set());
  } catch (error) {
    const { code, message } = describeFirebaseError(error, "Unable to update location.");
    console.error("[Shots] Failed to update location in bulk", {
      error,
      shotCount: selectedShots.length,
      locationId
    });
    toast.error({ title: "Failed to update location", description: `${code}: ${message}` });
  } finally {
    setIsProcessingBulk(false);
  }
}, [canEditShots, selectedShots, currentShotsPath, db, locations, isProcessingBulk]);
```

#### 2. Bulk Date Handler
```javascript
const handleBulkSetDate = useCallback(async (dateValue) => {
  // Similar pattern to location handler
  // Use parseDateToTimestamp helper
  // Store as Firestore Timestamp or null
}, [canEditShots, selectedShots, currentShotsPath, db, isProcessingBulk]);
```

#### 3. Bulk Type Handler
```javascript
const handleBulkSetType = useCallback(async (typeValue) => {
  // Similar pattern to location handler
  // Validate type against allowed values if needed
}, [canEditShots, selectedShots, currentShotsPath, db, isProcessingBulk]);
```

#### 4. Bulk Move to Project
```javascript
const handleBulkMoveToProject = useCallback(async (targetProjectId) => {
  // Confirmation prompt
  const confirmed = await showConfirm(
    `Move ${selectedShots.length} shot${selectedShots.length === 1 ? "" : "s"} to this project? ` +
    `They will no longer appear in the current project.`
  );
  if (!confirmed) return;

  setIsProcessingBulk(true);
  try {
    let batch = writeBatch(db);
    let updateCount = 0;

    for (let i = 0; i < selectedShots.length; i++) {
      const shot = selectedShots[i];
      const shotDocRef = docRef(...currentShotsPath, shot.id);

      batch.update(shotDocRef, {
        projectId: targetProjectId,
        laneId: null, // Reset lane assignment
        updatedAt: serverTimestamp()
      });
      updateCount++;

      if (updateCount === 500) {
        await batch.commit();
        batch = writeBatch(db);
        updateCount = 0;
      }
    }

    if (updateCount > 0) {
      await batch.commit();
    }

    toast.success({
      title: "Shots moved",
      description: `Moved ${selectedShots.length} shot${
        selectedShots.length === 1 ? "" : "s"
      } to the selected project.`,
    });

    setSelectedShotIds(new Set());
  } catch (error) {
    // Error handling
  } finally {
    setIsProcessingBulk(false);
  }
}, [canEditShots, selectedShots, currentShotsPath, db, isProcessingBulk]);
```

#### 5. Bulk Copy to Project
```javascript
const handleBulkCopyToProject = useCallback(async (targetProjectId) => {
  setIsProcessingBulk(true);
  try {
    const copiedShots = [];

    // Create new documents with addDoc
    for (let i = 0; i < selectedShots.length; i++) {
      const shot = selectedShots[i];

      // Copy all properties except id and timestamps
      const shotData = {
        name: shot.name,
        description: shot.description || "",
        type: shot.type || "",
        date: shot.date || null,
        locationId: shot.locationId || null,
        locationName: shot.locationName || null,
        projectId: targetProjectId,
        laneId: null, // Don't assign to any lane initially
        status: shot.status || "todo",
        products: Array.isArray(shot.products) ? shot.products : [],
        productIds: Array.isArray(shot.productIds) ? shot.productIds : [],
        talent: Array.isArray(shot.talent) ? shot.talent : [],
        talentIds: Array.isArray(shot.talentIds) ? shot.talentIds : [],
        tags: Array.isArray(shot.tags) ? shot.tags : [],
        notes: shot.notes || "",
        thumbPath: shot.thumbPath || null, // Copy reference to same image
        createdAt: serverTimestamp(),
        createdBy: user?.uid || null,
        updatedAt: serverTimestamp()
      };

      const newDocRef = await addDoc(
        collRef(...currentShotsPath),
        shotData
      );
      copiedShots.push(newDocRef.id);
    }

    toast.success({
      title: "Shots copied",
      description: `Copied ${copiedShots.length} shot${
        copiedShots.length === 1 ? "" : "s"
      } to the selected project.`,
    });

    setSelectedShotIds(new Set());
  } catch (error) {
    // Error handling
  } finally {
    setIsProcessingBulk(false);
  }
}, [canEditShots, selectedShots, currentShotsPath, db, user, isProcessingBulk]);
```

### UI Component Design

#### BulkOperationsToolbar Layout
```
┌─────────────────────────────────────────────────────────────────────┐
│ 5 shots selected                                      [Clear]       │
│ ──────────────────────────────────────────────────────────────────  │
│                                                                       │
│ Tags:  [+ Apply Tags ▼]  [- Remove Tags ▼]                         │
│                                                                       │
│ Properties:  [📍 Location ▼]  [📅 Date ▼]  [🎬 Type ▼]            │
│                                                                       │
│ Project:  [→ Move to Project ▼]  [⎘ Copy to Project ▼]            │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Model

#### Shot Document Structure
```javascript
{
  id: "shot-abc123",
  name: "Product Close-up",
  description: "...",
  type: "product", // NEW: can be bulk edited
  date: Timestamp | null, // NEW: can be bulk edited
  locationId: "loc-xyz", // NEW: can be bulk edited
  locationName: "Studio A", // Denormalized
  projectId: "proj-123", // NEW: can be bulk edited via move
  laneId: "lane-456" | null,
  products: [...],
  productIds: [...],
  talent: [...],
  talentIds: [...],
  tags: [...],
  createdAt: Timestamp,
  createdBy: "user-id",
  updatedAt: Timestamp // CRITICAL: Must be updated in all bulk operations
}
```

## Testing Strategy

### Unit Tests
- Test each bulk handler independently
- Verify batch write structure
- Confirm updatedAt timestamp inclusion
- Test error handling

### Integration Tests
```javascript
// src/pages/__tests__/ShotsPage.bulkOperations.test.jsx
describe("ShotsPage bulk operations", () => {
  it("updates location for multiple shots with updatedAt", async () => {
    // Test bulk location update
  });

  it("updates date for multiple shots with updatedAt", async () => {
    // Test bulk date update
  });

  it("updates type for multiple shots with updatedAt", async () => {
    // Test bulk type update
  });

  it("moves shots to different project", async () => {
    // Test bulk move
  });

  it("copies shots to different project", async () => {
    // Test bulk copy creates new documents
  });

  it("handles batch commits correctly for >500 operations", async () => {
    // Test batching logic
  });
});
```

### Manual Test Cases
1. Select 3 shots, bulk set location → Verify all updated
2. Select 10 shots, bulk set date → Verify all updated
3. Select 5 shots, bulk change type → Verify all updated
4. Select 2 shots, move to different project → Verify removed from current view
5. Select 3 shots, copy to different project → Verify originals remain
6. Select 501 shots, bulk operation → Verify batching works
7. Trigger operation while another is in progress → Verify race condition protection

## Risk Assessment

### Low Risk
- ✅ Patterns already established in Phase 11C
- ✅ Data model already supports these operations
- ✅ Firestore batching well understood

### Medium Risk
- ⚠️ Reverse index maintenance for location.shotIds
- ⚠️ Copy operation creates many new documents (quota considerations)
- ⚠️ Move operation is destructive (requires confirmation)

### Mitigation
- Maintain existing reverse index update patterns from ShotsPage
- Add confirmation prompts for destructive operations
- Document quotas and limits in code comments
- Comprehensive error logging

## Success Criteria

- [ ] All 5 bulk operations implemented and functional
- [ ] Race condition protection in place
- [ ] updatedAt timestamps included in all operations
- [ ] Reverse indexes maintained correctly
- [ ] Confirmation prompts for destructive operations
- [ ] Toast notifications provide clear feedback
- [ ] Selection clears after successful operations
- [ ] Error states handled gracefully
- [ ] Tests passing (100% of bulk operation test suite)
- [ ] Build successful
- [ ] Documentation updated
- [ ] PR created and ready for review

## Implementation Timeline

- **Setup & Planning**: 30 minutes ✅ Complete
- **Extend UI Component**: 45 minutes
- **Implement Location/Date/Type Handlers**: 60 minutes
- **Implement Move/Copy Handlers**: 60 minutes
- **Testing**: 45 minutes
- **Documentation & PR**: 30 minutes
- **Total**: ~4 hours

## Files Modified

1. `src/components/shots/BulkOperationsToolbar.jsx` (new, extends BulkTaggingToolbar)
2. `src/pages/ShotsPage.jsx` (add bulk operation handlers)
3. `src/pages/__tests__/ShotsPage.bulkOperations.test.jsx` (new test file)
4. `docs/MOCKUP_INTEGRATION_ASSESSMENT.md` (update Phase 11E status)
5. `PHASE11E_EXTENDED_BULK_OPERATIONS_SESSION.md` (this file)

## Notes

- Reuse BulkTaggingToolbar patterns for consistency
- Keep toolbar UI clean and organized by operation category
- Ensure all operations follow the same error handling pattern
- Remember: updatedAt timestamp in EVERY bulk operation (learned from Phase 11C bug)
- Consider UX: Don't auto-close dropdowns until operation completes
- Add loading indicators during operations
- Batch writes automatically handle 500 operation limit
