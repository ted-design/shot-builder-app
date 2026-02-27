# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

This file governs all Claude Code work in the vNext worktree. Follow these rules exactly.

## Canonical Source of Truth

**Root-level `PRD.md` and `Plan.md` are the authoritative specifications.** Product vision, user journeys, feature priorities, and the phased implementation plan are defined there.

| File | What's in it |
|------|-------------|
| `PRD.md` | Product vision, user journeys, feature priorities, UX principles |
| `Plan.md` | Multi-phase plan with sub-task checkboxes (this IS the todo tracker) |
| `Architecture.md` | Tech stack, module structure, routes, data model, auth/RBAC, design system, component inventory, performance budgets, security checklist |
| `AI_RULES.md` | Decision framework, code standards, testing, implementation patterns (three-panel, visual, dark mode, permissions), context management |
| `MEMORY.md` | Persistent cross-session memory: error patterns, phase summaries, user preferences |

**`docs-vnext/` is supplementary engineering reference** — slice specs, sprint proofs, and design details. When `docs-vnext/` conflicts with root docs, root docs win.

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

See `Architecture.md` for tech stack, module structure, routes, data model, auth/RBAC, design system, performance budgets, and security checklist.

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

## Shot Status Labels

Canonical labels (from `statusMappings.ts`). Use these everywhere — views, filters, PDFs, badges:

| Firestore value | Display label |
|---|---|
| `todo` | **Draft** |
| `in_progress` | **In Progress** |
| `on_hold` | **On Hold** |
| `complete` | **Shot** |

Do NOT use alternative labels (To do, Complete, Done). `statusMappings.ts` is the single source of truth.
