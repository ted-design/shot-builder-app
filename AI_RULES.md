# AI Rules -- Shot Builder

Rules for all AI agent work on this project. When in doubt, these rules apply.

---

## Decision Framework

### When to Plan vs. Just Do

| Scope | Action |
|-------|--------|
| 1-2 files, clear intent, no architectural impact | Just do it |
| 3+ files OR architectural decisions OR uncertainty | Plan first (write plan, get approval) |
| Cross-feature changes, schema changes, new deps | Plan + checkpoint with user before proceeding |

### When Reality Contradicts Specs

Reality wins. If the code does something different from what a doc says, update the doc -- not the code (unless the code is buggy). Architecture.md describes what the codebase IS.

### Confidence Threshold

- 80%+ sure the approach is right: proceed, explain what you did
- Less than 80% sure: state options, recommend one, ask user

---

## Code Standards

### Language & Files

- **New files:** TypeScript (.ts/.tsx)
- **Existing JS/JSX files:** Edit in place. Do not convert to TypeScript without explicit request.
- **File structure (legacy):** `src/pages/`, `src/components/`, `src/hooks/`, `src/lib/`, `src/context/`
- **File structure (vNext):** `src-vnext/app/`, `src-vnext/features/`, `src-vnext/shared/`, `src-vnext/ui/`
- **New code goes in `src-vnext/`.** Do not modify legacy `src/` unless porting utilities.
- **File size:** 200-400 lines typical, 800 max. Extract before exceeding.
- **Functions:** <50 lines. No nesting deeper than 4 levels.

### Immutability

Always create new objects. Never mutate parameters, props, or state.

```typescript
// WRONG
function updateShot(shot, status) { shot.status = status; return shot; }

// CORRECT
function updateShot(shot, status) { return { ...shot, status }; }
```

### Error Handling

- Every async operation must have error handling
- User-facing errors: toast with actionable message (Sonner)
- System errors: capture to Sentry, show generic message
- Never swallow errors silently
- Never show raw error messages to users

### Input Validation

- All user input validated at the form boundary using Zod schemas from `shared/lib/validation.ts`
- Schemas: `projectNameSchema`, `shotTitleSchema`, `optionalUrlSchema`, `optionalNotesSchema`
- Use `validateField(schema, value)` helper for per-field error extraction (returns `string | null`)
- All Firestore write data validated before write
- Never trust URL params or query strings without validation
- No form libraries (react-hook-form, formik) — useState + Zod is sufficient for simple dialogs

### Console Output

- **Development:** `console.log` / `console.warn` allowed for debugging
- **Production:** No `console.log`. Use Sentry for errors. Lint rule: `no-console`

---

## Testing Requirements

### Minimum Bar

| Code Type | Requirement |
|-----------|-------------|
| New `lib/` modules | 80%+ coverage (Vitest) |
| New components | Render test + key interaction test (Testing Library) |
| Bug fixes | Regression test written before the fix |
| Every page | Empty, loading, and error state coverage |

### Approach

- Unit tests for pure logic (hooks, utils, lib)
- Component tests for UI behavior (Testing Library)
- E2E (Playwright): critical flows only, after stabilization
- Mock Firestore in unit/component tests -- never hit real Firestore
- Run `npm test` before marking any task complete

### Refactor-Induced Test Breakage

When refactoring a component's interaction model (e.g., always-visible textarea → click-to-edit toggle), **plan for test updates as part of the delta**:

1. Identify tests that assume the old behavior (search for test selectors and interaction patterns)
2. Update tests to follow the new interaction flow (e.g., click to enter edit mode before asserting on edit-mode elements)
3. Add new tests for the new behavioral states (read mode, edit mode transitions, exit behavior)
4. Never skip tests or mark a delta complete with failing tests

### Design Token Verification

Before referencing any CSS custom property (`var(--color-*)`) in a component:
1. Verify the token exists in `tokens.css`
2. Missing tokens silently resolve to nothing — the build won't catch them
3. If a new token is needed, add it to `tokens.css` first (Delta 1 pattern)

### Dark Mode Compatibility

