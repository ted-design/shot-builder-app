import { useState, useCallback } from "react"
import { useParams } from "react-router-dom"
import { toast } from "sonner"
import type {
  BlockType,
  ExportBlock,
  ExportDocument,
  ExportPage,
} from "../types/exportBuilder"
import { createBlock } from "../lib/blockDefaults"
import { getDynamicVariables } from "../lib/exportVariables"
import { BlockPalette } from "./BlockPalette"
import { BlockSettingsPanel } from "./BlockSettingsPanel"
import { DocumentPreview } from "./DocumentPreview"
import { ExportTopBar } from "./ExportTopBar"

function createDefaultDocument(): ExportDocument {
  const now = new Date().toISOString()
  return {
    id: "draft",
    name: "Untitled Document",
    pages: [{ id: "page-1", blocks: [] }],
    settings: {
      layout: "portrait",
      size: "letter",
      fontFamily: "Inter, sans-serif",
    },
    createdAt: now,
    updatedAt: now,
  }
}

export default function ExportBuilderPage() {
  const { id: _projectId } = useParams<{ id: string }>()
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null)
  const [document, setDocument] = useState<ExportDocument>(createDefaultDocument)

  const variables = getDynamicVariables({
    projectName: "Sample Project",
    clientName: "Unbound Merino",
    shotCount: 24,
    productCount: 12,
    shootDates: ["2026-04-15", "2026-04-18"],
  })

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

  const handleOpenTemplates = useCallback(() => {
    toast.info("Templates panel coming soon.")
  }, [])

  const handleOpenVariables = useCallback(() => {
    toast.info("Variables panel coming soon.")
  }, [])

  const handleOpenPageSettings = useCallback(() => {
    toast.info("Page settings panel coming soon.")
  }, [])

  const handleExport = useCallback(() => {
    toast.info("PDF export coming soon.")
  }, [])

  const selectedBlock =
    document.pages
      .flatMap((p) => p.blocks)
      .find((b) => b.id === selectedBlockId) ?? null

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <ExportTopBar
        documentName={document.name}
        onOpenTemplates={handleOpenTemplates}
        onOpenVariables={handleOpenVariables}
        onOpenPageSettings={handleOpenPageSettings}
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
          variables={variables}
        />

        {/* Right — Block Settings */}
        <BlockSettingsPanel
          block={selectedBlock}
          onUpdateBlock={handleUpdateBlock}
          onDeleteBlock={handleDeleteBlock}
        />
      </div>
    </div>
  )
}
