# Experience Spec — Shot Builder vNext

> Draft v1 — 2026-01-30

## Information Architecture

### Desktop Navigation (Persistent Sidebar)

```
┌─────────────────────────────────────────────┐
│ [Logo]  Shot Builder                    [≡]  │
├──────────┬──────────────────────────────────┤
│          │                                   │
│ PROJECTS │   [Page Content]                  │
│ ○ Dash   │                                   │
│          │                                   │
│ PROJECT  │                                   │
│ ● Shots  │                                   │
│ ○ Pulls  │                                   │
│ ○ Assets │                                   │
│ ○ Call   │                                   │
│   Sheet  │                                   │
│          │                                   │
│ ORG      │                                   │
│ ○ Prod-  │                                   │
│   ucts   │                                   │
│ ○ Library│                                   │
│          │                                   │
│ ──────── │                                   │
│ ○ Settings                                   │
│ ○ Account│                                   │
└──────────┴──────────────────────────────────┘
```

**Sections:**

| Section | Items | Scope | Notes |
|---------|-------|-------|-------|
| **Projects** | Dashboard | Org | Project selector + readiness overview |
| **Project** | Shots, Pulls, Assets, Call Sheet | Project | Visible only when a project is active. Grayed/hidden otherwise. |
| **Org** | Products, Library (Talent, Locations, Crew) | Org | Always visible. Org-level data. |
| **System** | Settings, Account | Org/User | Admin-only for Settings. |

The sidebar is collapsible to icon-only mode on desktop.

### Mobile Navigation (Slide-Out Drawer)

```
┌──────────────────────────┐
│ [☰] Project Name   [👤]  │
├──────────────────────────┤
│                           │
│   [Page Content]          │
│                           │
└──────────────────────────┘

Drawer (slides from left):
┌────────────────┐
│ [Logo]         │
│                │
│ Dashboard      │
│ ───────────    │
│ Shots      ●   │
│ Pulls          │
│ ───────────    │
│ Products       │
│ Library        │
│ ───────────    │
│ Account        │
└────────────────┘
```

**Mobile drawer rules:**
- Shows only mobile-capable destinations (hide Settings, Call Sheet builder, and other desktop-only surfaces).
- Project context shown in top bar. Tap project name to switch projects.
- Active item highlighted. Section dividers match desktop grouping.

### Route Map

| Route | Page | Mobile | Desktop | Scope |
|-------|------|--------|---------|-------|
| `/` | Redirect → `/projects` | ✓ | ✓ | — |
| `/projects` | Project Dashboard | ✓ Read | ✓ Full | Org |
| `/projects/:id` | Redirect → `/projects/:id/shots` | — | — | — |
| `/projects/:id/shots` | Shot List | ✓ Read + Status | ✓ Full | Project |
| `/projects/:id/shots/:sid` | Shot Detail | ✓ Read + Notes | ✓ Full Edit | Project |
| `/projects/:id/pulls` | Pull Sheet List | ✓ Read + Fulfill | ✓ Full | Project |
| `/projects/:id/pulls/:pid` | Pull Sheet Detail | ✓ Fulfill | ✓ Full Edit | Project |
| `/projects/:id/assets` | Project Assets | ✓ Read | ✓ Full | Project |
| `/projects/:id/callsheet` | Call Sheet | ✗ Desktop Only | ✓ Full | Project |
| `/products` | Product Library | ✓ Read | ✓ Full | Org |
| `/products/new` | Product Create | ✗ Desktop Only | ✓ Full | Org |
| `/products/:fid` | Product Detail | ✓ Read | ✓ Read + Actions | Org |
| `/products/:fid/edit` | Product Edit | ✗ Desktop Only | ✓ Full | Org |
| `/library/talent` | Talent Library | ✓ Read | ✓ Full | Org |
| `/library/locations` | Location Library | ✓ Read | ✓ Full | Org |
| `/library/crew` | Crew Library | ✓ Read | ✓ Full | Org |
| `/admin` | Settings | ✗ Desktop Only | ✓ Full | Org |
| `/account` | Account Settings | ✓ Limited | ✓ Full | User |

**Surface Classification:**

| Classification | Meaning | Example |
|----------------|---------|---------|
| **Reader** | View data, no mutations | Mobile product detail |
| **Limited** | View + targeted operational actions (status, confirm, flag, notes) and constrained corrective actions (e.g., replace within existing assignments, flag issues). Never exposes general-purpose editors or structural configuration. | Mobile shot list, pull fulfillment |
| **Editor** | Full CRUD, structural changes, complex forms | Desktop shot editor, pull sheet builder |
| **Desktop Only** | Not rendered on mobile; redirect to project dashboard with toast | Call sheet builder, admin settings |

### Mobile Philosophy

Mobile is a constrained, simplified view of the same workflows — not a divergent or mobile-only workflow set. Every mobile surface renders a subset of what desktop shows for the same route, using the same data and the same business logic. There are no mobile-only features, screens, or data flows. The goal is operational access (view, triage, confirm, flag) on the same pipeline that desktop constructs.

**Clarification:** "Limited" mode may include constrained corrective actions (e.g., replacing a product within an existing assignment, flagging an issue on a shot) but never general-purpose editors, structural configuration, or bulk operations. Mobile does not introduce mobile-only workflows or aim for full desktop parity.

---

## Key Flows

### Flow 1: Brief → Shot-Ready (Primary Loop)

**Actors:** Producer (desktop)

