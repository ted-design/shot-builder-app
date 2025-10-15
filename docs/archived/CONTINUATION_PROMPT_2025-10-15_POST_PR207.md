# Shot Builder App - Continuation Prompt (ARCHIVED)

**Archived**: October 15, 2025
**Reason**: Updated with PR #207 fixes (planner loading, dropdown z-index, editor dark mode)
**Replacement**: New lean continuation prompt following reference-based strategy

---

# Shot Builder App - Continuation Prompt

I'm continuing work on my Shot Builder Firebase app. **All 34 phases complete + production bug fixes deployed.**

## Current Status

**34/34 phases complete + all bug fixes merged** ✅

- Latest: PR #205 merged - Date timezone, colourway loading, z-index fixes + code review improvements
- Bundle: 251.49 kB gzipped
- Tests: 351 passing
- Production: Stable and fully operational

**Branch**: `main` (clean slate for new work)

## Quick Reference

**Master roadmap**: `/docs/MOCKUP_INTEGRATION_ASSESSMENT.md`
- Complete 34-phase history with PR links (#159-#198, #201-#205)
- Bundle size tracking across all phases
- Test coverage metrics

**Recent session docs**:
- `/CODE_REVIEW_IMPROVEMENTS_2025-10-15.md` - Semantic HTML, memoization, JSDoc
- `/BUGFIX_SESSION_2025-10-15_PART2.md` - Three critical bugs (PR #205)
- `/BUGFIX_SESSION_2025-10-15.md` - Loading/tag bugs (PR #201)
- `/UX_IMPROVEMENTS_SESSION_2025-10-15.md` - UI polish (PR #202)

**Tech**: React 18 + Vite 7 + Tailwind + Firebase + TanStack Query

## What I Need

**[Option 1]** Suggest next improvement
- Review codebase for optimization opportunities
- Identify polish/refinement areas
- Propose next feature from roadmap or new ideas

**[Option 2]** Implement specific feature
- I'll tell you what I want to build
- You review existing patterns
- Create implementation plan with TodoWrite
- Build, test, and document

**[Option 3]** Production support
- Fix bugs or Sentry errors
- Address performance issues
- Resolve deployment problems

## Please

1. Read `/docs/MOCKUP_INTEGRATION_ASSESSMENT.md` for full context
2. Suggest best next step OR wait for my request
3. Create implementation plan with TodoWrite for multi-step tasks
4. Work efficiently - test builds, update docs, create PRs

## Important Notes

### Always Read Before Edit
Use Read tool before any file modifications. Follow existing design patterns.

### Key Patterns
- **Real-time data**: TanStack Query + Firestore `onSnapshot`
- **Mutations**: Optimistic updates for instant UX
- **Dark mode**: Tailwind `dark:` prefix (100% coverage)
- **Accessibility**: WCAG 2.1 AA compliance required
- **Multi-tenancy**: All queries scoped to `clientId`
- **Error handling**: Try-catch-finally for async ops, user feedback via toasts

### Tech Stack Essentials
```
Frontend: React 18 + Vite 7
Styling: Tailwind CSS + dark mode
Backend: Firebase (Firestore, Auth, Storage)
State: TanStack Query (server state)
Forms: React Hook Form + Zod
Icons: Lucide React
Testing: Vitest + React Testing Library
```

### Project Structure
```
src/
├── components/      # React components
│   ├── ui/         # Reusable UI components
│   └── [feature]/  # Feature-specific components
├── context/        # React Context providers
├── hooks/          # Custom hooks (useFirestoreQuery, etc.)
├── lib/            # Utilities and helpers
└── pages/          # Route pages
```

### Development Workflow
1. **Branches**: `feat/[description]` OR `fix/[description]`
2. **Testing**: Write tests before/during implementation
3. **Commits**: Conventional commits (`feat:`, `fix:`, `test:`, `docs:`)
4. **Documentation**: Update session docs in project root
5. **CI**: All tests must pass (9 skip in CI environment, pass locally)

### Bundle Management
- Current: 251.49 kB gzipped
- Code splitting by route with React.lazy()
- Monitor bundle size in roadmap after changes

### Testing Notes
- Coverage target: Comprehensive feature coverage
- 9 tests skip in CI (ProjectScopeContext, useImageLoader, LocationsPage, ShotEditModal.portal, SearchCommand)
- Run `npm test` locally before pushing
- All PRs require passing tests

## Recent Context

**Just Completed - October 15, 2025**:

### Bug Fixes (PRs #201-205 - All Merged)
- ✅ PR #205: Date timezone fixes (Oct 17 displaying correctly), colourway loading (legacy SKU support), z-index positioning, code review improvements
- ✅ PR #204: projectsPath function fixes for project updates
- ✅ PR #203: Product colourway deleted field schema
- ✅ PR #202: UX improvements (dropdowns, buttons, cards)
- ✅ PR #201: Critical loading bugs (Product Edit Modal, Planner Page, Shot Edit tags)

**Current State**:
- Modern top navigation (horizontal, responsive, search, quick actions, avatars, breadcrumbs, notifications)
- Complete dark mode (100% coverage, theme toggle, localStorage)
- Premium animations (modals, buttons, dropdowns, micro-interactions)
- Performance optimized (TanStack Query caching, virtualized lists, debounced search)
- Comprehensive features (tags, bulk ops, CSV export, drag & drop upload, filter presets)
- **Production-ready** with all critical bugs fixed

**Known Issues**:
- 9 integration tests skip in CI environment (pass locally)
- No major bugs or blockers

## Communication Style

- **Be concise**: Acknowledge → Plan → Execute
- **Use TodoWrite**: Track multi-step work
- **Update todos**: Mark complete as you progress
- **Reference docs**: Link to docs, don't duplicate
- **Ask when unclear**: Clarify before implementing

## Ready

I'm ready to continue. Tell me what you'd like to work on, or I can suggest next steps after reviewing the codebase.
