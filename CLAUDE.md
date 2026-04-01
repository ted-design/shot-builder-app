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
- `src-vnext/styles/design-tokens.js` provides semantic Tailwind classes (`.heading-page`, `.heading-section`, `.heading-subsection`, `.label-meta`, `.body-text`, `.caption`, etc.). Prefer these over ad-hoc class combinations.
- Tailwind classes reference token values. No hardcoded hex colors or arbitrary spacing in components.
- Use `text-3xs` (9px), `text-2xs` (10px), `text-xxs` (11px) for micro font sizes — never `text-[9px]`, `text-[10px]`, `text-[11px]`.
- Use `text-sm` (13px), `text-base` (14px), `text-lg` (16px), `text-xl` (18px) — never `text-[13px]`, `text-[14px]`, `text-[15px]`. These sizes are overridden in `tailwind.config.js` to be 1-2px smaller than Tailwind defaults.
- Page headings use `heading-page` semantic class (weight 300 editorial) — never `text-xl font-semibold` or `text-2xl font-bold`.
- Section headings use `heading-section` — never `text-base font-semibold`. Subsections use `heading-subsection`.
- Tag badges use neutral body with subtle category-accent left borders — never use rainbow `getTagColorClasses()` on `TagBadge`.
- Every surface uses the same building blocks. No one-off component variants for a single page.
- Fewer surfaces, fewer modes. Each new page/modal must justify its existence.

### 4. Reuse Existing Infrastructure

Firebase Auth, Firestore, Storage, Functions, security rules, and the data model are stable and unchanged.

