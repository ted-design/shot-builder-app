# Shot Builder - Continuation Prompt

I'm continuing UI/UX improvements for my Shot Builder Firebase app. Phase 17A (Comments & Mentions Collaboration) just completed.

## Current Status

**35/35 phases done** ✅
- Latest: Phase 17A - Comments & Mentions Collaboration System (PR #209 - merged)
- Recent bug fixes: PRs #207 (planner loading, z-index, editor dark mode), #210 (z-index standardization)
- Production cleanup: Current branch `refactor/production-code-cleanup` (clean status)
- Next: Phase 17B (Activity Feed) OR custom improvements

## Branch

`main` (or create new feature branch from `main`)

## Quick Reference

**Master roadmap**: `/docs/MOCKUP_INTEGRATION_ASSESSMENT.md`
**Latest session**: `/PHASE17A_COMMENTS_MENTIONS_SESSION.md`

**Tech Stack**:
- React 18 + Vite 6 + Tailwind CSS 3
- Firebase (Firestore, Auth, Storage)
- TanStack Query v5 (intelligent caching, 50-80% Firestore read reduction)
- react-window (list virtualization)
- fuse.js (fuzzy search)
- date-fns (timestamp formatting)

## What I Need

**Option 1**: Phase 17B - Activity Feed & Timeline
- Project-level activity logging (shot updates, comments, status changes)
- Timeline component with filtering (type, user, date range)
- Real-time updates via TanStack Query
- 90-day retention with cleanup
- Estimated effort: 6-8 hours

**Option 2**: Phase 17C - Enhanced Public Sharing
- Project sharing with public links (like PullPublicViewPage)
- Per-link permissions (view, comment, full access)
- Expiring share tokens
- External collaborator support
- Estimated effort: 6-8 hours

**Option 3**: Testing & Quality Improvements
- E2E tests with Playwright
- Expand component test coverage
- Visual regression testing
- Performance profiling and benchmarks

**Option 4**: Mobile Optimization
- Responsive design refinements
- Touch gesture improvements
- Mobile-specific UI patterns
- Progressive Web App (PWA) capabilities

**Option 5**: I'll specify a custom improvement
- Bug fix, feature enhancement, or refactor
- You propose the implementation plan

## Your Approach

Please:

1. **RAG Integration - Single Source of Truth**:
   - BEFORE any implementation work, use the `doc-searcher` sub-agent to query the RAG server
   - RAG endpoint: `http://127.0.0.1:8000`
   - Auth header: `X-API-Key: claude-code-rag-key-2025`
   - Collection: `shot_builder_knowledge_base`
   - Query relevant patterns/implementations (top_k: 6-12 results)
   - Summarize findings briefly - reference docs, don't embed large code blocks

2. **Sub-Agent Orchestration** (select 3-5 agents based on task):
   - **Feature/Phase Implementation**: Staff Engineer, shadcn Implementation Builder, Code Reviewer, Git Commit Helper
   - **Refactor/Performance**: Code Refactorer, Senior Code Reviewer, System Architect
   - **UX/Polish**: Premium UX Designer, shadcn Requirements Analyzer, shadcn Component Researcher
   - **Strategy/Roadmap**: Product Strategy Advisor, System Architect, Staff Engineer
   - Protocol: Query RAG first → Summarize → Agent outputs tagged as `[AgentName]: <recommendation>`

3. **Implementation Plan**:
   - Create detailed plan with **TodoWrite** (break down into tasks)
   - Read existing patterns via RAG before editing
   - Follow established architecture and conventions
   - Test builds incrementally
   - Update documentation

4. **Quality Standards**:
   - All 351 tests must pass (zero regressions)
   - WCAG 2.1 AA compliance required
   - Monitor bundle size (currently 251.92 kB gzipped)
   - Build time target: <10s
   - Dark mode compatibility required
   - Security: validate inputs, prevent injection attacks

5. **Deliverables**:
   - Working implementation with tests
   - Session documentation (if significant work)
   - Pull request with proper description
   - Update `/docs/MOCKUP_INTEGRATION_ASSESSMENT.md` with new phase

## Important Principles

**RAG-First Development**:
- Always query RAG before implementing features
- Use RAG to find similar patterns, avoid reinventing
- Reference documentation paths, don't copy-paste large blocks
- ~40% token savings with lean prompts + RAG lookups

**RAG Server Management**:
- Scripts location: `/Users/tedghanime/Documents/App Development/A-simlified-RAG-tool-for-Claude-Code-context-management-main`
- Commands: `./rag_server.sh status|start|stop|health|logs`
- Preflight check: Run `./rag_server.sh health` (expect "OK")
- If unhealthy: Run `./rag_server.sh restart`, wait 3-5s, re-check
- Verify stats: `GET /stats` with X-API-Key (expect ~1,216 docs in `shot_builder_knowledge_base`)

**Development Workflow**:
- Read files before editing (use Read tool)
- Follow existing patterns from RAG queries
- Keep reasoning concise and forward-focused
- No large inline code dumps - reference file paths instead
- Test incrementally - don't batch all testing at the end

**Code Quality**:
- Zero breaking changes unless explicitly required
- Backwards compatibility is critical
- Performance optimization is ongoing priority
- Accessibility (WCAG 2.1 AA) is non-negotiable
- Security validation on all user inputs

## Project Health Snapshot

**Status**: ✅ Production Ready

**Features**:
- 🎨 Modern UI with top navigation bar (horizontal, mobile responsive)
- 🔍 Advanced search (Cmd+K, fuzzy matching, 80-90% faster)
- 💾 Filter presets (save/load/manage, 20 max per page)
- 🏷️ Complete tag system (color-coded, bulk operations, centralized management)
- 💬 Real-time collaboration (comments, @mentions, notifications)
- 🌙 Complete dark mode (100% coverage, theme toggle, localStorage persistence)
- 🎭 Premium animations (modals, buttons, dropdowns, micro-interactions)
- ⚡ Performance optimized (TanStack Query caching, list virtualization, debounced search)
- 📊 Universal CSV/Excel export (all major pages)
- 📤 Batch image upload (drag & drop, auto-compression)
- ♿ WCAG 2.1 AA compliant (keyboard navigation, ARIA labels, focus management)
- 🧪 351 tests passing
- 📦 251.92 kB gzipped bundle

**Recent Work**:
- Phase 17A: Comments & Mentions Collaboration (PR #209 ✅)
- Bug fixes: Planner loading, z-index standardization, editor dark mode (PRs #207, #210 ✅)
- Production cleanup: Dependencies, debug code removal

**Metrics**:
- Build time: ~9-10s
- Bundle size: 251.92 kB gzipped (optimized)
- Test coverage: 351 tests, all passing
- Performance: 60 FPS scrolling with 10,000+ items
- Firestore reads: 50-80% reduction via intelligent caching
- WCAG: 2.1 AA compliant

**Next Opportunities** (from roadmap):
- Phase 17B: Activity Feed & Timeline
- Phase 17C: Enhanced Public Sharing
- Comment enhancements (threaded replies, reactions, attachments)
- Testing infrastructure (E2E, visual regression)
- Mobile optimization (PWA, touch gestures)
- Performance profiling and benchmarks

## Notes

- All 35 mockup-inspired phases complete 🎉
- Production-ready with comprehensive feature set
- Clean architecture, solid test coverage
- Zero critical issues or tech debt
- Ready for production deployment OR next feature phase

**RAG Server Setup** (required before use):

The RAG server has been partially set up but needs configuration before use:

1. **Issue Identified**: Embedding function mismatch in existing collection
   - Collection `shot_builder_knowledge_base` exists with `default` embedding function
   - RAG system expects `sentence_transformer` embedding function
   - Server fails to start due to this conflict

2. **Quick Fix** (run these commands):
```bash
cd /Users/tedghanime/Documents/App\ Development/A-simlified-RAG-tool-for-Claude-Code-context-management-main

# Delete and recreate collection with correct embedding function
python main.py reset-collection shot_builder_knowledge_base

# Re-index the codebase
python main.py index /Users/tedghanime/Documents/App\ Development/Shot\ Builder\ Development/shot-builder-workdir/shot-builder-app

# Start the server
./rag_server.sh start

# Verify health
./rag_server.sh health
```

3. **Expected Stats** (after successful setup):
   - Collection: `shot_builder_knowledge_base`
   - Documents: ~1,216 (± drift after re-index)
   - Endpoint: http://127.0.0.1:8000
   - Auth: `X-API-Key: claude-code-rag-key-2025`

4. **Current State**:
   - ✅ Virtual environment configured
   - ✅ Dependencies installed
   - ✅ Package installed in editable mode
   - ⚠️ Collection needs reset due to embedding function mismatch
   - ❌ Server not running

**Note**: Until RAG server is fixed, use direct file reads via `Read` tool instead of `doc-searcher` agent.

---

Ready when you are! Let me know which direction you'd like to go.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
