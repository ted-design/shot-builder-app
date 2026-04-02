# CHECKPOINT — Sprint S17 Complete (2026-04-02)

## Branch: `main` — PR #378 merged (squash)

## S17 COMPLETE. All features delivered.
## Build clean, lint zero, 149 test files, 1500 tests pass. CI ~3min.

## S17 Summary (4 commits, squash-merged)

### Export Builder v2 (Phases 1-6)
- Phase 1: Wire Shell — connected TemplateDialog, VariablesPanel, PageSettingsPanel (replaced 4 "coming soon" toasts), document auto-save via debounced localStorage
- Phase 2: Data Integration — useExportData() aggregation hook (6 Firestore subscriptions), ExportDataProvider React context, real variables from project data
- Phase 3: Data Blocks — ShotGridBlockView (real shots with filter/sort/talent resolution), ShotDetailBlockView (shot picker), ProductTableBlockView, PullSheetBlockView, CrewListBlockView
- Phase 4: PDF Generation — 13 new files in lib/pdf/ (ExportPdfDocument, ExportPdfBlockMapper, 7 block PDFs, WatermarkOverlay, pdfStyles, generateExportPdf orchestrator, resolveExportImages pipeline)
- Phase 5: Block Reorder — @dnd-kit drag-and-drop with SortableBlock wrapper, GripVertical handle
- Phase 6: Custom Variables — add/edit/delete in VariablesPanel, CustomVariable type on ExportDocument, merged into variable resolution pipeline

### Shot Creation Improvements
- Title/description split: buildShotTitle() returns family name only, colorway goes to description field
- Gender auto-tagging: GENDER_TAG_MAP with default tag IDs (default-gender-men/women/unisex), no duplicate tags
- Shot number format: formatShotNumber() changed from "SH-001" to "01" (2-digit, no prefix)

### Shoot Readiness Fixes
- Removed ConfidenceBadge component — UrgencyBadge is sole indicator
- SKU-level project linkage: extended useProductProjectMap to track skuIds, "In X projects" badge on expanded colorway rows
- Fixed \u2026 literal text in JSX attribute (needs {} wrapper)
- Filter completed/archived projects from bulk-add dropdown

### CI Performance Fix
- run-vitest.cjs: skip --pool threads --singleThread override on CI (detected by Codex)
- vitest.config.ts: global CI timeout 30s → 60s
- Result: CI tests went from 26min timeouts to ~3min pass

## New Infrastructure (S17)
- `features/export/hooks/useExportData.ts`
- `features/export/components/ExportDataProvider.tsx`
- `features/export/components/SortableBlock.tsx`
- `features/export/components/blocks/ShotDetailBlockView.tsx`
- `features/export/components/blocks/ProductTableBlockView.tsx`
- `features/export/components/blocks/PullSheetBlockView.tsx`
- `features/export/components/blocks/CrewListBlockView.tsx`
- `features/export/lib/pdf/` (13 files)
- `dashboard/hooks/useProductProjectMap.ts` — now tracks skuProjectMap
