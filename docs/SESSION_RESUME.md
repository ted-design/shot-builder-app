# Session Resume — Production Hub Sprint S15

Read this file to resume work on the UX Overhaul sprint. All context needed is in the project docs.

---

## Quick Start

1. **Read these files first** (in order):
   - `CLAUDE.md` — project rules, hard constraints, new S15 infrastructure
   - `docs/_runtime/HANDOFF.md` — what was just completed, next steps
   - `docs/_runtime/CHECKPOINT.md` — detailed completion state
   - `Plan.md` — Sprint S15 section for sub-task checkboxes
   - `MEMORY.md` — cross-session memory, completed phases
   - `docs/research/s15-action-plan.md` — full prioritized action plan

2. **Verify current state:**
   ```bash
   git log --oneline -10   # Should show S15a-d commits on vnext/s15-ux-overhaul
   npm run build            # Should pass
   npm run lint             # Should pass (zero warnings)
   npm test                 # ~1427 tests passing (2 flaky requestNotification tests may fail)
   ```

3. **Resume from:** Sprint S15e (Premium Polish) — or whichever phase the user requests.

---

## Workflow Protocol

This project uses a structured agent-team approach. Follow these patterns exactly.

### 1. Session Orchestrator Model

You (the main Claude instance) act as the **session orchestrator**. You do NOT implement code directly except for small fixes. Instead:

- **Plan** the work based on research + mockups + action plan
- **Deploy agent teams** with specialized roles in isolated worktrees
- **Integrate** their output (merge worktrees, resolve conflicts)
- **Validate** (build, lint, test after every merge)
- **Review** (code-reviewer agent + Codex CLI)
- **Fix** issues found in review
- **Document** (update CHECKPOINT, HANDOFF, Plan.md, MEMORY.md)
- **Report** progress to user

### 2. Agent Team Structure

Deploy **2-3 parallel agents per wave** in isolated git worktrees (`isolation: "worktree"`). Each agent gets:

- **Non-overlapping file ownership** — two agents must never modify the same file
- **Complete context** — tell them exactly which files to read first, what types exist, what to create
- **Clear acceptance criteria** — build clean, lint zero, tests pass
- **Mode:** `bypassPermissions` for implementation agents

**Typical team per phase:**
| Role | Purpose | Agent Type |
|------|---------|------------|
| Data Architect | Types, models, pure functions, tests | `general-purpose` (worktree) |
| UI Engineer | Components, routes, integration | `general-purpose` (worktree) |
| Code Reviewer | Post-implementation quality gate | `code-reviewer` |
| Validator | Build/lint/test verification | Main orchestrator (inline) |

### 3. Code Review Pipeline

After EVERY implementation commit:
1. Deploy `code-reviewer` agent with specific review checklist
2. Attempt Codex CLI review: `codex -a never "review prompt"` (may need terminal)
3. Fix all **CRITICAL** and **HIGH** issues before proceeding
4. Document **MEDIUM** issues as follow-up tasks
5. Commit fixes as a separate `fix:` commit

### 4. Codex MCP Integration

Codex CLI is installed at `/Users/tedghanime/.nvm/versions/node/v22.19.0/bin/codex`. Use it for external review:
- Codex CLI requires a terminal — may fail with "stdin is not a terminal" in subprocesses
- Fallback: use `code-reviewer` agent (subagent_type) which achieves the same purpose
- Always present Codex/reviewer findings to the user

### 5. HTML Mockups (Design-First)

Before implementing any UI feature:
1. Create HTML mockup in `mockups/s15-{feature}.html`
2. Use Tailwind CDN + dark theme (zinc-950 bg, Inter font)
3. Match app's Near-Black Editorial identity
4. Show before/after states, UX rationale callouts, implementation notes
5. Serve via `python3 -m http.server` and review in Chrome
6. Get **user approval** before writing any code

### 6. UI/UX Skills

Leverage installed skills when designing/implementing UI:
- `/ui-ux-pro-max` — comprehensive design intelligence
- `/design` — brand identity, design tokens
- `/ui-styling` — shadcn/ui + Tailwind styling
- `/design-system` — token architecture, component specs
- `/brand` — brand voice, visual identity

