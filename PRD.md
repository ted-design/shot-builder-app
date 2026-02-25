# Product Requirements -- Shot Builder

---

## Vision

Shot Builder is the production planning tool for fashion and commercial photography. It replaces the chaos of spreadsheets, email chains, Slack threads, paper call sheets, and tribal knowledge with a single source of truth.

**Goal:** Materially reduce the time and friction it takes to move from a brief to a fully shoot-ready state.

**Identity:** Professional and precise. Clean, structured, corporate-grade. Think: Bloomberg Terminal meets Notion -- confidence and control, not flashy or playful.

**Business model:** Agency tool built by Immediate Group for brand/retailer clients. Currently serving one client, with aspirations to duplicate for other clients with per-org customization. Multi-tenant by design (clientId scoping).

---

## What Shot Builder Eliminates

| Problem | How SB Solves It |
|---------|-----------------|
| **Wrong products on set** | Pull sheets auto-generated from shot assignments. Warehouse fulfillment tracked item-by-item. >95% accuracy target. |
| **Communication gaps** | Single source of truth with real-time status. Everyone sees the same data. No "did you get my email?" |
| **Replanning / rework** | Changes cascade visibly. Version/audit trail shows who changed what and when. |
| **Time to plan** | Keyboard-first interaction, inline editing, smart defaults, command palette. Fewer clicks = faster planning. |

---

## Target Users

All users onboard simultaneously. The app must work for every role from day one.

### Producer (Primary)

- **Role:** admin or producer
- **Context:** Desktop, planning ahead of shoot. 3-10 active projects, 50-200 shots.
- **Job:** Move projects from brief to shoot-ready as fast as possible. Coordinate team. React to changes.
- **Day:** Planning early in project lifecycle, coordinating mid-project, reviewing/adjusting late.
- **Pain points:** Too many clicks to plan a shot. Navigation doesn't match mental model. Can't find features. Shot editing workflow is clunky.

### Wardrobe Stylist

- **Role:** producer or wardrobe
- **Context:** Desktop for planning, mobile/tablet on-set for reference.
- **Job:** Assemble, track, and fulfill product pulls for each shoot.
- **Pain points:** Pull sheet generation requires too many steps. Hard to see what's missing.

### Warehouse Operator

- **Role:** warehouse
- **Context:** Mobile in warehouse. May access via shared link or app login.
- **Job:** Pick, pack, and confirm pull sheet items accurately. Track sample lifecycle.
- **Pain points:** Item list hard to scan on phone. Fulfillment status unclear. One-handed operation needed.
- **Physical workflow:** Walk through warehouse pulling products off shelves. Check in/out samples. Track condition and returns.

### Crew Member

- **Role:** crew
- **Context:** Tablet (iPad) on-set. Phone as fallback.
- **Job:** Reference shots, update status, flag issues during production.
- **Pain points:** Can't quickly find today's shots. Too much UI chrome for a tablet.

### Brand Creative Director

- **Role:** varies (producer or viewer)
- **Context:** Desktop review sessions.
- **Job:** Approve/reject shot plans. Provide creative direction. Review reference images.

### Brand Product Manager

- **Role:** varies
- **Context:** Desktop.
- **Job:** Provide product input (catalog data, launch dates, sample availability). Track which products are assigned to shoots.

### Brand Marketing Lead

- **Role:** viewer
- **Context:** Desktop.
- **Job:** Track overall project status and health. View progress without editing.

---

## Core User Journeys

### Journey 1: Brief to Shoot-Ready (HERO)

This is the primary workflow. Everything else supports this pipeline.

1. **Create project** -- Name + shoot dates (2 fields). Project appears on dashboard as "Not Started."
2. **Add shots** -- Quick-add from shot list: title + Enter. Batch paste for multiple titles. Shots default to "Draft."
3. **Assign resources** -- For each shot: products (inline picker from library), talent, location. No separate pages.
4. **Review readiness** -- Dashboard shows derived readiness: X shots planned, Y products assigned, Z talent confirmed. Auto-computed, not manual checklist.
5. **Generate pull sheets** -- Select shots, auto-generate pull sheet with required SKUs. Pull status: "Draft."
6. **Share pull sheet** -- Public share link to warehouse team.
7. **Confirm fulfillment** -- Warehouse marks items picked. Producer sees updated pull status in real-time.
8. **Create call sheet** -- Time-based schedule: who does what, when, where for each shoot day.
9. **Shoot-ready** -- Derived when: all shots have assignments + all pulls fulfilled + call sheet finalized.

