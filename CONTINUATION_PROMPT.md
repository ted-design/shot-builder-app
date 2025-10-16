# Shot Builder - Continuation Prompt (Lean)

I'm continuing UI/UX improvements for my Shot Builder Firebase app. Phase 17A (Comments & Mentions) just completed.

## Current Status: 35/35 phases done ✅

- **Latest**: Phase 17A - Comments & Mentions Collaboration System (PR #209 merged)
- **Recent**: Bug fixes (PRs #207, #210), production cleanup
- **Next**: Phase 17B (Activity Feed) OR custom improvements

## Branch

`main` (or create new from `main`)

## Quick Reference

- **Roadmap**: `/docs/MOCKUP_INTEGRATION_ASSESSMENT.md`
- **Latest Session**: `/PHASE17A_COMMENTS_MENTIONS_SESSION.md`
- **Tech**: React 18 + Vite 6 + Tailwind + Firebase + TanStack Query v5

## What I Need

**Option 1**: Phase 17B - Activity Feed & Timeline
- Project-level activity logging (shot updates, comments, status changes)
- Timeline component with filtering
- Real-time updates via TanStack Query
- 90-day retention with cleanup
- Estimated: 6-8 hours

**Option 2**: Phase 17C - Enhanced Public Sharing
- Project sharing with public links
- Per-link permissions (view, comment, full)
- Expiring share tokens
- External collaborator support
- Estimated: 6-8 hours

**Option 3**: Testing & Quality
- E2E tests (Playwright)
- Visual regression testing
- Performance profiling

**Option 4**: Mobile Optimization
- Responsive refinements
- Touch gesture improvements
- PWA capabilities

**Option 5**: Custom improvement (I'll specify)

## Your Approach

Please:

1. **RAG Integration** (Single Source of Truth):
   - Query RAG BEFORE any implementation: `http://127.0.0.1:8000/search`
   - Auth: `X-API-Key: claude-code-rag-key-2025`
   - Collection: `shot_builder_knowledge_base`
   - Top_k: 6-12 results
   - Summarize findings - reference paths, don't embed code

2. **Sub-Agent Orchestration** (select 3-5 based on task):
   - **Feature/Phase**: Staff Engineer, shadcn Builder, Code Reviewer, Git Helper
   - **Refactor/Perf**: Code Refactorer, Senior Reviewer, System Architect
   - **UX/Polish**: Premium UX Designer, shadcn Analyzer, Component Researcher
   - **Strategy**: Product Strategy Advisor, System Architect, Staff Engineer
   - **Protocol**: Query RAG → Summarize → Tag outputs `[Agent]: <recommendation>`

3. **Implementation**:
   - Create plan with **TodoWrite** (break into tasks)
   - Read patterns via RAG before editing
   - Follow established architecture
   - Test incrementally
   - Update docs

4. **Quality Standards**:
   - 351 tests passing (zero regressions)
   - WCAG 2.1 AA compliant
   - Bundle: 251.92 kB gzipped (monitor)
   - Build: <10s target
   - Dark mode compatible
   - Input validation & security

5. **Deliverables**:
   - Working implementation with tests
   - Session doc (if significant)
   - PR with description
   - Update roadmap

## Project Health

**Status**: ✅ Production Ready

**Features**:
- 🎨 Modern UI (top nav, mobile responsive)
- 🔍 Advanced search (Cmd+K, fuzzy, 80-90% faster)
- 💾 Filter presets (20 max per page)
- 🏷️ Tag system (color-coded, bulk ops, centralized)
- 💬 Collaboration (comments, @mentions, notifications)
- 🌙 Dark mode (100% coverage)
- 🎭 Premium animations
- ⚡ Performance (TanStack caching, virtualization, debouncing)
- 📊 CSV/Excel export
- 📤 Batch image upload
- ♿ WCAG 2.1 AA
- 🧪 351 tests passing
- 📦 251.92 kB gzipped

**Metrics**:
- Build: ~9-10s
- Tests: 351 passing
- Performance: 60 FPS with 10k+ items
- Firestore: 50-80% read reduction
- Zero critical issues

## RAG Server Setup

**Current State**:
- ✅ Server running on http://127.0.0.1:8000
- ✅ Virtual env + dependencies installed
- ⚠️ Collection has 0 documents (needs indexing)

**Index Codebase** (run once):
```bash
cd /Users/tedghanime/Documents/App\ Development/A-simlified-RAG-tool-for-Claude-Code-context-management-main

source venv/bin/activate

python main.py index /Users/tedghanime/Documents/App\ Development/Shot\ Builder\ Development/shot-builder-workdir/shot-builder-app

# Wait ~2-3 minutes for indexing
# Expected: ~1,216 docs indexed
```

**Verify** (after indexing):
```bash
./rag_server.sh health
# Expected: "OK"

curl -s "http://127.0.0.1:8000/stats" -H "X-API-Key: claude-code-rag-key-2025"
# Expected: collection=shot_builder_knowledge_base, total_documents≈1,216
```

**Management**:
- Scripts: `/Users/tedghanime/Documents/App Development/A-simlified-RAG-tool-for-Claude-Code-context-management-main`
- Commands: `./rag_server.sh status|start|stop|health|logs|restart`

**Note**: Until indexed, use direct `Read` tool instead of `doc-searcher` agent.

## Key Principles

✅ **Reference, don't embed** (~40% token savings)
✅ **RAG-first** (query before implementing)
✅ **Concise reasoning** (forward-focused, no retrospectives)
✅ **3-5 agents per task** (orchestrated, tagged outputs)
✅ **Test incrementally** (don't batch at end)
✅ **Zero breaking changes** (backwards compatibility critical)

## Notes

- All 35 phases complete 🎉
- Production-ready with comprehensive features
- Clean architecture, solid test coverage
- Ready for Phase 17B or custom work

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
