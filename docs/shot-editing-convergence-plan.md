# Shot Editing Convergence Plan — Cross-Surface Parity

**Version:** v2.0
**Status:** ✅ COMPLETE
**Last Updated:** 2026-01-25
**Related Documents:**
- `docs/shot-editor-v3-parity-gate.md` (v1.8)
- `docs/shot-editor-v3-ia.md`
- `design-spec.md`
- `shot-editor-v3-phase3.md` (v0.26)

---

## Purpose

This document defines a **cross-surface convergence plan** for shot editing to ensure that:
1. All shot editing surfaces across the app maintain parity with Shot Editor V3
2. Editing capabilities do not drift or diverge across Planner, Call Sheet, and other surfaces
3. A clear migration path exists for consolidating shot editing into a coherent system

---

## 1. Current Surface Inventory

### 1.1 Shot Editor V3 (Primary — Sole Editor for /shots)

**Location:** `src/pages/ShotEditorPageV3.jsx`
**Access Path:** `/projects/:projectId/shots/:shotId/editor`
**Status:** ✅ Authoritative — Sole editor for Shots page (Delta I.10 complete)

**Capabilities:**
- Full shot editing (name, status, description, date, shot number)
- Notes (rich text with autosave)
- Looks system (multi-look support with hero product designation)
- Products (per-look assignment)
- Talent assignment
- Location selection
- Tags management
- Comments section
- Reference images (per-look, with display image designation)
- Delete shot (soft delete with confirmation)
- Duplicate shot

---

### 1.2 ShotEditModal in PlannerPage

**File:** `src/pages/PlannerPage.jsx`
**Import:** Line 82
**Usage:** Lines 3605-3632

**Purpose:** Inline shot editing within the Planner view when a shot card is clicked for editing.

**Current Props Passed:**
```jsx
<ShotEditModal
  open
  titleId="planner-shot-edit-title"
  shotId={editingShot.shot.id}
  shotName={editingShot.shot.name}
  description="Update shot details, linked products, and talent assignments."
  draft={editingShot.draft}
  onChange={updateEditingDraft}
  onClose={closeShotEditor}
  onSubmit={handleSaveShot}
  isSaving={isSavingShot}
  onDelete={() => handleDeleteShot(editingShot.shot)}
  families={families}
  loadFamilyDetails={loadFamilyDetails}
  createProduct={buildShotProduct}
  allowProductCreation={false}
  locations={locations}
  talentOptions={talentOptions}
  talentPlaceholder="Select talent"
  talentNoOptionsMessage={talentNoOptionsMessage}
  talentLoadError={talentLoadError}
  projects={projects}
  currentProjectId={projectId}
  onMoveToProject={handleMoveToProject}
  movingProject={movingProject}
  onCopyToProject={handleCopyToProject}
  copyingProject={copyingProject}
/>
```

**Fields Editable:**
- Name, shot number, type/description
- Status, date
- Products (add/remove, no Looks system)
- Talent assignment
- Location selection
- Tags
- Reference images/attachments
- Notes (rich text)
- Move/copy to project actions

**Risk:** This modal exposes **more editing capabilities than V3** in some areas (move/copy to project) while lacking others (Looks system, per-look products).

---

### 1.3 ScheduleShotEditorModal in CallSheetBuilder

**Wrapper File:** `src/components/callsheet/entries/ScheduleShotEditorModal.jsx`
**Import:** Line 3
**Export:** Lines 77-182

**Consumer File:** `src/components/callsheet/CallSheetBuilder.jsx`
**Import:** Line 50
**Usage:** Lines 1224-1236

**Purpose:** Shot editing within the Call Sheet timeline view. A thin wrapper around `ShotEditModal` that:
- Normalizes shot data into a draft format
- Provides simplified save logic via `useUpdateShot` hook
- Passes through to ShotEditModal with reduced prop set

