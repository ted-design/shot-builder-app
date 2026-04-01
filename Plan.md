# Plan -- Production Hub

Living implementation plan. Iterative phases -- ship improvements every few days. Not a rewrite -- targeted UX improvements to make the app onboarding-ready for the full team.

**Strategy:** Each phase has a clear goal, wireframe/mockup requirements, implementation steps, and acceptance criteria. Phases are sequential -- complete each phase before starting the next.

> **Note on pre-plan work:** Some sub-tasks in Phases 3, 3.5, and 4 are checked off. This work was done on the `vnext/shots-editor-110-polish` branch *before* this plan existed and has been merged to main. These checked items reflect code that exists, but do not change the phase order. **Phase 2 (Nav & IA) is the active next phase.** See AI_RULES.md "Phase Discipline" for the rules.

---

## Phase 1: Documentation + Cleanup

**Goal:** Clean root directory, accurate documentation, single source of truth for all future work.

**Status:** COMPLETE.

### Sub-tasks

- [x] **1a:** Archive legacy docs (root .md files, docs/, docs-vnext/)
- [x] **1b:** Write 4 core docs (AI_RULES, PRD, Architecture, Plan)
- [x] **1c:** Rewrite CLAUDE.md (<100 lines), update README.md
- [x] **1d:** Verify build + lint pass, no broken imports

### Acceptance Criteria

- [x] Root directory clean: only CLAUDE.md, AI_RULES.md, PRD.md, Architecture.md, Plan.md, README.md + config/source files
- [x] CLAUDE.md < 100 lines
- [x] `npm run build` succeeds
- [x] `npm run lint` passes (zero warnings)
- [x] All legacy docs preserved in `archive/` with git history
- [x] No broken imports or references in source code

---

## Phase 2: Navigation & Information Architecture

**Goal:** Simplify navigation so any new user can find what they need within 10 seconds. This is the biggest onboarding barrier.

**Status:** COMPLETE (committed, pending PR).

### Proposed IA

```
Dashboard (project list + readiness overview)
[Active Project]
  ├── Shots (list + board + gallery views)
  ├── Pull Sheets (generation + fulfillment)
  ├── Call Sheet (desktop only — RequireDesktop guard)
  └── Settings
Products (org-level library, always visible)
Library (consolidated: talent, crew, locations, palette)
Admin (role-gated: admin only)
```

### Sub-tasks

- [x] **2a:** Audit current sidebar + route map (research, no code changes)
- [x] **2b:** Design simplified IA + write HTML mockups (desktop sidebar, collapsed + expanded)
- [x] **2c:** Write HTML mockups (mobile drawer, tablet layout)
- [x] **2d:** Write HTML mockup (Cmd+K command palette) — mockup created, implementation deferred to Slice 7
- [x] **2e:** Get user approval on all mockups (Direction A: Near-Black Editorial approved)
- [x] **2f:** Implement desktop sidebar changes (11 components in `src-vnext/shared/components/sidebar/`)
- [x] **2g:** Implement mobile drawer navigation (Radix Dialog, phone/tablet variants)
- [x] **2h:** Implement keyboard sidebar toggle (`[`) + collapse/expand via icon click
- [ ] **2i:** Consolidate library routes + remove legacy redirects — deferred (routes work as-is)
- [x] **2j:** Verify all breakpoints + acceptance criteria

### Acceptance Criteria

- [x] New user can navigate to any feature within 3 clicks from dashboard
- [x] Sidebar shows only relevant items for current context (project-scoped vs org-level)
- [x] Keyboard sidebar toggle (`[`) works
- [x] Mobile drawer navigation works on 375px viewport
- [x] Tablet layout uses off-canvas drawer
- [x] No orphaned routes (every route reachable from navigation)
- [x] Legacy redirects still work (no broken bookmarks)
- [ ] Cmd+K palette finds any entity or action — deferred to Slice 7

### Implementation Notes

- Design tokens + Tailwind config migrated to Direction A (Near-Black Editorial, zinc palette)
- AppShell decomposed from 365 → 85 lines, 11 focused sidebar components
- Three breakpoints: phone (<768), tablet (768-1023), desktop (>=1024)
- Desktop-only routes (Tags, Call Sheet) use `RequireDesktop` guard with toast redirect
- 26 tests added (nav-config, useSidebarState, SidebarNavItem)

---

## Phase 3: Shot Editing Workflow

**Goal:** Make the shot editing loop fast and fluid. This is where producers spend 80% of their time. Every click saved here compounds across hundreds of shots.

**Status:** COMPLETE (3v board reorder deferred).

### Sub-tasks

- [x] **3a:** Audit current shot editing UX + identify friction points (research, no code)
- [x] **3b:** Write HTML mockups: shot list with inline editing + three-panel desktop layout
- [x] **3c:** Write HTML mockups: product picker + quick-add workflow
- [x] **3d:** Write HTML mockups: gallery view + board/kanban view
- [x] **3e:** Get user approval on all mockups
- [x] **3f:** Implement inline editing on shot list (title, status, tags)
- [x] **3g:** Implement three-panel desktop layout with resizable panels
- [x] **3h:** Implement product picker redesign (search, keyboard nav, thumbnails)
- [x] **3i:** Implement quick-add workflow (title + Enter, batch paste)
- [x] **3j:** Implement multi-view system (table, board, gallery) + view persistence
- [x] **3k:** Implement auto-save (debounced writes, optimistic UI, save indicator)
- [x] **3l:** Implement keyboard shortcuts (Cmd+K, Cmd+N, Tab, Enter, Escape, 1-4)
- [x] **3m:** Verify acceptance criteria + run full test suite
- [x] **3w:** Keyboard shortcuts help dialog (`?` key) + keyboard hints on toolbar view buttons
- [x] **3x:** Product family filter in shot list filter sheet
- [x] **3n:** Public share system (callable -> HTTP endpoint -> denormalized Firestore reads)
- [x] **3o:** Shot lifecycle actions (duplicate, copy/move across projects, soft-delete)
- [x] **3p:** Multi-tag filters on ShotListPage
- [x] **3q:** PDF export (multi-template + batch export)
- [x] **3r:** Reference links section (clickable anchors in shot detail)
- [x] **3s:** Notes preview component
- [x] **3t:** Fix gallery view switching bug (URL param deletion caused stale localStorage fallback)
- [x] **3u:** Standardize status labels to System A (Draft / In Progress / On Hold / Shot) across all views, filters, and PDF exports
- [ ] **3v:** Board column reorder + show/hide configuration (deferred — localStorage-persisted column order and visibility)
- [x] **3y:** Three-panel design token audit (tokenize status badges, fix hardcoded colors)
- [x] **3z:** Notes section read/edit toggle + card wrapper consistency
- [x] **3aa:** Enriched list panel (density tiers, description preview, shot number)
- [x] **3ab:** Reference tile redesign (hover action bar, cover below image)
- [x] **3ac:** List panel display preferences (toggleable properties)

### Acceptance Criteria

- [x] Producer can create 10 shots in under 60 seconds using keyboard only
- [x] Inline edits auto-save without explicit save button
- [x] Three-panel layout works on desktop (>1024px)
- [x] Product picker supports keyboard navigation
- [x] All three views (table, board, gallery) work and persist preference
- [x] Keyboard shortcuts documented and functional
- [x] Shot list supports filter by status, tag, product family, talent, location
- [x] No page refreshes during editing workflow

---

## Phase 3.5: Schedule & Call Sheet Assembly

**Goal:** Build the schedule creation and timeline visualization pipeline that feeds into call sheet output. Producers need to see day-of logistics at a glance.

**Status:** Partially complete (pre-plan work). Not the active phase.

### Sub-tasks

- [x] **3.5a:** Trust-core schedule increments A-I (entry CRUD, time slots, crew/talent assignment)
- [x] **3.5b:** UX reliability pass + P2 review feedback
- [x] **3.5c:** Preview metadata simplification
- [x] **3.5d:** Entry deletion + shared highlight creation + ScheduleEntryEditSheet
- [x] **3.5e:** Adaptive timeline visualization (7 components, adaptiveSegments algorithm)
- [ ] **3.5f:** E2E testing of full schedule -> call sheet flow
- [ ] **3.5g:** Call sheet output/print polish

### Acceptance Criteria

- [x] Schedule entries can be created, edited, reordered, and deleted
- [x] Timeline visualization adapts to entry density (adaptive segments)
- [x] Schedule preview shows simplified metadata
- [ ] Full flow from schedule creation to call sheet output works end-to-end
- [ ] Call sheet print layout is clean and professional

---

