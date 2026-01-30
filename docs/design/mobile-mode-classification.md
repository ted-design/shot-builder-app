# Mobile Mode Classification Audit

> **Delta**: Design.MobileModeClassificationAudit
> **Date**: 2026-01-29
> **Status**: Design artifact — no code changes

---

## Classification Framework

| Mode | Definition |
|------|-----------|
| **Editor** | Fully usable on mobile with intentional touch-first design. Users can create, edit, and manage data. |
| **Reader** | View-only or lightly interactive. Scroll, expand, comment, share — but no heavy editing. |
| **Limited** | Partial functionality. View data + small actions (status toggle, quick add). Heavy editing deferred to desktop. |
| **Desktop-only** | Not supported on mobile beyond a redirect message or minimal fallback. |

---

## Surface Classification Table

| # | Surface | Route | Primary Intent | Current Mobile Behavior | Recommended Mode | Rationale | Key Risk if Misclassified |
|---|---------|-------|----------------|------------------------|-----------------|-----------|--------------------------|
| 1 | **Projects (Dashboard)** | `/projects` | Browse & select projects | Cards render but may overflow; filters usable | **Editor** | This is the mobile entry point. Users need to see projects, filter by lifecycle, and tap into one. Low interaction density — card grid + search. | If not Editor, users have no mobile entry point at all. |
| 2 | **Project Dashboard** | `/projects/:id/dashboard` | Overview & navigation | Stats cards render; links work | **Reader** | Read-only summary with navigation links. No editing required. Natural mobile surface. | Low risk either way — it's already simple. |
| 3 | **Shots List (Builder view)** | `/projects/:id/shots` | Browse & triage shots | Grid/table renders but cramped; bulk selection awkward on touch | **Limited** | Users should browse shots, see status, search/filter, and tap to view details. Bulk operations and table view should be suppressed on mobile. | If Editor: accidental edits, unusable table. If Reader: users can't even change shot status. |
| 4 | **Shots List (Planner view)** | `/projects/:id/shots?view=planner` | Drag-drop scheduling | Drag-drop lanes break on small screens; keyboard shortcuts irrelevant | **Desktop-only** | Multi-lane drag-drop with keyboard shortcuts is fundamentally a desktop interaction. No reasonable touch equivalent exists for cross-lane reordering at this density. | If anything but Desktop-only: broken drag-drop, corrupted shot ordering, user frustration. |
| 5 | **Shot Editor (Workspace)** | `/projects/:id/shots/:id/editor` | Deep editing of shot details | Workspace layout collapses; left dock + canvas don't fit; rich text editor problematic | **Desktop-only** | Three-panel workspace with rich text, product/look management, image attachments, versioning, and comments. Touch targets are too dense; accidental edits are high-risk. | If Editor/Limited: data corruption from accidental saves, unusable layout, broken rich text. |
| 6 | **Shot Edit Modal** | (modal overlay) | Quick shot editing | Modal is full-screen capable but multi-step tabs + product selector are dense | **Desktop-only** | Multi-step modal with rich text, product SKU selection, talent assignment, image crop, and comment threads. Too many nested interactions for mobile. | Same as Shot Editor — accidental edits, broken sub-modals. |
| 7 | **Products List** | `/products` | Browse product library | Gallery view works; table view cramped; filter bar overflows | **Limited** | Users should browse products in gallery mode and tap for details. Table view, bulk operations, and field visibility controls should be hidden on mobile. | If Editor: accidental bulk operations. If Reader: can't even search effectively. |
| 8 | **Product Detail (Workspace)** | `/products/:id` | Edit product family | Workspace left-rail + canvas collapses; colorway/SKU management is dense | **Reader** | Users on mobile want to check product details, see colorways, view sample status. Editing colorway matrices and SKU grids requires desktop precision. | If Editor: broken workspace layout, accidental SKU changes. If Desktop-only: loses legitimate reference use case. |
| 9 | **Product Import Wizard** | `/import-products` | CSV import | Multi-step wizard with column mapping; no mobile use case | **Desktop-only** | CSV upload and column mapping is inherently a desktop workflow. File selection alone is problematic on mobile. | If anything else: broken wizard, wasted user effort. |
| 10 | **Talent Library** | `/library/talent` | Browse & manage talent | Grid tiles render; cockpit expand-down is awkward on mobile | **Limited** | Users should browse talent cards and view details. Creating/editing talent profiles with measurement fields and multi-image galleries needs desktop. | If Editor: measurement field entry is error-prone on mobile. If Reader: can't even search/filter. |
| 11 | **Crew Directory** | `/library/crew` | Browse crew | List renders fine | **Limited** | Browse and view crew profiles. Creating/editing profiles should be desktop. | Low risk — simple list surface. |
| 12 | **Locations Library** | `/library/locations` | Browse locations | Grid/list renders | **Limited** | Browse locations and view details. Creating/editing with maps and multi-field forms should be desktop. | Low risk — similar to crew. |
| 13 | **Tags Manager** | `/library/tags` | Manage taxonomy | List + inspector pattern; tight layout | **Desktop-only** | Tag merging, color picking, and the list+inspector dual-pane pattern don't work on mobile. Tags are an admin function with no mobile urgency. | If Limited/Reader: confusing partial UI with no real utility. |
| 14 | **Departments** | `/library/departments` | Manage departments | List renders | **Reader** | Reference only. Department structure is set up on desktop and rarely changed. | Low risk. |
| 15 | **Palette (Swatches)** | `/library/palette` | Manage colors | Grid of swatches renders | **Reader** | Color reference on mobile is useful for on-set matching. Editing color values needs desktop precision. | If Editor: color picker is unusable on mobile. |
| 16 | **Pull Sheets List** | `/pulls` | Browse pull sheets | List renders; status badges visible | **Limited** | Users (especially warehouse staff) need to browse pulls and check status on mobile. Creating and editing pulls needs desktop. | If Reader: warehouse users can't update status. If Editor: accidental pull modifications. |
| 17 | **Pull Sheet Editor** | `/pulls/:id/edit` | Edit pull items | Editable grid with inline inputs; auto-save is dangerous on touch | **Desktop-only** | Inline-editable grid with auto-save, quantity fields, fulfillment tracking, and section management. Touch + auto-save = data corruption risk. | If anything else: accidental quantity changes saved automatically, fulfillment errors. |
| 18 | **Pull Sheet (Public View)** | `/pulls/shared/:token` | Share with external party | Renders as read-only; likely already works | **Reader** | This is explicitly a sharing surface. Read-only by design. Mobile is a primary consumption context for shared pulls. | If not Reader: breaks the sharing use case entirely. |
| 19 | **Call Sheet Builder** | `/projects/:id/schedule` | Build shoot schedule | DayStream drag-drop timeline; swimlanes collapse | **Desktop-only** | Timeline drag-drop with swimlanes, time blocks, and multi-day views. No viable touch equivalent at this density. | If anything else: broken drag-drop, corrupted schedules. |
| 20 | **Catalogue — People** | `/projects/:id/catalogue/people` | Assign people to project | Tabbed list with sidebar; dual-scope | **Limited** | Users should browse who's on the project. Adding from library is a select-and-confirm flow that could work with constraints, but the sidebar filter pattern is desktop-oriented. | If Editor: sidebar layout breaks. If Reader: can't add people to project. |
| 21 | **Catalogue — Locations** | `/projects/:id/catalogue/locations` | Assign locations to project | Similar to people catalogue | **Limited** | Same rationale as People catalogue. Browse + simple add. | Same as above. |
| 22 | **Project Settings** | `/projects/:id/settings` | Edit project metadata | Simple form | **Limited** | Basic form with name, dates, metadata. Could work on mobile but edits are infrequent enough to not justify full Editor treatment. | Low risk. |
| 23 | **Account Settings** | `/account` | Edit personal profile | Simple form | **Limited** | Basic profile form. Same as project settings. | Low risk. |
| 24 | **Admin Panel** | `/admin` | Manage users & roles | User roster + role dropdowns | **Desktop-only** | Admin operations (custom claims, role assignment, dev tools) are high-consequence and low-frequency. No mobile need. | If anything else: accidental role changes with serious security implications. |
| 25 | **Command Palette** | `Cmd+K` overlay | Quick navigation & search | Keyboard-driven; no mobile trigger | **Desktop-only** | Keyboard shortcut driven. On mobile, replaced by standard navigation. | N/A — not a page, but should be explicitly excluded from mobile. |
| 26 | **Notifications** | Bell icon dropdown | View activity | Dropdown renders | **Reader** | Notifications are a natural mobile surface. View and dismiss. | If not at least Reader: users miss on-set updates. |