**Props Passed to ShotEditModal:**
```jsx
<ShotEditModal
  open={open}
  heading={modalHeading}
  shotName={draft?.name || ""}
  draft={draft}
  onChange={handleDraftChange}
  onClose={onClose}
  onSubmit={handleSave}
  isSaving={updateShot.isPending}
  submitLabel="Save"
  savingLabel="Saving…"
  families={families}
  loadFamilyDetails={loadFamilyDetails}
  createProduct={createShotProduct}
  allowProductCreation={false}
  locations={locations}
  talentOptions={talentOptions}
  projects={[]}  // Empty array — no project operations
  currentProjectId={projectId}
  shotId={draft?.id || null}
/>
```

**Fields Editable:**
- Name, shot number, type/description
- Status, date
- Products (add/remove, no Looks system)
- Talent assignment
- Location selection
- Tags
- Reference images/attachments
- Notes

**Notable Differences from Planner:**
- No move/copy to project (projects array is empty)
- No delete action passed

---

### 1.4 Test Files (Mock Only — Not Active Code)

The following files mock `ShotEditModal` but do not represent active editing surfaces:

| File | Purpose |
|------|---------|
| `src/pages/__tests__/ShotsPage.bulkOperations.test.jsx:82` | Mock for bulk ops testing |
| `src/pages/__tests__/ShotsPage.bulkTagging.test.jsx:75` | Mock for bulk tagging testing |
| `src/components/shots/__tests__/ShotEditModal.portal.test.jsx` | Direct modal unit tests |

These do not require migration but should be updated if ShotEditModal is retired.

---

## 2. Target End-State

### Option Analysis

| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| **A: Navigate to V3 everywhere** | Replace all inline modals with navigation to V3 editor | Single source of truth; no divergence possible; full capability | Context switch disrupts workflow; Planner/Callsheet lose inline editing |
| **B: Thin Quick-Edit Modal** | Create a new minimal modal for quick edits (subset of V3 fields) | Fast context-specific edits; clear capability boundary | Two editing surfaces to maintain; potential for feature creep |
| **C: Keep ShotEditModal with strict parity** | Maintain existing modal but enforce that fields cannot exceed V3 | Preserves current UX; minimal code change | Modal is legacy code; continues to diverge over time; maintenance burden |

---

### Recommended End-State: **Option A — Navigate to V3 Everywhere**

**Justification:**

1. **Single Source of Truth:** All shot editing happens in V3, eliminating divergence risk permanently.

2. **Capability Clarity:** Users learn one editing surface. No confusion about which fields are available where.

3. **Maintenance Reduction:** Removing ShotEditModal from active use eliminates ~1,400 lines of legacy code from the critical path.

4. **Consistency with design-spec.md:** The design spec explicitly states:
   > "Creation and editing share the SAME editor... No parallel editors allowed."

5. **Phase 3 Alignment:** V3 is now the sole editor for /shots (Delta I.10). Extending this to Planner and Call Sheet is the natural next step.

**Context Switch Mitigation:**

- Navigation to V3 can use browser back button to return to Planner/Call Sheet
- V3 can detect referrer and show "Back to Planner" / "Back to Call Sheet" affordance
- URL parameter can encode return context: `/projects/:projectId/shots/:shotId/editor?from=planner`

---

## 3. Migration Deltas

### Delta J.2: Planner → V3 Navigation

**Status:** ✅ **COMPLETED** (2026-01-25)

**Scope:** Replace ShotEditModal usage in PlannerPage with navigation to V3

**Changes Made:**
1. ✅ Removed `ShotEditModal` import from PlannerPage.jsx (replaced with comment)
2. ✅ Modified `openShotEditor` callback to navigate to V3 instead of setting modal state
3. ✅ Removed ShotEditModal JSX block (replaced with comment)
4. ✅ Navigation uses pattern: `/projects/${projectId}/shots/${shotId}/editor?returnTo=planner`

**Navigation Parameter Used:** `?returnTo=planner`

