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

- All user input validated at the form boundary (Zod schemas)
- All Firestore write data validated before write
- Never trust URL params or query strings without validation

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

### Context Budget Rules

- Each Plan.md phase is broken into lettered sub-tasks that fit in one session
- A sub-task should be completable in <30 tool calls
- If a sub-task exceeds 30 tool calls, split it further
- When context reaches ~60%, proactively checkpoint and consider starting fresh