- **Reuse existing Firestore collections and document shapes.** No new collections, no new fields, no schema changes without overwhelming justification.
- If a schema change is proposed, you must: (a) present the rationale, (b) present a migration plan (rules/backfill/dual-write), (c) STOP for approval before proceeding.
- **Approved exception:** `pendingInvitations` subcollection under `clients/{clientId}/` (Sprint S9) — stores pre-signup role invitations keyed by normalized email. Admin-only read/write in `firestore.rules`.
- **Approved exception:** `_functionQueue` collection (Sprint S9b) — Firestore Queue pattern for Cloud Function invocation. Client writes request doc, `processQueue` onCreate trigger processes server-side, client reads response via `onSnapshot`. Bypasses GCP org policy IAM restrictions. See Architecture.md "Cloud Functions" section.
- **Approved exception:** `visibility` and `createdBy` fields on project documents (Sprint S10). `visibility` is `"team"` | `"restricted"` | `"private"` (default `"team"`, field absent = `"team"`). `createdBy` stores the UID of the project creator. Type: `ProjectVisibility` in `shared/types/index.ts`.
- **Approved exception:** `comments` subcollection under `shotRequests/{requestId}/` (Sprint S12B) — `clients/{clientId}/shotRequests/{requestId}/comments/{commentId}` stores conversation threads. Admin+producer read/write in `firestore.rules`. `authorId` binding enforced on create. Body limit: 5000 chars in rules, 2000 chars (`MAX_COMMENT_CHARS`) client-side.
- **Approved exception:** `request-references` Storage path (Sprint S12B) — `clients/{clientId}/request-references/{requestId}/{filename}` for image uploads on structured references. Gated by `isValidUpload()` helper (image/* content-type + 10MB size limit) in `storage.rules`.
- **Cloud Function invocation:** All callable functions use `callFunction()` from `shared/lib/callFunction.ts` (Firestore queue-based). Do NOT use `httpsCallable` or direct HTTP fetch. The `onRequest` exports in `functions/index.js` are dormant fallback. There are 8 queue handlers: `setUserClaims`, `claimInvitation`, `createShotShareLink`, `publicUpdatePull`, `deactivateUser`, `reactivateUser`, `resendInvitationEmail`, `sendRequestNotification`.
- **Email service:** `functions/email.js` sends invitation emails via Resend. Non-blocking — email failures are logged but do not block invitation creation. From: `Production Hub <noreply@unboundmerino.immediategroup.ca>`. Reply-to: `ted@immediategroup.ca`.
- **Approved field:** `lastSignInAt` on user documents (Sprint S11). Written by AuthProvider on each sign-in (fire-and-forget `setDoc` with `merge: true`). Displayed in admin team roster.
- **Firestore rules — shots vs talent/locations:** Shots allow write for any authed user (`isAuthed()`). Talent and locations restrict writes to `isAdmin() || isProducer()`. Do NOT restrict shots writes — crew users have `canManageShots` in rbac.ts.
- Reuse existing `firestore.rules` — do not modify security rules unless the change is required by a new vNext route and has been reviewed.
- **Firestore rules helpers (Sprint S10):** `hasGlobalRole(roles)` checks user's auth claim role against a list. `producerCanAccessProject(clientId, projectId)` grants producers access to projects with `visibility == "team"` or absent visibility field. These are cascaded to all sub-collections. Do not modify or duplicate these patterns.
- Auth custom claims (`role`, `clientId`) and the 5-role model (admin, producer, crew, warehouse, viewer) are fixed infrastructure.
- Firestore path helpers from `shared/lib/paths` are the single source for collection references. Key helpers include `shotRequestsPath`, `shotRequestDocPath`, and `shotRequestCommentsPath`.
- Shared text utilities in `shared/lib/textUtils.ts` (normalizeText, normalizeWhitespace, humanizeLabel, parseCsvList) — do not create local duplicates.
- **SKU colorName deduplication:** When importing SKUs into families that already have legacy SKUs, match by BASE color name (strip vendor code suffix via regex `\s*\([^)]*\)$`). Legacy SKUs use simple names ("Black"), imports use vendor-coded names ("Black (0101)"). Always merge into the existing legacy SKU to preserve doc IDs that may be referenced by project product selections. Never create a new SKU if a legacy one with the same base color already exists.
- **Approved field:** `styleNumbers` on ProductFamily documents (Line Sheet Import, 2026-03-12). Already written to Firestore by import scripts — TypeScript type formalized to match. Display: `styleNumbers[0]` as dominant, `styleNumbers.slice(1)` as aliases. **Anti-pattern:** Before proposing new Firestore fields, check if import scripts already write the data. TypeScript types may lag behind what's actually in documents.
- **Shared utility:** `shared/lib/sizeRange.ts` — pure `compressSizeRange()` function for display. Compresses `["S","M","L","XL"]` → `"S - XL"`, composite inseam sizes `["S/30","S/32","M/30"]` → `"S - M / 30", 32"`, sock composites pass through. Do not store computed size ranges — always compute at render time.
- **Bulk shot creation:** `features/requests/lib/bulkShotWrites.ts` (Sprint S12C). Uses `writeBatch` with `BATCH_CHUNK_SIZE = 250` (Firestore limit) and enforces `MAX_BULK_ITEMS = 500` cap. Always filter deleted products client-side (`deleted !== true`) — never use `where("deleted","==",false)` which excludes docs missing the field.

### 5. State Strategy

- Server state = Firestore `onSnapshot` subscriptions. No Redux, Zustand, or client-side cache.
- List views must aggressively unsubscribe on unmount to avoid fan-out.
- Optimistic updates are allowed only for idempotent state transitions (status toggles). Optimistic entity creation is explicitly disallowed — all creates must await Firestore write confirmation.
- Readiness indicators (e.g., shots planned, products assigned) must be denormalized aggregates on the parent document, not computed via client-side fan-out queries.
- No duplicate state. Never cache Firestore data in React state. Subscribe and render.
- No custom offline sync engine. Firestore's default IndexedDB persistence is relied upon for offline reads. No custom mutation queue, conflict resolution UI, or sync status system.
- Context providers are minimal: Auth, ProjectScope, Theme, SearchCommand. `SearchCommandProvider` (Sprint S14) is a real useState-backed provider powering the Cmd+K command palette (`CommandPalette` component in AppShell). Uses `cmdk` + Fuse.js (threshold 0.35) for universal search across projects, products, talent, crew. Recent items in `sb:cmd-recent` localStorage key (last 5). Zero Firestore subscriptions when palette is closed.

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

### 8. Production Readiness Overrides

Phase order is the default. Override when reality demands it:

- **Onboarding blockers take priority.** If real users cannot sign in, get roles assigned, or access core workflows, fix that before continuing feature work. Check PRD.md's MUST-HAVE list — anything there that's missing from Plan.md is a candidate for an override sprint.
- **On resume, ask:** "Can a new team member use this app today?" If no, the blocker is the next task — regardless of what Plan.md says is next.
- **Override protocol:** (1) identify the blocker, (2) discuss with user, (3) add an override sprint to Plan.md before the next planned phase, (4) document rationale in MEMORY.md.

### 9. Sprint S15 New Infrastructure

- **Export Builder route:** `/projects/:id/export` (desktop-only, RequireDesktop). Block-based PDF composition with 9 block types, template system, variable tokens, document operations. All code in `src-vnext/features/export/`. Uses `@react-pdf/renderer` (already a dependency). Templates stored in localStorage (`sb:export-templates`, `sb:export-doc:{projectId}`).
- **Shoot urgency system:** `src-vnext/features/products/lib/shootUrgency.ts` — 5-tier time-based urgency (OVERDUE/URGENT/SOON/UPCOMING/UNSCHEDULED) alongside existing confidence system. Overdue products sort first in readiness widget.
- **Page transitions:** CSS-only `fade-in-rise` keyframes in `tokens.css`, `PageTransition` wrapper in `AppShell.tsx`. Respects `prefers-reduced-motion`. No framer-motion dependency.
- **View consolidation:** Shot ViewMode narrowed from `"gallery"|"visual"|"table"` to `"card"|"table"`. Old localStorage values auto-migrate. `ShotVisualCard.tsx` deleted.
- **Library table views:** `TalentTable.tsx` and `LocationsTable.tsx` with sortable columns, Grid/Table and List/Table toggles. Persist to localStorage (`sb:talent-view`, `sb:locations-view`).
- **Call sheet improvements:** Section toggles (show/hide via Switch), per-field customization (`EditSectionFieldsDialog` with rename/reorder/resize/toggle), layout templates (3 built-in + user-saved via `CallSheetLayoutDialog`). Field configs persist to Firestore via `callSheetConfig`.
- **Bulk shot delete:** `bulkSoftDeleteShots()` in `shotLifecycleActions.ts`. Uses `writeBatch` chunked at 250, capped at `MAX_BULK_DELETE=500`. Typed "DELETE" confirmation dialog in `ShotListPage.tsx` bulk action bar.

## Legacy Codebase Context

The existing `src/` directory contains the **legacy JavaScript app** (~583 files, `.js`/`.jsx`). vNext is a **ground-up TypeScript rebuild** — not a migration or refactor of legacy files.

- **Do not modify legacy `src/` files** unless porting specific utilities to `shared/lib/`.
- Legacy code is reference material for understanding existing Firestore patterns, auth flows, and data shapes.
- The legacy `src/lib/paths.js` hardcodes a `CLIENT_ID` constant. vNext must always resolve `clientId` from Firebase Auth custom claims via `AuthProvider` — never from a hardcoded value.
- Legacy deps `@tanstack/react-query`, `react-select`, `react-easy-crop`, `reactjs-tiptap-editor` were removed from `package.json` in Sprint S13. Do not add them back or import them in any code.

## Project Overview

Production Hub (formerly Shot Builder) is a ground-up redesign of the production planning app. It is mobile-first, opinionated, and built as vertical slices. The goal is to materially reduce the time and friction from brief to shoot-ready.

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

## Shot Request Status Labels

Canonical labels (from `requestStatusMappings.ts`). Use these everywhere:

| Firestore value | Display label | Color |
|---|---|---|
| `submitted` | **Submitted** | blue |
| `triaged` | **Triaged** | amber |
| `absorbed` | **Absorbed** | green |
| `rejected` | **Rejected** | gray |

`requestStatusMappings.ts` is the single source of truth for request statuses.
