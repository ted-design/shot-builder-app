# Shot Builder App - Continuation Prompt

I'm continuing work on my Shot Builder Firebase app. **Phase 16.3 (Notification System)** just completed and deployed to production.

## Current Status

**34/34 phases complete** ✅

- Latest: Phase 16.3 - Real-time notification system with bell icon, badge, and dropdown panel
- Production fix: Chunk loading error auto-recovery (PR #200 - deployed)
- Bundle size: 251.08 kB gzipped
- Tests: 253 passing (9 skip in CI environment)
- Production: Stable and live

**Branch**: `main` (up to date)

## Quick Reference

**Master roadmap**: `/docs/MOCKUP_INTEGRATION_ASSESSMENT.md`
- Complete phase history with PR links
- Bundle size tracking across all phases
- Test coverage metrics

**Latest session**: `/PHASE16.3_NOTIFICATIONS_SESSION.md`
- Real-time notification system implementation
- NotificationBell and NotificationPanel components
- TanStack Query + Firestore onSnapshot integration
- 69 comprehensive tests added

**Tech**: React + Vite + Tailwind + Firebase + TanStack Query

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
1. **Branches**: `feat/phase[X]-[description]` OR `fix/[description]`
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
- Current: 251.08 kB gzipped
- Code splitting by route with React.lazy()
- Monitor bundle size in roadmap after changes

### Testing Notes
- Coverage target: Comprehensive feature coverage
- 9 tests skip in CI (ProjectScopeContext, useImageLoader, LocationsPage, ShotEditModal.portal, SearchCommand)
- Run `npm test` locally before pushing
- All PRs require passing tests

## Recent Context

**Just Completed**:
- Phase 16.3: Notification system (bell icon, badge, dropdown, real-time updates)
- Production fix: Chunk loading auto-recovery for stale JavaScript issues
- Deployed to production: All features live and stable

**Current Work - UI/UX Bug Fixes** (2025-10-15):
User reported 9 UI/UX issues via annotated screenshots. Fixing bugs one at a time with Option A approach.

**Bug #1 - Product Edit Modal Infinite Loading** ✅ FIXED
- **File**: `/src/pages/ProductsPage.jsx:692-719`
- **Root Cause**: `loadFamilyForEdit` lacked error handling - if Firestore query failed, `setEditLoading(false)` never executed
- **Fix Applied**: Added try-catch-finally block to ensure loading state always clears
- **Error Handling**: Added toast notification for user feedback on failures
- **Build Status**: ✅ Passed (9.35s)

**Bug #2 - Planner Page Infinite Loading** ✅ FIXED
- **File**: `/src/pages/PlannerPage.jsx:1112-1142`
- **Root Cause**: Local `shotsLoading` state only cleared when legacy shots `onSnapshot` fired. If subscription failed silently or collection didn't exist, loading state stayed true forever.
- **Fix Applied**: Added 5-second safety timeout that forces `setShotsLoading(false)` if legacy shots don't load
- **Safety**: Timeout is cleared on cleanup to prevent memory leaks
- **Build Status**: ✅ Passed (9.24s)

**Bug #3 - Tags Not Saving in Shot Edit Modal** ✅ FIXED
- **File**: `/src/lib/shotDraft.js:17-47, 49-59`
- **Root Cause**: `shotDraftSchema` missing `tags` field - tags were stripped during Zod validation when saving shots
- **Fix Applied**: Added `tags` field to schema with proper structure (id, label, color) and to `initialShotDraft`
- **Schema**: `tags: z.array(z.object({ id: z.string(), label: z.string(), color: z.string() })).optional()`
- **Build Status**: ✅ Passed (9.30s)

**Remaining Issues**:
- UX: Quick Actions dropdown z-index/positioning
- UX: Shots page button layout and spacing
- UX: Project cards spacing and active project highlighting
- UX: Dark mode text contrast issues
- Feature: Rich text editor enhancements

**Current State**:
- Modern top navigation (horizontal, responsive, search, quick actions, avatars, breadcrumbs, notifications)
- Complete dark mode (100% coverage, theme toggle, localStorage)
- Premium animations (modals, buttons, dropdowns, micro-interactions)
- Performance optimized (TanStack Query caching, virtualized lists, debounced search)
- Comprehensive features (tags, bulk ops, CSV export, drag & drop upload, filter presets)

**Known Issues**:
- 9 integration tests skip in CI environment (pass locally)
- Monitor Sentry for chunk error recovery metrics (auto-reload messages expected as users update)

## Communication Style

- **Be concise**: Acknowledge → Plan → Execute
- **Use TodoWrite**: Track multi-step work
- **Update todos**: Mark complete as you progress
- **Reference docs**: Link to docs, don't duplicate
- **Ask when unclear**: Clarify before implementing

## Example Flow

**User**: "Add PDF export to shots"

**Your response**:
1. ✅ Create todos (Research, Design, Implement, Test, Document)
2. 📖 Check for existing PDF patterns (found PlannerExportModal, PullExportModal)
3. 💡 Propose approach using react-pdf library (already in bundle)
4. 🛠️ Implement systematically, updating todos
5. 📝 Document in session file

## Ready

I'm ready to continue. Tell me what you'd like to work on, or I can suggest next steps after reviewing the codebase.