### Journey 2: Shot Editing (Core Loop)

This is where producers spend 80% of their time. Must be fast and fluid.

**Hybrid approach:**
- **Inline quick edits** on the list view: title, status, notes, tags. Click to edit, auto-save on blur.
- **Detail panel** for complex fields: product assignments, talent, location, hero image, looks, references. Slide-over or drill-down.
- **Keyboard-first:** Tab between shots, Enter to drill in, Escape to close, Cmd+K for any action.
- **No page refreshes.** No multi-step wizards for common actions.
- **Auto-save** with debounce. No save button.

### Shot Status Model

Every shot progresses through four statuses. These labels are canonical across all views, filters, badges, and exports.

| Firestore value | Display label | Meaning |
|---|---|---|
| `todo` | **Draft** | Created but not yet actively being worked on |
| `in_progress` | **In Progress** | Actively being planned, assigned, or prepared |
| `on_hold` | **On Hold** | Paused pending a decision, resource, or external input |
| `complete` | **Shot** | Photographed and complete — ready for delivery |

"Draft" and "Shot" are intentional domain-specific terms. "Draft" means the shot plan is not finalized. "Shot" means the photograph has been taken. Do not substitute generic alternatives (To do, Complete, Done).

### Journey 3: Warehouse Fulfillment (Mobile)

- **Guided pick flow:** One item at a time, full-screen steps.
  - Step 1: Large product image + name + aisle/shelf location + quantity.
  - Step 2: Tap "Picked" -> confirm or flag issue (out of stock, damaged, wrong item).
  - Step 3: Auto-advance to next item. Progress: "Item 7 of 23."
- **Elevated quick filters:** "My Picks", "High Priority", "Ready to Ship" as tap-to-toggle chips.
- **Optimized for one-handed operation** while other hand pulls product.

### Journey 4: On-Set Operations (Tablet)

- **Gallery view** of shots with reference images for visual scanning.
- **Floating bottom action bar:** "Add Photo", "Mark Shot", "Add Note" -- always accessible.
- **Single-tap status updates.** Flag issues for producer attention.
- **Minimal chrome.** Content-first. No sidebar on tablet (off-canvas drawer).

### Journey 5: Brand Stakeholder Review

- Clean read-only views with shot plans, progress, and status.
- Comment, approve/reject, provide creative direction.
- Dashboard showing project health at a glance.
- **Future:** Dedicated client-facing portal (top wishlist priority).

### Journey 6: Product Lifecycle (Aspirational)

- Full lifecycle: catalog entry -> sample tracking -> shoot assignment -> photography -> asset delivery -> return.
- Product team uses Shot Builder as source of truth for product status.
- Track: when products arrive, launch dates, sample availability, when to shoot.
- Multiple input methods: CSV bulk import, manual entry, API integration (future).

---

## Feature Priority Matrix

