# Shot Builder - Continuation Prompt

I'm continuing UI/UX improvements for my Shot Builder Firebase app. Phase 12.9 just completed - comprehensive list virtualization across ProjectsPage and ProductsPage.

## Current Status

**Phase 12.9.1 Complete** ✅ (Deferred items addressed)
- 21 phases complete total (+ Phase 12.9.1 polish)
- Branch: `feat/phase12.9-comprehensive-virtualization`
- All 180 tests passing
- Build time: 8.76s
- Bundle size: 286.73 kB gzipped (unchanged)

**Latest Work**:
- Virtualized ProjectsPage grid with VirtualizedGrid
- Virtualized ProductsPage gallery view with VirtualizedGrid
- Preserved stagger animations for small lists (<100 items)
- 98% DOM reduction for large lists (1000+ items)
- 60 FPS scrolling with 10,000+ items
- Zero bundle size impact (react-window already loaded)

**Phase 12.9.1 Improvements** ✅:
- ✅ Added configurable column support to VirtualizedGrid (columnBreakpoints prop)
- ✅ ProductsPage now uses 2-5 responsive columns (matching Tailwind classes)
- ✅ Added "Create Product" card to ProductsPage gallery (UX consistency with ProjectsPage)

## Documentation References

**Always read these first before making recommendations**:

1. **Master Roadmap**: `/docs/MOCKUP_INTEGRATION_ASSESSMENT.md`
   - Complete project history (21 phases)
   - All feature tracking and priorities
   - Performance metrics and decisions

2. **Latest Session**: `/PHASE12.9_SESSION.md`
   - Phase 12.9 implementation details
   - Performance metrics and testing
   - Technical decisions and lessons learned
   - Files modified: `/src/components/dashboard/ProjectCards.jsx`, `/src/pages/ProductsPage.jsx`

3. **Architecture Docs**:
   - Overview: `/docs/shot_builder_overview_updated.md`
   - Structure: `/docs/shot_builder_structure.md`
   - Roadmap: `/docs/shot_builder_roadmap_updated.md`
   - Guardrails: `/docs/shot_builder_guardrails.md`

## Tech Stack

**Core**:
- React 18 + Vite 6 + Tailwind CSS 3
- Firebase (Firestore, Auth, Storage)
- TanStack Query v5 (intelligent caching, 100% coverage)
- react-window (list virtualization)

**Key Libraries**:
- react-beautiful-dnd (drag-and-drop)
- recharts (analytics)
- jspdf + jspdf-autotable (PDF generation)
- lucide-react (icons)

**Testing**: Vitest + React Testing Library (180 tests, all passing)

## Key Architectural Decisions

### Data Caching (TanStack Query)
- **100% coverage** across all major pages (Phase 12.5-12.8)
- 50-80% Firestore read reduction
- Intelligent invalidation on mutations
- Background refetching for stale data
- Pattern: `useClientData()` hooks for each data type

### List Virtualization (react-window)
- **Threshold-based**: Only virtualize when 100+ items
- **VirtualizedList**: Single-column lists (ShotsPage)
- **VirtualizedGrid**: Multi-column grids (ShotsPage, ProjectsPage, ProductsPage)
- Preserves stagger animations for small lists (<100 items)
- 98% DOM reduction for large lists (1000+ items)
- Zero performance impact for typical usage

### Soft Deletes
- All entities use `deleted` + `deletedAt` flags
- Preserves data integrity and audit trails
- Admin-only hard delete capability
- Images preserved on soft delete

### Tag System
- Client-specific tags with color coding
- Batch tag operations with conflict resolution
- Tag management UI for admins/producers
- Auto-lowercase normalization

### Responsive Design
- Mobile-first approach
- Tailwind breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px), 2xl (1536px)
- WCAG 2.1 AA compliance
- Touch-friendly targets (min 44px)

## Development Workflow

**Before making changes**:
1. Read `/docs/MOCKUP_INTEGRATION_ASSESSMENT.md` for full context
2. Read relevant session docs (e.g., `/PHASE12.9_SESSION.md`)
3. Check git status and current branch
4. Review existing tests related to your work