## Phase 4: Form & Data Entry Optimization

**Goal:** Reduce friction on every form. Fewer required fields, smarter defaults, progressive disclosure.

**Status:** Complete.

### Sub-tasks

- [x] **4a-products:** Progressive filters + unified view options for product library
- [x] **4b-products:** Classification toolbar + colorway flow
- [x] **4c-products:** Previous style number field
- [x] **4d:** Audit remaining forms: project creation, shot creation, pull generation (research)
- [x] **4e:** Write HTML mockups: project creation, shot creation, pull generation
- [x] **4f:** Get user approval on mockups
- [x] **4g:** Reduce required fields + implement smart defaults
- [x] **4h:** Implement progressive disclosure (collapsible sections, remembered state)
- [x] **4i:** Implement inline validation (Zod schemas, field-level feedback, auto-save)
- [x] **4j:** Verify acceptance criteria + run full test suite

### Acceptance Criteria

- [x] Project creation: 1 required field (name), completes in <5 seconds
- [x] Shot creation: 1 required field (title), completes in <3 seconds
- [x] All forms use progressive disclosure (common fields visible, details collapsed)
- [x] Smart defaults reduce manual input by >50%
- [x] Inline validation provides feedback before submission
- [x] No form requires more than 3 required fields

---

## Phase 5: Mobile & Tablet Polish

**Goal:** Make mobile shoot-day operations and tablet planning genuinely useful. iPad is a first-class viewport, not an afterthought.

**Status:** Complete.

### Sub-tasks

- [x] **5a:** Audit current responsive behavior at 375px, 768px, 1280px (research)
- [x] **5b:** Write HTML mockups: warehouse guided pick flow (mobile)
- [x] **5c:** Write HTML mockups: on-set gallery view + floating action bar (tablet)
- [x] **5d:** Write HTML mockups: tablet three-panel layout + mobile shot list
- [x] **5e:** Get user approval on all mockups
- [x] **5f:** Touch targets + ResponsiveDialog (Sheet on mobile, Dialog on desktop)
- [x] **5g:** Warehouse guided pick flow (full-screen stepper, one-handed operation)
- [x] **5h:** Floating action bar + AppShell integration + page URL param handling
- [x] **5i:** ShotStatusTapRow (1-tap status pills) + ProductDetailPage hide-not-disable
- [x] **5j:** Responsive breakpoint audit + verify acceptance criteria

### Acceptance Criteria

- [x] Warehouse pick flow completable with one hand on phone
- [x] Gallery view shows shot hero images on tablet
- [x] Floating action bar accessible on all mobile/tablet pages
- [x] Touch targets minimum 44px on all interactive elements
- [x] Every page renders correctly at 375px, 768px, and 1280px
- [x] No horizontal scroll on any viewport
- [x] Desktop-only features (call sheet builder, admin) redirect on mobile with toast

---

## Phase 6: Visual Identity & Polish

**Goal:** Professional and precise visual identity. Make the app look like it was built by a funded startup, not a side project. First impressions matter for stakeholder onboarding.

**Status:** COMPLETE — 6a-6k all committed.

### Sub-tasks

- [x] **6a:** Audit current visual inconsistencies (colors, typography, spacing) (research)
- [x] **6b:** Write mockups: color palette, typography scale, component showcase
- [x] **6c:** Write mockups: empty states, loading skeletons, error states, dark mode
- [x] **6d:** Get user approval on visual identity
- [x] **6e:** Implement brand identity (tokens.css updates, color palette, typography)
- [x] **6f:** Implement component polish (audit shadcn usage, standardize styles)
- [x] **6g:** Implement empty states for all list views
- [x] **6h:** Implement loading skeletons (replace spinners, stagger animation)
- [x] **6i:** Implement error states (toast, Sentry, offline banner, form errors)
- [x] **6j:** Implement presence indicators (avatar dots, edit conflict warning)
- [x] **6k:** Dark mode audit + verify acceptance criteria

### Acceptance Criteria

- [x] Color palette defined in tokens.css and consistently applied
- [x] Typography hierarchy clear: headings, body, labels, captions
- [x] Every list view has an empty state with CTA
- [x] Loading skeletons on all async pages (no raw spinners)
- [x] Error states tested: network error, permission error, not found
- [x] Dark mode works correctly (all token-driven, no hardcoded colors)
- [ ] A non-technical stakeholder would describe the app as "professional"

---

## Phase 7A: Bug Fixes & Quick Wins

**Goal:** Fix broken workflows and add missing infrastructure before building new features.

**Status:** COMPLETE.

### Sub-tasks

- [x] **7A.1:** Fix shoot date edit not persisting (EditProjectDialog useEffect dep bug)
- [x] **7A.2:** Fix sidebar showing "Project" instead of project name (use useProject hook)
- [x] **7A.3:** Add library RBAC helpers (canManageTalent, canManageCrew, canManageLocations)

### Acceptance Criteria

- [x] Shoot dates persist after editing in EditProjectDialog
- [x] Sidebar shows actual project name when inside a project
- [x] RBAC helpers exist for all library entities; talent page uses canManageTalent

---

## Phase 7B: Library Entity Completion

**Goal:** Make crew, locations, and talent fully functional with CRUD. Port proven legacy patterns.

**Status:** COMPLETE.

### Sub-tasks

- [x] **7B.1:** HTML mockups for crew & locations redesign (user approved table → detail page pattern)
- [x] **7B.2:** Crew: types, hooks, and write functions (CrewRecord expansion, crewWrites.ts, useCrewLibrary.ts)
- [x] **7B.3:** Crew pages: table list + detail page (replace 95-line read-only stub)
- [x] **7B.4:** Locations: types, hooks, and write functions (LocationRecord expansion, locationWrites.ts, useLocationLibrary.ts)
- [x] **7B.5:** Locations pages: table list + detail page (replace 87-line read-only stub)
- [x] **7B.6:** Talent: measurements expansion (gender-specific fields, port legacy measurementOptions.js)
- [x] **7B.7:** Talent: delete functionality (deleteTalent + Storage cleanup + ConfirmDialog)
- [x] **7B.8:** Update picker data mappers (usePickerData.ts — enrich location + talent pickers)

### Acceptance Criteria

- [x] Crew page has full CRUD: search, create, inline edit, delete with confirmation
- [x] Locations page has full CRUD: search, create, inline edit, photo upload, delete
- [x] Talent has gender-specific measurements (9+ fields) and delete functionality
- [ ] All pages correct at 375/768/1280px breakpoints (visual verification pending)
- [x] Tests pass, lint clean, build clean

---

## Phase 7C: UI/UX Polish Pass

**Goal:** Consistent density, interactions, navigation, and visual language across ALL pages. "Make it feel like one app."

**Status:** Complete. All sub-tasks done. Deferred: M2 (shot card readiness styling — by design), M3 (toolbar overflow — needs analysis), H4 (library layout — needs user decision).

### Sub-tasks

- [x] **7C.1:** Cross-page UX audit at 3 breakpoints (375px, 768px, 1280px)
- [x] **7C.2:** Mockups for density & interaction improvements (user approval required)
- [x] **7C.3:** Information density improvements (card padding, metadata, gaps)
- [x] **7C.4:** Hover states, transitions, and focus indicators
- [x] **7C.5:** Navigation clarity (breadcrumbs, active states, "you are here")
- [x] **7C.6:** Keyboard shortcuts expansion (library operations, help dialog update)

### Acceptance Criteria

> **Note:** Functional criteria (sub-tasks 7C.1–7C.6) are complete. The four criteria below are visual verification items deferred pending a dedicated review session. They do not block Phase 8.

- [ ] Every page correct at 375/768/1280px (visual verification deferred)
- [ ] All cards have hover states and cursor-pointer (visual verification deferred)
- [ ] No navigation dead-ends (visual verification deferred)
- [ ] Breadcrumbs on all detail pages via PageHeader (visual verification deferred)

---

## Phase 7D: Products Editor Improvements

**Goal:** Evolve products from basic CRUD to a managed workflow with taxonomy, better colorways, and sample tracking.

**Status:** Complete.

### Sub-tasks

- [x] **7D.1:** Products audit & mockups (user approval required)
- [x] **7D.2:** Managed taxonomy (productClassifications collection → Select pickers, type-to-create) — already built in prior phases
- [x] **7D.3:** Colorway workflow improvements (bulk create, visual display)
- [x] **7D.4:** Sample tracking improvements (status pipeline, due date warnings, overdue badges)
- [x] **7D.5:** Product workspace navigation (simplify tab system) — already built; count badges added
- [x] **7D.6:** ProductDetailPage decomposition (1,631→240 lines, 6 section components extracted)
- [x] **7D.7:** canCreate/canEdit split on ProductListPage + `C` keyboard shortcut + mobile create button
- [x] **7D.8:** Empty state CTAs on workspace sections (colorways, samples, assets, documents)