> **CRITICAL NOTE:** As of 2026-01-25, `PlannerPage.jsx` is **NOT actively routed** in the application.
> The `/planner` route redirects to `/shots?view=planner`, which further redirects to the "Schedule" tab
> (using `CallSheetBuilder`). The "legacy" Planner board with `PlannerCompactCard` is not rendered.
> This change prepares PlannerPage for re-enablement but has **no visible effect** in the current app.
> The active shot editing modal lives in `ScheduleShotEditorModal.jsx` (Call Sheet scope — see J.3).

**Explicit Scope Boundary:**
- ✅ NO changes to V3 itself (back-link deferred to J.6)
- ✅ NO changes to shot schema
- ✅ NO changes to Planner drag-drop or lane logic
- ✅ NO changes to Call Sheet

**Verification Results:**
- ✅ Lint passes (`npm run lint`)
- ✅ Build succeeds (`npm run build`)
- ⚠️ Visual verification not possible — PlannerPage is not routed
- Browser back behavior will work when PlannerPage is re-enabled

---

### Delta J.3: Call Sheet → V3 Navigation

**Status:** ✅ **COMPLETED** (2026-01-25)

**Scope:** Replace ScheduleShotEditorModal usage in CallSheetBuilder with navigation to V3

**Changes Made:**
1. ✅ Commented out `ScheduleShotEditorModal` import from CallSheetBuilder.jsx
2. ✅ Commented out `isShotEditorOpen`, `shotEditorShot` state variables
3. ✅ Added `useNavigate` hook from react-router-dom
4. ✅ Modified `handleEditShotEntry` to navigate to V3: `navigate(\`/projects/${projectId}/shots/${shotId}/editor?returnTo=schedule\`)`
5. ✅ Removed ScheduleShotEditorModal JSX block (replaced with comment)

**Navigation Parameter Used:** `?returnTo=schedule`

**Explicit Scope Boundary:**
- ✅ NO changes to V3 itself (back-link deferred to J.6)
- ✅ NO changes to shot schema
- ✅ NO changes to Call Sheet timeline logic
- ✅ NO changes to Planner (handled in J.2)

**Verification Results:**
- ✅ Lint passes (`npm run lint`)
- ✅ Build succeeds (`npm run build`)
- ✅ Visual verification: "Open shot" link in Schedule → navigates to V3 editor
- ✅ URL correctly includes `?returnTo=schedule` parameter
- ✅ Browser back → returns to Schedule view

---

### Delta J.4: Retire ScheduleShotEditorModal

**Status:** ✅ **COMPLETED** (2026-01-25)

**Scope:** Remove now-unused ScheduleShotEditorModal component

**Changes Made:**
1. ✅ Deleted `src/components/callsheet/entries/ScheduleShotEditorModal.jsx` (182 lines removed)
2. ✅ Removed commented-out import in `CallSheetBuilder.jsx`
3. ✅ Removed commented-out state variables (`isShotEditorOpen`, `shotEditorShot`) in `CallSheetBuilder.jsx`
4. ✅ Removed JSX comment placeholder in `CallSheetBuilder.jsx`

**Explicit Scope Boundary:**
- ✅ NO changes to V3
- ✅ NO changes to ShotEditModal (handled in J.5)

**Verification Results:**
- ✅ No import errors
- ✅ `npm run lint` passes (zero warnings)
- ✅ `npm run build` passes
- ✅ No dead code references remain

---

### Delta J.5: Retire ShotEditModal from Active Use

**Status:** ✅ **COMPLETED** (2026-01-25)

**Scope:** Verify ShotEditModal is no longer used in active runtime surfaces

**Reference Inventory (Full Search):**

