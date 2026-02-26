# Plan -- Shot Builder

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

- [ ] Every page correct at 375/768/1280px
- [ ] All cards have hover states and cursor-pointer
- [ ] No navigation dead-ends
- [ ] Breadcrumbs on all detail pages via PageHeader

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

## Phase 8: Shot Request Inbox (Future)

**Goal:** Allow any team member to submit shot requests. Producers triage into existing or new projects.

**Status:** Not started. Outline only — implementation after 7A-7E complete.

### Key Concepts

- New Firestore collection: `clients/{clientId}/shotRequests/{requestId}`
- Fields: title, requester, products[], references, notes, deadline, priority, status (submitted/triaged/absorbed/rejected)
- Flexible input: minimal (title + note) through structured brief (products, references, deadline)
- Producer triage: absorb into existing project shot list, or create new project from request

---

## Phase 9: Casting Engine (Future)

**Goal:** Searchable talent database with measurement-based matching and shot history.

**Status:** Not started. Outline only.

### Key Concepts

- Filter talent by measurement ranges (height, bust, waist, etc.), gender, availability
- Auto-match: given casting brief requirements, suggest matching talent
- Shot history: auto-link every shot a model has appeared in (reverse lookup from shot.talent[])
- Extend existing casting session infrastructure in talent page

---

## Phase 10: Asset Requirements & PLM (Future)

**Goal:** Track per-product/colorway asset requirements and sample logistics.

**Status:** Not started. Outline only.

### Key Concepts

- Per-product/colorway asset flags: needs e-comm, campaign, video, AI-generated
- Product launch date tracking
- Sample logistics: arrival, return, status timeline
- Auto-suggest shoot dates based on sample availability + quantity thresholds

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