### Acceptance Criteria

- [x] Classification uses managed taxonomy (Select pickers, not free text)
- [x] Colorway bulk create works
- [x] Sample tracking has status pipeline + overdue/due-soon badges
- [x] Product navigation is intuitive (audit findings addressed)

---

## Phase 7E: Feature Cleanup & Consolidation

**Goal:** Remove dead weight. Consolidate feature flag branches. Reduce maintenance surface.

**Status:** COMPLETE.

### Sub-tasks

- [x] **7E.1:** Audit feature flags: list all V2/V3 flags, which are safe to consolidate (research)
- [x] **7E.2:** Audit dependencies: identify unused npm packages (research)
- [x] **7E.3:** Audit routes: identify orphaned/legacy redirects (research)
- [x] **7E.4:** Remove planner drag-and-drop + standalone planner route
- [x] **7E.5:** Consolidate V2/V3 feature flags (remove dead code paths)
- [x] **7E.6:** Clean up dev-only routes (gate behind import.meta.env.DEV) — already done
- [x] **7E.7:** Remove unused npm dependencies (next-themes removed; prop-types imports removed)
- [x] **7E.8:** Remove legacy redirect routes + update Architecture.md route map
- [x] **7E.9:** Measure bundle size before/after + verify acceptance criteria

### Acceptance Criteria

- [x] No feature flag with both paths still active (shotEditorV3 removed, productsV2/V3 removed, pullsEditorV2 promoted)
- [x] No dev-only routes accessible in production build (already gated behind import.meta.env.DEV)
- [x] Bundle size stable (vendor chunks unchanged; ProductDetailPageV2 chunk eliminated)
- [x] Architecture.md updated to reflect final route map and dependencies

---

## Sprint S1: Edit Paths & CRUD Completeness

**Goal:** Close missing edit paths across crew, pulls, schedules, and locations. These gaps block basic workflows — users can't fix typos, rename entities, or remove photos.

**Status:** COMPLETE.

### Sub-tasks

- [x] **S1-1:** Crew: firstName/lastName editable, department/position editable, composite name sync
- [x] **S1-2:** Pull sheets: rename via InlineEdit on detail page
- [x] **S1-3:** Schedules: rename/edit via EditScheduleDialog (name + date)
- [x] **S1-4:** Locations: photo removal with confirmation

### Acceptance Criteria

- [x] Crew: edit first/last name → PageHeader title updates → department/position persist on reload
- [x] Pull: click name on detail page → InlineEdit → rename persists
- [x] Schedule: card dropdown → Edit → dialog with prefilled name/date → save → card updates
- [x] Location: photo visible → Remove → confirm → photo disappears
- [x] Build clean, lint zero warnings, tests pass

---

## Sprint S2: Admin Panel & User Onboarding

**Goal:** Enable admin panel so real team members can be invited, assigned roles, and access the app. Without this, onboarding is blocked — no users can use the vNext app.

**Status:** COMPLETE.

**Rationale:** PRD.md lists admin/settings as MUST-HAVE, but Plan.md skipped it. This override sprint fixes the gap per Hard Rule #8 (Production Readiness Overrides).

### Sub-tasks

- [x] **S2-1:** Foundation types (`UserProfile`), path helpers (`usersPath`, `userDocPath`), `isAdmin()` in rbac
- [x] **S2-2:** `useUsers` data hook (Firestore subscription to users collection)
- [x] **S2-3:** Admin write utilities (`inviteOrUpdateUser`, `updateUserRole`) using `setUserClaims` CF
- [x] **S2-4:** AdminPage UI (roster table, InviteUserDialog, UserRoleSelect)
- [x] **S2-5:** Route + sidebar integration (`/admin` with role + desktop guards, admin nav entry)
- [x] **S2-6:** First-sign-in error handling (PendingAccessPage for users without claims)
- [x] **S2-7:** CLAUDE.md Hard Rule #8 (Production Readiness Overrides)
- [x] **S2-8:** Documentation sync (Plan.md, Architecture.md, HANDOFF, CHECKPOINT, MEMORY)

### Acceptance Criteria

- [x] Build clean, lint zero warnings, all tests pass
- [x] Admin → /admin → roster loads → invite user → role change works
- [x] Non-admin → no "Admin" in sidebar → /admin redirects to /projects
- [x] User without claims → "Waiting for access" page → sign out works
- [x] Mobile → "Admin" not in drawer → /admin redirects with toast

---

## Sprint S4: Design System Realignment

**Goal:** Fix the three-layer typography mismatch between `tokens.css`, `tailwind.config.js`, and component classNames. Align font sizes, heading weights, tag badges, and card density with the approved mockup (`mockups/p6-visual-identity.html`).

**Status:** COMPLETE.

**Root cause:** `tailwind.config.js` was missing fontSize overrides for `xs`/`sm`/`base`/`lg`/`xl`, so every `text-sm` element rendered at 14px instead of the intended 13px. Page headings used semibold/bold instead of the editorial light (300) weight. Tag badges used rainbow colors instead of neutral styling.

### Sub-tasks

- [x] **S4-1:** Font size foundation — add `xs`/`sm`/`base`/`lg`/`xl` overrides to `tailwind.config.js`, replace all `text-[13px]`/`text-[10px]`/`text-[14px]`/`text-[15px]` workarounds (9 files)
- [x] **S4-2:** Page heading weights — replace ad-hoc `text-xl font-semibold` / `text-2xl font-bold` with `heading-page` semantic class (8 files)
- [x] **S4-3:** Tag badge neutralization — neutral styling in `TagBadge.tsx`, `rounded-full` → `rounded-md`
- [x] **S4-4:** ShotCard density reduction — reduce default visible fields from 7→3, flatten tag rendering
- [x] **S4-5:** Zinc cleanup — `bg-zinc-400` → `bg-neutral-400` in `BoardColumn.tsx`

### Acceptance Criteria

- [x] `text-sm` renders 13px in DevTools (not 14px)
- [x] All page headings use weight 300 (light editorial)
- [x] Tag badges are neutral (no rainbow colors)
- [x] ShotCard shows only title + status + shot number + description + flat tags by default
- [x] Zero `text-[13px]`, `text-[10px]`, `text-[14px]`, `text-[15px]` in src-vnext/
- [x] Zero `bg-zinc-` in src-vnext/
- [x] Build clean, lint zero warnings, tests pass (1,948)

---

## Sprint S5a: Dashboard Dates + Tag Accents + Wardrobe Fix

**Goal:** Fix three UX issues surfaced during Sprint S5 research: shoot dates buried below fold in project dialogs, tags lack visual category distinction, and wardrobe/warehouse role mismatch in Firestore rules.

**Status:** COMPLETE.

### Sub-tasks

- [x] **S5a-1:** Move ShootDatesField above "More options" in CreateProjectDialog + EditProjectDialog
- [x] **S5a-2:** TagBadge left-border accent by category (priority=warm, gender=cool, media=green, other=neutral) — 2.5px left border, neutral body preserved
- [x] **S5a-3:** Category-based tag sort (display-only) in ShotCard, BoardCard — priority → gender → media → other. Never mutate Firestore array.
- [x] **S5a-4:** Wardrobe/warehouse normalization in `firestore.rules` — update `hasProjectRole()` and `isProducer()` to recognize both "wardrobe" and "warehouse" variants
- [x] **S5a-5:** Tests + acceptance verification

### Acceptance Criteria

- [x] ShootDatesField is visible without expanding "More options" in both project dialogs
- [x] Tags display a subtle 2.5px left-border accent matching their category color
- [x] Tags are sorted by category (priority → gender → media → other) in ShotCard and BoardCard
- [x] Users with "wardrobe" role in Firestore project members are recognized by `hasProjectRole()`
- [x] Build clean, lint zero warnings, all tests pass

---

## Sprint S5b: Admin RBAC — Project Access Management

**Goal:** Enable per-project access control so admins can assign users to specific projects. Without this, all users see all projects — a blocker for multi-team onboarding.

**Status:** COMPLETE (commit 4106d42).

### Sub-tasks