| Priority | Features |
|----------|----------|
| **Must-Have** | Projects + dashboard with readiness, shots (inline edit + detail panel), product assignment to shots, pull sheet generation + fulfillment + sharing, call sheets, Cmd+K command palette, keyboard shortcuts, mobile/tablet operations |
| **Should-Have** | Product library CRUD, talent/crew/locations library, comments + activity feed, tags, notifications, admin/settings, board column reorder + show/hide |
| **Nice-to-Have** | PDF export, CSV import/export, color palette/swatches, department management, demo mode |
| **Cut / Simplify** | Planner/drag-and-drop board (users don't use it), advanced theming, deep versioning UI, offline writes, V2/V3 parallel surfaces |
| **Future Wishlist** | Client-facing portal (TOP), reporting/analytics, AI-assisted planning, post-shoot asset management |

---

## UX Principles

### 1. Command palette as primary discovery

Cmd+K finds any entity, triggers any action. Users should never need to navigate a menu hierarchy to find something. (Inspired by Linear)

### 2. Keyboard-first interaction

Mouse is supported but not required for common workflows. (Inspired by Linear)

| Shortcut | Context | Action |
|---|---|---|
| `Cmd+K` | Global | Command palette (search + actions) — Phase 7 |
| `N` | Shot list | Focus quick-add input |
| `1` / `2` / `3` / `4` | Shot list | Switch view: gallery / visual / table / board |
| `Escape` | Shot detail | Return to shot list |
| `Cmd+S` | Shot detail | Prevent browser save dialog (auto-save handles persistence) |

### 3. Inline editing by default

Click to edit. Auto-save on blur. No "edit mode" toggle. No save button. Changes persist immediately. (Inspired by Notion)

### 4. Progressive disclosure

Common fields visible. Complex fields expand on demand. Default visible: title, status, assigned products, talent, location. Collapsed: notes, comments, change history, technical specs. (Inspired by Notion)

### 5. Readiness as organizing principle

The UI always answers: "What's left before this project is shoot-ready?" Readiness is derived from data (shots assigned, products pulled, call sheet finalized), not manually toggled.

### 6. Adaptive density

Desktop: full panels (three-panel layout). Tablet: collapsible panels, off-canvas drawer. Mobile: single-column cards. One layout system, three density modes. (Inspired by Figma)

### 7. Fewer surfaces, fewer modes

Each page must justify its existence. Prefer inline actions and progressive disclosure over new routes. No one-off component variants.

### 8. Visual-first where it matters

Shot cards with hero images. Product thumbnails in pickers. Gallery view for creative review sessions with brand stakeholders. (Inspired by Canva)

---

## UX Patterns to Adopt

| Pattern | Source | Application in Shot Builder |
|---------|--------|-----------------------------|
| Command palette (Cmd+K) | Linear | Universal search + action hub across projects, shots, products, talent, locations |
| Inline field editing | Linear | Click-to-edit title, status, assignments on shot/pull list rows |
| Status icon click-to-advance | Linear | Single-click status transitions with valid-next-state dropdown |
| Click-to-edit with auto-save | Notion | No edit mode, no save button, Firestore writes on blur |
| Multi-view (table/board/gallery) | Notion | Shot list: table (data entry), board (status kanban), gallery (creative review) |
| Filter/sort/group control bar | Notion | Compact chip-based filtering above every list view |
| Three-panel layout | Figma | Desktop shot editor: shot list / canvas / properties inspector |
| Contextual properties panel | Figma | Right panel adapts based on selected entity (shot, product, talent) |
| Floating bottom action bar | Figma | Mobile/tablet contextual actions, always accessible |
| Visual card grid | Canva | Gallery view for creative review with brand stakeholders |
| Multi-step mobile flow | Canva | Guided warehouse pick: one item at a time, full-screen steps |
| Elevated quick filters | Canva | Prominent filter chips for warehouse queue |
| Collapsible sidebar ([ key) | Linear | Keyboard toggle for maximum content area |
| Pinned + recent items | Notion | Quick access to active projects/entities in sidebar |
| Presence indicators | Figma | Show who's editing what to prevent conflicts |

---

## Anti-Goals

- **Not a generic project management tool.** This is opinionated for production planning workflows.
- **Not maximum flexibility.** Fewer knobs, fewer modes. Opinionated defaults over configuration.
- **Not mobile-first development.** Desktop is the primary creation surface. Mobile/tablet are operational.
- **No custom offline sync engine.** Firestore's default IndexedDB persistence is the ceiling.
- **No user-customizable themes.** Design tokens are fixed and consistent.
- **No feature parity on day 1.** Ship iteratively.

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Brief to shoot-ready time | Measurably faster than spreadsheet-based planning |
| Pull sheet accuracy | >95% items correctly fulfilled without change orders |
| Mobile task completion | 100% of designated mobile actions completable |
| New user onboarding | Productive within first session, no training required |
| Error rate (Sentry) | <0.5% of sessions |
| LCP on 4G mobile | <2.5s |
| Time to first useful action | <5s from login |

---

## Shoot Types

The app handles both:
- **E-commerce / catalog:** High-volume product photography. Hundreds of SKUs, standardized shots, efficiency is everything.
- **Editorial / campaign:** Creative shoots with talent, styling, locations. Fewer shots but more complex planning per shot.

Shot-to-product relationships are variable: 1 shot = 1 product (e-commerce) through 1 shot = many products + talent + props (campaign).

## Project Scope

Projects are flexible: single shoot day, multi-day shoots, or ongoing campaigns. The data model supports all three via `shootDates[]` arrays.

## Change Management

When plans change (product unavailable, talent cancellation, schedule shift): show impact clearly, maintain version/audit trail (who/when/why), and let the producer decide the response. The tool absorbs change gracefully.
