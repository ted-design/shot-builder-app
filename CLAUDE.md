# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This file governs all Claude Code work in the vNext worktree. Follow these rules exactly.

## Canonical Source of Truth

**`docs-vnext/` is the authoritative specification for vNext.** All product, design, and engineering decisions are defined there.

- `docs-vnext/product/north-star.md` — Target users, JTBD, success metrics, anti-goals
- `docs-vnext/design/experience-spec.md` — IA, navigation, flows, interaction rules, states
- `docs-vnext/engineering/architecture.md` — Modules, data contracts, state strategy, security
- `docs-vnext/engineering/build-strategy.md` — Vertical slices, first slice scope, Definition of Done

**Any documentation outside `docs-vnext/` is legacy reference only and may be stale.** Do not treat legacy docs as authoritative. When legacy docs conflict with `docs-vnext/`, `docs-vnext/` wins.

## Hard Rules

### 1. Vertical-Slice Discipline

Build one complete workflow at a time. Each slice ships a fully usable end-to-end flow that replaces the equivalent in the old system.

- **No horizontal layers.** Do not "set up all components first" or "build all routes first."
- **No stubs.** Deferred features must not be stubbed, partially implemented, or visible in the UI. No placeholder routes, grayed-out nav items, "coming soon" labels, or skeleton feature modules.
- **If it's not in the current slice, it does not exist in the codebase.**
- The current slice is defined in `docs-vnext/engineering/build-strategy.md`.

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
- Tailwind classes reference token values. No hardcoded hex colors or arbitrary spacing in components.
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
| Styling | Tailwind CSS + tokens.css |
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

## Git Workflow

- Branch: `vnext/spec-reset` (current)
- Commit format: Conventional Commits
- One topic per commit
- Main branch: `main`
- Do not push to main without review
