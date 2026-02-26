# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This file governs all Claude Code work in the vNext worktree. Follow these rules exactly.

## Canonical Source of Truth

**Root-level `PRD.md` and `Plan.md` are the authoritative specifications.** Product vision, user journeys, feature priorities, and the phased implementation plan are defined there.

- `PRD.md` — Product vision, target users, core journeys, feature priority matrix, UX principles
- `Plan.md` — Multi-phase implementation plan (7A-7E + 8-10) with sub-task checkboxes (this is the todo tracker)
- `AI_RULES.md` — Decision framework, code standards, context management rules
- `Architecture.md` — Tech stack, routes, data model, file structure

**`docs-vnext/` is supplementary engineering reference** — slice specs, sprint proofs, and design details. Useful for understanding past work and engineering constraints, but when `docs-vnext/` conflicts with `PRD.md` or `Plan.md`, the root docs win.

## Hard Rules

### 1. Vertical-Slice Discipline

Build one complete workflow at a time. Each slice ships a fully usable end-to-end flow that replaces the equivalent in the old system.

- **No horizontal layers.** Do not "set up all components first" or "build all routes first."
- **No stubs.** Deferred features must not be stubbed, partially implemented, or visible in the UI. No placeholder routes, grayed-out nav items, "coming soon" labels, or skeleton feature modules.
- **If it's not in the current slice, it does not exist in the codebase.**
- The current phase and its sub-tasks are defined in `Plan.md`.

### 2. Mobile-First, Not Mobile-Parity

Every layout starts from the smallest viewport. Desktop adds density and editing capability.

- Mobile is a constrained, simplified view of the same workflows — not a divergent or mobile-only workflow set.
- Mobile surfaces: Reader (view-only) or Limited (view + operational actions like status, confirm, flag, notes).
- Desktop surfaces: Editor (full CRUD, structural changes, complex forms).
- Desktop-only surfaces (call sheet builder, admin settings) redirect to dashboard on mobile with a toast.
- Surface classifications are defined in `docs-vnext/design/experience-spec.md`.

### 3. Design-First, Reuse-First

- Use shadcn/ui (Radix) as the primitive layer. Do not create custom primitives.
- `tokens.css` is the single source of design truth. All color, spacing, and typography values come from tokens.
- `src/styles/design-tokens.js` provides semantic Tailwind classes (`.heading-page`, `.heading-section`, `.label-meta`, etc.). Prefer these over ad-hoc class combinations.
- Tailwind classes reference token values. No hardcoded hex colors or arbitrary spacing in components.
- Use `text-3xs` (9px), `text-2xs` (10px), `text-xxs` (11px) for micro font sizes — never `text-[9px]`, `text-[10px]`, `text-[11px]`.
- Every surface uses the same building blocks. No one-off component variants for a single page.
- Fewer surfaces, fewer modes. Each new page/modal must justify its existence.

### 4. Reuse Existing Infrastructure

Firebase Auth, Firestore, Storage, Functions, security rules, and the data model are stable and unchanged.

- **Reuse existing Firestore collections and document shapes.** No new collections, no new fields, no schema changes without overwhelming justification.
- If a schema change is proposed, you must: (a) present the rationale, (b) present a migration plan (rules/backfill/dual-write), (c) STOP for approval before proceeding.
- Reuse existing `firestore.rules` — do not modify security rules unless the change is required by a new vNext route and has been reviewed.
- Auth custom claims (`role`, `clientId`) and the 5-role model (admin, producer, crew, warehouse, viewer) are fixed infrastructure.
- Firestore path helpers from `shared/lib/paths` are the single source for collection references.

### 5. State Strategy

- Server state = Firestore `onSnapshot` subscriptions. No Redux, Zustand, or client-side cache.
- List views must aggressively unsubscribe on unmount to avoid fan-out.
- Optimistic updates are allowed only for idempotent state transitions (status toggles). Optimistic entity creation is explicitly disallowed — all creates must await Firestore write confirmation.
- Readiness indicators (e.g., shots planned, products assigned) must be denormalized aggregates on the parent document, not computed via client-side fan-out queries.
- No duplicate state. Never cache Firestore data in React state. Subscribe and render.
- No custom offline sync engine. Firestore's default IndexedDB persistence is relied upon for offline reads. No custom mutation queue, conflict resolution UI, or sync status system.
- Context providers are minimal: Auth, ProjectScope, Theme, SearchCommand.

### 6. No Over-Engineering

- Do not add features, refactor code, or make improvements beyond what the current slice requires.
- Do not add error handling for scenarios that cannot happen.
- Do not create abstractions for one-time operations.
- Do not add comments, docstrings, or type annotations to code you did not change.
- Three similar lines of code is better than a premature abstraction.

### 7. Documentation Discipline

Runtime documentation must stay in sync with the codebase. Stale docs break the resume protocol and waste future sessions.

