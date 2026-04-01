import { useState, useCallback } from "react"
import { useParams } from "react-router-dom"
import { toast } from "sonner"
import type { BlockType, ExportDocument } from "../types/exportBuilder"
import { BlockPalette } from "./BlockPalette"
import { ExportTopBar } from "./ExportTopBar"

const DEFAULT_DOCUMENT: ExportDocument = {
  id: "draft",
  name: "Untitled Document",
  pages: [{ id: "page-1", blocks: [] }],
  settings: {
    layout: "portrait",
    size: "letter",
    fontFamily: "Inter, sans-serif",
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

export default function ExportBuilderPage() {
  const { id: _projectId } = useParams<{ id: string }>()
  const [selectedBlockId, _setSelectedBlockId] = useState<string | null>(null)
  const [document] = useState<ExportDocument>(DEFAULT_DOCUMENT)

  const handleAddBlock = useCallback((type: BlockType) => {
    toast.info(`Block "${type}" will be added — renderer not yet implemented.`)
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
        <main className="flex flex-1 items-start justify-center overflow-y-auto bg-[var(--doc-canvas-bg)] p-8">
          <div className="doc-page w-full max-w-[816px] min-h-[1056px]">
            <div className="doc-page-content">
              {document.pages[0]?.blocks.length === 0 && (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Add blocks from the palette to build your document.
                  </p>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Right — Block Settings */}
        <aside className="flex w-[280px] shrink-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)]">
          {selectedBlockId ? (
            <div className="p-4">
              <h2 className="text-sm font-medium text-[var(--color-text)]">
                Block Settings
              </h2>
              <p className="mt-1 text-2xs text-[var(--color-text-muted)]">
                Configure the selected block.
              </p>
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center p-4">
              <p className="text-2xs text-[var(--color-text-muted)] text-center">
                Select a block to edit its settings.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