- [x] **S5b-1:** Firestore rules: add write rule for `projects/{pid}/members/{uid}` subcollection
- [x] **S5b-2:** Write functions: `addProjectMember`, `removeProjectMember` + `useProjectMembers` hook
- [x] **S5b-3:** Auto-membership on project create (`writeBatch` in CreateProjectDialog for atomic project + member doc)
- [x] **S5b-4:** Admin page: "Project Access" tab with project selector + member table
- [x] **S5b-5:** Add/remove member dialog (search existing users, assign project role)
- [x] **S5b-6:** Copy invite link UX (toast with copy button when user not found)
- [ ] **S5b-7:** Pending invites section on admin page — SKIPPED (no Firestore collection; copy-link UX covers intent)
- [x] **S5b-8:** Dashboard empty state for unassigned non-admin users ("No projects assigned. Contact your administrator.")
- [x] **S5b-9:** Tests + acceptance verification

### Acceptance Criteria

- [x] Admin can add/remove users from a project via admin page
- [x] Creating a project auto-adds the creator as a member (atomic write)
- [x] Admin can copy an invite link for users who haven't signed in yet
- [ ] Pending invites section shows attempted-invite users who haven't created accounts — SKIPPED (S5b-7)
- [x] Non-admin users with no project assignments see a clear empty state
- [x] Firestore rules enforce member subcollection write access
- [x] Build clean, lint zero warnings, all tests pass

---

## Phase 8: Shot Request Inbox

**Goal:** Allow admin and producer roles to submit shot requests. Producers triage requests into existing projects. Closes the gap between creative briefs and formal shot planning.

**Status:** COMPLETE.

**Rationale:** Producers currently have no structured intake channel. Shot ideas arrive via Slack/email and get lost. This phase adds a lightweight inbox that feeds the existing planning workflow.

### Key Decisions (approved)

- **Submit RBAC:** Admin + producer only (not all roles). Note: "producer" may be renamed to include client team members in the future — the role value stays the same.
- **Triage RBAC:** Admin + producer only, desktop-only (via `RequireDesktop` guard on triage panel)
- **Nav:** `/inbox` — org-level route, between Projects and Products in the sidebar
- **No image uploads** at request stage — references are URL strings only
- **No push notifications** in Phase 8 — requesters see status via their own /inbox view
- **Transaction-based absorption** — `runTransaction` prevents duplicate shot creation
- **"Create project from request"** — deferred to Phase 8.5 (too much scope for Phase 8)
- **Data model:** `clients/{clientId}/shotRequests/{requestId}` — org-level, not project-scoped
- **Status lifecycle:** `submitted` → `triaged` → `absorbed` | `rejected`
- **File structure pattern:** Follow `features/admin/` as the canonical model

### Sub-tasks

- [x] **8a:** Write HTML mockups — submission dialog (mobile-first), producer inbox (desktop two-panel), requester "my requests" view
- [x] **8b:** User approval on all mockups
- [x] **8c:** Foundation — types (`ShotRequest`, `ShotRequestStatus`, `ShotRequestPriority`), path helpers (`shotRequestsPath`, `shotRequestDocPath`), RBAC (`canTriageShotRequests`)
- [x] **8d:** Firestore security rules review + user approval (Hard Stop — do not proceed to 8e without this)
- [x] **8e:** Data layer — hooks (`useShotRequests`, `useShotRequest`), write functions (`submitRequest`, `triageAbsorb`, `triageReject`)
- [x] **8f:** Submission UI — `SubmitShotRequestDialog` (ResponsiveDialog, title required + progressive disclosure for products/deadline/notes, Zod validation)
- [x] **8g:** Inbox UI — `ShotRequestInboxPage` (two-panel on desktop: list + triage; single-column list on mobile), `ShotRequestCard`, `ShotRequestStatusBadge`
- [x] **8h:** Triage UI — `TriagePanel` (desktop right panel), `AbsorbDialog` (project picker + `runTransaction` shot creation), `RejectDialog` (optional reason field)
- [x] **8i:** Route + sidebar integration — `/inbox` route with `RequireRole` guard for admin+producer, sidebar "Inbox" entry between Dashboard and Products
- [x] **8j:** Tests + acceptance verification — 85 new tests (79 request feature + 6 nav), 2,106 total passing, build clean, lint zero

### Acceptance Criteria

- [x] Admin or producer can submit a shot request (title required, products/deadline/notes optional)
- [x] Requests appear in admin/producer inbox sorted by priority then date
- [x] Producer can absorb request into an existing project (creates shot via `runTransaction`)
- [x] Producer can reject a request with an optional reason
- [x] Requesters (admin/producer) can see their own submissions and their current status
- [x] `/inbox` route accessible to admin and producer roles
- [x] Triage actions (absorb/reject) are desktop-only (conditional rendering via `isDesktop`)
- [x] Sidebar shows "Inbox" entry for admin+producer (count shown in page header, not badge)
- [x] Build clean, lint zero warnings, all tests pass (2,106 passing)

### Implementation Notes

- Follow the `features/admin/` module pattern: `features/requests/components/`, `features/requests/hooks/`, `features/requests/lib/`
- `SubmitShotRequestDialog` uses `ResponsiveDialog` — works on mobile and desktop
- Triage panel is desktop-only: hide (not disable) on mobile, consistent with `canEdit = !isMobile && canManageX(role)` pattern
- `triageAbsorb` uses `runTransaction`: read target project, create shot doc, update request status atomically
- Unread badge count: denormalize `unreadRequestCount` on the client doc, or compute via client-side count of `status === 'submitted'` requests the user hasn't actioned

---

## Phase 8.5: Shot Request — Create Project Flow

**Goal:** Allow producers to create a new project directly from a shot request, not just absorb into an existing one.

**Status:** COMPLETE.

### Sub-tasks

- [x] **8.5a:** Research — read AbsorbDialog, requestWrites, CreateProjectDialog, paths to confirm approach
- [x] **8.5b:** Data layer — `createProjectFromRequest()` transaction (create project + member + shot + update request)
- [x] **8.5c:** UI layer — extend AbsorbDialog with Tabs mode toggle ("Existing Project" / "New Project")
- [x] **8.5d:** Quality gate — senior code review (3 fixes: path helper, hover style, stale nameError)
- [x] **8.5e:** Documentation — Plan.md, HANDOFF.md, CHECKPOINT.md, MEMORY.md

### Acceptance Criteria

- [x] AbsorbDialog has two modes: "Add to existing project" and "Create new project"
- [x] "Create new project" requires project name, optional shoot dates
- [x] Transaction atomically creates project + member + shot + updates request
- [x] Creator auto-added as project member (producer role)
- [x] Form validation: project name required (Zod), dates optional
- [x] Desktop only (triage is desktop-only per Phase 8 decision)
- [x] Build clean, lint zero warnings in new code, 2,122 tests pass

---

## Phase 9: Casting Engine — COMPLETE

**Goal:** Searchable talent database with measurement-based matching and shot history.

**Status:** COMPLETE. Committed `f6cbef5` on `vnext/sprint-s5b`. 89 new tests (2,211 total).

### Sub-tasks

- [x] **9a: Talent Search & Filter** — client-side filtering by gender, measurement ranges (min/max), agency, casting history. Filter sheet (responsive side/bottom). Active filter chips with dismiss.
- [x] **9b: Auto-Match / Casting Brief** — ephemeral brief with measurement requirements → ranked talent with match scores. Per-field breakdown (in-range/close/out/missing). Gender hard gate, proximity scoring.
- [x] **9c: Shot History** — reverse lookup via Firestore `array-contains` on `talentIds`. Grouped by project, status badges. Composite index added.
- [x] **Infrastructure** — `measurementParsing.ts` (conservative parser), `talentFilters.ts`, `castingMatch.ts`, `useTalentShotHistory` hook, `--color-status-red-*` tokens.
- [x] **Integration** — All 3 features integrated into LibraryTalentPage via tabs (Profile / Shot History / Casting Brief).

---

## Phase 10: Asset Requirements & PLM — COMPLETE

**Goal:** Track per-product/colorway asset requirements and sample logistics.

**Status:** Complete. 3 slices shipped, 24 new tests, 2,254 total pass.

### Sub-tasks

- [x] **10A: Launch Date + Asset Flags** — Types, lib, mappers, writes, Requirements tab, overview card
- [x] **10B: Sample Logistics** — returnDueDate + condition fields in Sheet, badges in SampleRow, SAMPLE_CONDITIONS constant
- [x] **10C: Dashboard Shoot Readiness** — shootReadiness lib, useShootReadiness hook, ShootReadinessWidget on ProjectDashboard (admin/producer only)

### Key Concepts