All new vNext components must work in dark mode:
1. **Surface colors:** Use `var(--color-surface)`, `var(--color-surface-subtle)`, `var(--color-bg)` — never `bg-white`, `bg-zinc-50`, `bg-slate-50`
2. **Border colors:** Use `var(--color-border)`, `var(--color-border-strong)` — never `border-zinc-*`, `border-slate-*`
3. **Domain accent text** (teal for products, indigo for talent, etc.): Add `dark:` Tailwind variants for -700/-800 shades (e.g., `text-teal-700 dark:text-teal-300`)
4. **Image overlays** (`bg-black/*`): Leave as-is — intentionally dark over image content
5. **Print portals:** Static white — leave as-is
6. **Activation:** `.dark` CSS class on `<html>`, NOT `data-theme` attribute. localStorage key: `sb:theme`
7. **FOUC prevention:** Three interconnected pieces must agree — `tokens.css` `.dark` selector, `ThemeProvider` class toggle, FOUC `<script>` in `index.html`. All three use `.dark` CSS class and `sb:theme` localStorage key. A mismatch between any two causes bugs.

---

## Off-Limits Without Approval

### Hard Stops (always ask first)

- New Firestore collections or document fields
- New npm dependencies
- Firestore security rules changes
- Auth/RBAC model changes
- Removing or renaming existing routes
- Deleting feature flag definitions

### Soft Stops (proceed with explanation)

- Modifying `src/lib/` files used by multiple features
- Changing component APIs consumed by other components
- Adding new feature flags
- Modifying the App.jsx router

---

## Tech Debt Strategy

| Debt | Policy |
|------|--------|
| TanStack Query | Keep. Do not introduce to new code -- prefer direct Firestore onSnapshot. |
| tiptap / reactjs-tiptap-editor | Keep where used. Evaluate before adding to new surfaces. |
| react-select | Keep where used. Prefer Radix Select for new pickers. |
| react-easy-crop | Keep where used. |
| Feature flag V2/V3 variants | Consolidate when older version is fully deprecated. Track as cleanup. |
| Mixed JS/TS | New files in TS. Don't convert existing JS without request. |

**General rule:** Do not fix tech debt while implementing features. Separate commits, separate scope. Document debt with TODO comments referencing the issue.

---

## Git Standards

- **Format:** Conventional commits (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, `perf:`)
- **Scope:** One logical change per commit
- **PR descriptions:** What changed, why, how to test, screenshots for UI changes
- **Branching:** Feature branches off `main`. Never force-push shared branches.
- **Reviews:** Do not push to `main` without review

---

## Workflow

1. **Plan:** Write plan with checkable items for non-trivial tasks
2. **Verify plan:** Check in with user before starting implementation
3. **Track progress:** Mark items complete as you go
4. **Verify before done:** Run lint, type-check, tests. Demonstrate correctness.
5. **After corrections:** Record what you learned to avoid repeating mistakes

---

## Phase Discipline

Plan.md defines a sequential phase order. Follow it.

### Rules

1. **Complete the active phase before starting the next.** "Complete" means acceptance criteria met, PR merged, CHECKPOINT.md updated.
2. **No skipping phases.** If Phase N feels less urgent than Phase N+2, raise it with the user -- don't silently jump ahead.
3. **Pre-plan work is not plan progress.** Code that existed before the plan was written gets acknowledged in CHECKPOINT.md but does not change phase ordering.
4. **Out-of-phase discoveries go to a backlog, not into the current sprint.** If you find a Phase 5 issue while working Phase 2, note it in Plan.md under Phase 5 -- don't fix it now.
5. **Every session starts by reading HANDOFF.md.** It tells you the active phase and next sub-task. If you disagree with the priority, discuss it before diverging.

### Why This Matters

The plan exists because the codebase grew organically with 27+ ad-hoc feature branches before any documentation existed. Sequential phases prevent the same pattern from recurring. Phase 2 (Nav & IA) was deliberately placed before Phase 3 (Shot Editing) because navigation is the onboarding gate -- no one can use the shot editor if they can't find it.

---

## Cleanup Agents

Agents like `code-simplifier`, `refactor-cleaner` are available but follow strict rules:

- **Follow-up only.** Never during initial implementation or active development.
- **Explicit permission required.** Named scope and goal for each invocation.
- **Behavior preserved.** Must not change component APIs, hook signatures, route behavior, or user-facing output.
- **Reversible.** Every cleanup is a single, revertable commit.

---

## Context Management

### Session Resume Protocol

1. On session start: read `docs/_runtime/HANDOFF.md` for next steps
2. On session start: read `docs/_runtime/CHECKPOINT.md` for completed work
3. On "continue where we left off": follow HANDOFF.md exactly
4. Read Plan.md for the active sub-task's acceptance criteria

### Checkpointing Rules

- Update `CHECKPOINT.md` after completing any sub-task (not just at session end)
- Update `HANDOFF.md` before ending any session or when context is getting large
- **CHECKPOINT.md records:** what's done, what's in progress, key decisions made
- **HANDOFF.md records:** numbered next steps, do-not list, verification checklist