### 7. Ralph Wiggum Iterative Loop

For implementation tasks that need iterative refinement, use the Ralph Wiggum loop:

```
/ralph-loop "Implement [feature]. 

Requirements:
- [specific requirement 1]
- [specific requirement 2]

Completion criteria:
- npm run build passes with zero errors
- npm run lint passes with zero warnings
- npm test passes (all tests)
- No hardcoded colors (design tokens only)
- All new code has readonly TypeScript interfaces

After 15 iterations without completion, document blockers and stop.

Output <promise>COMPLETE</promise> when all criteria met." --max-iterations 20 --completion-promise "COMPLETE"
```

### 8. Documentation Cadence

Update docs at these checkpoints:
- **After each agent wave completes:** CHECKPOINT.md
- **After each commit:** HANDOFF.md
- **After each phase completes:** Plan.md checkboxes, MEMORY.md status
- **Before session end or context >60%:** All four files
- **After any code review:** Document findings and fixes

---

## Current State (as of 2026-04-01)

### Branch: `main` (S15 + S16 merged via PR #376)

### Completed — Sprint S15 (UX Overhaul):
- **S15a:** Batch shot delete, urgency badges (5-tier), page transitions (CSS)
- **S15b:** Talent table view, locations table view, shot view consolidation (3→2)
- **S15c:** Export PDF builder (block-based, 9 types, templates, variables, doc ops, persistence)
- **S15d:** Call sheet section toggles, per-field customization, layout templates
- **S15e:** Premium polish (hover-lift, btn-press, shimmer), product enrichment (Linked Shots tab), retroactive fixes

### Completed — Sprint S16 (Quality & Consistency):
- **S16a:** Bug fixes (gender labels, HTML notes, checkbox layout, text overflow)
- **S16b:** Shared components (ViewModeToggle, SearchBar, usePersistedViewMode) applied to all library pages
- **S16c:** Interactive table system — 5/5 tables with column resize, visibility toggles (Saturation-style), drag reorder, keyboard nav
- **S16d:** Consistency sweep — 8 review issues resolved
- **S16e:** Shoot readiness: per-colorway selection, requirement status, gender badges, sort, project assignment indicators
- **S16f:** Call sheet visual upgrade: typography tokens, full-bleed section bands, spacing tokens
- **S16g:** Talent detail polish: headshot lightbox, spacing, overflow, tab bar

### Deferred to S17:
- Canvas image editor (multi-layer composition — Fabric.js or Konva.js evaluation needed)
- Advanced call sheet (SetHero full feature parity)

### Key Infrastructure Created:
- `docs/DESIGN_SYSTEM.md` — **permanent enforcement document**, referenced from CLAUDE.md Hard Rule #3. READ BEFORE ANY UI WORK.
- 9 new shared files: ViewModeToggle, SearchBar, usePersistedViewMode, TableColumnConfig, useTableColumns, useColumnResize, useTableKeyboardNav, ColumnSettingsPopover, ResizableHeader
- 60+ new tests

### Research docs (all in `docs/research/`):
- `saturation-export-builder.md` — Saturation's block-based PDF builder
- `sethero-callsheet.md` — SetHero's call sheet builder
- `kobolabs-plm.md` — KoboLabs PLM platform
- `internal-ux-audit.md` — Current app pain points with file paths + line numbers
- `s15-action-plan.md` — Full prioritized plan with phases
- `s16-quality-plan.md` — Quality overhaul plan (7 phases)

---

## Competitive Intelligence Summary

### Saturation (export builder) — Key takeaways adopted:
- Block-based document composition with drag-and-drop
- Template library (built-in + workspace-saved)
- Dynamic variable token system
- Per-block settings (typography, layout, column toggles)
- Multi-page documents with page management

### SetHero (call sheet) — Key takeaways adopted:
- Section toggle system (show/hide)
- Per-field customization (rename, reorder, resize, toggle)
- Layout template save/load
- Smart suggestions (auto-detect from schedule)

### KoboLabs (PLM) — Key takeaways for future:
- Contextual communication threads per entity
- Bulk operation patterns with floating action bar
- Mobile field operations (QR scanning, photo capture)
- Version tracking with audit trails