- Per-colorway (SKU) asset flags with 5-state lifecycle: needed → in_progress → delivered | ai_generated | not_needed
- 6 canonical asset types (ecomm_on_figure, lifestyle, off_figure_pinup, off_figure_detail, video, other) + 3 legacy compat (ecomm, campaign, ai_generated)
- AI Generated flag: purple status (5th flag state, counts as "complete" for scheduling)
- Chip-based progressive disclosure (default) + table view toggle for asset requirements
- Per-colorway launch dates on ProductSku with family inheritance (resolveSkuLaunchDate)
- Family hero image with EditableProductImage (hover Replace/Remove) in Colorways section
- Assets tab renamed to Files (documents only, identity images moved to Colorways)
- Product launch date on ProductFamily with overdue/soon deadline warnings
- Sample logistics: returnDueDate + condition fields, return overdue/due-soon badges
- Dashboard widget: shoot readiness with 3-tier display (full/request-deadline/samples-only), expandable constraints, confidence badges, progress bars

---

## Sprint S6: Talent Page Improvements

**Goal:** Fix 6 UX issues on the Library > Talent page: details below grid requiring excessive scrolling, editable project linking, misleading shot history errors, misplaced casting brief, text-field measurements, and unscoped TalentPicker.

**Status:** COMPLETE

### Sub-tasks

- [x] **S6-1 (Mockups):** 4 HTML mockups — 3 layout options (Sheet/MasterDetail/SlideOver) + casting brief panel with range sliders. User chose Option A (Sheet).
- [x] **S6-2 (Decompose):** LibraryTalentPage.tsx 1,896→741 lines. Extracted 6 files: talentUtils.ts, HeadshotThumb.tsx, SortableImageTile.tsx, TalentInlineEditors.tsx, TalentDetailPanel.tsx (916 lines), CreateTalentDialog.tsx. Build + 98 tests pass.
- [x] **S6-3a (Read-only projects):** Removed add/remove project controls from TalentDetailPanel. Project pills are now read-only `<Link>` to `/projects/:id/assets`. Removed `availableProjectOptions` prop/computation.
- [x] **S6-3b (Shot history fix):** Fixed `error instanceof Error` always false (FirestoreCollectionError is plain object). `isMissingIndex` → muted message, genuine errors → red.
- [x] **S6-4 (Sheet layout):** Replaced inline Card with Sheet (right-side on desktop, bottom sheet on mobile). Added prev/next navigation buttons + keyboard arrow keys. Selected card gets highlight ring. Build + 98 tests pass.
- [x] **S6-5a (Casting brief relocation):** Extract casting brief from TalentDetailPanel tabs to top-level collapsible panel above grid. Grid cards show match score badges when casting mode active.
- [x] **S6-5b (Range sliders):** Install shadcn Slider, create MeasurementRangeSlider (dual-thumb), useMeasurementBounds hook for data-driven bounds. Replace text inputs in casting brief.
- [x] **S6-6 (TalentPicker scoping):** Added `projectId` prop to TalentPicker, project-scoped filtering, auto-repair orphaned talent via `addTalentToProject`. ShotDetailPage passes `shot.projectId`. All 242 tests pass.

### Key Decisions

- **Layout:** Option A (Sheet) — right-side drawer on desktop (`sm:max-w-xl lg:max-w-2xl`), bottom sheet on mobile (`max-h-[90vh] rounded-t-xl`)
- **Navigation:** Prev/next buttons in sticky Sheet header + Left/Right keyboard arrows (skip when typing in inputs)
- **Project pills:** Read-only with `<Link>` navigation to `/projects/:id/assets`
- **Shot history errors:** `isMissingIndex` → muted message (not red), genuine errors → red
- **TalentPicker:** Scoped to project talent; auto-repair is silent best-effort (idempotent `arrayUnion`)
- **Casting brief:** Will move from detail tabs to top-level collapsible panel (Phase 5)
- **Range sliders:** Dual-thumb with data-driven bounds from actual talent measurements (Phase 5)

### Acceptance Criteria

- [x] Talent detail opens in Sheet (no more scrolling below grid)
- [x] Prev/next + keyboard arrow navigation works
- [x] Project pills are read-only links
- [x] Shot history shows muted message for missing indexes
- [x] TalentPicker dropdown only shows project talent
- [x] Casting brief accessible as top-level panel (not buried in detail tabs)
- [x] Measurement inputs are range sliders with data-driven bounds
- [x] Build clean, all tests pass

---

## Sprint S7: Schedule & Call Sheet Polish

**Goal:** Elevate schedule builder, call sheet output, and mobile on-set viewer to 100% premium quality. Covers Plan.md items 3.5f-g with expanded scope.

**Status:** S7-6, S7-7, S7-8 COMPLETE. S7-9 (E2E) and S7-10 (docs) pending.

**Rationale:** Schedule and call sheet surfaces are the most visible outputs of the app — they go to clients, crew, and stakeholders. Premium polish here directly impacts first impressions and professional credibility.

### Sub-tasks

