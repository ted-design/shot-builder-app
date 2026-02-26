# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This file governs all Claude Code work in the vNext worktree. Follow these rules exactly.

## Canonical Source of Truth

**Root-level `PRD.md` and `Plan.md` are the authoritative specifications.** Product vision, user journeys, feature priorities, and the phased implementation plan are defined there.

- `PRD.md` — Product vision, target users, core journeys, feature priority matrix, UX principles
- `Plan.md` — 7-phase implementation plan with sub-task checkboxes (this is the todo tracker)
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
- RBAC helpers in `shared/lib/rbac`

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
