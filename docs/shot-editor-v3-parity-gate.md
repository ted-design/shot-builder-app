# Shot Editor V3 — Parity Gate Checklist

**Version:** v1.8
**Status:** ✅ V3 IS SOLE EDITOR — Legacy Modal Removed from ShotsPage (Delta I.10)
**Last Updated:** 2026-01-25

---

## Purpose

This document tracks feature parity between the **legacy Shot Edit Modal** (`ShotEditModal.jsx`) and **Shot Editor V3** (`ShotEditorPageV3.jsx`). It defines:

1. What capabilities must exist before V3 can **replace** the legacy editor
2. What can be deferred to post-replacement phases
3. A clear "Definition of Done" for the replacement milestone

---

## 1. Scope Boundaries

### What V3 WILL Support at Replacement

V3 will be the **sole editing surface** for shots. All core shot-editing workflows must be possible in V3 before the legacy modal is removed.

### What V3 Will NOT Support Initially (Explicitly Deferred)

| Capability | Rationale |
|------------|-----------|
| **Move shot to another project** | Low-frequency admin action; can remain in separate admin flow |
| **Copy shot to another project** | Low-frequency admin action; can remain in separate admin flow |
| **Real-time collaborative editing (Active Editors Bar)** | Complex; V3 uses autosave but not multi-presence |
| **Version history panel** | Nice-to-have; not required for core editing workflow |
| **Image crop editor (AdvancedImageCropEditor)** | V3 references are upload-only; crop editing deferred |
| **Multi-step wizard tabs** | V3 uses single-canvas paradigm; no tab navigation |

---

## 2. Parity Checklist

### Legend

| Status | Meaning |
|--------|---------|
| ✅ | V3 has this capability |
| ⚠️ | Partially implemented or different approach |
| ❌ | Missing — must be added before replacement |
| 🔜 | Planned for future phase (not blocker) |

---

### 2.1 Core Fields

| Capability | Legacy Modal | Shot Editor V3 | Status | Notes |
|------------|--------------|----------------|--------|-------|
| **Shot Name** | Text input field | Inline editable in Header Band | ✅ | Different UX, same function |
| **Shot Number** | Text input field | Displayed in Header Band (secondary) | ⚠️ | Display only in V3; editing needs verification |
| **Status** | Dropdown (todo, in_progress, complete, on_hold) | Dropdown in Header Band | ✅ | |
| **Description/Type** | Text input field | Inline editable in Header Band subtitle | ✅ | |
| **Date** | Date picker | Inline editable in Header Band | ✅ | Phase I.4: Uses native date input |

---

### 2.2 Rich Content

| Capability | Legacy Modal | Shot Editor V3 | Status | Notes |
|------------|--------------|----------------|--------|-------|
| **Notes (Rich Text)** | RichTextEditor in Creative tab | ShotNotesCanvas (primary surface) | ✅ | V3 has autosave + attribution |
| **Notes Character Limit** | 50,000 chars | 50,000 chars | ✅ | |
| **Notes Formatting Toolbar** | Bubble toolbar on selection | Visible static toolbar (per design-spec) | ✅ | V3 improved per Phase 1 |

---

### 2.3 Reference Images

| Capability | Legacy Modal | Shot Editor V3 | Status | Notes |
|------------|--------------|----------------|--------|-------|
| **Reference image upload** | MultiImageAttachmentManager (up to 10) | LookReferencesSection (per-look) | ✅ | Different model: V3 stores refs per Look |
| **Reference image removal** | X button on thumbnail | X button on thumbnail | ✅ | |
| **Reference image cropping** | AdvancedImageCropEditor modal | Not implemented | 🔜 | Deferred; not a blocker |
| **Display image designation** | Not in legacy | Star affordance in V3 | ✅ | V3-only feature |

---

### 2.4 Products

