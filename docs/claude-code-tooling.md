# Claude Code Tooling Configuration

This document tracks Claude Code plugins and tooling configurations for the Shot Builder project.

## Installed Plugins

### everything-claude-code

**Source:** [affaan-m/everything-claude-code](https://github.com/affaan-m/everything-claude-code)

**Install Date:** 2026-01-23

**Install Method:** Plugin marketplace (preferred method)

```bash
# Installation commands used:
claude plugin marketplace add affaan-m/everything-claude-code
claude plugin install everything-claude-code@everything-claude-code
```

**Version:** `5230892ee874` (git commit SHA)

**Scope:** User-level (applies across all projects)

## What's Enabled

### Commands (Slash Commands) - ENABLED
The following slash commands are available:
- `/plan` - Implementation planning with structured approach
- `/tdd` - Test-driven development workflow
- `/code-review` - Quality review checklist
- `/build-fix` - Build error resolution
- `/e2e` - E2E test generation with Playwright
- `/verify` - Verification loop for testing
- `/refactor-clean` - Dead code removal
- `/checkpoint` - Create implementation checkpoints
- `/eval` - Evaluation harness
- `/learn` - Learning mode for codebases
- `/orchestrate` - Multi-agent orchestration
- `/setup-pm` - Package manager configuration
- `/test-coverage` - Test coverage analysis
- `/update-codemaps` - Update code maps
- `/update-docs` - Documentation updates

### Agents (Subagents) - ENABLED
Specialized agents available for delegation:
- `planner` - Feature implementation planning
- `architect` - System design decisions
- `code-reviewer` - Quality/security review
- `security-reviewer` - Vulnerability analysis
- `e2e-runner` - E2E test execution (Playwright)
- `build-error-resolver` - Build error diagnosis
- `doc-updater` - Documentation maintenance
- `refactor-cleaner` - Code cleanup
- `tdd-guide` - TDD workflow guidance

### Skills (Workflows) - ENABLED
Workflow definitions for common patterns:
- `coding-standards` - Language-specific standards
- `backend-patterns` - APIs, databases, caching
- `frontend-patterns` - React, Next.js patterns
- `tdd-workflow` - TDD methodology
- `security-review` - Security review processes
- `verification-loop` - Continuous testing
- `strategic-compact` - Strategic compaction
- `continuous-learning` - Session learning

## What's NOT Enabled (Minimal Footprint)

### Hooks - NOT ENABLED
The plugin includes reference hook configurations in `hooks/hooks.json` but these are **NOT automatically enabled**. Available hooks include:
- Dev server tmux enforcement
- Git push review reminders
- Documentation file creation blocks
- Compact suggestions

To enable hooks, you would need to manually copy them to `~/.claude/settings.json`. **We keep them disabled to avoid unexpected behavior.**

### MCP Servers - NOT ENABLED
The plugin includes reference MCP server configs in `mcp-configs/mcp-servers.json` but these are **NOT automatically enabled**. Available configs include:
- GitHub, Supabase, Vercel, Railway
- Firecrawl, Context7, Memory
- Cloudflare (docs, workers, observability)
- ClickHouse, Magic UI

To enable MCP servers, you would need to manually copy them to `~/.claude.json`. **We keep them disabled to preserve context window.**

## Context Window Warning

From the plugin documentation:
> Keep under 10 MCPs enabled to preserve context window space. Under 80 active tools maximum is recommended.

The Shot Builder project already has several MCP servers configured (shadcn, playwright, chrome-devtools, figma, sequential-thinking, context7, ck, memory-keeper). Adding more would exceed recommended limits.

## Managing the Plugin

```bash
# List installed plugins
claude plugin list

# Disable the plugin (keeps it installed)
claude plugin disable everything-claude-code@everything-claude-code

# Re-enable the plugin
claude plugin enable everything-claude-code@everything-claude-code

# Update the plugin
claude plugin update everything-claude-code@everything-claude-code

# Uninstall completely
claude plugin uninstall everything-claude-code@everything-claude-code

# Remove the marketplace
claude plugin marketplace remove everything-claude-code
```

## Verification

To verify the plugin is working, use any of the slash commands:
```
/plan
/verify
/code-review
```

These commands will expand into full prompts guiding Claude Code through structured workflows.

---

## HARD RULES — Process & Safety

### Forbidden Actions (NEVER DO)

| Action | Why Forbidden |
|--------|---------------|
| Enable hooks | Unexpected behavior; modifies workflow in hard-to-debug ways |
| Enable new MCP servers | Context window exhaustion; >80 tools degrades performance |
| Start background processes | `npm run dev`, `npm start`, file watchers — blocks Claude Code and leaves orphan processes |
| Long-running foreground processes | If needed, run, capture output, and stop immediately |
| Auto-approve dangerous operations | Always confirm destructive actions with user |

### Verification Workflow — Mandatory Order

Every implementation delta MUST follow this verification sequence:

1. **Claude-in-Chrome FIRST** (when available)
   - Visual verification in real browser
   - Observe actual rendered state
   - Test user interactions

2. **If Chrome unavailable** → Document limitation
   - Add explicit note to execution log: `⚠️ Chrome extension unavailable`
   - Provide manual QA checklist
   - User must verify manually

3. **Lint + Build** (always required)
   ```bash
   npm run lint    # Must be zero warnings
   npm run build   # Must succeed
   ```

4. **No background dev server verification**
   - Do NOT start `npm run dev` to verify
   - If dev server needed: run in foreground, capture output, terminate immediately
   - Let user run dev server themselves for manual QA

### Process Safety Rules

1. **Never guess at verification** — If you can't verify, say so explicitly
2. **Never leave processes running** — All spawned processes must be terminated
3. **Never skip lint/build** — These are non-negotiable gates
4. **Document limitations** — If verification is incomplete, document what couldn't be verified

### Manual QA Checklist Template

When Chrome extension is unavailable, include this in execution log:

```markdown
### Manual QA Required

⚠️ **P.3.2 Note:** Chrome extension unavailable for visual verification.

| Scenario | Steps | Expected |
|----------|-------|----------|
| [Scenario 1] | [Steps to reproduce] | [Expected outcome] |
| [Scenario 2] | [Steps to reproduce] | [Expected outcome] |

**User Action:** Run `npm run dev` and verify above scenarios manually.
```
