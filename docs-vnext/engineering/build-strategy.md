# Build Strategy — Shot Builder vNext

> Draft v1 — 2026-01-30

## Approach: Vertical Slices

vNext is built as a series of self-contained vertical slices. Each slice delivers a complete, usable workflow — not a horizontal layer (e.g., "build all components first" or "set up all routes first").

Each slice includes:
- Route(s) + page component(s)
- Feature module (components, hooks, lib)
- Firestore integration (real data, real auth)
- Mobile + desktop layouts
- Empty / error / loading states
- Tests (unit + component minimum)

### Schema extension rule (rare, explicit)

Default posture is **no schema changes**.

If a slice requires a schema extension (e.g., new subcollections under an existing document), it must be:
- Explicitly approved
- Fully implemented end-to-end (UI + hooks + rules + docs + proof)
- Shipped as its own slice (no partial stubs)

---

## First Slice: Project → Shots → Pull Sheets

### Scope

This slice validates the core readiness pipeline from project creation through warehouse handoff.

**Included routes:**

| Route | Surface | Mobile | Desktop |
|-------|---------|--------|---------|
| `/projects` | Project Dashboard | ✓ Read | ✓ Full |
| `/projects/:id/shots` | Shot List | ✓ Read + Status | ✓ Full |
| `/projects/:id/shots/:sid` | Shot Detail | ✓ Read + Notes | ✓ Full Edit |
| `/projects/:id/pulls` | Pull Sheet List | ✓ Read + Fulfill | ✓ Full |
| `/projects/:id/pulls/:pid` | Pull Sheet Detail | ✓ Fulfill | ✓ Full Edit |

**Included features:**
- Project creation and listing
- Shot creation, listing, inline status updates
- Product assignment to shots (picker from existing product library data)
- Talent/location assignment to shots (picker from existing library data)
- Pull sheet generation from selected shots
- Pull sheet detail with item list and fulfillment toggles
- Public pull share link (read-only, existing `shareToken` mechanism)
- Derived readiness indicators on project dashboard

**Excluded from first slice (deferred):**
- Product CRUD (uses existing data; read-only in pickers)
- Talent/Location/Crew CRUD (uses existing data; read-only in pickers)
- Call sheet builder
- Planner (drag-and-drop board)
- Comments and @mentions
- Activity feed
- Notifications
- Admin/Settings
- Import/Export
- Global search / Cmd+K command palette
- Keyboard shortcuts

**Exclusion rule:** Deferred features must not be stubbed, partially implemented, or visible in the UI. No placeholder routes, grayed-out nav items, "coming soon" labels, or skeleton feature modules. If a feature is not in the current slice, it does not exist in the codebase. This prevents incomplete surfaces from confusing users and avoids accumulating dead code.

### Definition of Done

The first slice is "done" when all of the following are true:

**UX:**
- [ ] A producer can create a project, add shots, assign products/talent/locations, generate a pull sheet, and share it — entirely within vNext.
- [ ] A warehouse operator can open a shared pull sheet on mobile, view items, and mark them fulfilled.
- [ ] The project dashboard shows derived readiness (shots planned, products assigned, pulls fulfilled) without manual input.
- [ ] All pages have correct empty, loading, and error states.
- [ ] Mobile layouts are usable on a 375px viewport (iPhone SE).
- [ ] Desktop layouts use the sidebar navigation with collapsible mode.

**Correctness:**
- [ ] All data reads/writes use the existing Firestore collections and document shapes — no new collections or fields.
- [ ] Auth + RBAC enforced on every route (RequireAuth, role checks).
- [ ] Public pull share validates `shareToken` and shows only the intended pull.
- [ ] No regressions in existing Firestore security rules.

**Reliability:**
- [ ] Sentry error boundary wraps each feature module.
- [ ] Stuck loading detection on all subscription-based pages.
- [ ] Offline banner shown when connectivity is lost.
- [ ] All destructive actions have confirmation dialogs.
- [ ] Non-destructive state changes have undo toasts.