| Capability | Legacy Modal | Shot Editor V3 | Status | Notes |
|------------|--------------|----------------|--------|-------|
| **Product selection** | ShotProductsEditor component | ShotProductSelectorModal | ✅ | |
| **Product removal** | Remove button per product | Remove button in Look canvas | ✅ | |
| **Hero product designation** | Not explicit in legacy | heroProductId per Look | ✅ | V3-only feature |
| **Product context (gender/category)** | Not visible in selector | Visible per-row in modal | ✅ | Phase 2 F.3 improvement |
| **Create new product** | onCreateProduct callback | Not implemented in V3 | ⚠️ | Low priority; users create products in Products page |
| **Create new colorway** | onCreateColourway callback | Not implemented in V3 | ⚠️ | Low priority |

---

### 2.5 Talent

| Capability | Legacy Modal | Shot Editor V3 | Status | Notes |
|------------|--------------|----------------|--------|-------|
| **Talent assignment** | TalentMultiSelect component | ShotAssetsSection canvas | ✅ | Delta I.5: Editable via Assets section |
| **Talent display** | Multi-select dropdown | Summary in dock | ✅ | Read-only display works |
| **Talent headshots** | Shown in dropdown options | Shown in dock summary | ✅ | |

---

### 2.6 Location

| Capability | Legacy Modal | Shot Editor V3 | Status | Notes |
|------------|--------------|----------------|--------|-------|
| **Location selection** | LocationSelect dropdown | ShotAssetsSection canvas | ✅ | Delta I.5: Editable via Assets section |
| **Location display** | Dropdown with options | Summary row in dock | ✅ | Read-only display works |

---

### 2.7 Tags

| Capability | Legacy Modal | Shot Editor V3 | Status | Notes |
|------------|--------------|----------------|--------|-------|
| **Tag editing** | TagEditor component | ShotAssetsSection canvas | ✅ | Delta I.5: Editable via Assets section |
| **Tag display** | Inline tag pills | Summary row in dock (count + names) | ✅ | |
| **Tag autocomplete** | Suggestions from project tags | ShotAssetsSection TagEditor | ✅ | Delta I.5: Uses existing TagEditor with autocomplete |

---

### 2.8 Comments

| Capability | Legacy Modal | Shot Editor V3 | Status | Notes |
|------------|--------------|----------------|--------|-------|
| **Comment section** | CommentSection integrated | CommentSection in canvas | ✅ | Delta I.6: Reuses existing CommentSection component |
| **@mentions in comments** | Supported via RichTextEditor | Supported via CommentSection | ✅ | Delta I.6: Inherited from existing implementation |

---

### 2.9 Looks System

| Capability | Legacy Modal | Shot Editor V3 | Status | Notes |
|------------|--------------|----------------|--------|-------|
| **Multi-look support** | Not in legacy | ShotLooksCanvas with tabs | ✅ | V3-only feature |
| **Primary vs Alt looks** | Not in legacy | Tab labels (Primary, Alt A, etc.) | ✅ | |
| **Active look state** | N/A | Local UI state with tab switching | ✅ | |
| **Look-scoped products** | N/A | Products stored per-look | ✅ | |
| **Look-scoped references** | N/A | References stored per-look | ✅ | |

---

### 2.10 Actions & Operations

| Capability | Legacy Modal | Shot Editor V3 | Status | Notes |
|------------|--------------|----------------|--------|-------|
| **Save shot** | Manual submit button | Autosave (notes); field-level saves | ⚠️ | Different paradigm; needs review |
| **Delete shot** | Confirmation flow with "DELETE" typing | Header Band dropdown with confirmation dialog | ✅ | Soft delete (deleted: true); shots hidden by default from list + direct URL shows deleted state |
| **Duplicate shot** | Via external action (not in modal) | Duplicate button in Header Band | ✅ | |
| **Cancel editing** | Cancel button closes modal | Back button navigates away | ✅ | |

---

### 2.11 UX & Accessibility

| Capability | Legacy Modal | Shot Editor V3 | Status | Notes |
|------------|--------------|----------------|--------|-------|
| **Keyboard navigation** | Tab through form fields | Needs audit | ⚠️ | V3 is page-level; different patterns |
| **Auto-save status** | Status chips per section tab | Trust indicators on Notes | ⚠️ | V3 only has Notes autosave visible |
| **Read-only mode** | Not explicit | ?readonly=1 URL param | ✅ | |

---

### 2.12 Versioning & History