| File | Line | Category | Purpose |
|------|------|----------|---------|
| `src/components/shots/ShotEditModal.jsx` | 27 | Component | The modal component itself |
| `src/pages/PlannerPage.jsx` | 82 | Comment | `// ShotEditModal removed - Planner now navigates to Shot Editor V3 (Delta J.2)` |
| `src/pages/__tests__/ShotsPage.bulkOperations.test.jsx` | 82-84 | Mock | `vi.mock("../../components/shots/ShotEditModal", () => ({ default: () => null }))` |
| `src/pages/__tests__/ShotsPage.bulkTagging.test.jsx` | 75-77 | Mock | `vi.mock("../../components/shots/ShotEditModal", () => ({ default: () => null }))` |
| `src/pages/__tests__/shotProductIntegration.test.jsx` | 400 | Comment | `// Call updateDoc as if ShotEditModal had saved` |
| `src/components/shots/__tests__/ShotEditModal.portal.test.jsx` | All | Unit Test | Direct unit tests for the modal component |

**Categorization:**

- **Category A (Reachable Runtime Surface):** ❌ **NONE** — All runtime surfaces migrated (J.2 Planner, J.3 Call Sheet)
- **Category B (Unrouted/Dead Surface):** `PlannerPage.jsx:82` — Comment only, no import
- **Category C (Tests/Mocks/Storybook):** All remaining references are in test files (mocks or unit tests)

**Conclusion:**
> **ShotEditModal is no longer used in runtime.** The component is orphaned — only referenced by test mocks and its own unit tests. No migration work required for this delta.

**Decision on Component Retention:**
- ShotEditModal.jsx is NOT deleted in this delta
- Rationale: Test mocks still reference the path; deleting would break tests unnecessarily
- Future cleanup: When test files are refactored (unrelated to this convergence), mocks can be removed and component deleted

**Explicit Scope Boundary:**
- ✅ NO changes to V3
- ✅ NO changes to ShotEditModal.jsx
- ✅ NO changes to test files
- ✅ Documentation-only delta

**Verification Results:**
- ✅ `grep -r "ShotEditModal" src/` returns only tests/mocks/comments (no runtime imports)
- ✅ `npm run lint` passes (zero warnings)
- ✅ `npm run build` passes
- ✅ No runtime errors (component not rendered anywhere)

---

### Delta J.6: V3 "Return To" Context

**Status:** ✅ **COMPLETED** (2026-01-25)

**Scope:** Add return navigation affordance in V3 for context-aware back links

**Changes Made:**
1. ✅ Added `useSearchParams` hook to parse `returnTo` URL parameter in ShotEditorHeaderBandV3
2. ✅ Added `returnToContext` useMemo that derives navigation target and label
3. ✅ Conditionally renders "← Return to [Surface]" button in Header Band (after Shots back button)
4. ✅ Button navigates to appropriate surface when clicked

**Supported returnTo Formats:**
1. `returnTo=schedule` → navigates to `/projects/${projectId}/shots?view=planner` (Schedule surface)
2. `returnTo=planner` → alias for schedule (same behavior)
3. `returnTo=<encoded path starting with "/">` → decodes and navigates to internal path
   - Security: only allows paths starting with "/"
   - Derives label from last path segment (e.g., "/projects/.../shots?view=gallery" → "Return to Shots")

**Explicit Scope Boundary:**
- ✅ Changes limited to V3 Header Band (`ShotEditorHeaderBandV3.jsx`)
- ✅ NO schema changes
- ✅ NO logic changes to editing flows
- ✅ NO redesign — small text button with left arrow icon

**Verification Results:**
- ✅ `/editor?returnTo=schedule` → shows "← Return to Schedule" button, click navigates to Schedule view
- ✅ `/editor?returnTo=planner` → same behavior as schedule
- ✅ `/editor?returnTo=%2Fprojects%2F...%2Fshots%3Fview%3Dgallery` → shows "← Return to Shots" button, click navigates correctly
- ✅ `/editor` (no param) → button hidden, normal back button behavior
- ✅ `npm run lint` passes (zero warnings)
- ✅ `npm run build` passes

**Files Changed:**
- `src/components/shots/workspace/ShotEditorHeaderBandV3.jsx`:
  - Added `useSearchParams` import
  - Added `returnToContext` useMemo for parsing returnTo param
  - Added `handleReturnTo` callback for navigation
  - Added conditional "Return to [Surface]" button after existing Shots back button

