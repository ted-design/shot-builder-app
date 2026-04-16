import { useState, useCallback, useEffect, useRef } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import type {
  BlockType,
  CustomVariable,
  ExportBlock,
  ExportDocument,
  ExportTemplate,
  ExportVariable,
  PageItem,
  PageSettings,
} from "../types/exportBuilder"
import { isHStackRow } from "../types/exportBuilder"
import { createBlock } from "../lib/blockDefaults"
import { getDynamicVariables } from "../lib/exportVariables"
import {
  addBlockToPage,
  addHStackRow,
  applyTemplate,
  insertBlockAtIndex,
  moveBlock,
  removeBlockFromPage,
  updateSettings,
  wrapBlocksInHStack,
} from "../lib/documentOperations"
import {
  saveDocument,
  loadDocument,
  saveTemplate as persistTemplate,
} from "../lib/documentPersistence"
import { BLOCK_REGISTRY } from "../lib/blockRegistry"
import { BUILT_IN_TEMPLATES } from "../lib/builtInTemplates"
import { BlockPalette } from "./BlockPalette"
import { BlockSettingsPanel } from "./BlockSettingsPanel"
import { DocumentPreview } from "./DocumentPreview"
import { ExportTopBar } from "./ExportTopBar"
import { TemplateDialog } from "./TemplateDialog"
import { VariablesPanel } from "./VariablesPanel"
import { PageSettingsPanel } from "./PageSettingsPanel"
import { ExportDataProvider, useExportDataContext } from "./ExportDataProvider"
import { PaletteDragOverlay } from "./PaletteDragOverlay"
import { generateExportPdf } from "../lib/pdf/generateExportPdf"
import { useAuth } from "@/app/providers/AuthProvider"
import { useExportReports } from "../hooks/useExportReports"
import { useExportBlockOps } from "../hooks/useExportBlockOps"
import { useExportPageOps } from "../hooks/useExportPageOps"

function createDefaultDocument(): ExportDocument {
  const now = new Date().toISOString()
  return {
    id: "draft",
    name: "Untitled Report",
    pages: [{ id: "page-1", items: [] }],
    settings: {
      layout: "portrait",
      size: "letter",
      fontFamily: "Inter",
    },
    createdAt: now,
    updatedAt: now,
  }
}

/** Parse a drop-gap ID to extract the page ID and insertion index */
function parseDropGapId(gapId: string): { pageId: string; index: number } | null {
  // Format: drop-gap-{pageId}-{index}
  const match = /^drop-gap-(.+)-(\d+)$/.exec(gapId)
  if (!match || !match[1] || !match[2]) return null
  return { pageId: match[1], index: parseInt(match[2], 10) }
}

/** Parse a horizontal drop zone ID: {blockId}-drop-left or {blockId}-drop-right */
function parseHorizontalDropId(
  dropId: string,
): { blockId: string; position: "left" | "right" } | null {
  const leftMatch = /^(.+)-drop-left$/.exec(dropId)
  if (leftMatch?.[1]) return { blockId: leftMatch[1], position: "left" }
  const rightMatch = /^(.+)-drop-right$/.exec(dropId)
  if (rightMatch?.[1]) return { blockId: rightMatch[1], position: "right" }
  return null
}

/** localStorage key for legacy documents */
const LEGACY_DOC_PREFIX = "sb:export-doc:"

export default function ExportBuilderPage() {
  return (
    <ExportDataProvider>
      <ExportBuilderPageInner />
    </ExportDataProvider>
  )
}