### Subagent Strategy

- Use subagents for any task that would consume >20% of remaining context
- Each subagent gets: the specific task, relevant file paths, acceptance criteria
- Research/exploration: use `Explore` type (read-only)
- Implementation: use `general-purpose` type with full context
- Parallelize independent subagents (e.g., research 3 components simultaneously)
- Never duplicate work between main context and subagent
- Summarize subagent results into main context (don't paste raw output)

### Parallel Agent Sweeps (Phase 6 Pattern)

For large cross-directory standardization changes (e.g., adopting semantic classes across 30+ files):
1. Launch one subagent per feature directory scope (products/, shots/, pulls/, sidebar/, etc.)
2. Each agent gets: file list, exact find pattern, exact replacement, exclusion rules
3. Exclusions: print portals (React-PDF can't use CSS vars), `ui/` components (shadcn generated)
4. After all agents complete, run a single grep from main context to verify zero remaining violations
5. This pattern was used in Phase 6f (component polish sweep, 44 files in one pass)

### Firestore onSnapshot + Dialog Form State (Phase 7A Pattern)

When a dialog initializes form state from a live Firestore entity, the `useEffect` dependency on the entity object causes form resets on every snapshot (new object reference). **Never use `eslint-disable` to remove the entity from deps.** Instead:
1. Use a `useRef(false)` to track `wasOpen`
2. Only initialize form state when `open && !wasOpen.current && entity`
3. Keep the entity in the dependency array for correctness

### canCreate vs canEdit Permission Split (Phase 7C Pattern)

Pages with both create actions (available on mobile) and inline edit actions (desktop-only) must split their permission checks:
- `canCreate = canManageX(role)` — gates create button, empty state CTA, `C` keyboard shortcut. No `!isMobile` check.
- `canEdit = !isMobile && canCreate` — gates inline editing, table row actions, write fields.

Never gate create dialogs behind `!isMobile` — they work on mobile via `ResponsiveDialog`. Empty state CTAs use `canCreate` (not `canEdit`) so mobile users can reach create dialogs.

### Breadcrumb & Shortcut Conventions (Phase 7C Pattern)

**Breadcrumbs:** Top-level pages (Projects, Products) get NO breadcrumb. Nested pages show parent section. Detail pages show full path. Never duplicate the page title in the breadcrumb when it's already the `<h1>`.

**Keyboard shortcuts:** Any page with a create action gets `C` shortcut via `useKeyboardShortcuts`. Guard with `canCreate` (not `canEdit`). Update `KeyboardShortcutsDialog.tsx` SHORTCUT_GROUPS when adding new groups.

### Dual Mapper Consistency (Phase 7B Pattern)

When expanding entity types (e.g., adding `street`, `city`, `phone` to `LocationRecord`), update ALL independent mappers that produce that type:
- Library hooks (`useCrewLibrary`, `useLocationLibrary`) — primary full-field mappers
- Picker data hooks (`usePickerData.ts`) — independent mappers used by shot assignment pickers
- Schedule mappers (`mapSchedule.ts`) — used by schedule/call sheet features

Missing a mapper causes fields to silently be `undefined` despite Firestore having the data.

### Legacy-to-vNext Porting (Phase 6j Pattern)

When legacy `src/` code solves the same problem the current phase requires:
1. **Port, don't reinvent.** The legacy system is battle-tested. TypeScript conversion + design token adoption is the scope.
2. **Scope narrowly.** Port for the primary entity (shots) first. Extend to other entities as a separate delta.
3. **Audit for rendering duplication.** When extracting shared sub-components from ported code, ensure the parent doesn't re-render UI the child already handles (e.g., overflow "+N" badges in both StackedAvatars and the parent).
4. **Client-side TTL over Cloud Functions** when the data is tiny and short-lived (presence docs). Stale docs are harmless — the client filters them out.
5. **useAuth() over prop drilling** for `clientId` in deeply nested components within the auth boundary.

### Detail Page Decomposition Pattern (Phase 7D)

When a detail page exceeds 800 lines because it has multiple workspace sections (tabs/panels), decompose it:
1. **Parent is a thin shell** (~200 lines): data hooks, workspace nav, section routing, family-level dialogs
2. **Each section is its own component file**: receives data as props, owns its own UI state (filters, drafts, modals)
3. **Parent owns all Firestore hooks** to avoid double subscriptions. Pass data down; don't subscribe twice.
4. **Shared helpers** (date formatters, sort keys, validation) go in `lib/{feature}DetailHelpers.ts`
5. **Section-specific helpers** (DocumentRow, SampleRow) stay in the section file

This pattern reduced `ProductDetailPage.tsx` from 1,631 to 240 lines.

### Audit-Before-Build Pattern (Phase 7D)

Before implementing a Plan.md phase, **audit existing code first**. Phase 7D's audit revealed 2 of 5 sub-tasks were already built (taxonomy pickers, workspace nav). Auditing prevents:
- Duplicate implementation of features that already exist
- Incorrect scope estimates (5 sub-tasks → 3 actual)
- Wasted context on building what's already there

Pattern: (1) Explore vNext code, (2) Explore legacy code for reference, (3) Document findings, (4) Present revised scope for approval.

### Incremental vs Full-Save Write Functions (Phase 7D)

When adding child entities to an existing parent (e.g., SKUs to a product family), create a **dedicated incremental write function** rather than reusing the full-save function:
- Full-save functions reconcile the entire entity set (creates, updates, deletes, image uploads) — overkill for "just add N items."
- Incremental functions use `writeBatch` to add only new entities and update parent aggregates in one atomic operation.
- Keep them separate in the same `{entity}Writes.ts` file alongside the full-save functions.

Example: `bulkCreateSkus()` adds colorways without touching existing SKUs, while `updateProductFamilyWithSkus()` reconciles the entire SKU set.

### Three-Panel Layout Rules

Components inside `react-resizable-panels` must use `ResizeObserver` for width-aware layout — never viewport media queries (`sm:flex`, `md:hidden`). The panel can be narrow even on a wide viewport.

- **Compact prop:** Shared components used in both full-width and narrow panel contexts accept an optional `compact` prop (shorter placeholder, hide kbd hints, reduce padding).
- **Exit affordances:** Always provide 2+ visible ways to leave a modal/panel mode. Keyboard-only exits are easy to miss.
- **Click-to-edit fields:** Read mode is default. Click to enter edit mode with autoFocus. Blur saves and returns to read mode. Empty state shows placeholder like "Click to add notes..."
- **List density tiers:** Driven by `ResizeObserver`, not viewport. Compact (<200px): title only. Medium (200–280px): + thumbnail + badge. Full (>280px): + description preview.

### Visual Standards

All new and modified components follow these rules:

- **One `<h1>` per page.** Never two.
- **Semantic typography classes:** Use `.heading-page`, `.heading-section`, `.heading-subsection`, `.label-meta` from `design-tokens.js` — not raw Tailwind font/tracking combos.
- **Card standards:** `rounded-lg` (8px), `p-4` content padding, `pb-2` header padding, `gap-4` grid gap.
- **Badge font size:** `text-xxs` (11px) consistently — both on cards and detail pages.
- **Token-safe colors:** `text-white` on dark backgrounds → `text-[var(--color-text-inverted)]`. `bg-white` on surfaces → `bg-[var(--color-surface)]`. Sidebar text → `text-[var(--color-sidebar-text)]`.
- **Detail page navigation:** All detail pages use `PageHeader` with breadcrumbs. No inline ghost buttons or icon-only back buttons.

### Composite Field Sync Pattern (Sprint S1)

When a Firestore document has both granular fields (`firstName`, `lastName`) and a derived composite field (`name`), the write function must keep them in sync:

1. The `handleFieldSave` function checks which field is being saved
2. If it's a component of the composite (e.g., `firstName`), read the other component from the live entity in scope
3. Compute the composite: `[first, last].filter(Boolean).join(" ") || "Fallback"`
4. Spread both into the patch immutably: `{ ...patch, name: computed }`

This avoids stale composite fields when users edit only one sub-field. The same pattern applies whenever a display field (page title, breadcrumb) derives from editable sub-fields.

### CRUD Completeness Audit Pattern (Sprint S1)

Before building new features, audit existing entity pages for missing edit paths. Common gaps:
- **Read-only fields** that should be editable (department, position on detail pages)
- **Missing rename** on detail pages (pull sheets, schedules — use `InlineEdit` conditional on `canEdit`)
- **Missing destructive actions** on uploaded assets (photo removal — needs `ConfirmDialog`)
- **Missing edit entry points** on list cards (add Edit to `DropdownMenu` before Delete)

Each gap is a small fix (5-30 lines) but blocks real user workflows. Group by file overlap for parallel execution.

### Context Budget Rules

- Each Plan.md phase is broken into lettered sub-tasks that fit in one session
- A sub-task should be completable in <30 tool calls
- If a sub-task exceeds 30 tool calls, split it further
- When context reaches ~60%, proactively checkpoint and consider starting fresh
