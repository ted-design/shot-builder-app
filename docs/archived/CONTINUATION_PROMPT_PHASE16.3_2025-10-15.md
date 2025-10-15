# Shot Builder App - Continuation Prompt

I'm continuing UI/UX improvements for my Shot Builder Firebase app. **Phase 16.3 (Notification System)** just completed and merged to production.

## Current Status

**34/34 phases complete** ✅

- All mockup integration phases complete (Phase 1 - Phase 16.3)
- 322 tests passing (313 in CI, 9 skipped due to CI environment issues)
- Bundle size: 251.08 kB gzipped
- Production deployment: Live and stable

## Quick Reference

**Master Roadmap**: `/docs/MOCKUP_INTEGRATION_ASSESSMENT.md`
- Complete phase history with PR links
- Bundle size tracking
- Test coverage metrics

**Latest Session**: `/PHASE16.3_NOTIFICATIONS_SESSION.md`
- Real-time notification system implementation
- TanStack Query + Firestore onSnapshot integration
- 69 new tests added (utilities + components)
- Firestore security rules and indexes

**Recent PRs**: #159-#199 (all merged)

## What I Need

### Option 1: Polish & Refinement
If you identify areas needing improvement:
- Performance optimization opportunities
- Accessibility enhancements
- Test coverage gaps
- UI/UX consistency issues

### Option 2: New Feature
If I request a new feature:
- Review existing patterns in codebase
- Follow established architecture (see Important Notes)
- Maintain test coverage standards
- Update documentation

### Next Phase Planning
Help me decide what to work on next by:
1. Reviewing `/docs/MOCKUP_INTEGRATION_ASSESSMENT.md` for potential improvements
2. Analyzing codebase for optimization opportunities
3. Discussing new feature ideas if I propose them

## Important Notes

### Tech Stack
- **Frontend**: React 18 + Vite + Tailwind CSS
- **Backend**: Firebase (Firestore, Storage, Auth)
- **State**: TanStack Query (React Query) for server state
- **Forms**: React Hook Form + Zod validation
- **Icons**: Lucide React
- **Testing**: Vitest + React Testing Library

### Key Patterns
- **Real-time data**: Use TanStack Query with Firestore `onSnapshot`
- **Mutations**: Optimistic updates for instant UX
- **Dark mode**: Tailwind's dark: prefix (bg-white dark:bg-gray-900)
- **Accessibility**: WCAG 2.1 AA compliance required
- **Multi-tenancy**: All queries scoped to `clientId`

### File Organization
```
src/
├── components/       # React components
│   ├── layout/      # Navigation, sidebars, layouts
│   ├── ui/          # Reusable UI components
│   └── [feature]/   # Feature-specific components
├── context/         # React Context (Auth, ProjectScope, Theme)
├── hooks/           # Custom hooks (useFirestoreQuery, useFirestoreMutations)
├── lib/             # Utilities (firebase, helpers, validators)
└── pages/           # Route pages
```

### Development Workflow
1. **Branch naming**: `feat/phase[X]-[description]`
2. **Testing**: Write tests BEFORE implementation when possible
3. **Commits**: Use conventional commits (feat:, fix:, test:, docs:)
4. **Documentation**: Update session docs in project root
5. **CI**: Tests must pass locally; 9 integration tests skip in CI (known issue)

### Firebase Setup
- **Security rules**: All collections have user/client scoping
- **Indexes**: Required for compound queries (see `firestore.indexes.json`)
- **Storage**: Images stored in `clients/{clientId}/[collection]/`
- **Permissions**: Always check `clientId` matches and user is authenticated

### Testing Guidelines
- **Coverage target**: Aim for comprehensive feature coverage
- **Test types**: Unit (utilities), Integration (hooks), Component (UI)
- **Mock strategy**: Mock Firebase calls, test component logic
- **CI issues**: 9 tests skip in CI due to environment (see `vitest.config.ts`)
  - ProjectScopeContext, useImageLoader, LocationsPage, ShotEditModal.portal, SearchCommand

### Bundle Management
- **Current**: 251.08 kB gzipped
- **Strategy**: Code splitting by route, lazy loading where appropriate
- **Monitor**: Bundle size tracked in roadmap document

### Code Quality
- **Linting**: ESLint with React + TypeScript rules
- **Formatting**: Prettier (configured in project)
- **Types**: Use PropTypes or JSDoc for prop documentation
- **Comments**: Document complex logic, avoid obvious comments

## Production Monitoring

**Sentry**: Monitor for production errors
- Check for Firebase import issues (recent `collection is not defined` error)
- Verify errors resolved after fresh deployments
- Report critical issues immediately

**Firebase Console**: Check for
- Query performance (indexes required?)
- Security rule violations
- Storage quota usage

## Communication Style

- **Be concise**: Acknowledge tasks, outline approach, execute
- **Use todos**: Track multi-step tasks with TodoWrite tool
- **Show progress**: Update todos as you complete steps
- **Reference docs**: Point to relevant docs instead of duplicating info
- **Ask when unclear**: If requirements are ambiguous, ask before proceeding

## Example Interaction

**User**: "Add a feature to export shots to PDF"

**Your response**:
1. Create todo list (Research PDF libraries, Design export format, Implement export function, Add UI trigger, Write tests)
2. Research existing patterns (check for similar export features)
3. Propose approach (use jsPDF or react-pdf, export format details)
4. Get user approval if needed
5. Implement systematically, updating todos as you go
6. Document in session file

## Recent Context

**Just completed**: Phase 16.3 - Notification System
- NotificationBell component with unread badge
- NotificationPanel dropdown with real-time updates
- Mark as read and dismiss functionality
- Full dark mode and accessibility support
- 69 new tests (26 utilities, 17 NotificationBell, 26 NotificationPanel)

**Known issues**:
- 9 integration tests skip in CI (environmental, pass locally)
- Previous Sentry error (`collection is not defined`) - monitor for resolution

**Production status**: ✅ All features deployed and stable

## Ready to Continue

I'm ready to work on the next phase. I can:
- Suggest improvements based on codebase analysis
- Implement new features you request
- Fix bugs or production issues
- Optimize performance or bundle size
- Enhance accessibility or test coverage

What would you like to work on next?
