# Handoff: Documentation Overhaul

## Next Steps

1. Run git mv for ~75 root .md files to `archive/legacy-root-docs/`
2. Run git mv docs/ archive/docs-legacy/
3. Write AI_RULES.md
4. Write PRD.md
5. Write Architecture.md
6. Write Plan.md
7. Rewrite CLAUDE.md (<100 lines)
8. Archive docs-vnext/ after content extracted
9. Update README.md
10. Run npm run build and npm run lint

## Do-Not List

- Do NOT modify any source code (src/)
- Do NOT delete files - only git mv to archive/
- Do NOT change firestore.rules, package.json, or config files
- Do NOT create aspirational src/features/ structure
- Do NOT remove TanStack Query or tiptap

## Verification

- Root has only: CLAUDE.md, README.md, AI_RULES.md, PRD.md, Architecture.md, Plan.md + config
- CLAUDE.md < 100 lines
- npm run build succeeds
- npm run lint passes
