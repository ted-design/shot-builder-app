import { Plus } from "lucide-react"
import type { ExportDocument, ExportVariable, ExportBlock } from "../types/exportBuilder"
import { BlockRenderer } from "./BlockRenderer"

interface DocumentPreviewProps {
  readonly document: ExportDocument
  readonly selectedBlockId: string | null
  readonly onSelectBlock: (blockId: string | null) => void
  readonly onAddTextBlock: (pageId: string) => void
  readonly variables: readonly ExportVariable[]
}

/**
 * Split a page's blocks into visual pages separated by page-break blocks.
 * Returns an array of block groups — each group represents one visual page.
 */
function splitByPageBreaks(
  blocks: readonly ExportBlock[],
): readonly (readonly ExportBlock[])[] {
  const pages: ExportBlock[][] = []
  let current: ExportBlock[] = []

  for (const block of blocks) {
    if (block.type === "page-break") {
      pages.push(current)
      current = []
    } else {
      current.push(block)
    }
  }
  // Push the last segment even if empty
  pages.push(current)
  return pages
}

export function DocumentPreview({
  document: doc,
  selectedBlockId,
  onSelectBlock,
  onAddTextBlock,
  variables,
}: DocumentPreviewProps) {
  // Flatten all pages and split by page-break blocks to get visual pages
  const allBlocks = doc.pages.flatMap((page) => page.blocks)
  const visualPages = splitByPageBreaks(allBlocks)
  const totalPages = visualPages.length
  const pageId = doc.pages[0]?.id ?? "page-1"

  return (
    <main
      data-testid="document-preview"
      className="flex flex-1 flex-col items-center gap-8 overflow-y-auto bg-[var(--doc-canvas-bg)] p-8"
      onClick={() => onSelectBlock(null)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          onSelectBlock(null)
        }
      }}
      role="presentation"
    >
      {visualPages.map((pageBlocks, pageIndex) => (
        <div
          key={pageIndex}
          className="doc-page w-full max-w-[816px] min-h-[1056px]"
        >
          <div className="doc-page-content flex flex-col gap-2">
            {pageBlocks.length === 0 && pageIndex === 0 && totalPages === 1 ? (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <p className="text-sm text-gray-400">
                  Add blocks from the palette to build your document.
                </p>
              </div>
            ) : (
              pageBlocks.map((block) => (
                <BlockRenderer
                  key={block.id}
                  block={block}
                  selected={selectedBlockId === block.id}
                  onSelect={() => onSelectBlock(block.id)}
                  variables={variables}
                />
              ))
            )}

            {/* Add Text Block button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onAddTextBlock(pageId)
              }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-gray-300 px-4 py-3 text-sm text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-500"
            >
              <Plus className="h-4 w-4" />
              Add Text Block
            </button>
          </div>

          {/* Page footer */}
          <div className="mt-auto pt-4 text-center text-xs text-gray-400">
            Page {String(pageIndex + 1)} of {String(totalPages)}
          </div>
        </div>
      ))}
    </main>
  )
}