---

## 4. Do Not Diverge Rule

**CRITICAL:** Until migration is complete, the following rule applies:

> **Fields editable in ShotEditModal (Planner/Call Sheet surfaces) MUST NOT exceed the capabilities available in Shot Editor V3.**

### Current Divergence Audit

| Field/Capability | V3 Status | ShotEditModal Status | Action Required |
|------------------|-----------|----------------------|-----------------|
| Name | ✅ | ✅ | None |
| Shot Number | ✅ (display + edit) | ✅ | None |
| Status | ✅ | ✅ | None |
| Description | ✅ | ✅ | None |
| Date | ✅ | ✅ | None |
| Products | ✅ (per-Look) | ✅ (flat list) | **Note:** V3 has richer model; modal is subset |
| Talent | ✅ | ✅ | None |
| Location | ✅ | ✅ | None |
| Tags | ✅ | ✅ | None |
| Notes | ✅ (autosave) | ✅ (manual save) | None |
| Comments | ✅ | ❌ | **V3-only** — acceptable |
| Reference Images | ✅ (per-Look) | ✅ (flat attachments) | **Note:** V3 has richer model |
| Looks System | ✅ | ❌ | **V3-only** — acceptable |
| Delete Shot | ✅ | ✅ (Planner only) | None |
| Duplicate Shot | ✅ | ❌ | **V3-only** — acceptable |
| Move to Project | ❌ (explicitly deferred) | ✅ (Planner only) | **DIVERGENCE** — Modal exceeds V3 |
| Copy to Project | ❌ (explicitly deferred) | ✅ (Planner only) | **DIVERGENCE** — Modal exceeds V3 |

### Divergence Resolution

The **Move/Copy to Project** capabilities in PlannerPage's ShotEditModal usage exceed V3's current scope. Per the parity gate document, these are explicitly deferred:

> "Move shot to another project — Low-frequency admin action; can remain in separate admin flow"

**Resolution Options:**
1. **Remove from modal now:** Strip move/copy from PlannerPage usage before J.2 migration
2. **Add to V3 first:** Implement move/copy in V3, then migrate (violates "no V3 changes" in J.2 scope)
3. **Accept temporary regression:** During migration, move/copy temporarily unavailable until V3 adds support

**Recommendation:** Option 3 — Accept temporary regression. Move/copy are low-frequency admin actions that can be temporarily unavailable during migration. Document this in release notes.

---

## 5. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Context switch disrupts workflow | Medium | Medium | Implement "Return To" affordance (J.6); test with real users |
| Move/copy regression frustrates admins | Low | Low | Document in release notes; implement in V3 post-migration |
| Tests break after modal removal | Medium | Low | Update mocks incrementally per delta |
| Planner performance degrades with navigation | Low | Medium | Test performance; consider preloading V3 components |
| Users confused by UX change | Medium | Medium | Toast/guidance on first navigation; update help docs |

---

## 6. Verification Checklist

### Pre-Migration (Before J.2)

- [ ] Document current ShotEditModal field set
- [ ] Document current user workflows in Planner
- [ ] Document current user workflows in Call Sheet
- [ ] Identify any undocumented modal usages
- [ ] Confirm V3 has feature parity for core fields

### Post J.2 (Planner Migration)

- [ ] Planner shot edit navigates to V3
- [ ] V3 displays correct shot data
- [ ] Browser back returns to Planner at same position
- [ ] "Back to Planner" link works (if implemented)
- [ ] No console errors
- [ ] `npm run lint` passes
- [ ] `npm run build` passes

### Post J.3 (Call Sheet Migration)

- [x] Call Sheet shot edit navigates to V3
- [x] V3 displays correct shot data
- [x] Browser back returns to Call Sheet at same position
- [x] "Back to Schedule" link works (implemented in J.6)
- [x] No console errors
- [x] `npm run lint` passes
- [x] `npm run build` passes

### Post J.4 + J.5 (Component Retirement)

