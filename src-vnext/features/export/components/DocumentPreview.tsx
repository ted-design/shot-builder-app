import { useCallback } from "react"
import { Plus } from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import type { ExportDocument, ExportVariable, ExportBlock } from "../types/exportBuilder"
import { SortableBlock } from "./SortableBlock"

interface DocumentPreviewProps {
  readonly document: ExportDocument
  readonly selectedBlockId: string | null
  readonly onSelectBlock: (blockId: string | null) => void
  readonly onAddTextBlock: (pageId: string) => void
  readonly variables: readonly ExportVariable[]
  readonly onMoveBlock?: (pageId: string, blockId: string, newIndex: number) => void
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
  onMoveBlock,
}: DocumentPreviewProps) {
  // Flatten all pages and split by page-break blocks to get visual pages
  const allBlocks = doc.pages.flatMap((page) => page.blocks)
  const visualPages = splitByPageBreaks(allBlocks)
  const totalPages = visualPages.length
  const pageId = doc.pages[0]?.id ?? "page-1"

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id || !onMoveBlock) return

      // Find the new index in the full (pre-split) block array of the first page
      const firstPage = doc.pages[0]
      if (!firstPage) return

      const newIndex = firstPage.blocks.findIndex((b) => b.id === over.id)
      if (newIndex === -1) return

      onMoveBlock(firstPage.id, String(active.id), newIndex)
    },
    [doc.pages, onMoveBlock],
  )

  // Collect all non-page-break block IDs for the sortable context
  const sortableIds = allBlocks
    .filter((b) => b.type !== "page-break")
    .map((b) => b.id)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sortableIds}
        strategy={verticalListSortingStrategy}
      >
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
              className="doc-page w-full max-w-[960px] min-h-[1243px]"
            >
              <div className="doc-page-content flex flex-col gap-2 pl-8">
                {pageBlocks.length === 0 && pageIndex === 0 && totalPages === 1 ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <p className="text-sm text-[var(--color-text-subtle)]">
                      Add blocks from the palette to build your document.
                    </p>
                  </div>
                ) : (
                  pageBlocks.map((block) => (
                    <SortableBlock
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
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-[var(--color-border)] px-4 py-3 text-sm text-[var(--color-text-subtle)] transition-colors hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-muted)]"
                >
                  <Plus className="h-4 w-4" />
                  Add Text Block
                </button>
              </div>

              {/* Page footer */}
              <div className="mt-auto pt-4 text-center text-xs text-[var(--color-text-subtle)]">
                Page {String(pageIndex + 1)} of {String(totalPages)}
              </div>
            </div>
          ))}
        </main>
      </SortableContext>
    </DndContext>
  )
}
