# Library System Architecture (R.8–R.18)

> **Delta R.8** — Entry flattening + hub removal. Structural cleanup only.
> **Delta R.18** — Profiles surface deprecated. Talent is canonical people browsing page.
> **Status**: Implemented.

---

## What R.18 Changed

R.18 **deprecates Profiles as a user-facing surface**:

1. Removed Profiles from Library navigation sidebar
2. `/library` now redirects to `/library/talent` (not `/library/profiles`)
3. `/library/profiles` now redirects to `/library/talent`
4. Talent (R.17 Gallery + Cockpit) is the canonical "people" browsing experience

**Profiles data remains in Firestore** — this is a UI surface deprecation, not a data migration.

---

## What R.8 Changed (Historical)

R.8 was a **minimal structural cleanup** that:

1. Removed the Library Hub (`/library` redirected to `/library/profiles`)
2. Flattened sidebar navigation (removed "Overview" entry)
3. Simplified LibraryPage shell (removed hub conditional logic)

**R.8 was NOT a full system refactor.** It did not implement polymorphic list renderers or standardize Inspector behavior across all domains.

---

## Current State by Domain (As of R.18)

| Domain | Layout | Edit Model | Status |
|--------|--------|------------|--------|
| **Talent** | Gallery grid + Expand-down cockpit | Edit via modal | ✅ Canonical people surface (R.17) |
| **Locations** | Rail/list + Inspector (canvas) | Inline edit on canvas | ✅ Implemented (R.9) |
| **Tags** | Rail/list + Inspector (canvas) | Inline edit on canvas | ✅ Implemented (R.10) |
| **Swatches (Palette)** | Rail/list + Inspector (canvas) | Inline edit on canvas | ✅ Implemented (R.11) |
| **Departments** | Workspace shell (rail + canvas) | Inline edit in canvas | ✅ Implemented (L.5) |
| **Profiles** | Rail/list + Inspector (canvas) | Inline edit on canvas | ⚠️ Deprecated surface (R.18) — redirects to Talent |
| **Crew** | Workspace shell (rail + canvas) | Edit via modal | ⚠️ Separate layout planned (future) |

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

### List Renderers by Domain

| Domain | List Type | Why | Current Status |
|--------|-----------|-----|----------------|
| Talent | Gallery grid with tiles | Visual scanning of people (portrait-oriented) | ✅ Implemented (R.17) |
| Locations | Compact rail with thumbnails | Visual scanning of venues | ✅ Implemented (R.9) |
| Tags | Compact rail with color swatches | Visual scanning with usage counts | ✅ Implemented (R.10) |
| Departments | Flat rail | Nested parent → children structure | ⚠️ Uses flat rail (tree deferred) |
| Swatches | Compact rail | Visual color browsing | ⚠️ Uses flat rail (color grid deferred) |

**Note**: Talent uses Gallery + Cockpit pattern. Locations, Tags, and Swatches use List + Inspector pattern with inline editing. Departments has workspace shell with inline editing.

---

## What Was Removed (R.18)

### Profiles as User-Facing Surface

- **Before**: `/library/profiles` was the primary Library entry point
- **After**: `/library/profiles` redirects to `/library/talent`
- **Why**: Talent (R.17) provides a superior "people" browsing experience with Gallery + Cockpit

### Profiles Navigation Entries

- **Before**: Sidebar Library submenu had "Profiles" with indented "Talent" and "Crew" sub-entries
- **After**: Sidebar Library submenu starts with "Talent → /library/talent"

### Profiles Tab in LibraryPage

- **Before**: LibraryPage tabs included "Profiles"
- **After**: Tabs start with "Talent"

---

## What Was Removed (R.8 — Historical)

### Library Hub

- **Before**: `/library` rendered `LibraryHubPage` (Bento-style tiles with domain counts)
- **After**: `/library` redirected to `/library/profiles` (now redirects to `/library/talent`)
- **Why**: Hub created navigation indirection

### "Overview" Navigation Entry

- **Before**: Sidebar Library submenu started with "Overview → /library"
- **After**: Submenu started with "Profiles → /library/profiles" (now "Talent → /library/talent")

### Hub Conditional Logic

- **Before**: `LibraryPage.jsx` checked if on hub and rendered differently
- **After**: Only checks for full-workspace pages (Talent, Locations, Tags, Palette)

---

## Route Changes (R.18)

| Route | Before R.18 | After R.18 |
|-------|-------------|------------|
| `/library` | Redirect to `/library/profiles` | Redirect to `/library/talent` |
| `/library/profiles` | `LibraryProfilesPage` | Redirect to `/library/talent` |
| `/library/talent` | `LibraryTalentPage` | `LibraryTalentPage` (canonical) |

---

## Files Changed (R.18)

| File | Change |
|------|--------|
| `src/App.jsx` | Index route for `/library` → redirect to `/library/talent` |
| `src/App.jsx` | `/library/profiles` route → redirect to `/library/talent` |
| `src/components/layout/SidebarNav.jsx` | Removed Profiles + indented Talent/Crew; added Talent as direct entry |
| `src/pages/LibraryPage.jsx` | Removed Profiles tab; updated bypass check for Talent |

## Files Deprecated (Not Deleted)

| File | Status |
|------|--------|
| `src/pages/LibraryHubPage.jsx` | Deprecated (R.8) — no longer routed, kept for reference |
| `src/pages/LibraryProfilesPage.jsx` | Deprecated (R.18) — route redirects to Talent, kept for reference |

---

## What Was Explicitly NOT Addressed (Deferred)

| Item | Notes |
|------|-------|
| ~~Inline edit for Locations~~ | ✅ Addressed in R.9 |
| ~~Inline edit for Tags~~ | ✅ Addressed in R.10 (name/color inline; merge/delete remain modals) |
| Inline edit for Swatches | Still uses SwatchCreateModal/SwatchEditModal |
| Polymorphic list renderers | Swatches not refactored to color grid; Departments not refactored to tree |
| ~~Profiles as primary surface~~ | ✅ Deprecated in R.18 — Talent is now canonical |
| Crew layout redesign | Future work; separate layout planned |
| Visual redesign | Incremental improvements only |
| Mobile responsive | Desktop-first |

---

## Document History

| Date | Delta | Change |
|------|-------|--------|
| 2026-01-26 | R.18 | Profiles surface deprecated; Talent is canonical people browsing page |
| 2026-01-26 | R.17 | Talent Gallery Grid + Expand-Down Cockpit |
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