- [x] ScheduleShotEditorModal deleted
- [x] ShotEditModal verified no runtime usage (orphaned — tests/mocks only)
- [x] No remaining active imports (both ScheduleShotEditorModal and ShotEditModal)
- [x] All tests pass (no mock updates needed — mocks still valid)
- [ ] Bundle size reduced (verify build output) — ShotEditModal still in bundle but never rendered

### Post J.6 (Return Context)

- [x] `?returnTo=schedule` shows Schedule back link
- [x] `?returnTo=planner` shows Schedule back link (alias)
- [x] Encoded path `?returnTo=%2F...` shows derived back link
- [x] No param shows default behavior (button hidden)
- [x] Links navigate correctly

---

## 7. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v1.0 | 2026-01-25 | Claude | Initial convergence plan created |
| v1.1 | 2026-01-25 | Claude | Delta J.3 completed — Call Sheet → V3 navigation |
| v1.2 | 2026-01-25 | Claude | Delta J.6 completed — V3 "Return To" context affordance |
| v1.3 | 2026-01-25 | Claude | Delta J.4 completed — ScheduleShotEditorModal retired |
| v1.4 | 2026-01-25 | Claude | Delta J.5 completed — ShotEditModal verified no runtime usage (orphaned) |
| v2.0 | 2026-01-25 | Claude | **CONVERGENCE COMPLETE** — All deltas J.2–J.6 done; plan closed out |

---

## 8. Final State

**Convergence Status:** ✅ **COMPLETE** (2026-01-25)

The shot editing convergence is now complete. All runtime shot editing surfaces use Shot Editor V3.

### System State Summary

| Component | State |
|-----------|-------|
| **Shot Editor V3** | ✅ Active — sole editor for all surfaces |
| **ShotsPage** | ✅ Navigates to V3 (Delta I.10) |
| **PlannerPage** | ✅ Navigates to V3 with `returnTo=planner` (Delta J.2) |
| **CallSheetBuilder** | ✅ Navigates to V3 with `returnTo=schedule` (Delta J.3) |
| **V3 Return-To Affordance** | ✅ Active — header shows contextual back link (Delta J.6) |
| **ScheduleShotEditorModal** | 🗑️ Deleted (Delta J.4) |
| **ShotEditModal** | ⚠️ Orphaned — tests/mocks only, not in runtime (Delta J.5) |

### Navigation Flows

1. **Shots Page** → Click shot card → V3 Editor → Browser back returns to shots
2. **Schedule (Call Sheet)** → Click "Open shot" → V3 Editor → "← Return to Schedule" button or browser back
3. **Planner** (if re-enabled) → Click shot → V3 Editor → "← Return to Schedule" button or browser back

---

## 9. Deferred Cleanup

The following cleanup items are explicitly deferred and not blocking:

| Item | Reason | Future Action |
|------|--------|---------------|
| Delete `ShotEditModal.jsx` | Test mocks still reference path | Remove when test files refactored |
| Remove PlannerPage dead code | Page not routed; no urgency | Clean up if/when Planner re-enabled |
| Move/Copy to Project in V3 | Low-frequency admin action | Implement if user demand emerges |
| Bundle size verification | ShotEditModal in bundle but never rendered | Verify reduction after test mock removal |

---

## References

- **Shot Editor V3 Page:** `src/pages/ShotEditorPageV3.jsx`
- **Legacy Modal:** `src/components/shots/ShotEditModal.jsx` (orphaned — tests only)
- **Schedule Modal Wrapper:** ~~`src/components/callsheet/entries/ScheduleShotEditorModal.jsx`~~ (deleted in J.4)
- **Planner Page:** `src/pages/PlannerPage.jsx`
- **Call Sheet Builder:** `src/components/callsheet/CallSheetBuilder.jsx`
- **Design Spec:** `design-spec.md`
- **IA Spec:** `docs/shot-editor-v3-ia.md`
- **Parity Gate:** `docs/shot-editor-v3-parity-gate.md`