1. **Create project** — Name, shoot dates, brief URL. Project appears on dashboard as "Not Started."
2. **Add shots** — Quick-add from shot list (title + optional product/talent). Shots default to "Draft" status.
3. **Assign resources** — For each shot, assign products (from product library), talent (from talent library), and location. Inline search/picker, not separate pages.
4. **Review readiness** — Project dashboard shows derived readiness: X shots planned, Y products assigned, Z talent confirmed. No manual checklist.
5. **Generate pull sheets** — Select shots → auto-generate pull sheet with required SKUs. Pull sheet status: "Draft."
6. **Share pull sheet** — Send public share link to warehouse. Warehouse fulfills via mobile or desktop.
7. **Confirm fulfillment** — Warehouse marks items fulfilled. Producer sees updated pull status.
8. **Mark shoot-ready** — When all shots have assignments and pulls are fulfilled, project status shifts to "Ready." This is derived, not manually toggled.

### Flow 2: Warehouse Fulfillment (Mobile)

**Actors:** Warehouse Operator (mobile, Limited mode)

1. Open pull sheet from shared link or app.
2. See item list grouped by product family, with sizes and quantities.
3. Tap item → mark as "Picked" / "Not Available" / "Substituted."
4. Add note if substituting.
5. Pull sheet status auto-updates as items are fulfilled.
6. Producer receives notification when pull is fully fulfilled or has issues.

### Flow 3: On-Set Operations (Mobile)

**Actors:** Crew (mobile, Limited mode)

1. Open project → shot list (filtered by today's date or current lane).
2. View shot detail: assigned products, talent, location, notes.
3. Update shot status: "In Progress" → "Shot" → "Needs Reshoot."
4. Add note or flag issue (text + optional photo capture).
5. Producer sees status updates in real-time on their dashboard.

### Flow 4: Product Management (Desktop)

**Actors:** Producer / Wardrobe (desktop, Editor mode)

1. Browse product library (search, filter by category/brand/season).
2. Create product family with base metadata (name, brand, category, hero image).
3. Add SKUs with size/color variants.
4. Products are org-level; assign to shots via the shot editor.

### Flow 5: Library Management (Desktop)

**Actors:** Producer (desktop, Editor mode)

1. Browse talent/locations/crew in the Library section.
2. Create or edit profiles (contact info, sizing for talent, address for locations).
3. Assign to projects via the project assets page or inline from the shot editor.
4. Library items are org-scoped; project assignment is a link, not a copy.

---

## Interaction Rules

### Search

- **Global search** (`Cmd+K`): Searches across projects, shots, products, talent, locations. Returns categorized results. Available on all pages.
- **In-context search**: Each list page has a filter/search bar scoped to that entity type. Debounced, client-side filtering for loaded data.
- **Mobile**: Global search accessible from top bar icon. In-context search via expandable search bar.

### Filters

- Filters are scoped per list page (e.g., shot status, product category).
- Applied filters shown as removable chips below the search bar.
- Filter state persisted in URL query params (shareable, bookmarkable).
- Mobile: Filters in a bottom sheet triggered by a filter icon.

### Selection & Bulk Actions

- Checkbox-based multi-select on list pages (desktop only).
- Bulk actions appear in a sticky action bar when items are selected.
- Mobile: No bulk selection. Single-item actions only (tap → action sheet).

### Confirmations

- Destructive actions (delete, remove assignment) require a confirmation dialog.
- Non-destructive state changes (status update, mark fulfilled) happen immediately with undo toast (3s window).
- No "are you sure?" for non-destructive actions.

### Inline Editing

- Prefer inline editing over full-page edit modes where possible (e.g., shot title, status, notes).
- Complex structured editing (SKU matrix, call sheet timeline) uses dedicated editor surfaces.

---

## Empty / Error / Loading State Principles

### Empty States

Every list/collection view must handle the empty case explicitly:

| Context | Pattern |
|---------|---------|
| **No projects yet** | Centered illustration + "Create your first project" CTA |
| **No shots in project** | Contextual message + quick-add prompt |
| **No search results** | "No results for [query]" + suggestion to broaden search |
| **No mobile access** | "This feature is available on desktop" + link to desktop-capable page |
| **No project selected** | Redirect to project dashboard with toast |

**Rules:**
- Never show a blank white page.
- Empty states must include a primary action (what to do next).
- Use the same illustration/icon style consistently.

### Error States

| Type | Pattern |
|------|---------|
| **Network error** | Banner at top of page: "Connection lost. Retrying..." with manual retry button. |
| **Permission denied** | Full-page message: "You don't have access to this resource." No retry. |
| **Not found** | Full-page 404 with "Go to Dashboard" CTA. |
| **Form validation** | Inline field errors. Never toast-only for validation. |
| **Server error** | Toast with error summary + "Try again" action. Log to Sentry. |

**Rules:**
- Errors are never silent. Every failure must have visible feedback.
- Retryable errors offer a retry mechanism.
- Non-retryable errors explain what happened and offer a next step.

### Loading States

| Context | Pattern |
|---------|---------|
| **Page load** | Skeleton screens matching the page layout. Never a spinner-only page. |
| **List loading** | Skeleton rows (3-5 placeholder items). |
| **Action in progress** | Button enters loading state (spinner + disabled). |
| **Background refresh** | No visible loading indicator. Data updates silently. |
| **Stuck loading (>5s)** | Show "Taking longer than expected" message with retry option. |

**Rules:**
- Skeleton screens must match the real layout (same heights, widths, spacing).
- Never show a full-page spinner. Always skeleton or inline loading.
- Loading states must have a timeout / stuck detection (existing `useStuckLoading` pattern).