**Quality:**
- [ ] `npm run lint` passes with zero warnings.
- [ ] `npm run build` produces a valid production build.
- [ ] Unit tests cover shared/lib and feature lib modules (80%+).
- [ ] Component tests cover key interactions (shot creation, pull fulfillment).
- [ ] *(Post-v1 hardening)* At least 1 Playwright E2E test covers the full slice flow.
- [ ] LCP < 2.5s on simulated 4G (Lighthouse mobile).
- [ ] JS bundle < 150 KB gzipped (initial load).

---

## Slice Sequence (Proposed)

| # | Slice | Depends On | Key New Surfaces |
|---|-------|------------|------------------|
| **1** | Project → Shots → Pull Sheets | — | Dashboard, shot list/detail, pull list/detail, public share |
| **2** | Product Library | Slice 1 (pickers exist) | Product list, product detail, SKU management |
| **2C** | Product Workspace | Slice 2 | Samples tracking, documents, product activity/comments |
| **3** | Library (Talent, Locations, Crew) | Slice 1 (pickers exist) | Library pages, profile detail, project assignment |
| **4** | Comments + Activity | Slice 1 | Comment threads, activity timeline, @mentions |
| **5** | Planner | Slice 1 | Drag-and-drop board, lane management |
| **6** | Call Sheet | Slice 1 + 3 | Call sheet builder (desktop only) |
| **7** | Notifications + Search | Slices 1-4 | Global notifications, Cmd+K command palette |
| **8** | Admin + Settings | All | User management, role assignment, org settings |

Each slice is independently deployable and testable. Slices 2-3 can be parallelized.

---

## Scaffolding Order (First Slice)

Steps 1–4 below are **infrastructure scaffolding** — the minimal app shell required before any feature can exist. This is not "horizontal layer" work prohibited by the vertical-slice rule; it is the prerequisite platform on which vertical slices are built. Feature work begins at step 5.

Before building features, set up the app shell:

1. **Project scaffold** — Vite + React + Tailwind + shadcn/ui init. Configure tokens.css integration.
2. **Firebase integration** — Import existing `firebase.ts`, `paths.js`, `rbac.js` into `shared/lib/`. Verify auth flow works.
3. **App shell** — Router, auth provider, sidebar layout (desktop), drawer layout (mobile), route guards.
4. **Skeleton + error patterns** — Build the skeleton, error boundary, and loading components once in `shared/components/`.
5. **Feature: Projects** — Dashboard page with project list and creation.
6. **Feature: Shots** — Shot list and detail pages with inline editing and assignment pickers.
7. **Feature: Pulls** — Pull sheet list, detail, fulfillment UI, and public share.
8. **Integration** — Wire readiness indicators on dashboard. Test full flow.
9. **Polish** — Mobile breakpoints, empty states, error states, stuck loading.
10. **Test** — Unit, component, and E2E tests.

---

## Code Simplifier Usage

After each slice is functionally complete and tested:

1. Run the `code-simplifier` skill on the slice's feature module.
2. Focus on: removing dead branches, simplifying conditional logic, consolidating duplicate patterns.
3. Do NOT run code-simplifier during active development — only post-slice as a cleanup pass.
4. Review simplifier output before committing (it should not change behavior).

---

## Verification Expectations

| Check | Tool | When |
|-------|------|------|
| Lint | `npm run lint` | Every commit (pre-commit hook) |
| Type check | `npx tsc --noEmit` | Every commit |
| Unit tests | `npm test` | Every commit |
| Build | `npm run build` | Before slice sign-off |
| E2E | `npx playwright test` | Post-v1 hardening (not required for first slice) |
| Lighthouse | Chrome DevTools | Before slice sign-off |
| Visual review | Browser (desktop + mobile viewport) | Before slice sign-off |
| Offline smoke test | Simulated airplane mode in browser DevTools | Before slice sign-off |
| Security | Threat model checklist (see architecture.md) | Before slice sign-off |

**Offline validation note:** Developers are encouraged to test key workflows in simulated offline/airplane mode during validation to verify that read-only behavior is acceptable and the offline banner appears correctly. This is a manual spot-check, not an automated gate.
