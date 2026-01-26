# Library System Architecture (R.8)

> **Delta R.8** — Entry flattening + hub removal. Structural cleanup only.
> **Status**: Implemented.

---

## What R.8 Actually Changed

R.8 is a **minimal structural cleanup** that:

1. Removed the Library Hub (`/library` now redirects to `/library/profiles`)
2. Flattened sidebar navigation (removed "Overview" entry)
3. Simplified LibraryPage shell (removed hub conditional logic)

**R.8 is NOT a full system refactor.** It does not implement polymorphic list renderers or standardize Inspector behavior across all domains.

---

## Current State by Domain (As of R.11)

| Domain | Layout | Edit Model | Status |
|--------|--------|------------|--------|
| **Profiles** | Rail/list + Inspector (canvas) | Inline edit on canvas | ✅ Implemented (R.5–R.7) |
| **Locations** | Rail/list + Inspector (canvas) | Inline edit on canvas | ✅ Implemented (R.9) |
| **Tags** | Rail/list + Inspector (canvas) | Inline edit on canvas | ✅ Implemented (R.10) |
| **Swatches (Palette)** | Rail/list + Inspector (canvas) | Inline edit on canvas | ✅ Implemented (R.11) |
| **Departments** | Workspace shell (rail + canvas) | Inline edit in canvas | ✅ Implemented (L.5) |
| **Talent (legacy)** | Workspace shell (rail + canvas) | Edit via modal | ⚠️ Deprecated (use Profiles) |
| **Crew (legacy)** | Workspace shell (rail + canvas) | Edit via modal | ⚠️ Deprecated (use Profiles) |

---

## Target System Model (Future Work)

The **north star** for the Library is:

### List + Inspector Pattern

```
┌─────────────────────────┬────────────────────────────────────────────────┐
│     LIST VIEW           │        INSPECTOR                               │
│     (browsing)          │        (edit surface)                          │
│                         │                                                │
│  Search + Filter        │  Selected item detail with inline edit         │
│  Scannable items        │  - Click field → edit inline                   │
│  Selection highlights   │  - Blur/Enter → save                           │
│                         │  - Escape → cancel                             │
│                         │                                                │
│                         │  Target: NO navigation to edit pages           │
│                         │  Target: NO modal-first editing                │
└─────────────────────────┴────────────────────────────────────────────────┘
```

### Aspirational List Renderers by Domain (Not Yet Implemented)

| Domain | Target List Type | Why | Current Status |
|--------|------------------|-----|----------------|
| Profiles (Talent + Crew) | Compact rail with thumbnails | Visual scanning of people | ✅ Implemented |
| Locations | Compact rail with thumbnails | Visual scanning of venues | ✅ Implemented (R.9) |
| Tags | Compact rail with color swatches | Visual scanning with usage counts | ✅ Implemented (R.10) |
| Departments | Hierarchical tree | Nested parent → children structure | ❌ Not implemented (uses flat rail) |
| Swatches | Color grid | Visual color browsing | ❌ Not implemented |

**Note**: Profiles and Locations fully implement the target List + Inspector pattern with inline editing. Departments has the workspace shell with inline editing but uses a flat rail, not a tree.

---

## What Was Removed (R.8)

### Library Hub

- **Before**: `/library` rendered `LibraryHubPage` (Bento-style tiles with domain counts)
- **After**: `/library` redirects to `/library/profiles`
- **Why**: Hub created navigation indirection; Profiles is now the primary Library entry point

### "Overview" Navigation Entry

- **Before**: Sidebar Library submenu started with "Overview → /library"
- **After**: Submenu starts with "Profiles → /library/profiles"

### Hub Conditional Logic

- **Before**: `LibraryPage.jsx` checked if on hub and rendered differently
- **After**: Only checks for Profiles page (which has its own header)

---

## Route Changes (R.8)

| Route | Before R.8 | After R.8 |
|-------|------------|-----------|
| `/library` | `LibraryHubPage` | Redirect to `/library/profiles` |
| All other `/library/*` routes | No change | No change |

---

## Files Changed

| File | Change |
|------|--------|
| `src/App.jsx` | Index route for `/library` → redirect to `/library/profiles` |
| `src/App.jsx` | Removed `LibraryHubPage` lazy import |
| `src/components/layout/SidebarNav.jsx` | Removed "Overview" from Library submenu |
| `src/pages/LibraryPage.jsx` | Removed hub conditional logic |

## Files Deprecated (Not Deleted)

| File | Status |
|------|--------|
| `src/pages/LibraryHubPage.jsx` | Deprecated — no longer routed, kept for reference. Deprecated file kept temporarily; eligible for removal in a later cleanup delta once stable. |

---

## What Was Explicitly NOT Addressed (Deferred)

| Item | Notes |
|------|-------|
| ~~Inline edit for Locations~~ | ✅ Addressed in R.9 |
| ~~Inline edit for Tags~~ | ✅ Addressed in R.10 (name/color inline; merge/delete remain modals) |
| Inline edit for Swatches | Still uses SwatchCreateModal/SwatchEditModal |
| Polymorphic list renderers | Swatches not refactored to color grid; Departments not refactored to tree |
| Talent/Crew legacy page retirement | Still routed, users should use Profiles |
| Visual redesign | R.8 is structural cleanup only |
| Mobile responsive | Desktop-first |

---

## Document History

| Date | Delta | Change |
|------|-------|--------|
| 2026-01-26 | R.10 | Tags List + Inspector standardization (inline name/color editing) |
| 2026-01-26 | R.9 | Locations inline editing standardization (Inspector pattern) |
| 2026-01-26 | R.8 | Hub removed, entry flattened, navigation simplified |
| 2026-01-26 | R.7 | Profiles canvas workspace stage + tabs |
| 2026-01-26 | R.6 | Profile canvas design polish |
| 2026-01-26 | R.5 | Unified Profiles workspace (rail/list + inspector) |
| 2026-01-26 | R.4 | Profiles discovery page |
| 2026-01-26 | R.3 | Profiles system design |
| 2026-01-26 | R.2 | Library Hub implementation (now deprecated) |
| 2026-01-26 | R.1 | Library domain architecture documentation |