| Capability | Legacy Modal | Shot Editor V3 | Status | Notes |
|------------|--------------|----------------|--------|-------|
| **Version history panel** | VersionHistoryPanel component | Not implemented | 🔜 | Deferred; not a blocker |
| **Active editors display** | ActiveEditorsBar component | Not implemented | 🔜 | Deferred; not a blocker |

---

## 3. Replacement Blockers

These must be resolved before the legacy modal can be removed:

| # | Capability | Priority | Effort Estimate |
|---|------------|----------|-----------------|
| ~~1~~ | ~~**Date field editing**~~ | ~~BLOCKER~~ | ~~Low~~ | ✅ RESOLVED (Phase I.4) |
| ~~2~~ | ~~**Talent assignment editing**~~ | ~~BLOCKER~~ | ~~Medium~~ | ✅ RESOLVED (Delta I.5) |
| ~~3~~ | ~~**Location selection editing**~~ | ~~BLOCKER~~ | ~~Medium~~ | ✅ RESOLVED (Delta I.5) |
| ~~4~~ | ~~**Tag editing**~~ | ~~BLOCKER~~ | ~~Medium~~ | ✅ RESOLVED (Delta I.5) |
| ~~5~~ | ~~**Comment section integration**~~ | ~~BLOCKER~~ | ~~Medium-High~~ | ✅ RESOLVED (Delta I.6) |
| ~~6~~ | ~~**Delete shot action**~~ | ~~BLOCKER~~ | ~~Low~~ | ✅ RESOLVED (Phase I.2) |

### Non-Blockers (IMPORTANT but deferrable)

| Capability | Priority | Rationale |
|------------|----------|-----------|
| Shot Number editing | IMPORTANT | Display-only may be sufficient initially |
| Create product/colorway | LATER | Users can use Products page |
| Image cropping | LATER | Upload-only workflow is acceptable |
| Version history | LATER | Nice-to-have for power users |
| Active editors presence | LATER | Complex; requires real-time infrastructure |

---

## 4. Verification Steps for Replacement

### Pre-Replacement QA Checklist

Before removing the legacy modal:

- [ ] **Create shot via V3**: User can create a new shot using the prelude flow and V3 editor
- [ ] **Edit all core fields**: Name, Status, Description visible and editable
- [ ] **Edit Date field**: Date can be set and saved
- [ ] **Edit Notes**: Rich text editing works with autosave
- [ ] **Add products**: Products can be added via modal and saved to Look
- [ ] **Remove products**: Products can be removed from Look
- [ ] **Set hero product**: Star affordance works to designate hero
- [ ] **Add references**: Reference images upload and display correctly
- [ ] **Remove references**: Reference images can be deleted with confirmation
- [ ] **Set display image**: Star affordance works on references
- [ ] **Assign talent**: Talent can be added/removed (requires canvas section)
- [ ] **Select location**: Location can be selected (requires canvas section)
- [ ] **Edit tags**: Tags can be added/removed (requires canvas section)
- [x] **View comments**: Comments section displays correctly
- [x] **Add comments**: Users can post new comments
- [x] **Delete shot**: Delete action available with confirmation flow
- [ ] **Keyboard navigation**: Tab through all interactive elements
- [ ] **Mobile responsive**: Dock collapses, canvas remains usable

### Smoke Test Scenarios

1. **New Shot Flow**
   - Open Shots page → Click "+ Create" → Complete prelude → Arrive in V3 editor
   - Edit name, add products, add notes → Navigate away → Return → All data persisted

2. **Existing Shot Edit**
   - Open shot from table/cards view → Make changes to multiple fields
   - Verify autosave indicators → Close browser → Reopen → Changes present

3. **Collaborative Workflow**
   - Add comment on shot → @mention a team member
   - Team member receives notification → Opens shot → Sees comment

---

## 5. Migration Path

### Phase I.1 (Current)
- Create this parity gate document
- No code changes

### Phase I.2 (Complete)
- ~~Add Date field to V3 Header Band or canvas~~ ✅ DONE (Phase I.4)
- ~~Add Delete shot action to V3 (Header Band dropdown)~~ ✅ DONE (Phase I.2/I.3)

