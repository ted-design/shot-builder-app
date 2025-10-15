# Shot Builder App - Continuation Prompt

I'm continuing work on my Shot Builder Firebase app. **All 34 phases complete + recent bug fixes deployed to production.**

## Current Status

**34/34 phases complete + production bug fixes** ✅

- Latest: Additional bug fixes merged (PR #205)
- Bug fixes: Date timezone, colourway loading, dropdown z-index
- Bundle: 251.49 kB gzipped
- Tests: 351 passing, 39 tests in ProjectCard (9 skip in CI environment)
- Production: Stable and fully operational

**Branch**: `main` (up to date, clean slate for new work)

## Quick Reference

**Master roadmap**: `/docs/MOCKUP_INTEGRATION_ASSESSMENT.md`
- Complete 34-phase history with PR links
- Bundle size tracking across all phases
- Test coverage metrics
- Recent bug fix documentation

**Recent session docs**:
- `/BUGFIX_SESSION_2025-10-15_PART2.md` - Date timezone, colourways, z-index (PR #205)
- `/BUGFIX_SESSION_2025-10-15.md` - Three critical bugs fixed (loading, tags)
- `/UX_IMPROVEMENTS_SESSION_2025-10-15.md` - UI polish (dropdowns, buttons, cards)
- `/PR_202_CODE_REVIEW_FIXES.md` - Code review feedback addressed
- `/PHASE16.3_NOTIFICATIONS_SESSION.md` - Real-time notification system

**Tech**: React 18 + Vite 7 + Tailwind + Firebase + TanStack Query

## What I Need

**[Option 1]** Suggest next improvement
- Review codebase for optimization opportunities
- Identify polish/refinement areas
- Propose next feature based on roadmap

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
- **Dark mode**: Tailwind `dark:` prefix (e.g., `dark:bg-slate-900`)
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
5. **CI**: 9 tests skip in CI (environmental, pass locally)

### Firebase Notes
- Security rules enforce `clientId` scoping
- Indexes required for compound queries (`firestore.indexes.json`)
- Storage paths: `clients/{clientId}/[collection]/`
- Always verify user authentication and client ownership

### Bundle Management
- Current: 251.50 kB gzipped
- Code splitting by route with React.lazy()
- Monitor bundle size in roadmap after changes

### Testing Notes
- Coverage target: Comprehensive feature coverage
- 9 tests skip in CI (ProjectScopeContext, useImageLoader, LocationsPage, ShotEditModal.portal, SearchCommand)
- Run `npm test` locally before pushing
- All PRs require passing tests

## Recent Context

**Just Completed - October 15, 2025**:

### Bug Fixes Part 2 (PR #205 - ✅ Merged)
**Documentation**: `/BUGFIX_SESSION_2025-10-15_PART2.md`

- ✅ Fixed project date timezone issue (Oct 17 showing as Oct 16)
- ✅ Fixed colourways not loading in product edit modal (legacy SKUs)
- ✅ Fixed dropdown z-index positioning (menus behind headers)
- ✅ Added comprehensive date validation and test coverage
- ✅ 10 new tests for date formatting, 39 total tests for ProjectCard

### Bug Fixes Part 1 (PR #201 - ✅ Merged)
**Documentation**: `/BUGFIX_SESSION_2025-10-15.md`

- ✅ Product Edit Modal infinite loading (missing error handling)
- ✅ Planner Page infinite loading (legacy shots subscription timeout)
- ✅ Tags not saving in Shot Edit Modal (missing schema field)

### Product Colourway Fix (PR #203 - ✅ Merged)
- ✅ Fixed missing `deleted` field when creating new SKUs during product edits
- ✅ Prevented invisible colourways and duplicate creation

### UX Improvements (PR #202 - ✅ Merged)
**Documentation**: `/UX_IMPROVEMENTS_SESSION_2025-10-15.md`

- ✅ Fixed Quick Actions and Notification dropdowns z-index
- ✅ Fixed Shots page button cramming on mobile
- ✅ Enhanced Project Card active highlighting
- ✅ Comprehensive dark mode improvements

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

## Example Flow

**User**: "Add duplicate detection for products"

**Your response**:
1. ✅ Create todos (Research, Design, Implement, Test, Document)
2. 📖 Check existing product patterns (found ProductsPage, validation)
3. 💡 Propose approach using style number matching
4. 🛠️ Implement systematically, updating todos
5. 📝 Document in session file

## Ready

I'm ready to continue. Tell me what you'd like to work on, or I can suggest next steps after reviewing the codebase.
