# Shot Builder - Continuation Prompt

I'm continuing work on my Shot Builder Firebase app. **All 35 phases complete + critical security fixes applied.**

## Current Status

**35/35 phases complete** ✅

- **Latest**: Phase 17A Comments & Mentions (PR #209 - ready for review after critical fixes)
- **Bundle**: 251.92 kB gzipped
- **Tests**: 351 passing
- **Production**: Stable and fully operational

**Branch**: `feat/phase17a-comments-mentions` (ready to merge after review)

## Quick Reference

**Master roadmap**: `/docs/MOCKUP_INTEGRATION_ASSESSMENT.md`
- Complete 35-phase history with PR links (#159-#208)
- Bundle size tracking and test coverage metrics
- All recent features and bug fixes documented

**Latest session**: `/PHASE17A_COMMENTS_MENTIONS_SESSION.md`
- Comments & mentions system implementation details
- Security fixes and code review improvements

**Tech**: React 18 + Vite 7 + Tailwind + Firebase + TanStack Query

## What I Need

**[Option 1]** Review and merge PR #209
- Phase 17A: Comments & Mentions collaboration system
- All critical security/reliability fixes applied (Phase 1)
- XSS prevention, immutable field validation, memory leak fixes
- 351 tests passing, bundle optimized

**[Option 2]** Phase 17B: Activity Feed
- Auto-log shot updates, comments, status changes
- Project-level activity timeline
- Filter by type, user, date range

**[Option 3]** Phase 17C: Enhanced Sharing
- Project sharing with public links
- Per-link permissions (view, comment, full access)
- External collaborator support

**[Option 4]** Production support or custom feature
- Tell me what you want to build/fix
- I'll review existing patterns and create a plan

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
- **Z-index hierarchy**:
  - `z-40`: Sticky page headers, navigation bars
  - `z-50`: Dropdowns, popovers, tooltips, sidebars
  - `z-60`: Reserved (defined in config, use for layered modals if needed)
  - `z-100`: Top-level overlays (use sparingly for highest priority UI)

### Security (Critical)
- **DOMPurify**: Strict sanitization for user-generated HTML
- **Firestore rules**: Immutable field validation, ownership checks
- **Error handling**: Try-catch with graceful degradation

### Development
- **Branches**: `feat/[name]` or `fix/[name]`
- **Testing**: All tests must pass (9 skip in CI, pass locally)
- **Commits**: Conventional commits with Claude Code footer
- **CI**: Firebase preview channels (max 5, auto-pruned)

## Git Workflow

```bash
# Create branch from main
git checkout main
git pull
git checkout -b [feat|fix]/description

# After changes
git add .
git commit -m "type: description"
git push -u origin [branch]

# Create PR
gh pr create --title "..." --body "..."

# Merge after review
gh pr merge [number] --squash
```

## Recent Context

**Phase 17A Critical Fixes (PR #209)**:
1. **XSS Prevention**: DOMPurify config hardened (restricted class attributes, forbidden tags/attrs)
2. **Firestore Security**: Immutable field validation (createdBy, createdAt, createdByName, createdByAvatar)
3. **Race Condition**: Replaced Date.now() with crypto.randomUUID() for temp IDs
4. **DOM Safety**: Try-catch wrapper with validation in insertMentionAtCursor
5. **Memory Leak**: useRef pattern for event listener callbacks
6. **CI/CD**: Firebase preview channel quota management (--max-channels 5)

All fixes tested ✅, build passing ✅, zero regressions ✅

**Phase 17A Features**:
- Real-time comments on shots (create, edit, delete)
- @user mentions with autocomplete and keyboard navigation
- Automatic notifications for mentioned users
- Comment subcollections with security rules
- Full dark mode and WCAG 2.1 AA compliance

See `/PHASE17A_COMMENTS_MENTIONS_SESSION.md` for complete details.

## Communication Style

- **Be concise**: Acknowledge → Plan → Execute
- **Use TodoWrite**: Track multi-step work, mark complete as you go
- **Reference docs**: Link to docs, don't duplicate content
- **Ask when unclear**: Clarify requirements before implementing

## Ready

I'm ready to continue. What would you like to work on?