---

## Mobile Design Principles

1. **Mobile is for reference and triage, not construction.** The core creation workflows (shot editing, schedule building, pull sheet authoring) are desktop activities. Mobile exists to check status, review details, and perform lightweight actions during shoots or on the go.

2. **Auto-save is hostile on mobile.** Any surface with auto-save and inline-editable fields must be Desktop-only or must disable auto-save on mobile. Touch interfaces produce unintentional input — combining that with auto-save guarantees data corruption.

3. **Drag-and-drop does not exist on mobile.** Planner lanes, DayStream timelines, and sortable image galleries have no mobile equivalent. These surfaces must be Desktop-only or must provide a completely different interaction model (which is out of scope for near-term work).

4. **Multi-pane layouts collapse to single-pane on mobile.** Workspace patterns (left rail + canvas + dock) and list+inspector patterns must either collapse to a single navigable view or be marked Desktop-only. There is no middle ground — partially collapsed layouts are worse than not supporting mobile at all.

5. **Mobile surfaces earn their mode through frequency and context.** A surface gets Editor mode only if users realistically need to create/edit that data while away from a desk (e.g., projects dashboard). If the only mobile use case is "glance at it," it's Reader. If it's "glance and tap one thing," it's Limited.

---

## Top 3 Surfaces That Must NOT Be Editable on Mobile

