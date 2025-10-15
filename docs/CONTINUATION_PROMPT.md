# Shot Builder - Continuation Prompt

I'm continuing work on my Shot Builder Firebase app. **All 34 phases complete + production bug fixes deployed.**

## Current Status

**34/34 phases complete + all bug fixes merged** ✅

- Latest: PR #207 merged - Planner loading fix, dropdown z-index corrections, editor dark mode
- Bundle: 251.49 kB gzipped
- Tests: 351 passing
- Production: Stable and fully operational

**Branch**: `main` (clean slate for new work)

## Quick Reference

**Master roadmap**: `/docs/MOCKUP_INTEGRATION_ASSESSMENT.md`
- Complete 34-phase history with PR links (#159-#207)
- Bundle size tracking across all phases
- Test coverage metrics
- All recent bug fixes and improvements

**Tech**: React 18 + Vite 7 + Tailwind + Firebase + TanStack Query

## What I Need

**[Option 1]** Suggest next improvement
- Review codebase for optimization opportunities
- Identify polish/refinement areas
- Propose next feature or enhancement

**[Option 2]** Implement specific feature
- I'll tell you what I want to build
- You review existing patterns from docs
- Create implementation plan with TodoWrite
- Build, test, and document

**[Option 3]** Production support
- Fix bugs or errors
- Address performance issues
- Resolve deployment problems

## Please

1. Read `/docs/MOCKUP_INTEGRATION_ASSESSMENT.md` for full context
2. Suggest best next step OR wait for my request
3. Create implementation plan with TodoWrite for multi-step tasks
4. Work efficiently - test builds, update docs, create PRs

## Essential Patterns

### Data & State
- **Real-time**: TanStack Query + Firestore `onSnapshot`
- **Mutations**: Optimistic updates for instant UX
- **Multi-tenancy**: All queries scoped to `clientId`

### UI & Styling
- **Dark mode**: Tailwind `dark:` prefix (100% coverage)
- **Accessibility**: WCAG 2.1 AA compliance
- **Z-index**: z-40 (headers), z-60 (modals), z-100 (dropdowns)

### Development
- **Branches**: `feat/[name]` or `fix/[name]`
- **Testing**: Write tests during implementation
- **Commits**: Conventional commits with Claude Code footer
- **CI**: All tests must pass (9 skip in CI, pass locally)

## Git Workflow

```bash
# Create branch
git checkout -b [feat|fix]/description

# After changes
git add . && git commit -m "..."
git push -u origin [branch]

# Create PR
gh pr create --title "..." --body "..."

# Wait for checks, then merge
gh pr merge [number] --squash
```

## Debugging Checklist

When fixing bugs:
1. Use TodoWrite to track issues
2. Grep/Read to locate problem areas
3. Check for variable name mismatches
4. Verify Tailwind classes are valid
5. Test dark mode variants
6. Run build and tests
7. Update documentation

## Recent Context

**PR #207 (Just Merged)** - Three bug fixes:
1. **Planner loading**: Fixed undefined `shotsLoading` variable (should be `primaryShotsLoading`)
2. **Dropdown z-index**: Added z-100 to tailwind.config, updated QuickActionsMenu, NotificationPanel, UserMenu
3. **Editor dark mode**: Fixed NotesEditor focus bug, added dark mode support, enhanced color picker

**Previous PRs #201-#206**: Loading bugs, UX improvements, schema fixes, timezone corrections, colourway support

See `/docs/MOCKUP_INTEGRATION_ASSESSMENT.md` for complete history.

## Communication Style

- **Be concise**: Acknowledge → Plan → Execute
- **Use TodoWrite**: Track multi-step work, mark complete as you go
- **Reference docs**: Link to docs, don't duplicate content
- **Ask when unclear**: Clarify requirements before implementing

## Ready

I'm ready to continue. What would you like to work on?