### Phase I.3 (Complete - Delta I.5)
- ~~Create "Assets" canvas section for Talent, Location, Tags editing~~ ✅ DONE
- Pattern: Collapsible section with Edit/Save/Cancel grammar per asset type
- Implementation: `ShotAssetsSection.jsx` with TalentMultiSelect, LocationSelect, TagEditor

### Phase I.4 (Complete - Delta I.6)
- ~~Integrate CommentSection into V3 layout~~ ✅ DONE
- Position: Below ShotAssetsSection in canvas area
- Implementation: Reuses existing `CommentSection` component with `clientId`, `shotId`, `shotName` props

### Phase I.5 (Complete - Delta I.7 QA + Delta I.8 Cutover)
- ~~QA verification of all checklist items~~ ✅ DONE (Delta I.7)
- ~~Update routing to always use V3 (remove flag gating)~~ ✅ DONE (Delta I.8)
- ~~Make V3 default everywhere (Cards/Table/Visual)~~ ✅ DONE (Delta I.8)
- Legacy modal preserved behind `?legacyShotEditor=1` safety valve

### Phase I.6 (Complete - Delta I.9 Bundle Optimization)
- ~~Lazy-load legacy modal to reduce default-path bundle size~~ ✅ DONE (Delta I.9)
- Legacy modal only loaded when rollback valve (`?legacyShotEditor=1`) is active
- Separate chunk: `ShotEditModal-B12v3_aR.js` (43.34 kB)
- Rollback valve preserved until observation period completes (cleanup is I.10)

### Phase I.7 (Complete - Delta I.10 Burn the Ships)
- ~~Remove `?legacyShotEditor=1` rollback valve from ShotsPage~~ ✅ DONE (Delta I.10)
- ~~Remove lazy-loaded ShotEditModal import from ShotsPage~~ ✅ DONE
- ~~Remove `useLegacyShotEditorMode` hook~~ ✅ DONE
- ~~Update all click handlers to navigate directly to V3~~ ✅ DONE
- **V3 is now the sole editor path for the Shots page**
- Note: `ShotEditModal.jsx` preserved for PlannerPage and ScheduleShotEditorModal use

---

## 6. Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| v1.0 | 2025-01-24 | Claude | Initial parity gate document |
| v1.1 | 2026-01-24 | Claude | Delete shot action implemented (Phase I.2) |
| v1.2 | 2026-01-24 | Claude | Soft-delete contract hardened (Delta I.3): deleted shots hidden from list + direct URL shows deleted state |
| v1.3 | 2026-01-24 | Claude | Date field editing implemented (Delta I.4): inline edit in Header Band using native date input |
| v1.4 | 2026-01-24 | Claude | Assets section implemented (Delta I.5): Talent, Location, Tags editing via ShotAssetsSection canvas |
| v1.5 | 2026-01-24 | Claude | CommentSection integrated (Delta I.6): Reuses existing CommentSection in canvas area — ALL BLOCKERS RESOLVED |
| v1.6 | 2026-01-25 | Claude | **CUTOVER COMPLETE** (Delta I.8): V3 is default editor everywhere; legacy modal gated behind `?legacyShotEditor=1` safety valve |
| v1.7 | 2026-01-25 | Claude | **BUNDLE OPTIMIZED** (Delta I.9): Legacy modal lazy-loaded; only included when rollback valve active |
| v1.8 | 2026-01-25 | Claude | **BURN THE SHIPS** (Delta I.10): Rollback valve removed; V3 is sole editor for ShotsPage; ShotEditModal preserved for Planner/Callsheet only |

---

## References

- **Legacy Editor**: `src/components/shots/ShotEditModal.jsx`
- **V3 Editor Page**: `src/pages/ShotEditorPageV3.jsx`
- **V3 Components**: `src/components/shots/workspace/`
- **Design Spec**: `design-spec.md`
- **IA Spec**: `docs/shot-editor-v3-ia.md`
- **Phase 1**: `shot-editor-v3-phase1.md` (COMPLETE)
- **Phase 2**: `shot-editor-v3-phase2.md` (COMPLETE)
- **Phase 3**: `shot-editor-v3-phase3.md` (ACTIVE)
