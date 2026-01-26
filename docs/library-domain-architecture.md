# Library Domain Architecture

> **Initiative R — Library Domain Architecture & Editing Model**
> **Delta R.1** — Documentation-only. No code changes.
> **Status**: Draft specification for guiding all future Library work.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Library Purpose & Principles](#library-purpose--principles)
3. [Domain Inventory & Archetypes](#domain-inventory--archetypes)
4. [Canonical Navigation Model](#canonical-navigation-model)
5. [Canonical Editing Model](#canonical-editing-model)
6. [Transition Plan](#transition-plan)
7. [Freeze List](#freeze-list)

---

## Problem Statement

### The Current State

The Library section of Shot Builder has evolved through incremental L.x deltas (L.1 through L.5) that applied a master-detail shell pattern uniformly across domains. While this brought visual consistency, it introduced systemic issues that prevent the Library from achieving the design maturity of Products V3 or Shot Editor V3.

### Anti-Patterns Identified

| Anti-Pattern | Manifestation | Impact |
|--------------|---------------|--------|
| **Page-by-page shell rewrites without a system model** | Each L.x delta copied the rail+canvas layout from the previous one | No coherent vision; domains that need different surfaces get forced into the same mold |
| **Overuse of left-rail + canvas regardless of domain** | Talent, Crew, Locations, Departments all use identical ~72px rail + full canvas | Classification domains (Tags, Palette) with 20-200 items don't benefit from this layout; it wastes space and creates false equivalence |
| **Editing escapes to legacy modals** | `CrewEditModal`, `TalentEditModal`, etc. launched from canvas | Users are yanked out of context; modal closes = lost mental state; inconsistent with Products V3 inline editing |
| **Lack of domain-specific contextual surfaces** | All domains rendered identically despite vastly different user intents | A crew member with 6 fields doesn't need the same canvas real estate as a talent profile with photos, measurements, and history |

### The Products V3 Standard

Products V3 established the design bar for Shot Builder workspaces:

- **Contextual surfaces**: SKU detail inline-expands, doesn't escape to modal
- **Progressive disclosure**: Show what matters first, reveal complexity on demand
- **Edit-in-place**: Click a field → edit inline → blur or Enter to save
- **Navigation clarity**: Clear hierarchy, no ambiguous "where am I?" states

The Library fails to meet this standard. This document defines the architecture required to close the gap.

---

## Library Purpose & Principles

### What the Library Is FOR

The Library is the **organization-level asset repository** for a production studio. It contains reusable resources that exist independently of any single project:

| Domain | Purpose |
|--------|---------|
| **Talent** | Model profiles available for casting across projects |
| **Crew** | Production team members with roles and contact info |
| **Locations** | Shooting venues with logistics details |
| **Departments** | Organizational structure for crew assignment |
| **Tags** | Classification vocabulary for shots |
| **Palette** | Standardized color swatches for products |

The Library is NOT:
- A project workspace (that's Shot Builder)
- A transactional system (that's Pulls)
- A planning canvas (that's Planner)

### Design Principles

#### 1. Contextual Over Generic

Different domains require different surfaces. A Profile domain (Talent, Crew) benefits from portrait-centric detail views. A Classification domain (Tags, Palette) benefits from dense, scannable lists. The Library must support both without forcing a one-size-fits-all layout.

#### 2. Progressive Disclosure

Show essential information first. Reveal complexity (notes, history, linked projects) on user demand. Avoid overwhelming users with every field simultaneously.

#### 3. Edit-in-Place by Default

Inline editing is the canonical interaction model. Users should be able to:
- Click a field → type → save without leaving context
- See changes reflected immediately
- Understand edit state clearly (visual affordance for editing vs. viewing)

Modals are exceptions, not defaults.

#### 4. Navigation Clarity Over Density

The user should always know:
- Where they are in the Library hierarchy
- How to get to related domains
- What actions are available

Density is acceptable for data lists. Density is harmful for navigation.

#### 5. Calm, Intentional, Editorial

Following the KoboLabs design sensibility:
- Generous whitespace over cramped layouts
- Clear visual hierarchy with confident typography
- Muted, warm palette over aggressive colors
- Motion and interaction that feels considered, not arbitrary

---

## Domain Inventory & Archetypes

The Library contains six domains. These map to three distinct archetypes:

### Archetype 1: Profiles

**Domains**: Talent, Crew

**Primary User Intent**: View and manage individual people with rich identity information.

**Characteristics**:
- Each entity has a portrait/avatar as primary visual anchor
- Medium entity count (10-200 typical)
- Rich metadata: contact info, measurements, history, linked projects
- Frequent read, occasional write

**Appropriate Surface Type**: Master-detail with portrait-centric canvas.

**List/Rail Necessity**: Yes — users need to scan and select individuals.

**Canonical Editing Model**:
- View mode shows formatted data
- Edit mode activates inline fields on canvas
- Save/Cancel actions at canvas level
- NO modal for editing existing profiles

**Scaling Strategy**:
- Search + filter in rail
- Alphabetical or recent-first sorting
- Lazy loading for 200+ profiles

---

### Archetype 2: Structure

**Domains**: Departments

**Primary User Intent**: Define and modify organizational hierarchy (departments → positions).

**Characteristics**:
- Hierarchical data: parent (department) → children (positions)
- Low entity count (5-20 departments typical)
- Simple metadata per entity
- Infrequent write, occasional read

**Appropriate Surface Type**: Expandable list with inline editing.

**List/Rail Necessity**: Conditional — with <20 departments, a full rail is overkill. An expandable single-column list may suffice.

**Canonical Editing Model**:
- Click department name → inline edit
- Add position → inline form row within expanded department
- Delete → inline action with confirmation popover (not modal)

**Scaling Strategy**:
- Unlikely to scale beyond 30 departments
- If it does, group by category (Production, Post, Admin)

---

### Archetype 3: Classification

**Domains**: Tags, Palette

**Primary User Intent**: Manage vocabularies and visual standards used across the system.

**Characteristics**:
- Many small, simple entities (20-500 items)
- Minimal metadata per entity (name, color, aliases)
- Batch operations common (merge tags, seed palette from products)
- Reference data — consumed by other domains

**Appropriate Surface Type**: Dense table or grid with bulk actions.

**List/Rail Necessity**: No — a left rail doesn't add value for flat classification lists. A single-column table with inline editing is superior.

**Canonical Editing Model**:
- Inline row editing (click cell → edit → blur to save)
- Bulk select + batch actions (merge, delete)
- Create via inline "new row" pattern, not modal

**Scaling Strategy**:
- Virtual scrolling for 200+ items
- Search + filter always visible
- Group by category if meaningful (tag groups, color families)

---

### Archetype Summary

| Archetype | Domains | Rail | Canvas | Edit Model |
|-----------|---------|------|--------|------------|
| **Profiles** | Talent, Crew | Yes (scan + select) | Portrait-centric detail | Inline fields on canvas |
| **Structure** | Departments | Conditional | Expandable list | Inline expand + edit |
| **Classification** | Tags, Palette | No | Dense table/grid | Inline cell editing |

---

## Canonical Navigation Model

### Problem: Library Defaults to Talent

Currently, navigating to `/library` redirects to `/library/talent`. This creates false hierarchy — Talent is not more important than other domains.

### Solution: Library Hub

The Library should have a dedicated hub page (`/library`) that provides:
- Overview of all Library domains
- Quick access to each domain
- Aggregate statistics (X talent, Y crew, Z locations)
- Recent activity across domains

### Hub Variants

Three variants are presented for consideration. Each prioritizes different user needs.

---

#### Variant A: Bento-Style Hub

Inspired by KoboLabs' calm, editorial approach.

```
┌─────────────────────────────────────────────────────────────────┐
│  Library                                                        │
│  Organization-wide assets for your productions                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │                     │  │                     │              │
│  │    👤 TALENT        │  │    👥 CREW          │              │
│  │    12 profiles      │  │    8 members        │              │
│  │                     │  │                     │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                 │
│  ┌─────────────────────┐  ┌─────────────────────┐              │
│  │                     │  │                     │              │
│  │    📍 LOCATIONS     │  │    🏢 DEPARTMENTS   │              │
│  │    5 venues         │  │    4 departments    │              │
│  │                     │  │                     │              │
│  └─────────────────────┘  └─────────────────────┘              │
│                                                                 │
│  ┌───────────────────────────────────────────────┐             │
│  │                                               │             │
│  │    🏷️ TAGS              🎨 PALETTE            │             │
│  │    45 tags              28 swatches          │             │
│  │                                               │             │
│  └───────────────────────────────────────────────┘             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Why this variant exists**: Prioritizes visual breathing room and editorial clarity. Each domain tile is a clear, tappable target. Statistics provide at-a-glance utility.

**When it's preferable**: Studios with modest Library sizes who value aesthetics and calm navigation.

**Supports future expansion**: New domains (e.g., "Vendors", "Equipment") add as new tiles.

---

#### Variant B: Split Hub (Category Rail + Domain Tiles)

```
┌─────────────────────────────────────────────────────────────────┐
│  Library                                                        │
├──────────────┬──────────────────────────────────────────────────┤
│              │                                                  │
│  CATEGORIES  │  PEOPLE                                          │
│              │  ┌─────────────┐  ┌─────────────┐               │
│  ● People    │  │ 👤 Talent   │  │ 👥 Crew     │               │
│  ○ Places    │  │ 12 profiles │  │ 8 members   │               │
│  ○ Classify  │  └─────────────┘  └─────────────┘               │
│              │                                                  │
│              │  Manage talent and crew for your productions.    │
│              │                                                  │
│              │                                                  │
│              │                                                  │
│              │                                                  │
└──────────────┴──────────────────────────────────────────────────┘
```

**Why this variant exists**: Provides categorical grouping for studios that think in terms of "people vs. places vs. metadata." The left rail acts as a category filter, not a domain list.

**When it's preferable**: Larger organizations with many Library domains where ungrouped tiles become overwhelming.

**Supports future expansion**: New domains slot into existing categories or create new ones.

---

#### Variant C: Minimal Hub (Single Column, Fast, Utilitarian)

```
┌─────────────────────────────────────────────────────────────────┐
│  Library                                                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  👤  Talent ·································· 12 profiles  →  │
│  👥  Crew ···································· 8 members    →  │
│  📍  Locations ······························· 5 venues     →  │
│  🏢  Departments ····························· 4 depts      →  │
│  ─────────────────────────────────────────────────────────────  │
│  🏷️  Tags ···································· 45 tags      →  │
│  🎨  Palette ································· 28 swatches  →  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Why this variant exists**: Fastest possible navigation. No tiles, no visual flourish — just a clean list of destinations. Similar to iOS Settings.

**When it's preferable**: Power users who know what they want; minimal cognitive load.

**Supports future expansion**: New domains are additional rows.

---

### Hub Recommendation

**Start with Variant A (Bento-Style Hub)** for these reasons:

1. Aligns with KoboLabs design sensibility (calm, editorial)
2. Provides clear visual hierarchy without navigation confusion
3. Statistics on tiles deliver immediate utility
4. Scales well to 6-10 domains before needing reconsideration
5. Creates a "moment of pause" that establishes Library as a distinct area

Variant C is acceptable as a fallback if implementation complexity is high.

---

## Canonical Editing Model

### Core Rule: Inline Edit by Default

The canonical interaction for editing existing entities:

1. User views entity in its natural surface (canvas, row, card)
2. User clicks editable element (field, cell, name)
3. Element transforms to input state (text field, select, etc.)
4. User modifies value
5. User exits edit state (blur, Enter, explicit Save)
6. Change persists immediately (optimistic UI + Firestore write)
7. Surface returns to view state

### Visual Affordances

| State | Visual Cue |
|-------|------------|
| **Viewable + Editable** | Subtle hover underline or background change; cursor: text |
| **Editing** | Input field with focus ring; clear boundaries |
| **Saving** | Brief loading indicator or disabled state |
| **Error** | Inline error message; field highlighted; no modal |

### When Modals Are Permitted

Modals are **exceptions**, allowed only for:

| Scenario | Rationale |
|----------|-----------|
| **Creation flows without established context** | Creating a new talent profile requires gathering multiple fields before the entity exists. A modal provides a contained space for this. |
| **Destructive confirmation** | Deleting a department with 10 positions requires explicit acknowledgment. A confirmation popover or small modal is appropriate. |
| **Bulk operations with preview** | Merging 5 tags into 1 benefits from a preview modal showing what will happen. |

### Explicitly Prohibited

| Pattern | Why It's Prohibited |
|---------|---------------------|
| **Modal for editing existing entities** | Violates inline-edit principle; fragments user context |
| **Modal triggered by "Edit" button on detail view** | Redundant indirection; user is already in detail context |
| **Modal for single-field edits** | Overkill; inline editing is faster and less disruptive |

### Edit State Visibility Rules

1. **Only one entity in edit mode at a time** within a given surface
2. **Unsaved changes indicator** visible in canvas/card header
3. **Exit without saving prompts confirmation** if changes exist
4. **Keyboard shortcuts**: Escape = cancel, Enter = save (for single-line fields)

### Transition from Legacy Modals

Current codebase uses modals (`CrewEditModal`, `TalentEditModal`, etc.) for editing. The transition path:

1. Introduce inline edit capability on canvas
2. Deprecate "Edit" button that launches modal
3. Keep modal components temporarily for create flows
4. Refactor create flows to use modal-less patterns where feasible
5. Delete modal components once unused

---

## Transition Plan

The following deltas are proposed to implement this architecture. **Do not implement these without explicit authorization.**

### R.2 — Library Hub Implementation

**Delivers**:
- `/library` route with Bento-style hub (Variant A)
- Domain tiles with counts
- Remove auto-redirect to Talent

**Does NOT touch**:
- Individual domain pages (Talent, Crew, etc.)
- Editing patterns within domains
- Data fetching logic within domains

**Why high leverage**: Establishes Library as a coherent area; stops the "Talent is default" anti-pattern.

---

### R.3 — Talent Inline Edit Surface

**Delivers**:
- Inline editing on Talent detail canvas
- Remove TalentEditModal for edit flows (keep for create)
- Edit state affordances per canonical model

**Does NOT touch**:
- Talent rail/list
- Other Library domains
- Talent data schema

**Why high leverage**: Talent is highest-traffic Library domain; sets precedent for Crew.

---

### R.4 — Crew Scaling Model

**Delivers**:
- Jump navigation / alphabet index for large crew lists
- Role-first grouping option (group by department)
- Inline editing on Crew canvas (mirrors R.3 pattern)

**Does NOT touch**:
- Talent domain
- Departments domain
- Crew data schema

**Why high leverage**: Crew lists at 100+ members need scaling strategy; this prevents UX debt.

---

### R.5 — Classification Consolidation (Tags + Palette)

**Delivers**:
- Tags page refactored to dense table with inline cell editing
- Palette page refactored to same pattern
- Potential consolidation into unified Classification surface
- Bulk actions (merge, delete) via table selection

**Does NOT touch**:
- Profile archetypes (Talent, Crew)
- Structure archetype (Departments)
- Navigation model

**Why high leverage**: Classification domains currently misuse master-detail layout; this fixes the archetype mismatch.

---

### Optional: R.6 — Departments Inline Hierarchy

**Delivers**:
- Departments page refactored to expandable list (no rail)
- Inline position management within expanded department
- Inline department name editing

**Does NOT touch**:
- Other Library domains
- Crew assignment logic

**Why optional**: Current Departments page is functional; lower urgency than R.2-R.5.

---

## Freeze List

Until R.2 is complete and the Library Hub establishes the new foundation:

### PAUSED

| Work | Reason |
|------|--------|
| **Further L.x shell rewrites** | No more copying the rail+canvas pattern to additional domains |
| **Cosmetic tweaks to Library pages** | Visual polish without architectural alignment is wasted effort |
| **Ad-hoc fixes to Library navigation** | Wait for R.2 to establish canonical navigation |
| **New Library domains** | Architecture must be validated before expansion |

### EXCEPTIONS

| Work | Condition |
|------|-----------|
| **Critical bugfixes** | If a Library page is broken (data loss, crash), fix it |
| **Security patches** | If a vulnerability is identified, patch immediately |
| **Performance fixes** | If a Library page is unusably slow, optimize |

### ENFORCEMENT

Before starting any Library-related delta:
1. Check if it aligns with an R.x delta in this document
2. If not, propose an architecture amendment
3. Get explicit approval before implementation

---

## Appendix: Visual Analysis Notes

### KoboLabs Design Sensibility (kobolabs.io)

**Tools used**: Playwright MCP browser automation

**Pages reviewed**: Homepage (https://www.kobolabs.io/)

**Observations**:
- Calm, minimalist cream/warm-white background
- Editorial typography with clear size hierarchy (large headlines, measured body text)
- Generous whitespace — elements breathe
- Muted, warm color palette (cream, olive, charcoal)
- Single clear CTA pattern — one primary action per section
- Bento-style feature cards with icon + headline + description
- Motion is subtle and intentional

**Applicable to Library**:
- Hub should feel calm, not dense
- Domain tiles should be confident, not cramped
- Typography should establish hierarchy clearly
- Avoid aggressive accent colors

### SetHero Workflow Reference (my.sethero.com)

**Tools used**: Playwright MCP browser automation

**Pages reviewed**: Login page only (departments page requires authentication)

**Observations**:
- Could not access internal departments UI due to authentication requirement
- Mental model for departments → positions hierarchy is standard in production software
- Expand/collapse grouping is the expected pattern

**Limitations**: No direct visual access to SetHero's department management UI.

---

## Document History

| Date | Delta | Author | Notes |
|------|-------|--------|-------|
| 2026-01-26 | R.1 | Claude (assisted) | Initial architecture document |

---

*This document is the authoritative reference for all future Library work. Deltas that deviate from this architecture require explicit amendments to this document before implementation.*