- [x] **S7-1 (Research):** Competitor analysis — SetHero, StudioBinder, Celtx crew grouping, header layouts, print conventions
- [x] **S7-2 (Mockups v1):** 3 HTML mockups — call sheet output, schedule builder, mobile on-set viewer
- [x] **S7-3 (Review Round 1):** User feedback + 3 bug fixes (overflow cropping, text cutoff, off-palette colors)
- [x] **S7-4 (Review Round 2):** User feedback + 2 design fixes (section band redesign, NOW indicator relocation)
- [x] **S7-5 (Devil's Advocate):** Cross-mockup consistency audit, token compliance, user feedback compliance
- [x] **S7-6 (Implementation — Schedule Builder):** Overlap groups compression algorithm, sidebar, properties drawer, NOW indicator
- [x] **S7-7 (Implementation — Call Sheet Output):** Modular grid header, multi-track schedule, dept-grouped crew, editorial section labels
- [x] **S7-8 (Implementation — Mobile On-Set Viewer):** LIVE status bar, tab navigation, crew directory, floating action bar
- [ ] **S7-9 (E2E Testing):** Full schedule -> call sheet flow (covers 3.5f)
- [ ] **S7-10 (Documentation):** Update Architecture.md, component inventory

### Key Design Decisions (locked in)

- **Compression:** Overlap groups algorithm (proportional heights for overlapping blocks, 64px compact for isolated)
- **Section labels:** Editorial style (dark text + 2px border rule), NOT full-bleed dark bands
- **Table headers:** Light gray (#f4f4f5 bg, zinc-600 text), NOT black
- **NOW indicator:** Time gutter placement, 1px line at 50% opacity, 8px dot
- **Block colors:** Setup=amber, Shooting=blue, HMU=purple, Meal=green, Travel=gray, Banner=dark

### Mockup Files (approved, ready for implementation)

- `mockups/sprint-s7-callsheet-output-v2.html`
- `mockups/sprint-s7-schedule-builder-v2.html`
- `mockups/sprint-s7-mobile-onset-v2.html`

### Acceptance Criteria

- [x] Schedule builder implements overlap groups compression with proportional heights
- [x] Call sheet output uses editorial section labels + light gray table headers
- [x] Call sheet prints cleanly on letter-size with dept page breaks
- [x] Mobile on-set viewer has LIVE indicator + tab navigation
- [x] NOW indicator is subtle and does not overlap block content
- [ ] Full schedule -> call sheet E2E flow works (3.5f)
- [x] All 3 surfaces match approved v2 mockups
- [x] Build clean, all tests pass

---

## Sprint S8: Team Audit & Fix Sprint

**Goal:** Comprehensive 6-agent audit of the entire vNext codebase followed by parallel implementation of all critical, high, and medium fixes. Close security vulnerabilities, fix deploy-blocking bugs, adopt the design system properly, consolidate duplicate code, and sync all documentation.

**Status:** COMPLETE (committed: 9e7de7f).

**Rationale:** Before pushing forward with new features, a full-codebase health check ensures the foundation is solid. The audit found 2 critical bugs, 1 security vulnerability, and 28 UX consistency issues that would compound if left unfixed.

### Research Phase (6 parallel read-only agents)

- [x] **S8-R1 (Researcher):** PRD compliance audit — all 7 user journeys validated end-to-end, zero critical gaps
- [x] **S8-R2 (UX Auditor):** 28 findings — semantic typography underused, hardcoded colors, dark mode ~60%, touch targets mostly OK
- [x] **S8-R3 (Systems Architect):** 8.5/10 architecture score — Firestore patterns solid, ShotDetailPage (6 subs) and CallSheetBuilderPage (10+ subs) exceed read budget
- [x] **S8-R4 (Adversary):** 8 issues — 2 critical (midnight overlap, iOS scroll trap), 4 high, 2 medium
- [x] **S8-R5 (Code Reviewer):** 9 files over 800 lines, normalizeText x3 duplication, recommendedContactDensity logic bug, strong immutability discipline
- [x] **S8-R6 (Doc Keeper):** 7 doc inconsistencies (Architecture.md routes, component inventory, MEMORY.md missing)

### Implementation Phase (6 parallel agents, non-overlapping file ownership)

- [x] **S8-1 (Critical Bugs):** Midnight crossing fix in overlapGroups.ts (clampEndMin helper) + iOS scroll trap fix in OnSetViewer.tsx (single scroll context)
- [x] **S8-2 (Security + Validation):** Public pulls Firestore rule tightened (requires shareToken ≥ 32 chars) + measurement bounds (feet 2-9) + talent selection auto-clear
- [x] **S8-3 (Typography):** Semantic classes (heading-section, heading-subsection) adopted across 10 page components
- [x] **S8-4 (Color Tokens):** 5 hardcoded colors replaced with token vars (emerald→success, red→error, amber→warning, white→text-inverted)
- [x] **S8-5 (Utility Consolidation):** shared/lib/textUtils.ts created, 3 files deduplicated, recommendedContactDensity bug fixed
- [x] **S8-6 (Documentation):** Architecture.md route map corrected (9 phantom routes removed, 6 added, 30+ S7 components), MEMORY.md created, HANDOFF/CHECKPOINT updated

### Acceptance Criteria

- [x] 2 critical bugs fixed (midnight overlap, iOS scroll trap)
- [x] 1 security vulnerability closed (pulls enumeration)
- [x] Semantic typography classes adopted across page components
- [x] Hardcoded colors replaced with design token vars
- [x] Duplicate utility functions consolidated into shared/lib/textUtils.ts
- [x] Architecture.md route map matches actual routes
- [x] 2370 tests pass, build clean, lint zero warnings

---

## Sprint S9: Production Hub Rebrand + Onboarding + Cleanup

**Goal:** Rename app from "Shot Builder" to "Production Hub," redesign the login page with premium dark branding, remove unused board view, and implement seamless user onboarding so admins can invite users before they've signed in.

**Status:** COMPLETE (committed, included in PR #363).

**Rationale:** Real users cannot onboard without the admin invite flow working for pre-signup emails. The rename and login redesign establish the Production Hub brand identity. Board view removal simplifies from 4 views to 3 (Gallery, Visual, Table) per PRD "Cut/Simplify" guidance.

### Sub-tasks

- [x] **S9-1:** App rename — "Shot Builder" → "Production Hub" across 5 files (index.html, package.json, SidebarHeader, MobileTopBar, PendingAccessPage)
- [x] **S9-2:** Login page redesign — dark zinc-950 background, frosted glass card, Google "G" SVG, "built by Immediate" footer
- [x] **S9-3:** Board view removal — 5 files deleted (~340 lines), ViewMode narrowed to "gallery" | "visual" | "table", keyboard shortcuts updated
- [x] **S9-4:** Seamless onboarding — pendingInvitations collection, setUserClaims catches user-not-found, claimInvitation CF, AuthProvider auto-claim, InviteUserDialog pending flow, AdminPage pending table
- [x] **S9-5:** Test fixes — adminWrites.test.ts and InviteUserDialog.test.tsx updated for new return types and button text
- [x] **S9-6:** Documentation — all root docs renamed, Architecture.md updated (data model, CFs, ViewMode), MEMORY.md learnings added

### Acceptance Criteria

- [x] `grep -r "Shot Builder" src-vnext/ index.html` returns zero results
- [x] `grep -rn '"board"' src-vnext/features/shots/` returns zero results
- [x] Login page shows Production Hub branding with dark theme
- [x] Admin can invite email that hasn't signed in → pending invitation created
- [x] 2349 tests pass, build clean, lint zero warnings
- [x] All root docs (PRD, Architecture, AI_RULES, Plan) renamed to "Production Hub"

### Post-Commit Deployment

- [x] Deploy Cloud Functions: `firebase deploy --only functions` (Firestore Queue pattern — bypasses GCP org IAM)
- [ ] Create Firestore index: collection group `pendingInvitations` — status(Asc) + email(Asc)
- [x] E2E test: admin invites unknown email → user signs in → auto-gets role (verified 2026-03-03)

### Sprint S9b: Firestore Queue Migration (Infrastructure Fix)

**Status:** COMPLETE (deployed, verified, uncommitted).

**Problem:** GCP org policy `constraints/iam.allowedPolicyMemberDomains` blocks `allUsers`/`allAuthenticatedUsers` IAM on Cloud Functions. Firebase Hosting rewrites require `allUsers` invoker, which was stripped and cannot be re-added.

**Solution:** Replaced HTTP-based Cloud Function invocation with Firestore document-trigger queue. Client writes to `_functionQueue/{docId}`, `processQueue` onCreate trigger processes server-side, client reads response via `onSnapshot`.

- [x] Server: `processQueue` Firestore trigger + extracted handler functions
- [x] Client: `callFunction.ts` rewritten (HTTP fetch → Firestore queue, same signature)
- [x] Rules: `_functionQueue` collection rules (auth create, anon for publicUpdatePull, owner read)
- [x] Tests: 11 unit tests for queue-based callFunction
- [x] Fix: onSnapshot error handler (silent failure → immediate reject)
- [x] Fix: Removed `revokeRefreshTokens` from `processInvitation` (was invalidating caller's own session)
- [x] Deployed and verified end-to-end (setUserClaims + claimInvitation)

## Sprint S10: User Management Overhaul

**Goal:** Complete the user management lifecycle — project visibility controls, enhanced admin roster with deactivation/reactivation, bulk project assignment, invitation emails via Resend, and first-run experience. Makes the admin panel production-ready for real team onboarding.

**Status:** COMPLETE (PR #363 merged to main). Post-merge hotfix: `firestore.rules` producer list/get split (PR #364 merged).

**Rationale:** Real team onboarding requires admins to control who sees which projects, deactivate departed users, bulk-assign projects during invite, and send professional invitation emails. Without these, admins must manually coordinate access outside the app.

### Sub-tasks

- [x] **S10-1:** Firestore rules — producer global read access to all projects, project `visibility` field support (team/restricted/private), `_functionQueue` anonymous create for `publicUpdatePull`
- [x] **S10-2:** Project visibility UI — 3-state radio (Team/Restricted/Private) in project settings dialog
- [x] **S10-3:** Enhanced team roster — search/filter bar (debounced search, role filter, status filter), status badges (Active/Deactivated/Pending), expandable user detail panel, improved pending invitation display
- [x] **S10-4:** Deactivation/reactivation — AlertDialog confirmation, inline role picker for reactivation, Cloud Function handlers (`handleDeactivateUser`, `handleReactivateUser`), resend invitation email button
- [x] **S10-5:** Bulk project assignment — `ProjectAssignmentPicker` component, `bulkAddProjectMembers` write function, integrated into `UserDetailPanel` and `InviteUserDialog`
- [x] **S10-6:** Invitation emails via Resend — `email.js` module, HTML+text templates, `handleResendInvitationEmail` Cloud Function, DNS verification
- [x] **S10-7:** First-run experience — empty states for team roster and project list, welcome toast for new users
- [x] **S10-8:** QA security audit — tested all role x visibility x membership combinations
- [x] **S10-9:** Documentation — Plan.md, Architecture.md, HANDOFF.md, CHECKPOINT.md, MEMORY.md updated

### Acceptance Criteria

- [x] Admin can set project visibility to Team, Restricted, or Private
- [x] Producers see all projects regardless of membership
- [x] Admin roster supports search by name/email, filter by role/status
- [x] User detail panel shows role, status, project memberships, last sign-in
- [x] Deactivation requires AlertDialog confirmation, prevents self-deactivation
- [x] Reactivation allows role selection before confirming
- [x] Invitation emails sent via Resend with Production Hub branding
- [x] Bulk project assignment available during invite and from user detail
- [x] 2360 tests pass, build clean, lint zero warnings

---

## Sprint S11: Stabilize + Polish

**Goal:** Security hardening, login page redesign, admin UX fixes, navigation rename, dashboard tabs. Comprehensive 6-agent team with research-first then implementation.

**Status:** COMPLETE (PR #365 merged to main). Firestore rules + Cloud Functions deployed.

### Research Phase (6 parallel agents)

- [x] **S11-R1 (Code Reviewer):** 2 CRITICAL (revokeRefreshTokens self-lockout, missing write restrictions), 2 HIGH (createdAt persistence, missing AlertDialog)
- [x] **S11-R2 (Researcher):** Email audit (no reply-to header), last sign-in (no data source)
- [x] **S11-R3 (Systems Architect):** Carrier tracking feasibility (Phase 1: links, Phase 2: Ship24 API $3.90/mo)
- [x] **S11-R4 (Adversary):** Dashboard UX options (chose tabs), Inbox rename changelist
- [x] **S11-R5 (UX Designer):** 3 HTML login mockups (Option A/B/C), user chose Option A (split screen)
- [x] **S11-R6 (Doc Keeper):** Runtime docs updated, Plan.md S11 section drafted

### Implementation Phase (6 parallel agents, non-overlapping file ownership)

- [x] **S11-1 (Security):** revokeRefreshTokens guard (`uid !== callerUid`), talent/locations write restrictions (`isAdmin() || isProducer()`), email reply-to header
- [x] **S11-2 (Admin Fixes):** adminWrites.ts `merge:true` (was mergeFields excluding createdAt), PendingInvitationRow AlertDialog on revoke
- [x] **S11-3 (Last Sign-In):** `lastSignInAt` field on UserProfile type, AuthProvider fire-and-forget write, TeamRosterTab/TeamUserRow display
- [x] **S11-4 (Login Page):** Option A split screen rewrite — lifestyle hero WebP, UM logo, Immediate logo IMAGE, CSS custom properties
- [x] **S11-5 (Request Centre Rename):** ShotRequestInboxPage → ShotRequestCentrePage, route /inbox → /requests with redirect, nav icon ClipboardCheck
- [x] **S11-6 (Dashboard Tabs):** Projects (default) + Shoot Readiness tabs for admin/producer

### PR Review Fixes

- [x] **P1 fix:** Reverted shots write rule to `isAuthed()` — crew needs write access per rbac.ts
- [x] **P2 fix:** Removed `createdAt` from client-side merge write — server-side Cloud Function handles it via mergeFields

### Acceptance Criteria

- [x] Login page: UM logo + lifestyle image + Immediate logo IMAGE + design tokens
- [x] Admin: actual last sign-in timestamps shown
- [x] Nav: "Request Centre" (not "Inbox"), /inbox redirects to /requests
- [x] Dashboard: Projects + Shoot Readiness tabs
- [x] Email: reply-to ted@immediategroup.ca
- [x] Rules: talent/locations writes = admin/producer only; shots = any authed user
- [x] Functions: revokeRefreshTokens guarded for non-self UIDs
- [x] 2364 tests pass, build clean, lint zero warnings

### Post-Sprint Deployment

- [x] `firebase deploy --only firestore:rules,functions` — deployed (2x: initial + corrected shots rule)
- [x] PR #365 merged to main

### Post-Sprint Fix (PR #366)

- [x] UM logo distortion — `h-[22px]` → `h-7` (28px), source PNG was 3928px wide causing 20x downscale artifacts
- [x] Immediate logo invisible — switched from white to black variant on light sign-in panel
- [x] Dark theme logo swap — `dark:hidden` / `hidden dark:block` for theme-aware Immediate logo (Codex bot P2 feedback)
- [x] PR #366 merged to main

### Login Page Redesign (PR #367)

- [x] Figma-driven redesign: UM logo moved from hero image overlay to sign-in panel (centered, prominent)
- [x] UM logo: white PNG (`unbound-logo-white.png`) with CSS `invert dark:invert-0` — width-based sizing `w-[300px] max-w-full`
- [x] Black UM logo PNG unusable (8860x4725 canvas padding vs white 3928x453) — documented in MEMORY.md
- [x] Immediate logo: full opacity (removed `opacity-30`), `h-5`, theme-aware (`dark:hidden` / `hidden dark:block`)
- [x] Sign-in panel always vertically centered (`items-center`, removed `md:items-start`)
- [x] Hero image: clean lifestyle photo, no overlay branding
- [x] Mobile overflow safety: `max-w-full` alongside `w-[300px]` (Codex bot P2 feedback)
- [x] PR #367 merged to main

---

## Sprint S12: Request Notifications + Request Overhaul + Bulk Shot Generation

**Goal:** Three vertical slices that close the loop on shot requests (notifications, collaborative briefs) and unlock bulk shot creation from the product library.

**Status:** COMPLETE (PR #370 merged to main). Firebase rules, storage, and functions deployed.

### S12A: Request Centre Notifications

- [x] **S12A-1:** `notifyUserIds` field on ShotRequest type
- [x] **S12A-2:** RecipientPicker component in SubmitShotRequestDialog (multi-select admin/producer users)
- [x] **S12A-3:** requestWrites.ts — fire-and-forget `callFunction('sendRequestNotification', ...)` after submit
- [x] **S12A-4:** Cloud Function `handleSendRequestNotification` — cross-tenant guard, recipient resolution, Resend email
- [x] **S12A-5:** Email template `buildRequestNotificationHtml/Text` in functions/email.js
- [x] **S12A-6:** `useSubmittedRequestCount` hook + sidebar badge on Request Centre nav item
- [x] **S12A-7:** Tests (43 new)

### S12B: Request Centre Overhaul

- [x] **S12B-1:** Types (`ShotRequestReference`, `ShotRequestComment`) + `shotRequestCommentsPath` in paths.ts
- [x] **S12B-2:** Firestore rules (comments subcollection: admin+producer read, authorId binding, 5000 char limit) + Storage rules (request-references with isValidUpload)
- [x] **S12B-3:** `useRequestComments` hook + `addRequestComment` write function (MAX_COMMENT_CHARS = 2000)
- [x] **S12B-4:** CommentThread UI (smart auto-scroll, Enter-to-send, empty state)
- [x] **S12B-5:** Product picker (ProductPickerPopover) in submit dialog using `relatedFamilyIds`
- [x] **S12B-6:** ReferenceInput component (structured references + Firebase Storage upload, filename sanitization, MAX_REFERENCES = 10)
- [x] **S12B-7:** TriagePanel overhaul (products, references, conversation thread) + tests (34 new)

### S12C: Bulk Product-to-Shot Generation

- [x] **S12C-1:** `useProductSelection` hook (prefixed Set state: `fam:` / `sku:`)
- [x] **S12C-2:** Multi-select mode on ShootReadinessWidget (admin+producer gated)
- [x] **S12C-3:** Multi-select mode on ProductListPage (checkboxes, Select All)
- [x] **S12C-4:** BulkSelectionBar floating action bar component
- [x] **S12C-5:** BulkAddToProjectDialog (project picker + family/SKU granularity toggle)
- [x] **S12C-6:** `bulkCreateShotsFromProducts` (writeBatch with 250-doc chunking, MAX_BULK_ITEMS = 500, client-side deleted filter)
- [x] **S12C-7:** Tests (46 new)

### Review Fixes (15/15 applied)

- [x] Cross-tenant clientId validation in Cloud Function
- [x] Client-side deleted filter (not `where("deleted","==",false)`)
- [x] Storage rules content-type via `isValidUpload()`
- [x] Comment body max length (5000 rules, 2000 client)
- [x] ReferenceInput error surfacing via toast
- [x] TriagePanel product links use React Router `<Link>`
- [x] Notification creates restricted to admin+producer
- [x] Smart auto-scroll in CommentThread
- [x] RecipientPicker empty state + scroll constraint
- [x] Filename sanitization + MAX_REFERENCES cap
- [x] SidebarNavItem badge uses `var(--color-accent)` token
- [x] BulkAddToProjectDialog empty projects state
- [x] MAX_BULK_ITEMS = 500 cap in bulkShotWrites

### Acceptance Criteria

- [x] 2488 tests passing, build clean, lint zero warnings
- [x] Visual QA: all 10 UI checkpoints verified in browser
- [x] CI: build + vitest + claude-review all pass
- [x] PR #370 merged to main
- [x] Firebase deployed: firestore:rules, storage, functions

---

## Sprint S13: Cleanup + Quick Wins

**Goal:** Remove banned dependencies that inflate the vendor chunk, add missing UX quick wins (on-set standalone route, theme toggle, role-gating fix).

**Status:** COMPLETE (PRs #372 + #373 merged to main).

### Sub-tasks

- [x] **S13-1:** Remove banned deps from package.json (react-select, react-easy-crop, reactjs-tiptap-editor, @tanstack/react-query)
- [x] **S13-2:** Promote class-variance-authority to direct dependency
- [x] **S13-3:** Narrow vitest config to src-vnext/ only
- [x] **S13-4:** Vendor chunk splitting via manual chunks in vite.config (891kB → 276kB)
- [x] **S13-5:** On-set viewer standalone route (`/projects/:id/schedules/:scheduleId/onset`) — `OnSetViewerPage` wrapper, no `RequireDesktop`, all roles
- [x] **S13-6:** Theme toggle in sidebar (light/dark/system cycle button in `SidebarUserSection`)
- [x] **S13-7:** Shoot Readiness tab visible to all authenticated roles (was admin/producer only)

### Acceptance Criteria

- [x] `package.json` contains no react-select, react-easy-crop, reactjs-tiptap-editor, @tanstack/react-query
- [x] Vendor chunk ≤ 300kB gzipped
- [x] On-set viewer accessible via standalone URL without RequireDesktop guard
- [x] Theme toggle cycles light → dark → system in sidebar footer
- [x] Shoot Readiness tab visible to crew, warehouse, and viewer roles
- [x] Build clean, lint zero warnings, tests pass

---

## Sprint S14: Cmd+K Command Palette

**Goal:** Ship the Cmd+K command palette deferred from Phase 2. Fulfils PRD UX Principle #1 ("command palette as primary discovery").

**Status:** COMPLETE (PR #374 merged to main).

**Rationale:** PRD lists Cmd+K as a MUST-HAVE feature. The `SearchCommandProvider` stub was already wired into App.tsx but held no real state. This sprint replaces the stub with a full implementation using Fuse.js for fuzzy search and cmdk for the keyboard-navigable UI.

### Sub-tasks

- [x] **S14-1:** Replace `SearchCommandProvider` stub with real useState-backed provider (`src-vnext/app/providers/SearchCommandProvider.tsx`)
- [x] **S14-2:** `CommandPalette.tsx` — Dialog + Command, Fuse.js search, grouped results (Projects, Products, Talent, Crew, max 5 per group), recent items section, quick actions when empty
- [x] **S14-3:** `commandPaletteUtils.ts` — Fuse index builder, entity mappers, `sb:cmd-recent` localStorage helpers, `groupByType()`
- [x] **S14-4:** Mount in App.tsx (wrap AppRoutes with SearchCommandProvider) + AppShell (render `<CommandPalette />`)
- [x] **S14-5:** Tests (20 new) in `CommandPalette.test.tsx`

### Key Decisions

- Used `Dialog` + `Command shouldFilter={false}` instead of `CommandDialog` — `CommandDialog` hardcodes `Command` without `shouldFilter`, which hides Fuse results
- Cmd+K bound via direct `document.addEventListener` — `useKeyboardShortcuts` blocks inputs; meta+k must work from any focused element including inputs
- `CommandPaletteInner` only renders when `open === true` — zero Firestore subscriptions when palette is closed
- Fuse threshold 0.35 — fuzzy but not too loose
- Recent items capped at 5, localStorage key `sb:cmd-recent`
- "Go to Admin" quick action shown only for admin role

### Acceptance Criteria

- [x] Cmd+K / Ctrl+K opens palette from any focused element including inputs
- [x] Empty query shows Recent (if any) + Quick Actions sections
- [x] Search query shows grouped results (Projects, Products, Talent, Crew)
- [x] Clicking or pressing Enter navigates to entity and closes palette
- [x] Recent items persist across sessions in localStorage
- [x] Zero Firestore subscriptions when palette is closed
- [x] 1215 tests passing, build clean, lint zero warnings
- [x] PR #374 merged to main

---

## Sprint S15: UX Overhaul & Competitive Parity

**Goal:** Address user-reported UX friction across multiple surfaces, informed by competitive analysis of Saturation (export builder), SetHero (call sheet), and KoboLabs (PLM). Ship quick wins first, then bigger redesigns.

**Status:** S15a + S15b COMPLETE. S15c-e pending.

**Research:** 4 competitive/internal audit docs in `docs/research/`. Action plan in `docs/research/s15-action-plan.md`. 3 HTML mockups approved in `mockups/s15-*.html`.

### S15a: Quick Wins (commit 78a5742)

- [x] **S15a-1: Shot batch delete** — `bulkSoftDeleteShots()` with writeBatch (250-chunk, 500 cap), red Delete button in bulk action bar, typed "DELETE" confirmation dialog. 5 tests.
- [x] **S15a-2: Urgency badges** — `getShootUrgency()` replaces misleading Low/Medium/High with OVERDUE/URGENT/SOON/UPCOMING/UNSCHEDULED. Overdue products now surface first. Token colors. 37 tests.
- [x] **S15a-3: Page transitions** — CSS-only `fade-in-rise` (200ms ease-out) via PageTransition wrapper. `prefers-reduced-motion` respected. No new deps. 2 tests.

### S15b: View Improvements (commit 8426960)

- [x] **S15b-1: Talent table view** — `TalentTable.tsx` with sortable columns (name, gender, agency, height, measurements, projects). Grid/Table toggle, localStorage persistence. 7 tests.
- [x] **S15b-2: Locations table view** — `LocationsTable.tsx` with sortable columns (name, address, city, contact, projects). List/Table toggle, localStorage persistence. 8 tests.
- [x] **S15b-4: Shot view consolidation** — Gallery+Visual merged into Card. ViewMode: "card"|"table". Shortcuts: 1=Card, 2=Table. Old localStorage migrated. ShotVisualCard no longer rendered.

### S15c: Export Builder Redesign (pending)

- [ ] **S15c-1: Block model** — Block types (Text, Image, ShotGrid, ShotDetail, ProductTable, Divider, PageBreak), document model
- [ ] **S15c-2: Builder UI** — 3-panel layout (block palette, WYSIWYG preview, block settings)
- [ ] **S15c-3: Template system** — Built-in + user-saved templates
- [ ] **S15c-4: Variable system** — Dynamic tokens (project name, dates, page numbers)
- [ ] **S15c-5: Data blocks** — ShotGrid and ProductTable pull live data with column toggles

### S15d: Call Sheet Improvements (pending)

- [ ] **S15d-1: Section toggles** — Show/hide each call sheet section
- [ ] **S15d-2: Per-field customization** — Rename, reorder, resize, toggle columns per section
- [ ] **S15d-3: Layout templates** — Save/load call sheet configurations

### S15e: Premium Polish (pending)

- [ ] **S15e-1: Image editing canvas** — Cropping + basic adjustments
- [ ] **S15e-2: UX polish** — Hover states, micro-interactions, premium feel
- [ ] **S15e-3: Product enrichment** — Last modified indicators, richer metadata

### Acceptance Criteria (S15a+b)

- [x] Batch delete: select shots → Delete → typed confirmation → soft-deleted → toast
- [x] Urgency: overdue products show red OVERDUE badge, not "Low" confidence
- [x] Transitions: page changes fade in smoothly (200ms)
- [x] Talent: Grid/Table toggle with sortable columnar view
- [x] Locations: List/Table toggle with sortable columnar view
- [x] Views: 2 modes (Card + Table) instead of 3 (Gallery + Visual + Table)
- [x] 1274 tests passing, build clean, lint zero warnings

---

## Cross-Phase Requirements

These apply to every phase:

### Testing

- Unit tests for new `lib/` modules (80%+ coverage)
- Component tests for new UI components (render + key interaction)
- Bug fixes get regression tests before the fix
- Every page: empty, loading, and error state coverage
- Run `npm test` before marking any phase step complete

### Performance

- LCP < 2.5s on simulated 4G mobile
- Initial JS bundle < 150 KB gzipped
- Route chunks < 50 KB gzipped each
- < 5 Firestore reads per page load

### Security

Before shipping any phase, answer:
1. Can a user access data outside their `clientId`?
2. Can a user escalate their role?
3. Can a user modify data they should only read?
4. Can untrusted input be rendered as HTML/JS?
5. Can a public share link leak private data?

### Git

- Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`)
- One logical change per commit
- Feature branches off `main`

---

## Wireframe & Mockup Strategy

Every phase that touches UI (Phases 2-6) requires wireframes before implementation:

1. **HTML mockups** in `mockups/` directory -- static HTML/CSS files that can be opened in a browser
2. **Mobile-first** -- mockups start at 375px, then show tablet (768px) and desktop (1280px)
3. **User approval** -- mockups reviewed and approved before implementation begins
4. **Iterative** -- mockups are quick and disposable, not pixel-perfect. Speed over fidelity.

### Mockup conventions

- One HTML file per surface/flow
- Tailwind CDN for styling (matches production stack)
- Annotated with comments explaining UX decisions
- Named: `{phase}-{surface}-{viewport}.html` (e.g., `p2-sidebar-desktop.html`)