- **After completing any task:** Update `docs/_runtime/HANDOFF.md` (next steps) and `docs/_runtime/CHECKPOINT.md` (what's done).
- **After completing a Plan.md sub-task:** Check the corresponding checkbox in `Plan.md`. Do not leave completed work unchecked.
- **Before ending a session:** Re-read all three files (`HANDOFF.md`, `CHECKPOINT.md`, `Plan.md`) and verify they are consistent with each other and with what was actually built.
- **On resume ("pick up where we left off"):** Read `HANDOFF.md` first, then cross-check against `CHECKPOINT.md` and `Plan.md` before starting work.
- **MEMORY.md:** Update the current phase status line when progress changes.

The authoritative tracking files are:

| File | What to update | When |
|------|---------------|------|
| `Plan.md` | Check sub-task checkboxes | When a sub-task is fully complete |
| `docs/_runtime/HANDOFF.md` | Current state, just completed, next steps, verification | After every implementation session |
| `docs/_runtime/CHECKPOINT.md` | Completed tasks list, what's next, critical file state | After every implementation session |
| `MEMORY.md` | Current phase status line | When phase progress changes |

## Legacy Codebase Context

The existing `src/` directory contains the **legacy JavaScript app** (~583 files, `.js`/`.jsx`). vNext is a **ground-up TypeScript rebuild** — not a migration or refactor of legacy files.

- **Do not modify legacy `src/` files** unless porting specific utilities to `shared/lib/`.
- Legacy code is reference material for understanding existing Firestore patterns, auth flows, and data shapes.
- The legacy `src/lib/paths.js` hardcodes a `CLIENT_ID` constant. vNext must always resolve `clientId` from Firebase Auth custom claims via `AuthProvider` — never from a hardcoded value.
- Legacy deps like `@tanstack/react-query`, `react-select`, `react-easy-crop`, `reactjs-tiptap-editor` are not part of the vNext stack. Do not import them in new code.

## Project Overview

Shot Builder vNext is a ground-up redesign of the Shot Builder production planning app. It is mobile-first, opinionated, and built as vertical slices. The goal is to materially reduce the time and friction from brief to shoot-ready.

### Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React 18+ (SPA) |
| Build | Vite |
| Styling | Tailwind CSS + tokens.css + design-tokens.js |
| Primitives | shadcn/ui (Radix) |
| State | React Context + Firestore real-time |
| Backend | Firebase (Auth, Firestore, Storage, Functions) |
| Testing | Vitest + Testing Library + Playwright |
| Errors | Sentry |
| Routing | React Router v6 |

### Module Structure

```
src/
├── app/              # App shell, providers, router, route guards
├── features/         # Domain modules (projects/, shots/, pulls/, etc.)
│   └── {feature}/
│       ├── components/
│       ├── hooks/
│       └── lib/
├── shared/           # Shared utilities, no domain logic
│   ├── components/   # Layout shells, nav, common wrappers
│   ├── hooks/        # useMediaQuery, useDebounce, etc.
│   ├── lib/          # Firebase init, paths, rbac, utils
│   └── types/        # Shared TypeScript types
└── ui/               # shadcn/ui generated components (never modify inline)
```

**Module rules:**
- Features are self-contained. Cross-feature imports go through `shared/`.
- No circular dependencies between features.
- `shared/lib/` owns Firebase. All path builders, Firebase init, RBAC live there.
- `ui/` is generated by shadcn. Customization via Tailwind config + tokens only.

## Essential Commands

```bash
npm install                    # Install dependencies
npm run dev                    # Start dev server (localhost:5173)
npm run build                  # Production build
npm run preview                # Preview production build
npm test                       # Run Vitest (all tests via wrapper script)
npm test -- src/path/file.test.ts  # Run a single test file
npm run test:watch             # Vitest watch mode
npm run lint                   # ESLint (zero warnings, --max-warnings=0)
npm run test:e2e               # Playwright E2E tests (all browsers)
npm run test:e2e:chromium      # Playwright Chromium only
```

**Note:** `npm test` runs through `scripts/run-vitest.cjs` which forces `--pool threads --singleThread` to avoid concurrency issues on macOS paths with spaces. The `vitest.config.ts` pool setting (`forks`) applies only to `test:watch` and `test:ui`.

## Data Model (Firestore)

All data is scoped by `clientId` from Firebase Auth custom claims.

```
/clients/{clientId}/
  ├── projects/{projectId}/
  │   ├── members/{userId}
  │   ├── pulls/{pullId}
  │   └── lanes/{laneId}
  ├── shots/{shotId}/
  │   └── comments/{commentId}
  ├── productFamilies/{familyId}/
  │   └── skus/{skuId}
  ├── talent/{talentId}
  ├── locations/{locationId}
  ├── crew/{crewMemberId}
  ├── notifications/{notificationId}
  └── activities/{projectId}/{activityId}
```

**Do not create new collections or modify document shapes without explicit approval.**

## Auth & RBAC

- Firebase Auth with Google sign-in
- Custom claims: `role` (admin|producer|crew|warehouse|viewer), `clientId`
- Route guards: RequireAuth, RequireRole, RequireProject
- Firestore rules enforce `clientId` scoping on every read/write
- RBAC helpers in `shared/lib/rbac`:

| Permission | Roles |
|-----------|-------|
| `canManageProjects` | admin, producer |
| `canManageShots` | admin, producer, crew |
| `canManageSchedules` | admin, producer |
| `canManageProducts` | admin, producer |
| `canManageTalent` | admin, producer |
| `canManageCrew` | admin, producer |
| `canManageLocations` | admin, producer |
| `canGeneratePulls` | admin, producer |
| `canManagePulls` | admin, producer, warehouse |
| `canFulfillPulls` | admin, warehouse |

## Testing

- Unit tests: Vitest, mock Firestore, 80%+ coverage for lib modules
- Component tests: Testing Library, mock context providers
- E2E: Playwright against Firebase Emulators — post-v1 hardening, not required for the first vertical slice
- Every page must have empty, loading, and error state coverage

## Performance Budgets

- LCP < 2.5s on 4G mobile
- Initial JS bundle < 150 KB gzipped
- Route chunks < 50 KB gzipped each
- < 5 Firestore reads per page load
- Route-level code splitting (React.lazy for every route)

## Security

Before shipping any feature, answer:
1. Can a user access data outside their `clientId`?
2. Can a user escalate their role via client-side manipulation?
3. Can a user modify data they should only read?
4. Can untrusted input be rendered as HTML/JS?
5. Can a public share link leak private data?
6. Can a race condition cause duplicate writes?

## Optional Cleanup Agents

Tools like `code-simplifier`, `refactor-cleaner`, and similar optimization agents are available but are **not default behavior.** They follow strict rules:

- **Follow-up deltas only.** Never run during initial implementation, architectural work, or UX construction. Only after a vertical slice or delta is functionally complete and tested.
- **Explicit permission required.** Each invocation must be a named follow-up delta with a clearly stated scope and goal. Do not run opportunistically or "while you're in there."
- **Behavior and interfaces must be preserved.** Cleanup agents simplify internals. They must not change component APIs, hook signatures, route behavior, or any user-facing output.
- **Reversible.** Every cleanup pass must be a single, revertable commit. If the diff changes behavior, reject it.

## Design System (Direction A: Near-Black Editorial)

The visual direction is finalized. All new UI must follow this palette:

- **Neutrals:** Zinc scale (not Slate). `zinc-50` through `zinc-900`.
- **Primary:** Near-black (`#18181b` / `zinc-900`). Used for primary buttons, strong text.
- **Accent:** Immediate Red (`#E31E24`). Reserved for: logo mark, sidebar active indicator, destructive states only. Do not use red on general buttons.
- **Typography:** Inter. Light weight (300) for page headings, semibold for section headings. Editorial tracking: `-0.02em` on headings, `-0.01em` on sub-headings.
- **Shadows:** Minimal. Borders do separation work (Notion/Linear style).
- **Mockups:** `mockups/p2-sidebar-desktop.html`, `mockups/p2-drawer-mobile-tablet.html`, `mockups/p2-cmdk-palette.html` — open in browser for visual reference.

## Three-Panel Layout Patterns

The three-panel desktop layout (`ThreePanelLayout.tsx`) uses `react-resizable-panels` with three `Panel` children and two `PanelResizeHandle` dividers.

**Responsive within panels (not viewport):** Components inside resizable panels must not use viewport-based media queries (`sm:flex`, `md:hidden`, etc.) for layout decisions. The panel can be narrow even when the viewport is wide. Use `ResizeObserver` to measure actual panel width and derive a `compact` boolean.

**Compact prop pattern:** Shared components used in both full-width pages and narrow panel contexts (e.g., `ShotQuickAdd`) should accept an optional `compact` prop to reduce padding, shorten placeholder text, and hide non-essential UI (keyboard hints, batch actions).

**Exit affordances:** Three-panel mode must provide multiple visible exit paths — not just keyboard shortcuts. Current exits: (1) `Escape` key, (2) "← Shots" breadcrumb button in center panel, (3) clicking the already-selected shot in the list panel toggles deselect.

**Breadcrumb hygiene:** Navigation breadcrumbs must not duplicate information already visible on screen. If the shot title is shown as an H2 directly below, the breadcrumb should only show the back-navigation ("← Shots"), not repeat the title.

**Notes/Description click-to-edit pattern:** Read mode is default. Click anywhere on the text to enter edit mode with autoFocus. Blur saves via `useAutoSave.flush()` and returns to read mode. Empty state shows placeholder text like "Click to add notes..." with subtle styling.

**List panel density tiers:** Three density levels driven by `ResizeObserver`, not viewport queries:
- Compact (`< 200px`): Title + shot number only, no thumbnail/badge
- Medium (`200–280px`): Title + shot number + thumbnail + status badge
- Full (`> 280px`): All of medium + 2-line description preview

**Reference tile hover-reveal action bar:** Default state shows clean image only. On hover, a frosted action bar appears at bottom with star (set cover) and X (remove) icons. Cover indicator is a text strip below the image, not overlaying it.

**Display preferences localStorage key:** `sb:three-panel:list-prefs` — stores `{ showThumbnail, showShotNumber, showDescription, showStatusBadge }`. Managed by `useListDisplayPreferences` hook in `features/shots/hooks/`.

## Session Learnings & Error Prevention

These patterns were learned through implementation errors and should be followed to avoid repeating them.

### Firestore onSnapshot Form Reset (Phase 7A)

When a dialog's `useEffect` initializes form state from a Firestore-subscribed object and depends on both `open` and the entity (e.g., `[open, project]`), every `onSnapshot` creates a new object reference — re-triggering the effect and resetting form state mid-edit. This silently discards the user's input.

**Fix:** Use a `useRef` to track `wasOpen` and only initialize form state when `open` transitions from `false` to `true`:

```tsx
const wasOpen = useRef(false)
useEffect(() => {
  if (open && !wasOpen.current && entity) {
    // Initialize form state here
  }
  wasOpen.current = open
}, [open, entity])
```

**Do NOT use `eslint-disable-next-line react-hooks/exhaustive-deps`** to remove `entity` from deps — the ref approach keeps `entity` in the dependency array while preventing unwanted re-initialization.

### Test Updates on Behavior Refactors

When refactoring a component's interaction model (e.g., always-editable textarea to click-to-edit toggle), **existing tests will break**. Plan for this:
- Tests that assume the old interaction (e.g., textarea immediately visible) must be updated to the new flow (e.g., click read-mode first, then interact with textarea).
- Add `data-testid` attributes to new interaction states (e.g., `notes-read-mode`, `notes-input`) so tests can target them reliably.
- After refactoring, add new tests covering the new states (placeholder text in read mode, blur-to-exit, etc.).

### Design Token Hygiene

- **Never reference a token before it exists in `tokens.css`.** The build won't catch missing CSS variables — they silently resolve to nothing. Verify the token exists before using `var(--color-*)`.
- **Status badge colors belong in tokens**, not as hardcoded Tailwind classes. Use `var(--color-status-{color}-{bg|text|border})` so dark mode and theming work.
- **Hardcoded `text-white`, `bg-black` inside token-driven components** are design-system violations. Use `var(--color-text-inverted)` and `var(--color-text)` instead.

### External Store Patterns

- `useSyncExternalStore` is the correct React 18 pattern for localStorage-backed state — not `useState` + `useEffect` + manual event listeners. It handles SSR, concurrent mode, and tearing correctly.
- External store singletons (cached value + listeners Set + subscribe/getSnapshot) live at module scope, outside the component.

### CSS-Only Hover Reveal

- Use Tailwind `group` class on parent + `opacity-0 group-hover:opacity-100 transition-opacity` on children for hover-reveal UI. No JavaScript state or event handlers needed.
- Frosted glass effect: `bg-[var(--color-surface)]/90 backdrop-blur-sm`.

### Form Validation & Button Disabled Guards

- When a submit button has `disabled={!value.trim()}`, **tests cannot trigger validation errors by clicking it with empty/whitespace input** — the click is swallowed. Two approaches:
  1. Test that the button IS disabled (preferred for empty-state guard)
  2. Test Zod validation via fields that CAN have invalid non-empty values (e.g., bad URL format)
- For component tests on dialogs with disabled submit: test disabled state directly, test validation errors on fields that accept non-empty invalid input (URLs, etc.), and test the happy path via mock assertions.

### Zod Validation Pattern (Phase 4)

- `validateField(schema, value)` returns `string | null` — avoids try/catch boilerplate in form handlers.
- Per-field errors stored in `Record<string, string | null>` state. Clear on keystroke for immediate feedback.
- If a validation error is in a collapsed (progressive disclosure) section, auto-expand that section before showing the error.
- Schemas live in `shared/lib/validation.ts` — reusable across create and edit dialogs.

### Progressive Disclosure in Dialogs

- Only worth doing when 3+ optional fields exist (project dialogs). For 1-2 field dialogs (shot, pull), collapsing is absurd overhead.
- EditDialog auto-expands if ANY collapsed field already has data — never hide the user's existing values.
- Use local `useState` for expand/collapse toggle — dialogs are ephemeral, no need for localStorage.

### Shot Numbering Extraction Pattern

- When the same logic is needed in 2+ components, extract to a `lib/` module immediately — don't copy-paste.
- `shotNumbering.ts` is shared by `ShotQuickAdd` (inline quick-add) and `CreateShotDialog` (modal create). Both need `computeMaxShotNumber` + `formatShotNumber`.

### Bash CWD Persistence

- **Never use `cd` in Bash tool commands.** The working directory change persists across all subsequent tool calls in the session. If the new directory lacks `.claude/hooks/`, ALL hooks fail with "can't open file" errors, blocking Edit, Write, and Bash tools entirely.
- Use absolute paths instead: `python3 -m http.server 8765 --directory /absolute/path/to/dir` rather than `cd dir && python3 -m http.server 8765`.
- If CWD gets stuck, the only fix is starting a new session or using a subagent (which may also inherit the broken CWD).

### Component Replacement Text Matching in Tests (Phase 6g)

- When replacing inline text/markup with a shared component (e.g., `InlineEmpty`), **test assertions for exact text strings will break** if the text changes even slightly (e.g., "No comments yet." with period becomes "No comments yet" without period).
- Before replacing inline text with a component: grep for the exact string in test files. Update test assertions as part of the same delta.

### design-tokens.js Must Use CSS Variables (Phase 6e)

- `design-tokens.js` (Tailwind plugin) must reference CSS custom properties (`var(--color-text)`, `var(--text-2xl)`) — NOT Tailwind `theme()` calls like `theme('colors.neutral.900')`.
- Tailwind `theme()` resolves at build time to static hex values, which breaks dark mode token switching. CSS vars resolve at runtime, enabling `.dark` class overrides.

### Parallel Agent Sweeps for Cross-Directory Changes (Phase 6f)

- For large standardization changes across many feature directories, launch parallel subagents — one per directory scope (products/, shots/, pulls/, sidebar/, etc.).
- Each agent gets: the list of files to modify, the exact pattern to find, and the replacement pattern.
- Verify with a single grep afterwards to catch any the agents missed.
- Exclude print portals (React-PDF can't use CSS vars) and `ui/` components (shadcn generated, never modify inline).

### LoadingState Skeleton Prop Pattern (Phase 6h)

- `LoadingState` accepts an optional `skeleton` ReactNode prop. When provided, shows content-shaped skeleton instead of spinner.
- Page-level `LoadingState` calls get skeleton props (`<ListPageSkeleton />`, `<DetailPageSkeleton />`).
- Sub-section `LoadingState` calls (inside detail pages, modals) stay as plain spinners — skeletons at that granularity create visual noise.
- `useStuckLoading` threshold is 8s (not 5s). After 8s: dim skeleton to 30% opacity + centered retry overlay.

### Shared Sub-Component Duplicate Rendering (Phase 6j)

- When a shared sub-component (e.g., `StackedAvatars`) already renders overflow UI ("+N" badge), the parent component must NOT render the same overflow UI again. This causes `getByText("+1")` to throw "multiple elements found" in tests.
- **Pattern:** Let the shared sub-component own all its rendering concerns. The parent only composes it — never duplicates visual elements the child already handles.
- When porting legacy JS components to TypeScript, always audit for rendering duplication between the original component and extracted shared helpers.

### Presence System Porting Pattern (Phase 6j)

- Legacy presence infrastructure (`useEntityPresence.js`, `useFieldLock.js`, `ActiveEditorsBar.jsx`) was a complete, battle-tested system. The vNext port was a straightforward TypeScript conversion, not a redesign.
- **Port-first, extend-later:** When legacy code solves the same problem well, port the proven architecture rather than reinventing. Scope the initial port narrowly (shot entities only), then extend.
- **Client-side TTL is sufficient** for presence cleanup when docs are tiny and short-lived. A Cloud Function adds complexity without proportional benefit — stale presence docs are filtered out by the client and are harmless.
- **useAuth() in nested components** is simpler than prop-drilling `clientId` through intermediate components. Since all shot components are within the auth boundary, calling `useAuth()` directly avoids adding props to components that don't otherwise need them.

### canCreate vs canEdit Split Pattern (Phase 7C)

Library and project list pages need two separate permission levels:
- **`canCreate`** = role-based only (`canManageX(role)`). Controls: create button visibility, empty state CTA, keyboard shortcut handler. No `!isMobile` check — create dialogs work on mobile via `ResponsiveDialog`.
- **`canEdit`** = role + desktop only (`!isMobile && canCreate`). Controls: inline editing, table row edit affordances, detail page write fields.

**Why the split matters:** Before Phase 7C, `canEdit = !isMobile && canManageX(role)` gated BOTH create buttons AND inline editing, which blocked mobile users from creating entities entirely — even though create dialogs (via ResponsiveDialog) work perfectly on mobile.

```tsx
const canCreate = canManageCrew(role)       // Role-only: create button + empty state CTA
const canEdit = !isMobile && canCreate      // Desktop-only: inline editing
```

**Mobile create button pattern:** Render icon-only `<Button size="icon">` on mobile, full text button on desktop:
```tsx
canCreate ? (
  isMobile ? (
    <Button size="icon" onClick={() => setCreateOpen(true)}>
      <Plus className="h-4 w-4" />
    </Button>
  ) : (
    <Button onClick={() => setCreateOpen(true)}>
      <Plus className="h-4 w-4" />
      New Crew Member
    </Button>
  )
) : null
```

### Breadcrumb Hierarchy Rules (Phase 7C)

- **Top-level pages** (Projects, Products): NO breadcrumb. The page title serves as the heading.
- **Nested pages within a section** (Library/Crew, Library/Talent): Show parent section breadcrumb (e.g., `Library > Crew`).
- **Project-scoped pages** (Dashboard, Shots, Assets): Show `Projects > Project Name`.
- **Detail pages** (Crew Detail, Location Detail): Show full path (e.g., `Library > Crew > John Smith`).
- **Never repeat** the page title in the breadcrumb when it's already visible as an `<h1>` directly below.

### Keyboard Shortcut Expansion Pattern (Phase 7C)

When a page has a create action, add `C` as a keyboard shortcut:
1. Import `useKeyboardShortcuts` from `@/shared/hooks/useKeyboardShortcuts`
2. Guard the handler with the permission check (use `canCreate`, not `canEdit`)
3. Update `KeyboardShortcutsDialog.tsx` SHORTCUT_GROUPS when adding new shortcut groups

```tsx
useKeyboardShortcuts([
  { key: "c", handler: () => { if (canCreate) setCreateOpen(true) } },
])
```

Currently active on: LibraryCrewPage, LibraryLocationsPage, LibraryTalentPage, ProjectDashboard.

### Mobile Table Density (Phase 7C)

Table cells visible on mobile use responsive padding to increase density on small screens:
```tsx
<td className="px-4 py-2.5 md:py-3 ...">
```
Desktop-only columns (hidden on mobile) keep standard `py-3` padding.

### Dark Mode Audit Patterns (Phase 6k)

- **`.dark` class, NOT `data-theme` attribute.** Tailwind's `darkMode: 'class'` strategy uses `.dark` on `<html>`. All docs, code, and tokens must reference this consistently. If you see `data-theme="dark"` in any doc, it's stale — the correct mechanism is `.dark` CSS class.
- **localStorage key convention:** All Shot Builder localStorage keys use the `sb:` prefix (`sb:theme`, `sb:three-panel:list-prefs`). Never use bare key names like `"theme"` — always `"sb:theme"`.
- **FOUC prevention is critical.** The inline `<script>` in `index.html` must apply `.dark` before React mounts. It reads `sb:theme` and falls back to `prefers-color-scheme`. This script must stay in sync with ThemeProvider's logic.
- **Legacy key migration:** When renaming a localStorage key, always add migration logic in both the FOUC script and the React provider. Read old key → write new key → delete old key.
- **Image overlays (`bg-black/*`) are dark-mode safe.** Semi-transparent black overlays on images (action bars, badges, checkboxes) are intentionally dark regardless of theme — they contrast with image content. Do NOT convert these to CSS variables.
- **Surface/border colors must use CSS variables.** Any `bg-zinc-*`, `bg-slate-*`, `border-zinc-*`, `border-slate-*` used as surface backgrounds or layout borders in vNext components MUST use `var(--color-surface-*)` or `var(--color-border-*)` tokens instead. These break silently in dark mode.
- **Domain-specific accent colors use `dark:` prefix.** For semantic colors outside the token system (e.g., `text-teal-700` for products, `text-indigo-700` for talent, `bg-amber-50` for schedule breaks), add Tailwind `dark:` variants inline (e.g., `text-teal-700 dark:text-teal-300`). Don't create tokens for every domain color.
- **Document the activation mechanism, not just the tokens.** Dark mode has 3 interconnected pieces: (1) CSS tokens in `tokens.css`, (2) ThemeProvider React context, (3) FOUC script in `index.html`. All three must agree on the class name and localStorage key. A mismatch between any two causes bugs.

## Mobile & Tablet Patterns (Phase 5)

### ResponsiveDialog

`shared/components/ResponsiveDialog.tsx` — unified component that renders Sheet (side="bottom") on mobile and Dialog on desktop. All creation/edit dialogs (CreateShotDialog, CreatePullDialog, CreateProjectDialog, EditProjectDialog) use this. Props: `open`, `onOpenChange`, `title`, `description`, `children`, `footer`, `contentClassName`.

### Touch Targets

`tokens.css` provides `.touch-target` utility: `@media (pointer: coarse) { .touch-target { min-height: 44px; min-width: 44px; } }`. Apply to all interactive elements that need mobile-safe hit areas.

### FloatingActionBar

`shared/components/FloatingActionBar.tsx` — route-aware FAB rendered by AppShell when `!isDesktop`. Uses URL params with `replace: true` to communicate with pages:
- Shot list (`/projects/:id/shots`): "New Shot" sets `?create=1`
- Shot detail (`/projects/:id/shots/:sid`): "Mark Shot" sets `?status_picker=1`, "Add Note" sets `?focus=notes`
- Target pages consume params via `useSearchParams` in a `useEffect`, then delete the param after handling.

### ShotStatusTapRow

`features/shots/components/ShotStatusTapRow.tsx` — 4 horizontal pill buttons for mobile 1-tap status changes. Replaces `ShotStatusSelect` dropdown on mobile. Uses canonical labels from `statusMappings.ts`. Optimistic update with rollback on error. All buttons have `min-h-[44px]` touch targets.

### Hide-Not-Disable Pattern

On mobile, when `canEdit = !isMobile && canManageX(role)` already prevents write form rendering, do NOT add redundant `disabled={... || isMobile}` props. This creates confusing grayed-out controls. Instead, conditionally render write forms only when `canEdit` is true, showing read-only values otherwise.

### Warehouse Guided Pick Flow

`/pulls/shared/:shareToken/guide` — full-screen stepper for one-handed warehouse operation. Components: `WarehousePickGuidePage` (shell + state), `WarehousePickStep` (item card), `WarehousePickProgress` (bar), `WarehousePickOutcomeBar` (3 action buttons). Local state only — no Firestore writes for substitute notes.

## Visual Standardization Rules (Phase 6)

These rules were established by the Phase 6a visual audit and 6b mockups. All new and modified components must follow them.

### Typography Hierarchy

Use semantic classes from `design-tokens.js`, not raw Tailwind:

| Element | Class | Spec |
|---|---|---|
| Page title (h1) | `.heading-page` | 24px / font-light (300) / -0.02em / md:28px |
| Section heading (h2) | `.heading-section` | 16px / font-semibold (600) / -0.01em |
| Subsection heading (h3) | `.heading-subsection` | 14px / font-semibold (600) / -0.01em |
| Meta label (uppercase) | `.label-meta` | 12px / font-semibold (600) / uppercase / 0.05em / text-subtle |

- **One `<h1>` per page.** Never two.
- **No arbitrary pixel sizes.** Use `text-sm` (13px) not `text-[13px]`, `text-2xs` (10px) not `text-[10px]`.

### Text Color Hierarchy

Four levels, clearly separated:

| Token | Zinc | Use for |
|---|---|---|
| `--color-text` | 900 | Primary: titles, form values, active items |
| `--color-text-secondary` | 600 | Supporting: descriptions, body, card subtitles |
| `--color-text-muted` | 500 | Metadata: timestamps, counts, hints |
| `--color-text-subtle` | 400 | Placeholders, disabled, label-meta |

### Card Standards

| Property | Standard |
|---|---|
| Border radius | `rounded-lg` (8px) — not `rounded-md` |
| CardContent padding | `p-4` |
| CardHeader bottom padding | `pb-2` |
| Card grid gap | `gap-4` |

### Badge Font Size

All badges use `text-xxs` (11px) consistently — both on cards and detail pages.

### Detail Page Navigation

All detail pages use `PageHeader` with breadcrumbs for back navigation. No inline ghost buttons or icon-only back buttons.

### Token Usage

- `text-white` on dark backgrounds → use `text-[var(--color-text-inverted)]`
- `bg-white` on surfaces → use `bg-[var(--color-surface)]`
- Sidebar text → use `text-[var(--color-sidebar-text)]` not `text-neutral-*`

## State Patterns (Phase 6c)

These patterns were established by the Phase 6c mockups (`mockups/p6-states.html`). Implementation must follow them.

### Empty States

| Variant | Use for | Specs |
|---|---|---|
| Full-page (`EmptyState`) | List pages with zero items | min-h-200px, centered, icon + title + description + CTA button |
| Filtered empty | List pages with active filters but no matches | Same as full-page but "No matching X" + "Clear filters" CTA |
| Inline empty (`InlineEmpty`) | Detail page sub-sections (Colorways, Comments, References) | min-h-120px, 32px icons, dashed border, muted text |

Six domain variants: Shots (Camera), Products (Package), Pulls (ClipboardList), Locations (MapPin), Talent (Users), Schedules (Calendar).

### Loading Skeletons

- **Content-shaped skeletons** replace all generic spinners. Four patterns: list page (toolbar + card grid), table (header + rows), detail page (breadcrumb + 2-col), single card.
- **Staggered pulse animation:** 6 delay tiers at 150ms increments (0ms-750ms) for wave effect. Avoids "flashing block" appearance.
- **Stuck loading overlay:** After 8s (`useStuckLoading` hook), show dimmed skeleton grid at 30% opacity + centered overlay card with spinner + "Taking longer than expected..." + Retry button.

### Error States

| Component | Status | Purpose |
|---|---|---|
| `ErrorBoundary` | Exists | Chunk load detection + generic fallback. Wrapped on all pages. |
| `OfflineBanner` | Exists | Amber top-of-page banner with WifiOff icon, auto-dismiss on reconnect |
| `NetworkErrorBanner` | Exists | Red top-of-page banner with manual Retry button |
| `ForbiddenPage` (403) | Exists | Centered layout: large "403" + ShieldAlert icon + "Go to Dashboard" |
| `NotFoundPage` (404) | Exists | Centered layout: large "404" + FileQuestion icon + "Go to Dashboard". Catch-all route wired. |

Toast variants (Sonner): success (green), error (red), warning (amber), info (blue).

### Presence Indicators (Phase 6j)

Real-time collaborative editing awareness, ported from legacy JS to TypeScript vNext.

| Component / Hook | Purpose |
|---|---|
| `useEntityPresence` | Subscribe to `presence/state` doc, filter expired locks (60s TTL), group active editors by user |
| `useFieldLock` | Acquire/release field-level locks with 30s heartbeat, auto-release on unmount |
| `ActiveEditorsBar` | Expandable blue info bar: stacked avatars + "X is editing Y" with per-editor expand detail |
| `CompactActiveEditors` | Inline avatar dots + animated ping indicator (used in three-panel breadcrumb bar) |

**Firestore path:** `/clients/{clientId}/shots/{shotId}/presence/state` — single doc with `locks` map keyed by field path. Security rules already deployed.

**Constants:** 30s heartbeat (`LOCK_HEARTBEAT_INTERVAL_MS`), 60s expiration (`LOCK_EXPIRATION_MS`). Client-side TTL filtering — no Cloud Function for cleanup.

**Current scope:** Shot entities only. `useFieldLock` is infrastructure-ready but NOT wired to individual input fields yet (future delta).

**Types:** `shared/types/presence.ts` — `FieldLock`, `EntityPresence`, `ActiveEditor`, `formatFieldNames()`, `formatActiveEditorsSummary()`.

### Dark Mode (Phase 6k — Implemented)

- **Activation:** `.dark` CSS class on `<html>` (Tailwind class-based strategy, NOT `data-theme` attribute).
- **Token mapping:** `tokens.css` `.dark { ... }` block overrides all CSS custom properties. Zinc scale inverted: light surfaces (50→900), dark text (900→50), mid-tones (500 stays).
- **ThemeProvider:** `src-vnext/app/providers/ThemeProvider.tsx` — exposes `theme` (user choice: `light | dark | system`), `effective` (resolved: `light | dark`), `setTheme`, `toggleTheme`.
- **localStorage key:** `sb:theme` with values `light | dark | system`. Legacy `theme` key auto-migrated.
- **FOUC prevention:** `index.html` inline script applies `.dark` before React mounts, using `sb:theme` key with system preference fallback.
- **System mode:** When set to `system`, ThemeProvider listens to `prefers-color-scheme` changes and updates dynamically.
- **Legacy `src/` files:** Not converted. Schedule/callsheet preview components have extensive hardcoded `gray-*`/`slate-*` — these are out of scope until ported to vNext.

## Library Entity Patterns (Phase 7B)

### Navigation: Table List → Detail Page

Library entities (crew, locations, talent) use a two-step navigation pattern:
1. **List page** (`/library/crew`, `/library/locations`): Searchable table with key columns. Row click navigates to detail page.
2. **Detail page** (`/library/crew/:crewId`, `/library/locations/:locationId`): Full editing with InlineEdit fields, delete with ConfirmDialog.

This is NOT a master-detail split screen. Each is a separate route with its own lazy-loaded page component.

### Write Function Pattern

Each entity has a dedicated `{entity}Writes.ts` file in `features/library/lib/`:
- `crewWrites.ts` — `createCrewMember`, `updateCrewMember`, `deleteCrewMember`
- `locationWrites.ts` — `createLocation`, `updateLocation`, `deleteLocation`, `uploadLocationPhoto`
- `talentWrites.ts` — `createTalent`, `updateTalent`, `deleteTalent`, `setTalentHeadshot`, `removeTalentHeadshot`, `uploadTalentPortfolioImages`, `uploadTalentCastingImages`

All write functions take `clientId` from the caller (via `useAuth()`), never hardcoded. All set `updatedAt: serverTimestamp()` and `updatedBy: userId`.

### Measurement System

`features/library/lib/measurementOptions.ts` provides gender-specific measurement fields:
- **Men:** height, waist, inseam, shoes, suit, collar, sleeve (7 fields)
- **Women:** height, waist, hips, shoes, bust, dress (6 fields)
- **Other/unset:** all fields combined

Use `getMeasurementOptionsForGender(talent.gender)` — never hardcode a static measurement list.

### Entity Delete Pattern

Deleting entities with associated Storage files (talent images, location photos) must:
1. Collect ALL image paths from the entity (headshot, gallery, casting session images)
2. Delete Storage files first (best-effort, errors swallowed)
3. Delete the Firestore document last
4. Use `ConfirmDialog` with `destructive` prop for user confirmation

### Dual Mapper Awareness

When expanding entity types (adding fields to `CrewRecord`, `LocationRecord`, `TalentRecord`), update ALL mappers that produce that type:
- **Library hooks** (`useCrewLibrary`, `useLocationLibrary`, `useTalentLibrary`) — primary, full-field mappers
- **Picker data hooks** (`usePickerData.ts`) — independent mappers used by shot pickers, must also be enriched
- **Schedule mappers** (`mapSchedule.ts`) — used by schedule/call sheet features

Missing a mapper causes fields to silently be `undefined` even though Firestore has the data.

## Shot Status Labels

Canonical labels (from `statusMappings.ts`). Use these everywhere — views, filters, PDFs, badges:

| Firestore value | Display label |
|---|---|
| `todo` | **Draft** |
| `in_progress` | **In Progress** |
| `on_hold` | **On Hold** |
| `complete` | **Shot** |

Do NOT use alternative labels (To do, Complete, Done). `statusMappings.ts` is the single source of truth. `shotListFilters.ts STATUS_LABELS` must match.

## Git Workflow

- Branch: `vnext/phase-discipline-guardrails` (current)
- Commit format: Conventional Commits
- One topic per commit
- Main branch: `main`
- Do not push to main without review