function ExportBuilderPageInner() {
  const { id: projectId } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { clientId } = useAuth()
  const { project, shots, productFamilies } = useExportDataContext()

  // --- Firestore multi-report ---
  const {
    reports,
    loading: reportsLoading,
    saveReport,
    deleteReport,
    createReport,
    loadReport,
    importReport,
  } = useExportReports(clientId, projectId)

  const [activeReportId, setActiveReportId] = useState<string | null>(null)
  const [hasInitialized, setHasInitialized] = useState(false)
  const [showImportPrompt, setShowImportPrompt] = useState(false)

  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showVariables, setShowVariables] = useState(false)
  const [showPageSettings, setShowPageSettings] = useState(false)
  const [zoom, setZoom] = useState(100)
  const [activeDragType, setActiveDragType] = useState<string | null>(null)

  const [document, setDocument] = useState<ExportDocument>(createDefaultDocument)

  // Ref to hold current activePageId for use inside memoized callbacks
  const activePageIdRef = useRef(activePageId)
  useEffect(() => {
    activePageIdRef.current = activePageId
  }, [activePageId])

  // --- Extracted hooks ---
  const {
    handleAddBlock,
    handleUpdateBlock,
    handleDeleteBlock,
    handleDuplicateBlock,
    handleMoveBlockUp,
    handleMoveBlockDown,
  } = useExportBlockOps(setDocument, setSelectedBlockId, activePageId)

  const {
    handleAddPage,
    handleDuplicatePage,
    handleDeletePage,
    handleResizeColumns,
    handleAddColumn,
    handleRemoveColumn,
  } = useExportPageOps(document, setDocument, activePageId, setActivePageId)

  // --- Initialization: select first report or detect legacy localStorage ---
  useEffect(() => {
    if (reportsLoading || hasInitialized) return

    async function initialize() {
      // Check for preset query params (e.g. ?preset=shot-list)
      const preset = searchParams.get("preset")

      if (preset) {
        const templateIdMap: Record<string, string> = {
          "shot-list": "built-in-shot-list",
          "shot-detail": "built-in-storyboard",
          "storyboard": "built-in-storyboard",
          "lookbook": "built-in-lookbook",
          "pull-sheet": "built-in-pull-sheet",
          "call-sheet": "built-in-call-sheet",
        }

        const templateId = templateIdMap[preset]
        const template = templateId
          ? BUILT_IN_TEMPLATES.find((t) => t.id === templateId)
          : undefined

        if (template) {
          const newDoc = applyTemplate(template)
          setDocument(newDoc)
          setActivePageId(newDoc.pages[0]?.id ?? null)
          // Clear search params to avoid re-applying on re-render
          setSearchParams({}, { replace: true })
          setHasInitialized(true)
          return
        }
      }

      if (reports.length > 0) {
        // Select first (most recently updated) report
        const first = reports[0]!
        const full = await loadReport(first.id)
        if (full) {
          setDocument({
            id: full.id,
            name: full.name,
            pages: [...full.pages],
            settings: full.settings,
            customVariables: full.customVariables,
            createdAt: "",
            updatedAt: full.updatedAt?.toISOString() ?? "",
          })
          setActiveReportId(full.id)
          setActivePageId(full.pages[0]?.id ?? null)
        }
      } else if (projectId) {
        // Check for legacy localStorage document
        const legacyKey = `${LEGACY_DOC_PREFIX}${projectId}`
        const legacyRaw = localStorage.getItem(legacyKey)
        if (legacyRaw) {
          setShowImportPrompt(true)
        }
        // Otherwise stays on default blank document
      }
      setHasInitialized(true)
    }

    initialize().catch(() => {
      setHasInitialized(true)
    })
  }, [reportsLoading, hasInitialized, reports, loadReport, projectId, searchParams, setSearchParams])

  // --- Switch report ---
  const handleSelectReport = useCallback(
    async (reportId: string) => {
      if (reportId === activeReportId) return
      try {
        const full = await loadReport(reportId)
        if (!full) {
          toast.error("Report not found")
          return
        }
        setDocument({
          id: full.id,
          name: full.name,
          pages: [...full.pages],
          settings: full.settings,
          customVariables: full.customVariables,
          createdAt: "",
          updatedAt: full.updatedAt?.toISOString() ?? "",
        })
        setActiveReportId(full.id)
        setActivePageId(full.pages[0]?.id ?? null)
        setSelectedBlockId(null)
      } catch {
        toast.error("Failed to load report")
      }
    },
    [activeReportId, loadReport],
  )

  // --- Create new report ---
  const handleCreateReport = useCallback(async () => {
    try {
      const newId = await createReport("Untitled Report")
      setDocument({
        ...createDefaultDocument(),
        id: newId,
      })
      setActiveReportId(newId)
      setActivePageId("page-1")
      setSelectedBlockId(null)
      toast.success("New report created")
    } catch {
      toast.error("Failed to create report")
    }
  }, [createReport])

  // --- Import legacy localStorage report ---
  const handleImportLegacy = useCallback(async () => {
    if (!projectId) return
    const saved = loadDocument(projectId)
    if (!saved) {
      toast.error("No local data found")
      setShowImportPrompt(false)
      return
    }
    try {
      const newId = await importReport(
        saved.name,
        saved.pages,
        saved.settings,
        saved.customVariables ? [...saved.customVariables] : undefined,
      )
      setDocument({
        id: newId,
        name: saved.name,
        pages: saved.pages,
        settings: saved.settings,
        customVariables: saved.customVariables,
        createdAt: saved.createdAt,
        updatedAt: saved.updatedAt,
      })
      setActiveReportId(newId)
      setActivePageId(saved.pages[0]?.id ?? null)
      setShowImportPrompt(false)
      toast.success("Local report imported to cloud")
    } catch {
      toast.error("Failed to import local report")
    }
  }, [projectId, importReport])

  // --- Rename report ---
  const handleRenameReport = useCallback(
    (name: string) => {
      setDocument((prev) => ({
        ...prev,
        name,
        updatedAt: new Date().toISOString(),
      }))
    },
    [],
  )

  // --- Delete report ---
  const handleDeleteReport = useCallback(
    async (reportId: string) => {
      try {
        await deleteReport(reportId)
        toast.success("Report deleted")
        // If we deleted the active report, switch to first remaining
        if (reportId === activeReportId) {
          const remaining = reports.filter((r) => r.id !== reportId)
          if (remaining.length > 0) {
            const first = remaining[0]!
            void handleSelectReport(first.id)
          } else {
            setActiveReportId(null)
            setDocument(createDefaultDocument())
          }
        }
      } catch {
        toast.error("Failed to delete report")
      }
    },
    [deleteReport, activeReportId, reports, handleSelectReport],
  )

  // --- Auto-save to Firestore (debounced) ---
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!activeReportId || !hasInitialized) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveReport(activeReportId, {
        name: document.name,
        pages: document.pages,
        settings: document.settings,
        customVariables: document.customVariables ? [...document.customVariables] : undefined,
      }).catch(() => {
        // Save failed silently — Firestore offline cache will retry
      })
    }, 800)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [activeReportId, document, hasInitialized, saveReport])

  // --- Fallback: also save to localStorage for offline resilience ---
  const localSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!projectId) return
    if (localSaveTimerRef.current) clearTimeout(localSaveTimerRef.current)
    localSaveTimerRef.current = setTimeout(() => {
      saveDocument(projectId, document)
    }, 1000)
    return () => {
      if (localSaveTimerRef.current) clearTimeout(localSaveTimerRef.current)
    }
  }, [projectId, document])

  // Real data from Firestore via ExportDataProvider
  const dynamicVariables = getDynamicVariables({
    projectName: project?.name ?? document.name,
    clientName: "",
    shotCount: shots.length,
    productCount: productFamilies.length,
    shootDates: project?.shootDates ?? [],
  })

  // Merge dynamic + custom variables into a single array for resolution
  const customAsExportVars: readonly ExportVariable[] = (
    document.customVariables ?? []
  ).map((cv) => ({
    key: cv.key,
    label: cv.label,
    value: cv.value,
    source: "custom" as const,
  }))
  const variables: readonly ExportVariable[] = [
    ...dynamicVariables,
    ...customAsExportVars,
  ]

  // --- DnD setup ---

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const source = event.active.data.current?.source as string | undefined
    if (source === "palette") {
      setActiveDragType(event.active.data.current?.type as string)
    }
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveDragType(null)

      if (!over) return

      const currentActivePageId = activePageIdRef.current
      const source = active.data.current?.source as string | undefined
      const overId = String(over.id)

      // --- Horizontal drop: wrap two blocks into an HStack ---
      const hDrop = parseHorizontalDropId(overId)
      if (hDrop) {
        if (source === "palette") {
          // Dragging from palette onto the side of an existing block
          const blockType = active.data.current?.type as BlockType | "hstack"
          if (blockType === "hstack") return // Can't wrap with an HStack layout block
          const newBlock = createBlock(blockType)
          setDocument((prev) => {
            const targetPage = prev.pages.find((p) => p.id === currentActivePageId) ?? prev.pages[0]
            const pageId = targetPage?.id ?? "page-1"
            return wrapBlocksInHStack(prev, pageId, hDrop.blockId, newBlock, hDrop.position)
          })
          setSelectedBlockId(newBlock.id)
        } else {
          // Dragging an existing block onto the side of another
          const draggedId = String(active.id)
          if (draggedId === hDrop.blockId) return // Can't wrap a block with itself
          setDocument((prev) => {
            const targetPage = prev.pages.find((p) => p.id === currentActivePageId) ?? prev.pages[0]
            const pageId = targetPage?.id ?? "page-1"
            const page = prev.pages.find((p) => p.id === pageId)
            if (!page) return prev
            const draggedItem = page.items.find(
              (item) => !isHStackRow(item) && item.id === draggedId,
            )
            if (!draggedItem || isHStackRow(draggedItem)) return prev

            // Remove the dragged block first, then wrap
            const withoutDragged = removeBlockFromPage(prev, pageId, draggedId)
            return wrapBlocksInHStack(
              withoutDragged,
              pageId,
              hDrop.blockId,
              draggedItem as ExportBlock,
              hDrop.position,
            )
          })
        }
        return
      }

      // --- Palette drop: create new block at position ---
      if (source === "palette") {
        const blockType = active.data.current?.type as BlockType | "hstack"

        // Check if dropped on a drop-gap
        const gap = parseDropGapId(overId)
        if (gap) {
          if (blockType === "hstack") {
            // Insert HStack at index — use insertBlockAtIndex with a fresh row
            setDocument((prev) => {
              const row = {
                id: crypto.randomUUID(),
                type: "hstack" as const,
                columns: [
                  { id: crypto.randomUUID(), widthPercent: 50, blocks: [] as readonly ExportBlock[] },
                  { id: crypto.randomUUID(), widthPercent: 50, blocks: [] as readonly ExportBlock[] },
                ],
              }
              return insertBlockAtIndex(prev, gap.pageId, row, gap.index)
            })
          } else {
            const newBlock = createBlock(blockType)
            setDocument((prev) =>
              insertBlockAtIndex(prev, gap.pageId, newBlock, gap.index),
            )
            setSelectedBlockId(newBlock.id)
          }
          return
        }

        // Fallback: not on a gap, append to active page (same as click)
        if (blockType === "hstack") {
          setDocument((prev) => {
            const targetPage = prev.pages.find((p) => p.id === currentActivePageId) ?? prev.pages[0]
            if (!targetPage) return prev
            return addHStackRow(prev, targetPage.id)
          })
        } else {
          const newBlock = createBlock(blockType)
          setDocument((prev) => {
            const targetPage = prev.pages.find((p) => p.id === currentActivePageId) ?? prev.pages[0]
            if (!targetPage) return prev
            return {
              ...prev,
              pages: prev.pages.map((p) =>
                p.id === targetPage.id
                  ? { ...p, items: [...p.items, newBlock] }
                  : p,
              ),
              updatedAt: new Date().toISOString(),
            }
          })
          setSelectedBlockId(newBlock.id)
        }
        return
      }

      // --- Reorder: existing block sort ---
      if (active.id === over.id) return

      setDocument((prev) => {
        const targetPage = prev.pages.find((p) => p.id === currentActivePageId) ?? prev.pages[0]
        if (!targetPage) return prev

        const flatBlocks = targetPage.items.flatMap((item) =>
          isHStackRow(item)
            ? item.columns.flatMap((col) => col.blocks)
            : [item],
        )
        const newIndex = flatBlocks.findIndex((b) => b.id === over.id)
        if (newIndex === -1) return prev

        return moveBlock(prev, targetPage.id, String(active.id), newIndex)
      })
    },
    [],
  )

  const handleDragCancel = useCallback(() => {
    setActiveDragType(null)
  }, [])

  // --- Additional block helpers ---

  const handleAddTextBlock = useCallback(
    (pageId: string) => {
      const newBlock = createBlock("text")
      setDocument((prev) => addBlockToPage(prev, pageId, newBlock))
      setSelectedBlockId(newBlock.id)
    },
    [],
  )

  const handleSelectBlock = useCallback((blockId: string | null) => {
    setSelectedBlockId(blockId)
  }, [])

  const handleMoveBlock = useCallback(
    (pageId: string, blockId: string, newIndex: number) => {
      setDocument((prev) => moveBlock(prev, pageId, blockId, newIndex))
    },
    [],
  )

  // --- Custom variable operations ---

  const handleAddCustomVariable = useCallback(() => {
    const newVar: CustomVariable = {
      key: crypto.randomUUID(),
      label: "New Variable",
      value: "",
    }
    setDocument((prev) => ({
      ...prev,
      customVariables: [...(prev.customVariables ?? []), newVar],
      updatedAt: new Date().toISOString(),
    }))
  }, [])

  const handleUpdateCustomVariable = useCallback(
    (key: string, updates: Partial<CustomVariable>) => {
      setDocument((prev) => ({
        ...prev,
        customVariables: (prev.customVariables ?? []).map((cv) =>
          cv.key === key ? { ...cv, ...updates } : cv,
        ),
        updatedAt: new Date().toISOString(),
      }))
    },
    [],
  )

  const handleDeleteCustomVariable = useCallback((key: string) => {
    setDocument((prev) => ({
      ...prev,
      customVariables: (prev.customVariables ?? []).filter(
        (cv) => cv.key !== key,
      ),
      updatedAt: new Date().toISOString(),
    }))
  }, [])

  // --- Panel handlers ---

  const handleSelectTemplate = useCallback((template: ExportTemplate) => {
    const newDoc = applyTemplate(template)
    setDocument(newDoc)
    setSelectedBlockId(null)
  }, [])

  const handleSaveCurrentAsTemplate = useCallback(() => {
    const template: ExportTemplate = {
      id: crypto.randomUUID(),
      name: document.name,
      description: `Saved from "${document.name}"`,
      category: "saved",
      pages: document.pages,
      settings: document.settings,
    }
    persistTemplate(template)
    toast.success("Template saved")
  }, [document])

  const handleUpdateSettings = useCallback((settings: PageSettings) => {
    setDocument((prev) => updateSettings(prev, settings))
  }, [])

  const exportData = useExportDataContext()

  const handleExport = useCallback(() => {
    void generateExportPdf(document, exportData, variables)
  }, [document, exportData, variables])

  // --- Keyboard shortcut: Delete/Backspace removes selected block ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedBlockId) return
      if (e.key === "Delete" || e.key === "Backspace") {
        const target = e.target as HTMLElement
        if (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA") return
        e.preventDefault()
        handleDeleteBlock(selectedBlockId)
      }
    }
    window.document.addEventListener("keydown", handleKeyDown)
    return () => window.document.removeEventListener("keydown", handleKeyDown)
  }, [selectedBlockId, handleDeleteBlock])

  // --- Derived ---

  const selectedBlock =
    document.pages
      .flatMap((p) =>
        p.items.flatMap((item) =>
          isHStackRow(item)
            ? item.columns.flatMap((col) => col.blocks)
            : [item],
        ),
      )
      .find((b) => b.id === selectedBlockId) ?? null

  // Look up the active palette entry for the drag overlay
  const activePaletteEntry = activeDragType
    ? BLOCK_REGISTRY.find((e) => e.type === activeDragType)
    : null

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ExportTopBar
        documentName={document.name}
        pageCount={document.pages.length}
        zoom={zoom}
        onAddPage={handleAddPage}
        onZoomChange={setZoom}
        onOpenTemplates={() => setShowTemplates(true)}
        onOpenVariables={() => setShowVariables(true)}
        onOpenPageSettings={() => setShowPageSettings(true)}
        onExport={handleExport}
        reports={reports}
        activeReportId={activeReportId}
        onSelectReport={handleSelectReport}
        onCreateReport={handleCreateReport}
        onRenameReport={handleRenameReport}
        onDeleteReport={handleDeleteReport}
      />

      {/* Import legacy prompt */}
      {showImportPrompt && (
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-2">
          <span className="text-sm text-[var(--color-text-muted)]">
            A locally saved report was found for this project.
          </span>
          <button
            type="button"
            onClick={handleImportLegacy}
            className="rounded-md bg-[var(--color-accent)] px-3 py-1 text-xs font-medium text-white hover:opacity-90 transition-opacity"
          >
            Import Local Report
          </button>
          <button
            type="button"
            onClick={() => setShowImportPrompt(false)}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div className="flex flex-1 overflow-hidden">
          {/* Left -- Block Palette */}
          <BlockPalette onAddBlock={handleAddBlock} />

          {/* Center -- Document Preview */}
          <DocumentPreview
            document={document}
            selectedBlockId={selectedBlockId}
            onSelectBlock={handleSelectBlock}
            onAddTextBlock={handleAddTextBlock}
            onMoveBlock={handleMoveBlock}
            variables={variables}
            onUpdateBlock={handleUpdateBlock}
            onDeleteBlock={handleDeleteBlock}
            onDuplicateBlock={handleDuplicateBlock}
            onMoveBlockUp={handleMoveBlockUp}
            onMoveBlockDown={handleMoveBlockDown}
            onResizeColumns={handleResizeColumns}
            onAddColumn={handleAddColumn}
            onRemoveColumn={handleRemoveColumn}
            zoom={zoom}
            onAddPage={handleAddPage}
            onDuplicatePage={handleDuplicatePage}
            onDeletePage={handleDeletePage}
            isPaletteDrag={activeDragType !== null}
            onPageClick={setActivePageId}
          />

          {/* Right -- Block Settings */}
          <BlockSettingsPanel
            block={selectedBlock}
            onUpdateBlock={handleUpdateBlock}
            onDeleteBlock={handleDeleteBlock}
            clientId={clientId}
            projectId={projectId}
          />
        </div>

        {/* Drag overlay for palette items */}
        <DragOverlay dropAnimation={null}>
          {activePaletteEntry ? (
            <PaletteDragOverlay entry={activePaletteEntry} />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Panels / Dialogs */}
      <TemplateDialog
        open={showTemplates}
        onOpenChange={setShowTemplates}
        onSelectTemplate={handleSelectTemplate}
        onSaveCurrent={handleSaveCurrentAsTemplate}
      />

      <VariablesPanel
        open={showVariables}
        onOpenChange={setShowVariables}
        variables={variables}
        customVariables={document.customVariables ?? []}
        onAddCustomVariable={handleAddCustomVariable}
        onUpdateCustomVariable={handleUpdateCustomVariable}
        onDeleteCustomVariable={handleDeleteCustomVariable}
      />

      <PageSettingsPanel
        open={showPageSettings}
        onOpenChange={setShowPageSettings}
        settings={document.settings}
        onUpdateSettings={handleUpdateSettings}
      />
    </div>
  )
}
