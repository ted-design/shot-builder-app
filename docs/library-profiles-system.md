# Library Profiles System

> **Initiative R — Library Domain Architecture & Editing Model**
> **Delta R.3** — Design & Architecture specification. No code changes.
> **Status**: Approved design, ready for R.4 implementation delta.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Canonical Profile Model](#canonical-profile-model)
3. [Route Strategy](#route-strategy)
4. [Editing Rules](#editing-rules)
5. [Search & Filtering Philosophy](#search--filtering-philosophy)
6. [Surface Sketches](#surface-sketches)
7. [R.4 Implementation Proposal](#r4-implementation-proposal)

---

## Problem Statement

### The Current State

Shot Builder's Library contains two "Profile" archetype domains: **Talent** and **Crew**. Both represent people with identity, contact information, and metadata. Despite their conceptual similarity, they are implemented as entirely separate systems:

| Aspect | Talent | Crew |
|--------|--------|------|
| **Page component** | `LibraryTalentPage.jsx` (932 lines) | `LibraryCrewPage.jsx` (900 lines) |
| **Edit modal** | `TalentEditModal.jsx` | `CrewEditModal.jsx` |
| **Create modal** | `TalentCreateModal.jsx` | Inline `CrewCreateModal` |
| **Data hook** | `useTalent` via `useFirestoreQuery` | `useOrganizationCrew` |
| **Firestore path** | `clients/{clientId}/talent` | `clients/{clientId}/crew` |

### Problems Identified

| Problem | Impact |
|---------|--------|
| **Code duplication** | ~1,800 lines of nearly identical rail/canvas/modal code |
| **Inconsistent editing** | Both use modals despite R.1 establishing inline-edit as canonical |
| **No unified discovery** | Users must navigate to two separate pages to browse all people |
| **Divergent UX** | Talent has measurements & gallery; Crew has departments. No shared base |
| **Scaling limitations** | Neither page implements jump navigation for large lists (R.1 identified crew scaling as a concern) |

### What Success Looks Like

A unified Profile system where:

1. **Talent and Crew are contextual views** of a canonical Profile concept
2. **Common UI components** handle display, search, and filtering
3. **Inline editing** replaces modal workflows (per R.1 principles)
4. **A single "Profiles" destination** allows discovery across all people
5. **Context-specific extensions** (measurements for talent, departments for crew) layer cleanly on the base

---

## Canonical Profile Model

### Design Principle: Core + Extensions

The Profile model consists of a **stable core** that all profiles share, plus **contextual extensions** that vary by profile type.

### Core Profile (Shared by All)

```typescript
interface ProfileCore {
  // Identity
  id: string;
  firstName: string;
  lastName: string;
  displayName?: string;        // Computed or user-specified

  // Visual identity
  primaryImagePath: string | null;    // Headshot/portrait
  primaryImageUrl?: string;

  // Contact
  email: string | null;
  phone: string | null;

  // Classification
  profileType: 'talent' | 'crew';     // Discriminator
  tags?: string[];                     // Future: cross-type tagging

  // Notes
  notes: string | null;               // Rich text (HTML)

  // Audit
  createdAt: Timestamp;
  createdBy: string;
  updatedAt: Timestamp;
  updatedBy: string;

  // Org scope
  clientId: string;
  projectIds?: string[];              // Linked projects (optional)
}
```

### Talent Extension

```typescript
interface TalentProfile extends ProfileCore {
  profileType: 'talent';

  // Agency representation
  agency: string | null;
  url: string | null;                 // Portfolio URL

  // Gender for wardrobe purposes
  gender: 'male' | 'female' | 'non-binary' | string | null;

  // Measurements (structured for range search)
  measurements: {
    height?: number | string;         // Normalized to inches or string
    bust?: number | string;
    waist?: number | string;
    hips?: number | string;
    inseam?: number | string;
    collar?: number | string;
    sleeve?: number | string;
    dress?: string;
    shoes?: string;
    [key: string]: number | string | undefined;
  } | null;

  // Gallery images for portfolio
  galleryImages?: GalleryImage[];
}

interface GalleryImage {
  id: string;
  path: string;
  downloadURL?: string;
  description?: string;
  cropData?: CropData | null;
  order: number;
}
```

### Crew Extension

```typescript
interface CrewProfile extends ProfileCore {
  profileType: 'crew';

  // Company/organization
  company: string | null;

  // Department structure
  departmentId: string | null;
  positionId: string | null;

  // Rate/availability (future consideration)
  // rateInfo?: RateInfo;
  // availability?: AvailabilityStatus;
}
```

### Why This Structure

| Decision | Rationale |
|----------|-----------|
| **`profileType` discriminator** | Enables polymorphic queries while maintaining type safety |
| **Core contact fields shared** | Email/phone patterns identical across types |
| **Extensions as interfaces** | TypeScript can enforce type-specific fields |
| **No schema migration required** | Existing collections work as-is; model is logical overlay |

### Firestore Reality (No Migration)

This model does NOT require schema changes. The existing collections remain:

- `/clients/{clientId}/talent` → TalentProfile documents
- `/clients/{clientId}/crew` → CrewProfile documents

The Profile model is a **conceptual unification** for UI purposes. A future delta (R.6+) could consider collection consolidation, but R.4 implements unified UI over existing data.

---

## Route Strategy

### Current Routes (Preserved)

```
/library/talent     → LibraryTalentPage (existing)
/library/crew       → LibraryCrewPage (existing)
```

### New Routes (R.4)

```
/library/profiles              → ProfilesDiscoveryPage (NEW)
/library/profiles?type=talent  → Filtered to talent only
/library/profiles?type=crew    → Filtered to crew only
/library/profiles/:id          → Profile detail (NEW, optional)
```

### Route Behavior

| Route | Behavior |
|-------|----------|
| `/library/profiles` | Shows all profiles (talent + crew) in unified list |
| `/library/profiles?type=talent` | Pre-filtered to talent; URL reflects filter state |
| `/library/profiles?type=crew` | Pre-filtered to crew; URL reflects filter state |
| `/library/profiles/:id` | Deep link to specific profile (optional; R.4 may use local selection) |

### Why Unified + Filtered

1. **Discovery**: Users can browse all people from one place
2. **URL as state**: Filter state is shareable/bookmarkable
3. **Backwards compatibility**: Original routes remain, redirect to filtered view
4. **Mental model**: "Profiles" is a superset; "Talent" and "Crew" are lenses

### Hub Integration

The Library Hub (`/library`) should:
- Keep existing "Profiles" section with Talent and Crew tiles
- Add subtle link to "View all profiles" that navigates to `/library/profiles`
- Tiles continue to navigate to type-filtered views

### Sidebar Navigation

The sidebar Library submenu should evolve to:

```
Library
├── Overview       → /library
├── Profiles       → /library/profiles (NEW)
│   ├── Talent     → /library/profiles?type=talent
│   └── Crew       → /library/profiles?type=crew
├── Locations      → /library/locations
├── Departments    → /library/departments
├── Tags           → /library/tags
└── Swatches       → /library/palette
```

This replaces the current flat Talent/Crew entries with a nested "Profiles" group.

---

## Editing Rules

### Canonical Model: Inline Edit by Default

Per R.1, the Library editing model is:

> "Click a field → type → save without leaving context"

### Editing State Machine

```
┌──────────────────────────────────────────────────────────────────┐
│                        VIEW MODE                                  │
│  All fields displayed as formatted text                          │
│  Editable fields show subtle hover affordance (cursor: text)     │
└──────────────────────────┬───────────────────────────────────────┘
                           │ Click editable field
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                       FIELD EDIT MODE                             │
│  Clicked field transforms to input                               │
│  Focus ring indicates edit state                                 │
│  Other fields remain in view mode (dimmed slightly)              │
└──────────────────────────┬───────────────────────────────────────┘
                           │ Blur / Enter / Escape
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│                        SAVE / CANCEL                              │
│  Enter or blur → Save change → Return to view mode               │
│  Escape → Cancel → Return to view mode (no save)                 │
│  Error → Show inline error message, stay in edit mode            │
└──────────────────────────────────────────────────────────────────┘
```

### Field Types and Edit Patterns

| Field Type | Edit Pattern |
|------------|--------------|
| **Single-line text** (name, email, phone) | Click → Input field → Enter/blur to save |
| **Multi-line text** (notes) | Click → Textarea → blur to save; auto-resize |
| **Select** (gender, department) | Click → Dropdown → Selection saves immediately |
| **Measurements grid** | Click cell → Input → Tab to next cell or blur to save |
| **Image** (headshot) | Click → File picker or dropzone inline; upload saves immediately |
| **Gallery** | Click "Add" → Inline dropzone; drag to reorder; click to edit description |

### Visual Affordances

```
┌─────────────────────────────────────────────────────────────────┐
│                    VIEW STATE (Default)                          │
│                                                                  │
│  Name             Jane Smith              ← hover shows underline │
│  ─────────────────────────────                                   │
│  Email            jane@example.com        ← hover cursor: text   │
│  Phone            +1 555-1234                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    EDIT STATE (Field Active)                     │
│                                                                  │
│  Name             ┌─────────────────────────────────────┐       │
│                   │ Jane Smith                     │ ✓ │ ✗ │    │
│                   └─────────────────────────────────────┘       │
│                   ↑ Focus ring                    Save  Cancel  │
│  Email            jane@example.com   ← dimmed, still viewable   │
│  Phone            +1 555-1234                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### When Modals ARE Permitted

| Scenario | Rationale |
|----------|-----------|
| **Create new profile** | No existing context to edit inline; modal gathers minimum fields |
| **Delete confirmation** | Destructive action requires explicit acknowledgment |
| **Bulk actions** | Merge profiles, batch delete require preview |
| **Image crop** | Complex interaction benefits from focused modal |

### When Modals ARE NOT Permitted

| Scenario | Why |
|----------|-----|
| **Editing existing profile fields** | User is already viewing context; inline is faster |
| **Single-field updates** | Modal is overkill; click-edit-save is instant |
| **"Edit" button that opens full form** | Violates inline principle; fragments context |

### Migration from Current Modals

| Current | Target |
|---------|--------|
| `TalentEditModal` | Deprecated; inline edit on canvas |
| `CrewEditModal` | Deprecated; inline edit on canvas |
| `TalentCreateModal` | Retained for create flows |
| `CrewCreateModal` | Retained for create flows |

---

## Search & Filtering Philosophy

### Core Principle: Fast, Forgiving, Faceted

Users should be able to find profiles through multiple paths:

1. **Free text search** — Type anything, match across all text fields
2. **Type filter** — Talent vs Crew (primary facet)
3. **Secondary filters** — Agency, department, project, gender (contextual)
4. **Sort options** — Name, recent, agency/company

### Search Implementation

```typescript
interface ProfileSearchState {
  query: string;                    // Free text
  type: 'all' | 'talent' | 'crew'; // Primary filter
  filters: {
    agency?: string;               // Talent-specific
    departmentId?: string;         // Crew-specific
    projectId?: string;            // Future: linked projects
    gender?: string;               // Talent-specific
  };
  sort: {
    field: 'name' | 'recent' | 'agency' | 'company';
    direction: 'asc' | 'desc';
  };
}
```

### Search UX Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 Search profiles...                                          │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                                                           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  Type: [ All ] [ Talent ] [ Crew ]    ← Pill toggle             │
│                                                                  │
│  ▼ More filters                       ← Expandable              │
│    Agency: [ Any ▼ ]                                            │
│    Department: [ Any ▼ ]                                        │
│    Gender: [ Any ▼ ]                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Filter Behavior

| State | Behavior |
|-------|----------|
| **No query, no filters** | Show all profiles, sorted by name |
| **Query only** | Fuzzy match across name, email, agency, company, notes |
| **Type filter only** | Show all of that type |
| **Query + type** | Fuzzy match within type |
| **Secondary filters** | Contextual to type (agency only for talent, dept only for crew) |

### URL State Sync

Filter state is reflected in URL for shareability:

```
/library/profiles?q=jane&type=talent&agency=Ford
```

### Empty States

| Scenario | Message |
|----------|---------|
| **No profiles exist** | "No profiles yet. Add talent or crew to get started." |
| **Search returns nothing** | "No profiles match '{query}'. Try a different search term." |
| **Filter returns nothing** | "No {type} profiles match the current filters." |

---

## Surface Sketches

### Browse / Discover State

The unified Profiles page in discovery mode:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Library                                              [ + New Profile ]│
│                                                                          │
│  Profiles                                                                │
│  Browse talent and crew across your organization                         │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ 🔍 Search profiles...                                               │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Type: ( All ) ( Talent ) ( Crew )          Sort: [ Name A-Z ▼ ]        │
│                                                                          │
├────────────────────────┬─────────────────────────────────────────────────┤
│                        │                                                 │
│  RAIL (270px)          │  CANVAS                                        │
│                        │                                                 │
│  ┌──────────────────┐  │  ┌───────────────────────────────────────────┐ │
│  │ [📷] Jane Smith  │◀─┤  │                                           │ │
│  │     Ford Models  │  │  │           ┌─────────────┐                 │ │
│  │     ● Talent     │  │  │           │             │                 │ │
│  └──────────────────┘  │  │           │    [📷]     │                 │ │
│                        │  │           │             │                 │ │
│  ┌──────────────────┐  │  │           └─────────────┘                 │ │
│  │ [👤] Mike Chen   │  │  │                                           │ │
│  │     Photographer │  │  │         Jane Smith                        │ │
│  │     ● Crew       │  │  │         Ford Models                       │ │
│  └──────────────────┘  │  │                                           │ │
│                        │  │  ───────────────────────────────────────  │ │
│  ┌──────────────────┐  │  │                                           │ │
│  │ [📷] Alex Rivera │  │  │  📧  jane@fordmodels.com                  │ │
│  │     IMG Models   │  │  │  📞  +1 555-1234                          │ │
│  │     ● Talent     │  │  │                                           │ │
│  └──────────────────┘  │  │  📏  Measurements                         │ │
│                        │  │      Height    5'9"  │  Bust     34"      │ │
│  ┌──────────────────┐  │  │      Waist     25"   │  Hips     35"      │ │
│  │ [👤] Sarah Lee   │  │  │      Shoes     8     │  Dress    4        │ │
│  │     Production   │  │  │                                           │ │
│  │     ● Crew       │  │  │  📝  Notes                                │ │
│  └──────────────────┘  │  │      Available for SS26 campaign...       │ │
│                        │  │                                           │ │
│  ──────────────────    │  │  ───────────────────────────────────────  │ │
│  24 profiles           │  │                        [ Edit profile ]   │ │
│                        │  └───────────────────────────────────────────┘ │
└────────────────────────┴─────────────────────────────────────────────────┘
```

### Key Elements — Browse State

| Element | Purpose |
|---------|---------|
| **Type pills** | Primary filter; visual indicator of active filter |
| **Rail badges** | "● Talent" / "● Crew" distinguish types in mixed view |
| **Portrait variations** | Talent: Rectangular (3:4) for editorial. Crew: Circular (identity) |
| **Canvas sections** | Grouped by type-specific extensions (measurements for talent) |

---

### Focused Edit State

When editing a field inline:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ← Library                                              [ + New Profile ]│
│                                                                          │
│  Profiles                                                                │
│  Browse talent and crew across your organization                         │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ 🔍 Search profiles...                                               │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  Type: ( All ) (●Talent ) ( Crew )          Sort: [ Name A-Z ▼ ]        │
│                                                                          │
├────────────────────────┬─────────────────────────────────────────────────┤
│                        │                                                 │
│  RAIL                  │  CANVAS — EDIT MODE                            │
│  (dimmed)              │                                                 │
│                        │  ┌───────────────────────────────────────────┐ │
│  ┌──────────────────┐  │  │                                           │ │
│  │ [📷] Jane Smith  │◀─┤  │           ┌─────────────┐                 │ │
│  │     Ford Models  │  │  │           │             │                 │ │
│  │     ● Talent     │  │  │           │    [📷]     │  ← click to    │ │
│  └──────────────────┘  │  │           │             │    change      │ │
│                        │  │           └─────────────┘                 │ │
│  ┌──────────────────┐  │  │                                           │ │
│  │ [👤] Mike Chen   │  │  │         Jane Smith  ✎                     │ │
│  │     Photographer │  │  │         ┌────────────────────────────┐   │ │
│  │     ● Crew       │  │  │  Agency │ Ford Models            │✓│✗│   │ │
│  └──────────────────┘  │  │         └────────────────────────────┘   │ │
│                        │  │         ↑ EDITING                         │ │
│  ┌──────────────────┐  │  │  ───────────────────────────────────────  │ │
│  │ [📷] Alex Rivera │  │  │                                           │ │
│  │     IMG Models   │  │  │  📧  jane@fordmodels.com     (dimmed)     │ │
│  │     ● Talent     │  │  │  📞  +1 555-1234             (dimmed)     │ │
│  └──────────────────┘  │  │                                           │ │
│                        │  │  📏  Measurements             (dimmed)     │ │
│  ┌──────────────────┐  │  │      Height    5'9"  │  Bust     34"      │ │
│  │ [👤] Sarah Lee   │  │  │      Waist     25"   │  Hips     35"      │ │
│  │     Production   │  │  │                                           │ │
│  │     ● Crew       │  │  │  📝  Notes                   (dimmed)     │ │
│  └──────────────────┘  │  │      Available for SS26 campaign...       │ │
│                        │  │                                           │ │
│  ──────────────────    │  │  ───────────────────────────────────────  │ │
│  24 profiles           │  │     [ Unsaved changes ]  [ Discard ]      │ │
│                        │  └───────────────────────────────────────────┘ │
└────────────────────────┴─────────────────────────────────────────────────┘
```

### Key Elements — Edit State

| Element | Purpose |
|---------|---------|
| **Rail dimmed** | Focus attention on edit; discourage switching profiles mid-edit |
| **Field input** | Replaced text with input; check/X for save/cancel |
| **Other fields dimmed** | Indicate "not currently editing" |
| **Unsaved indicator** | Bottom bar shows pending changes |
| **Discard option** | Escape hatch to cancel all changes |

---

### Measurements Grid — Edit Detail

For talent profiles, measurements use a structured grid:

```
┌─────────────────────────────────────────────────────────────────────────┐
│  📏  Measurements                                                        │
│                                                                          │
│  ┌──────────────────────────────┬──────────────────────────────┐        │
│  │  Height                      │  Bust                        │        │
│  │  ┌────────────────────────┐  │  34"                         │        │
│  │  │ 5'9"             │✓│✗│ │  │  ↑ click to edit             │        │
│  │  └────────────────────────┘  │                              │        │
│  │  ↑ EDITING                   │                              │        │
│  ├──────────────────────────────┼──────────────────────────────┤        │
│  │  Waist                       │  Hips                        │        │
│  │  25"                         │  35"                         │        │
│  ├──────────────────────────────┼──────────────────────────────┤        │
│  │  Shoes                       │  Dress                       │        │
│  │  8                           │  4                           │        │
│  └──────────────────────────────┴──────────────────────────────┘        │
│                                                                          │
│  Tab to move between cells. Enter to save and move to next.             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## R.4 Implementation Proposal

### Delta R.4 — Unified Profiles Implementation

**Scope**: Implement the Profiles system as designed in R.3.

### Deliverables

1. **New `ProfilesPage.jsx`** — Unified discovery surface at `/library/profiles`
2. **New `ProfileCard.jsx`** — Rail item component with type badge
3. **New `ProfileCanvas.jsx`** — Detail view with inline edit support
4. **New `InlineEditField.jsx`** — Reusable inline edit component
5. **Routing updates** — Add `/library/profiles` route, preserve legacy routes
6. **Sidebar update** — Nest Talent/Crew under "Profiles" group
7. **Hub update** — Add "View all profiles" link

### Explicit Boundaries

| In Scope | Out of Scope |
|----------|--------------|
| New unified page component | Schema/collection changes |
| Inline edit for text fields | Inline edit for images (modal ok) |
| Type filter (Talent/Crew) | Advanced filters (agency, dept) |
| URL state sync for type | Deep link to specific profile |
| Basic search across all profiles | Fuzzy/faceted search engine |
| Desktop layout | Mobile responsive (defer to R.5) |

### Does NOT Touch

| Item | Reason |
|------|--------|
| Existing Talent/Crew pages | Preserved as redirects; deprecated later |
| Firestore collections | No schema changes |
| TalentCreateModal | Retained for create flows |
| CrewCreateModal | Retained for create flows |
| Other Library domains | Out of R.4 scope |

### Files Changed (Estimated)

| File | Change |
|------|--------|
| `src/pages/ProfilesPage.jsx` | **NEW** — Main unified page |
| `src/components/profiles/ProfileCard.jsx` | **NEW** — Rail item |
| `src/components/profiles/ProfileCanvas.jsx` | **NEW** — Detail canvas |
| `src/components/profiles/InlineEditField.jsx` | **NEW** — Edit primitive |
| `src/App.jsx` | Add route for `/library/profiles` |
| `src/components/layout/SidebarNav.jsx` | Update Library submenu |
| `src/pages/LibraryHubPage.jsx` | Add "View all" link |
| `src/pages/LibraryTalentPage.jsx` | Add redirect to `/library/profiles?type=talent` |
| `src/pages/LibraryCrewPage.jsx` | Add redirect to `/library/profiles?type=crew` |

### Acceptance Criteria

1. **Discovery**: User can browse all profiles from `/library/profiles`
2. **Filtering**: Type pills filter between All/Talent/Crew
3. **URL state**: Filter state reflected in URL
4. **Inline edit**: Text fields (name, email, phone, agency, notes) edit inline
5. **Visual distinction**: Talent and Crew profiles visually distinguishable in rail
6. **Backward compat**: Old routes redirect to new filtered views
7. **Performance**: Page loads in <1s for 100 profiles

### Why This Scope

| Decision | Rationale |
|----------|-----------|
| **Text fields only for inline edit** | Highest impact, lowest complexity |
| **No image inline edit** | Cropping UX benefits from modal |
| **No advanced filters yet** | Start simple; add complexity based on use |
| **Preserve old pages as redirects** | Non-breaking change; graceful migration |

---

## Visual References

### Design Sensibility Sources

| Source | Observations Applied |
|--------|----------------------|
| **KoboLabs (kobolabs.io)** | Calm, editorial rhythm; generous whitespace; muted warm palette; restrained interactions |
| **Products V3 (internal)** | Workspace pattern (rail + canvas); section headers; bento cards; inline surfaces |
| **Shot Editor V3 (internal)** | Contextual panels; progressive disclosure; inline editing affordances |

### Color Palette (Inherited from App)

| Token | Usage |
|-------|-------|
| `slate-50` | Rail background |
| `white` | Canvas background |
| `slate-900` | Primary text |
| `slate-500` | Secondary text |
| `primary` | Links, focus rings |
| `emerald-500` | Success states |
| `amber-500` | Warning/caution |

### Typography (Inherited)

| Element | Style |
|---------|-------|
| Page title | `text-lg font-semibold` |
| Section header | `text-sm font-semibold uppercase tracking-wide` |
| Profile name (rail) | `text-sm font-medium` |
| Profile name (canvas) | `text-2xl font-semibold` |
| Field labels | `text-sm font-medium text-slate-600` |
| Field values | `text-base text-slate-900` |

---

## Document History

| Date | Delta | Author | Notes |
|------|-------|--------|-------|
| 2026-01-26 | R.3 | Claude (assisted) | Design & architecture specification |

---

*This document is the authoritative design reference for the Library Profiles System. Implementation delta R.4 should reference this specification. Deviations require amendments to this document.*
