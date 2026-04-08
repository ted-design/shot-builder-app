# CHECKPOINT — Sprint S26: ALL PHASES COMPLETE (2026-04-08)

## Build clean. Lint zero. 160 test files / 1847 tests pass.

## Sprint S26 — All Phases Complete
- [x] Phase 1: Launch date resolution fix
- [x] Phase 2: Shots table reorder + column consolidation
- [x] Phase 3: Shot detail UX overhaul (6 workstreams)
- [x] Phase 4: Shots page visual polish (3 workstreams)

## Phase 4 Detail — Completed
- [x] WS4a: Inline filter dropdowns — Status + Missing Popovers with live counts in toolbar. Insights bar removed. "More filters" button for advanced conditions. Compact "Showing X of Y" inline counter.
- [x] WS4b: Renumber in Sort dropdown — SelectSeparator + action SelectItem. Disabled when filters active (collision guard).
- [x] WS4c: Design system audit — zero hardcoded hex colors, zero text-[Npx] patterns in modified files.

## What's Next
- Sprint S26 PR — merge all phases
- Recreate existing casting share links (old shares have 12-image cap)
- E2E auth emulator fix (pre-existing)

## Critical File State
- `src-vnext/features/shots/components/ShotListToolbar.tsx`: Inline Status/Missing Popover dropdowns, Renumber in sort, Showing counter, removed Filters/Display buttons
- `src-vnext/features/shots/components/ShotListPage.tsx`: Removed insights bar, removed ShotListDisplaySheet rendering, wired inline filter props + extraFilterCount
- `src-vnext/features/shots/components/ShotListDisplaySheet.tsx`: File kept, no longer imported anywhere
- `src-vnext/features/shots/components/ShotDetailPage.tsx`: Layout restructured, breadcrumb, back button, deleted guard
- `src-vnext/features/shots/components/TalentPicker.tsx`: Casting board grouping
- `src-vnext/features/shots/components/LocationPicker.tsx`: projectId prop + grouped sections
- `src-vnext/features/shots/components/ProductAssignmentPicker.tsx`: Enhanced rows, Details button
- `src-vnext/features/shots/components/ProductQuickViewPopover.tsx`: NEW — side=left popover
- `src-vnext/features/shots/components/ProductSummaryStrip.tsx`: NEW — deduped product circles strip
