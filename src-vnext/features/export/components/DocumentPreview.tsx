import { Columns, Copy, MoreVertical, Plus, Trash2 } from "lucide-react"
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { useDndContext, useDroppable } from "@dnd-kit/core"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import type { ExportDocument, ExportVariable, ExportBlock, PageItem } from "../types/exportBuilder"
import { isHStackRow } from "../types/exportBuilder"
import { SortableBlock } from "./SortableBlock"
import { HStackRowView } from "./HStackRowView"

interface DocumentPreviewProps {
  readonly document: ExportDocument
  readonly selectedBlockId: string | null
  readonly onSelectBlock: (blockId: string | null) => void
  readonly onAddTextBlock: (pageId: string) => void
  readonly variables: readonly ExportVariable[]
  readonly onMoveBlock?: (pageId: string, blockId: string, newIndex: number) => void
  readonly onUpdateBlock?: (blockId: string, updates: Partial<ExportBlock>) => void
  readonly onDeleteBlock?: (blockId: string) => void
  readonly onDuplicateBlock?: (blockId: string) => void
  readonly onMoveBlockUp?: (blockId: string) => void
  readonly onMoveBlockDown?: (blockId: string) => void
  readonly onResizeColumns?: (rowId: string, widths: Record<string, number>) => void
  readonly onAddColumn?: (rowId: string) => void
  readonly onRemoveColumn?: (rowId: string, columnId: string) => void
  readonly zoom?: number
  readonly onAddPage?: () => void
  readonly onDuplicatePage?: (pageId: string) => void
  readonly onDeletePage?: (pageId: string) => void
  readonly isPaletteDrag?: boolean
  readonly onPageClick?: (pageId: string) => void
}

/** Flatten page items into ExportBlocks (expanding HStack columns) */
function flattenItems(items: readonly PageItem[]): readonly ExportBlock[] {
  return items.flatMap((item) =>
    isHStackRow(item)
      ? item.columns.flatMap((col) => col.blocks)
      : [item],
  )
}

/**
 * Split page items into visual pages separated by page-break blocks.
 * Preserves HStack rows as-is; only standalone page-break blocks trigger a split.
 */
function splitItemsByPageBreaks(
  items: readonly PageItem[],
): readonly (readonly PageItem[])[] {
  const pages: PageItem[][] = []
  let current: PageItem[] = []

  for (const item of items) {
    if (!isHStackRow(item) && item.type === "page-break") {
      pages.push(current)
      current = []
    } else {
      current.push(item)
    }
  }
  // Push the last segment even if empty
  pages.push(current)
  return pages
}

/** Drop zone indicator between blocks for palette drag */
function DropGap({
  id,
  isPaletteDrag,
}: {
  readonly id: string
  readonly isPaletteDrag: boolean
}) {
  const { isOver, setNodeRef } = useDroppable({ id })

  if (!isPaletteDrag) return null

  return (
    <div
      ref={setNodeRef}
      className="relative flex items-center justify-center"
      style={{ height: isOver ? 40 : 12 }}
    >
      <div
        className={`absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 transition-all ${
          isOver
            ? "bg-[var(--color-accent)] opacity-100"
            : "bg-transparent opacity-0"
        }`}
      />
      {isOver && (
        <div className="relative z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-accent)] text-white">
          <Plus className="h-3 w-3" />
        </div>
      )}
    </div>
  )
}

/**
 * Left/right drop zones overlaid on a standalone block.
 * When a drag is active these zones become droppable targets.
 * Hovering over the left/right 25% shows a vertical blue line indicator
 * signaling "drop here to create side-by-side columns."
 */
function HorizontalDropZones({ blockId }: { readonly blockId: string }) {
  const { active } = useDndContext()

  const leftId = `${blockId}-drop-left`
  const rightId = `${blockId}-drop-right`

  const { isOver: isOverLeft, setNodeRef: setLeftRef } = useDroppable({ id: leftId })
  const { isOver: isOverRight, setNodeRef: setRightRef } = useDroppable({ id: rightId })

  // Only render when a drag is in progress
  if (!active) return null

  // Don't show horizontal drop zones when dragging the block itself
  if (String(active.id) === blockId) return null

  return (
    <>
      {/* Left 25% drop zone */}
      <div
        ref={setLeftRef}
        className="absolute inset-y-0 left-0 z-20"
        style={{ width: "25%" }}
      >
        {isOverLeft && (
          <div className="absolute inset-y-2 left-0 flex w-1 items-center">
            <div className="h-full w-full rounded-full bg-[var(--color-accent)]" />
            <div className="absolute -left-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--color-accent)] text-white shadow-sm">
              <Columns className="h-3 w-3" />
            </div>
          </div>
        )}
      </div>
      {/* Right 25% drop zone */}
      <div
        ref={setRightRef}
        className="absolute inset-y-0 right-0 z-20"
        style={{ width: "25%" }}
      >
        {isOverRight && (
          <div className="absolute inset-y-2 right-0 flex w-1 items-center">
            <div className="h-full w-full rounded-full bg-[var(--color-accent)]" />
            <div className="absolute -right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-[var(--color-accent)] text-white shadow-sm">
              <Columns className="h-3 w-3" />
            </div>
          </div>
        )}
      </div>
    </>
  )
}

