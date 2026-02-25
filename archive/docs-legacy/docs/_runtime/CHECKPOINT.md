# Checkpoint: Documentation Overhaul

## Key Decisions & Invariants

1. **Reality wins over aspirational specs.** New docs describe what the codebase IS, not what docs-vnext said it should be.
2. **4 new docs + streamlined CLAUDE.md** replace all existing documentation:
   - AI_RULES.md - AI agent constitution
   - PRD.md - Product north star (merges north-star.md + experience-spec.md + user interviews)
   - Architecture.md - Technical architecture (merges architecture.md + actual codebase)
   - Plan.md - UX overhaul phases
   - CLAUDE.md - Streamlined <100 lines, references the 4 docs
3. **Archive, don't delete** - All legacy docs go to `archive/` with git history preserved
4. **TanStack Query stays** - Keep but don't introduce to new code
5. **File structure stays flat** - `src/pages/`, `src/components/`, etc. (NOT `src/features/`)
6. **Product identity:** Professional & precise, agency tool for fashion/commercial photography
7. **Hero feature:** Shot planning workflow (brief to shoot-ready)
8. **Planner/drag-and-drop:** Cut/simplify
9. **Tablet is mandatory** - iPad on-set optimization required
10. **App is not deployed yet** - Solo dev + AI, needs to onboard full team ASAP

## What Has Been Completed

- [x] Created `archive/` directory structure (legacy-root-docs, docs-legacy, docs-vnext-archive)
- [x] Read all docs-vnext/ content for extraction
- [x] Read all key source files (App.jsx, flags.js, rbac.ts, paths.ts)
- [x] Completed SaaS UX research (Linear, Notion, Figma, Canva patterns)
- [x] Completed deep user interviews (7 rounds of questions)
- [x] Plan approved by user

## What Is In Progress

- [ ] **Task #6:** Archive legacy docs (git mv ~75 root .md files + docs/ directory)

## What Is Next

- [ ] Write AI_RULES.md, PRD.md, Architecture.md, Plan.md
- [ ] Rewrite CLAUDE.md (<100 lines)
- [ ] Archive docs-vnext/ + update README.md
- [ ] Verify build + lint pass