**During development**:
1. Create feature branch: `feat/phase12.X-description`
2. Use `TodoWrite` to track implementation steps
3. Run tests frequently: `npm test`
4. Run builds to check bundle size: `npm run build`
5. Always read files before editing (use `Read` tool)

**After implementation**:
1. Verify all 180 tests pass
2. Check production build succeeds
3. Document changes in session file (e.g., `/PHASE12.X_SESSION.md`)
4. Update `/docs/MOCKUP_INTEGRATION_ASSESSMENT.md` if needed
5. Create PR with descriptive title and summary

**Git workflow**:
```bash
# Create feature branch
git checkout -b feat/phase12.X-description

# After work is done
npm test  # Ensure all tests pass
npm run build  # Verify production build

# Commit changes
git add .
git commit -m "feat: Phase 12.X - Description"

# Push and create PR
git push -u origin feat/phase12.X-description
gh pr create --title "Phase 12.X: Description" --body "..."
```

## Common Patterns

### Custom Hooks (TanStack Query)
```javascript
// Pattern: useClientData() hooks
export function useProjects(clientId) {
  return useQuery({
    queryKey: ['projects', clientId],
    queryFn: () => fetchProjects(clientId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// Mutation with invalidation
export function useUpdateProject(clientId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data) => updateProject(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['projects', clientId]);
    },
  });
}
```

### Virtualized Lists
```javascript
// Small lists: Standard rendering with animations
// Large lists (100+): Virtualized rendering

<VirtualizedGrid
  items={items}
  renderItem={(item, index, isVirtualized) => {
    const content = <Card {...item} />;
    if (!isVirtualized) {
      return <div className="animate-fade-in opacity-0" style={getStaggerDelay(index)}>{content}</div>;
    }
    return content;
  }}
  itemHeight={240}
  gap={16}
  className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
  threshold={100}
/>
```

### Soft Delete Pattern
```javascript
// Soft delete
await updateDoc(docRef, {
  deleted: true,
  deletedAt: Date.now(),
});

// Query excludes deleted items
const activeItems = items.filter(item => !item.deleted);
```

## Next Steps

**Ready to merge**:
- PR #185: Phase 12.9 - Comprehensive List Virtualization

**Potential priorities** (see roadmap for full list):
- Address deferred UX improvements from Phase 12.9
- Planner enhancements (timeline view, capacity planning)
- Pulls advanced workflows (sharing, templates, analytics)
- Products bulk operations (batch import, templates)
- New features or optimizations

**Your approach**:
1. Read the master roadmap first
2. Suggest the best next step based on project state
3. Create implementation plan with TodoWrite
4. Work efficiently - test builds, update docs, create PR

## Important Notes

- **Always read files before editing** - Use `Read` tool first
- **Follow existing patterns** - Check similar implementations
- **Test thoroughly** - All 180 tests must pass
- **Document changes** - Create session docs for significant work
- **Zero regressions** - Maintain backwards compatibility
- **Performance matters** - Check bundle size and build time
- **Accessibility first** - WCAG 2.1 AA compliance required

## Project Health

✅ **All systems operational**:
- 🎨 Modern UI design system
- ♿ WCAG 2.1 AA accessibility
- ⚡ Performance optimized (286.73 kB gzipped)
- 🏷️ Complete tag system
- 📦 Comprehensive bulk operations
- 📄 PDF bundle optimization
- 💾 Intelligent caching (100% coverage)
- 📜 List virtualization (major views)
- ✅ 180 tests passing
- 🚀 Production ready

**Recent PRs**:
- #180, #181: Phase 12.5 - TanStack Query Data Caching (✅ Merged)
- #182: Phase 12.6 - Complete TanStack Query Migration (✅ Merged)
- #183: Phase 12.7 - List Virtualization (✅ Merged)
- #184: Phase 12.8 - Complete PlannerPage TanStack Migration (✅ Merged)
- #185: Phase 12.9 - Comprehensive List Virtualization (✅ Ready)
