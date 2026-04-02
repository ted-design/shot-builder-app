# HANDOFF — Sprint S17 (2026-04-02)

## State
S17 complete (Export Builder v2 + shot creation improvements + readiness fixes + CI fix). Merged to main via PR #378 (squash). Branch deleted.

## What Was Built
- **Export Builder v2:** Fully functional block-based PDF builder — real Firestore data via useExportData() + ExportDataProvider, all 9 block types with live data, PDF generation via @react-pdf/renderer (lazy-loaded), drag-and-drop block reorder (@dnd-kit), custom variables (add/edit/delete), template system (5 built-in + user-saved), document auto-save to localStorage, watermark support, multi-page documents
- **Shot creation improvements:** Title/description split (product name in title, colorway in description), gender auto-tagging using default tag IDs (no duplicates), shot numbers as "01, 02" (was "SH-001, SH-002")
- **Shoot readiness fixes:** Urgency badge replaces confidence badge (no more competing indicators), SKU-level project linkage indicators on expanded colorway rows, \u2026 literal text fix, completed/archived project filter in bulk-add dropdown
- **CI performance:** Forks pool on CI (was threads+singleThread override), global 60s timeout — tests went from 26min timeouts to ~3min pass

## Key New Files
- `src-vnext/features/export/hooks/useExportData.ts` — aggregation hook (6 subscriptions)
- `src-vnext/features/export/components/ExportDataProvider.tsx` — React context
- `src-vnext/features/export/components/blocks/{ShotDetail,ProductTable,PullSheet,CrewList}BlockView.tsx` — data blocks
- `src-vnext/features/export/lib/pdf/` — 13 files (document, mapper, 7 block PDFs, watermark, styles, orchestrator, image resolver)
- `src-vnext/features/export/components/SortableBlock.tsx` — drag-and-drop wrapper
- `mockups/s17-export-builder-v2.html` — 9-flow HTML mockup

## What's Next
1. S17 backlog: Image upload for ImageBlock (needs storage rules), multi-report per project
2. S18: Canvas image editor (Fabric.js vs Konva.js evaluation)
3. CI: Address Codex-identified Firestore mock leak in InviteUserDialog test (ProjectAssignmentPicker opens real onSnapshot)

## To Resume
Read this file, then `docs/_runtime/CHECKPOINT.md`, then `docs/DESIGN_SYSTEM.md`.