export function DocumentPreview({
  document: doc,
  selectedBlockId,
  onSelectBlock,
  onAddTextBlock,
  variables,
  onMoveBlock: _onMoveBlock,
  onUpdateBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onMoveBlockUp,
  onMoveBlockDown,
  onResizeColumns,
  onAddColumn,
  onRemoveColumn,
  zoom = 100,
  onAddPage,
  onDuplicatePage,
  onDeletePage,
  isPaletteDrag = false,
  onPageClick,
}: DocumentPreviewProps) {
  // Each ExportPage is a distinct visual page; within each, page-break blocks
  // create additional visual pages. Result: a flat list of visual pages.
  const visualPages = doc.pages.flatMap((page) => {
    const splits = splitItemsByPageBreaks(page.items)
    return splits.map((items, subIndex) => ({
      pageId: page.id,
      items,
      subIndex,
    }))
  })
  const totalPages = visualPages.length
  const canDeletePage = doc.pages.length > 1

  // Collect all non-page-break block IDs for the sortable context
  const allBlocks = doc.pages.flatMap((page) => flattenItems(page.items))
  const sortableIds = allBlocks
    .filter((b) => b.type !== "page-break")
    .map((b) => b.id)

  return (
    <SortableContext
      items={sortableIds}
      strategy={verticalListSortingStrategy}
    >
      <main
        data-testid="document-preview"
        className="flex flex-1 flex-col items-center overflow-y-auto bg-[var(--doc-canvas-bg)] p-8"
        onClick={() => onSelectBlock(null)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onSelectBlock(null)
          }
        }}
        role="presentation"
      >
        <div
          className="flex flex-col items-center gap-8"
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: "top center",
          }}
        >
          {visualPages.map((vp, pageIndex) => {
            const { pageId: currentPageId, items: pageItems, subIndex } = vp
            const visualKey = `${currentPageId}-s${String(subIndex)}`

            // Build a flat index counter for drop gaps
            // Count items before this visual page to get correct insertion indices
            let itemsBeforeThisPage = 0
            for (let i = 0; i < pageIndex; i++) {
              const prev = visualPages[i]
              if (prev) {
                itemsBeforeThisPage += prev.items.length
                // Add 1 for the page-break that caused the split
                if (i < pageIndex) itemsBeforeThisPage += 1
              }
            }

            return (
              <div key={visualKey}>
                <div
                  className="doc-page relative w-full max-w-[960px] min-h-[1243px]"
                  onClick={() => onPageClick?.(currentPageId)}
                >
                  {/* Page actions menu */}
                  <div className="absolute right-2 top-2 z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-text-subtle)] opacity-0 transition-opacity hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-muted)] [.doc-page:hover_&]:opacity-100"
                        >
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Page actions</span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onDuplicatePage?.(currentPageId)
                          }}
                        >
                          <Copy className="h-4 w-4" />
                          Duplicate Page
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={!canDeletePage}
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeletePage?.(currentPageId)
                          }}
                          className="text-[var(--color-danger)]"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete Page
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="doc-page-content flex flex-col gap-2 pl-8">
                    {pageItems.length === 0 && pageIndex === 0 && totalPages === 1 ? (
                      <>
                        <DropGap
                          id={`drop-gap-${currentPageId}-0`}
                          isPaletteDrag={isPaletteDrag}
                        />
                        <div className="flex flex-col items-center justify-center py-24 text-center">
                          <p className="text-sm text-[var(--color-text-subtle)]">
                            Add blocks from the palette to build your document.
                          </p>
                        </div>
                      </>
                    ) : (
                      pageItems.map((item, itemIndex) => {
                        const globalIndex = itemsBeforeThisPage + itemIndex
                        return (
                          <div key={isHStackRow(item) ? item.id : item.id}>
                            <DropGap
                              id={`drop-gap-${currentPageId}-${String(globalIndex)}`}
                              isPaletteDrag={isPaletteDrag}
                            />
                            {isHStackRow(item) ? (
                              <HStackRowView
                                row={item}
                                selectedBlockId={selectedBlockId}
                                onSelectBlock={onSelectBlock}
                                variables={variables}
                                onResizeColumns={onResizeColumns ?? (() => {})}
                                onUpdateBlock={onUpdateBlock}
                                onAddColumn={onAddColumn}
                                onRemoveColumn={onRemoveColumn}
                              />
                            ) : (
                              <div className="relative">
                                <HorizontalDropZones blockId={item.id} />
                                <SortableBlock
                                  block={item}
                                  selected={selectedBlockId === item.id}
                                  onSelect={() => onSelectBlock(item.id)}
                                  variables={variables}
                                  onUpdateBlock={onUpdateBlock}
                                  onDeleteBlock={onDeleteBlock}
                                  onDuplicateBlock={onDuplicateBlock}
                                  onMoveBlockUp={onMoveBlockUp}
                                  onMoveBlockDown={onMoveBlockDown}
                                  isFirst={globalIndex === 0 && pageIndex === 0}
                                  isLast={
                                    pageIndex === visualPages.length - 1 &&
                                    itemIndex === pageItems.length - 1
                                  }
                                />
                              </div>
                            )}
                          </div>
                        )
                      })
                    )}

                    {/* Trailing drop gap after the last item */}
                    {(pageItems.length > 0 || (pageIndex > 0 || totalPages > 1)) && (
                      <DropGap
                        id={`drop-gap-${currentPageId}-${String(itemsBeforeThisPage + pageItems.length)}`}
                        isPaletteDrag={isPaletteDrag}
                      />
                    )}

                    {/* Add Text Block button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddTextBlock(currentPageId)
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

                {/* Insert page button between pages */}
                {onAddPage && (
                  <div className="flex items-center justify-center py-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onAddPage()
                      }}
                      className="flex h-7 items-center gap-1.5 rounded-full border border-dashed border-[var(--color-border)] px-3 text-xs text-[var(--color-text-subtle)] opacity-0 transition-opacity hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-muted)] [div:hover>&]:opacity-100"
                    >
                      <Plus className="h-3 w-3" />
                      Insert Page
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </main>
    </SortableContext>
  )
}
