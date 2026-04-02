import { useState, useCallback, useEffect, useRef } from "react"
import { useParams } from "react-router-dom"
import { toast } from "sonner"
import type {
  BlockType,
  CustomVariable,
  ExportBlock,
  ExportDocument,
  ExportPage,
  ExportTemplate,
  ExportVariable,
  PageSettings,
} from "../types/exportBuilder"
import { createBlock } from "../lib/blockDefaults"
import { getDynamicVariables } from "../lib/exportVariables"
import {
  applyTemplate,
  moveBlock,
  updateSettings,
} from "../lib/documentOperations"
import {
  saveDocument,
  loadDocument,
  saveTemplate as persistTemplate,
} from "../lib/documentPersistence"
import { BlockPalette } from "./BlockPalette"
import { BlockSettingsPanel } from "./BlockSettingsPanel"
import { DocumentPreview } from "./DocumentPreview"
import { ExportTopBar } from "./ExportTopBar"
import { TemplateDialog } from "./TemplateDialog"
import { VariablesPanel } from "./VariablesPanel"
import { PageSettingsPanel } from "./PageSettingsPanel"
import { ExportDataProvider, useExportDataContext } from "./ExportDataProvider"
import { generateExportPdf } from "../lib/pdf/generateExportPdf"

function createDefaultDocument(): ExportDocument {
  const now = new Date().toISOString()
  return {
    id: "draft",
    name: "Untitled Document",
    pages: [{ id: "page-1", blocks: [] }],
    settings: {
      layout: "portrait",
      size: "letter",
      fontFamily: "Inter",
    },
    createdAt: now,
    updatedAt: now,
  }
}

export default function ExportBuilderPage() {
  return (
    <ExportDataProvider>
      <ExportBuilderPageInner />
    </ExportDataProvider>
  )
}

function ExportBuilderPageInner() {
  const { id: projectId } = useParams<{ id: string }>()
  const { project, shots, productFamilies } = useExportDataContext()

  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(false)
  const [showVariables, setShowVariables] = useState(false)
  const [showPageSettings, setShowPageSettings] = useState(false)

  // Load persisted document on mount, or create default
  const [document, setDocument] = useState<ExportDocument>(() => {
    if (!projectId) return createDefaultDocument()
    const saved = loadDocument(projectId)
    return saved ?? createDefaultDocument()
  })

  // Debounced auto-save to localStorage
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!projectId) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveDocument(projectId, document)
    }, 500)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
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

  // --- Block operations ---

  const handleAddBlock = useCallback((type: BlockType) => {
    const newBlock = createBlock(type)
    setDocument((prev) => {
      const targetPage = prev.pages[0]
      if (!targetPage) return prev
      const updatedPage: ExportPage = {
        ...targetPage,
        blocks: [...targetPage.blocks, newBlock],
      }
      return {
        ...prev,
        pages: [updatedPage, ...prev.pages.slice(1)],
        updatedAt: new Date().toISOString(),
      }
    })
    setSelectedBlockId(newBlock.id)
  }, [])

  const handleAddTextBlock = useCallback(
    (_pageId: string) => handleAddBlock("text"),
    [handleAddBlock],
  )

  const handleSelectBlock = useCallback((blockId: string | null) => {
    setSelectedBlockId(blockId)
  }, [])

  const handleUpdateBlock = useCallback(
    (blockId: string, updates: Partial<ExportBlock>) => {
      setDocument((prev) => ({
        ...prev,
        pages: prev.pages.map((page) => ({
          ...page,
          blocks: page.blocks.map((block) =>
            block.id === blockId
              ? ({ ...block, ...updates } as ExportBlock)
              : block,
          ),
        })),
        updatedAt: new Date().toISOString(),
      }))
    },
    [],
  )

  const handleDeleteBlock = useCallback((blockId: string) => {
    setDocument((prev) => ({
      ...prev,
      pages: prev.pages.map((page) => ({
        ...page,
        blocks: page.blocks.filter((block) => block.id !== blockId),
      })),
      updatedAt: new Date().toISOString(),
    }))
    setSelectedBlockId((prev) => (prev === blockId ? null : prev))
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
    generateExportPdf(document, exportData, variables)
  }, [document, exportData, variables])

  // --- Derived ---

  const selectedBlock =
    document.pages
      .flatMap((p) => p.blocks)
      .find((b) => b.id === selectedBlockId) ?? null

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ExportTopBar
        documentName={document.name}
        onOpenTemplates={() => setShowTemplates(true)}
        onOpenVariables={() => setShowVariables(true)}
        onOpenPageSettings={() => setShowPageSettings(true)}
        onExport={handleExport}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left — Block Palette */}
        <BlockPalette onAddBlock={handleAddBlock} />

        {/* Center — Document Preview */}
        <DocumentPreview
          document={document}
          selectedBlockId={selectedBlockId}
          onSelectBlock={handleSelectBlock}
          onAddTextBlock={handleAddTextBlock}
          onMoveBlock={handleMoveBlock}
          variables={variables}
        />

        {/* Right — Block Settings */}
        <BlockSettingsPanel
          block={selectedBlock}
          onUpdateBlock={handleUpdateBlock}
          onDeleteBlock={handleDeleteBlock}
        />
      </div>

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