### 1. Shot Editor / Shot Edit Modal
**Why**: The shot editor is the most complex surface in the app — three-panel workspace, rich text, product/look management with SKU-level selection, image attachments with crop, versioning, and threaded comments. Every field is an accidental-edit risk on touch. Auto-save could persist unintended changes. The rich text editor (Tiptap) has known mobile quirks with bubble menus and slash commands. This is the single highest-risk surface for mobile editing.

### 2. Pull Sheet Editor
**Why**: Inline-editable grid with auto-save, quantity fields, and fulfillment status tracking. A stray touch could change a quantity from 12 to 1 and auto-save it, causing a warehouse to ship the wrong amount. The grid interaction pattern (cell focus, tab between fields) has no touch equivalent. Fulfillment errors have real-world cost.

### 3. Call Sheet / Schedule Builder (DayStream)
**Why**: Timeline-based drag-drop with swimlanes, time blocks, and multi-day views. Accidentally moving a block changes the shoot schedule for the entire team. The DayStream's drag interaction requires precise cursor placement that touch cannot replicate. A corrupted schedule has cascading real-world consequences (talent arrives at wrong time, locations double-booked).

---

## What This Audit Unlocks

This classification directly enables the following future deltas:

1. **Mobile.Breakpoint.Infrastructure** — Implement a `useMobileMode()` hook and `<MobileGate mode="editor|reader|limited|desktop-only">` wrapper component that reads this classification and enforces the correct behavior per surface.

2. **Mobile.DesktopOnlyGuard** — For all Desktop-only surfaces, add a clear interstitial ("This feature works best on desktop") with a back button, instead of rendering a broken layout.

3. **Mobile.ReaderSurfaces** — For Reader surfaces, strip edit affordances (hide edit buttons, disable form fields) and optimize layout for single-column consumption.

4. **Mobile.LimitedSurfaces** — For Limited surfaces, define exactly which actions survive on mobile (e.g., status toggle yes, bulk delete no) and implement per-surface mobile action sets.

5. **Mobile.EditorSurfaces** — For the few Editor surfaces (Projects dashboard), implement touch-optimized layouts with appropriate tap targets, swipe gestures, and mobile-first forms.

6. **Mobile.Navigation** — Redesign the sidebar for mobile (hamburger menu or bottom tab bar) with mode-aware navigation that grays out or hides Desktop-only entries.
