import type {
  ExportBlock,
  ExportDocument,
  ExportPage,
  ExportTemplate,
  HStackColumn,
  HStackRow,
  PageItem,
  PageSettings,
} from "../types/exportBuilder"
import { isHStackRow } from "../types/exportBuilder"

/** Map over items in a page, applying a transform to each block (including inside HStack columns).
 *  If blockMapper returns null, the block is removed.
 */
function mapPageItems(
  items: readonly PageItem[],
  blockMapper: (block: ExportBlock) => ExportBlock | null,
): readonly PageItem[] {
  const result: PageItem[] = []
  for (const item of items) {
    if (isHStackRow(item)) {
      result.push({
        ...item,
        columns: item.columns.map((col) => ({
          ...col,
          blocks: col.blocks
            .map(blockMapper)
            .filter((b): b is ExportBlock => b !== null),
        })),
      })
    } else {
      const mapped = blockMapper(item)
      if (mapped !== null) {
        result.push(mapped)
      }
    }
  }
  return result
}

/** Add a block to a page */
export function addBlockToPage(
  doc: ExportDocument,
  pageId: string,
  block: ExportBlock,
): ExportDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) =>
      page.id === pageId
        ? { ...page, items: [...page.items, block] }
        : page,
    ),
    updatedAt: new Date().toISOString(),
  }
}

/** Insert a block at a specific index within a page's items */
export function insertBlockAtIndex(
  doc: ExportDocument,
  pageId: string,
  block: PageItem,
  index: number,
): ExportDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => {
      if (page.id !== pageId) return page
      const items = [...page.items]
      const clamped = Math.max(0, Math.min(index, items.length))
      items.splice(clamped, 0, block)
      return { ...page, items }
    }),
    updatedAt: new Date().toISOString(),
  }
}

/** Remove a block from a page (also searches inside HStack columns) */
export function removeBlockFromPage(
  doc: ExportDocument,
  pageId: string,
  blockId: string,
): ExportDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) =>
      page.id === pageId
        ? {
            ...page,
            items: mapPageItems(page.items, (b) =>
              b.id === blockId ? null : b,
            ),
          }
        : page,
    ),
    updatedAt: new Date().toISOString(),
  }
}

/** Update a block's properties (also searches inside HStack columns) */
export function updateBlock(
  doc: ExportDocument,
  pageId: string,
  blockId: string,
  updates: Record<string, unknown>,
): ExportDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) =>
      page.id === pageId
        ? {
            ...page,
            items: mapPageItems(page.items, (b) =>
              b.id === blockId
                ? ({ ...b, ...updates } as ExportBlock)
                : b,
            ),
          }
        : page,
    ),
    updatedAt: new Date().toISOString(),
  }
}

/** Move a block within a page (reorder top-level items only) */
export function moveBlock(
  doc: ExportDocument,
  pageId: string,
  blockId: string,
  newIndex: number,
): ExportDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => {
      if (page.id !== pageId) return page

      const currentIndex = page.items.findIndex(
        (item) => !isHStackRow(item) && item.id === blockId,
      )
      if (currentIndex === -1) return page

      const items = [...page.items]
      const [moved] = items.splice(currentIndex, 1)
      if (!moved) return page

      const clampedIndex = Math.max(0, Math.min(newIndex, items.length))
      items.splice(clampedIndex, 0, moved)

      return { ...page, items }
    }),
    updatedAt: new Date().toISOString(),
  }
}

/** Add a new empty page */
export function addPage(doc: ExportDocument): ExportDocument {
  const newPage: ExportPage = {
    id: crypto.randomUUID(),
    items: [],
  }

  return {
    ...doc,
    pages: [...doc.pages, newPage],
    updatedAt: new Date().toISOString(),
  }
}

/** Remove a page */
export function removePage(
  doc: ExportDocument,
  pageId: string,
): ExportDocument {
  return {
    ...doc,
    pages: doc.pages.filter((p) => p.id !== pageId),
    updatedAt: new Date().toISOString(),
  }
}

/** Deep-duplicate a PageItem, assigning fresh UUIDs */
function duplicateItem(item: PageItem): PageItem {
  if (isHStackRow(item)) {
    return {
      ...item,
      id: crypto.randomUUID(),
      columns: item.columns.map((col) => ({
        ...col,
        id: crypto.randomUUID(),
        blocks: col.blocks.map((block) => ({
          ...block,
          id: crypto.randomUUID(),
        })),
      })),
    }
  }
  return { ...item, id: crypto.randomUUID() }
}

/** Duplicate a page (deep copy with new ids) */
export function duplicatePage(
  doc: ExportDocument,
  pageId: string,
): ExportDocument {
  const sourcePage = doc.pages.find((p) => p.id === pageId)
  if (!sourcePage) return doc

  const duplicatedPage: ExportPage = {
    id: crypto.randomUUID(),
    items: sourcePage.items.map(duplicateItem),
  }

  const sourceIndex = doc.pages.findIndex((p) => p.id === pageId)
  const newPages = [...doc.pages]
  newPages.splice(sourceIndex + 1, 0, duplicatedPage)

  return {
    ...doc,
    pages: newPages,
    updatedAt: new Date().toISOString(),
  }
}

/** Apply a template (replaces entire document content). Handles templates with legacy `blocks` field. */
export function applyTemplate(template: ExportTemplate): ExportDocument {
  const now = new Date().toISOString()

  return {
    id: crypto.randomUUID(),
    name: template.name,
    pages: template.pages.map((page) => {
      const sourceItems: readonly PageItem[] =
        page.items ?? (page as { blocks?: readonly ExportBlock[] }).blocks ?? []
      return {
        id: crypto.randomUUID(),
        items: sourceItems.map(duplicateItem),
      }
    }),
    settings: { ...template.settings },
    createdAt: now,
    updatedAt: now,
  }
}

/** Update page settings */
export function updateSettings(
  doc: ExportDocument,
  settings: PageSettings,
): ExportDocument {
  return {
    ...doc,
    settings: { ...settings },
    updatedAt: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// HStack operations
// ---------------------------------------------------------------------------

const MIN_COLUMN_WIDTH_PERCENT = 15
const MAX_COLUMNS = 4

/** Add a new HStack row with 2 equal columns to a page */
export function addHStackRow(
  doc: ExportDocument,
  pageId: string,
): ExportDocument {
  const row: HStackRow = {
    id: crypto.randomUUID(),
    type: "hstack",
    columns: [
      { id: crypto.randomUUID(), widthPercent: 50, blocks: [] },
      { id: crypto.randomUUID(), widthPercent: 50, blocks: [] },
    ],
  }

  return {
    ...doc,
    pages: doc.pages.map((page) =>
      page.id === pageId
        ? { ...page, items: [...page.items, row] }
        : page,
    ),
    updatedAt: new Date().toISOString(),
  }
}

/** Redistribute widths equally across columns, giving remainder to last column */
function distributeWidths(count: number): readonly number[] {
  const base = Math.floor(100 / count)
  const remainder = 100 - base * count
  return Array.from({ length: count }, (_, i) =>
    i === count - 1 ? base + remainder : base,
  )
}

/** Add a column to an HStack row, redistributing widths equally */
export function addColumnToRow(
  doc: ExportDocument,
  pageId: string,
  rowId: string,
): ExportDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => {
      if (page.id !== pageId) return page
      return {
        ...page,
        items: page.items.map((item) => {
          if (!isHStackRow(item) || item.id !== rowId) return item
          if (item.columns.length >= MAX_COLUMNS) return item

          const newCount = item.columns.length + 1
          const widths = distributeWidths(newCount)
          const newCol: HStackColumn = {
            id: crypto.randomUUID(),
            widthPercent: widths[newCount - 1] ?? 25,
            blocks: [],
          }
          return {
            ...item,
            columns: [
              ...item.columns.map((col, i) => ({ ...col, widthPercent: widths[i] ?? 25 })),
              newCol,
            ],
          }
        }),
      }
    }),
    updatedAt: new Date().toISOString(),
  }
}

/** Remove a column from an HStack row. If last column, remove the entire row */
export function removeColumnFromRow(
  doc: ExportDocument,
  pageId: string,
  rowId: string,
  columnId: string,
): ExportDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => {
      if (page.id !== pageId) return page
      return {
        ...page,
        items: page.items
          .map((item) => {
            if (!isHStackRow(item) || item.id !== rowId) return item
            const remaining = item.columns.filter((c) => c.id !== columnId)
            if (remaining.length === 0) return null
            const widths = distributeWidths(remaining.length)
            return {
              ...item,
              columns: remaining.map((col, i) => ({
                ...col,
                widthPercent: widths[i] ?? 50,
              })),
            }
          })
          .filter((item): item is PageItem => item !== null),
      }
    }),
    updatedAt: new Date().toISOString(),
  }
}

/** Resize columns by setting new percentage widths. Must sum to 100, each >= 15 */
export function resizeColumns(
  doc: ExportDocument,
  pageId: string,
  rowId: string,
  widths: Record<string, number>,
): ExportDocument {
  const values = Object.values(widths)
  const sum = values.reduce((a, b) => a + b, 0)
  if (sum !== 100) return doc
  if (values.some((v) => v < MIN_COLUMN_WIDTH_PERCENT)) return doc

  return {
    ...doc,
    pages: doc.pages.map((page) => {
      if (page.id !== pageId) return page
      return {
        ...page,
        items: page.items.map((item) => {
          if (!isHStackRow(item) || item.id !== rowId) return item
          return {
            ...item,
            columns: item.columns.map((col) => ({
              ...col,
              widthPercent: widths[col.id] ?? col.widthPercent,
            })),
          }
        }),
      }
    }),
    updatedAt: new Date().toISOString(),
  }
}

/** Add a block to a specific column within an HStack row */
export function addBlockToColumn(
  doc: ExportDocument,
  pageId: string,
  rowId: string,
  columnId: string,
  block: ExportBlock,
): ExportDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => {
      if (page.id !== pageId) return page
      return {
        ...page,
        items: page.items.map((item) => {
          if (!isHStackRow(item) || item.id !== rowId) return item
          return {
            ...item,
            columns: item.columns.map((col) =>
              col.id === columnId
                ? { ...col, blocks: [...col.blocks, block] }
                : col,
            ),
          }
        }),
      }
    }),
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Wrap two blocks into a new HStack row with 50/50 columns.
 *
 * Finds `targetBlockId` in the page's top-level items (must be a standalone block,
 * not inside an existing HStack). Creates a 2-column HStack and places the blocks:
 * - position "right": target in column 1, newBlock in column 2
 * - position "left": newBlock in column 1, target in column 2
 *
 * Replaces the target's position in items with the new HStack row.
 * If the target is not found (or is inside an HStack), the document is returned unchanged.
 */
export function wrapBlocksInHStack(
  doc: ExportDocument,
  pageId: string,
  targetBlockId: string,
  newBlock: ExportBlock,
  position: "left" | "right",
): ExportDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => {
      if (page.id !== pageId) return page

      const targetIndex = page.items.findIndex(
        (item) => !isHStackRow(item) && item.id === targetBlockId,
      )
      if (targetIndex === -1) return page

      const targetBlock = page.items[targetIndex] as ExportBlock

      const leftBlock = position === "left" ? newBlock : targetBlock
      const rightBlock = position === "left" ? targetBlock : newBlock

      const row: HStackRow = {
        id: crypto.randomUUID(),
        type: "hstack",
        columns: [
          { id: crypto.randomUUID(), widthPercent: 50, blocks: [leftBlock] },
          { id: crypto.randomUUID(), widthPercent: 50, blocks: [rightBlock] },
        ],
      }

      const items = [...page.items]
      items[targetIndex] = row

      return { ...page, items }
    }),
    updatedAt: new Date().toISOString(),
  }
}

/** Move a block between columns within the same HStack row */
export function moveBlockBetweenColumns(
  doc: ExportDocument,
  pageId: string,
  rowId: string,
  fromColId: string,
  blockId: string,
  toColId: string,
  toIndex: number,
): ExportDocument {
  return {
    ...doc,
    pages: doc.pages.map((page) => {
      if (page.id !== pageId) return page
      return {
        ...page,
        items: page.items.map((item) => {
          if (!isHStackRow(item) || item.id !== rowId) return item

          const fromCol = item.columns.find((c) => c.id === fromColId)
          if (!fromCol) return item

          const block = fromCol.blocks.find((b) => b.id === blockId)
          if (!block) return item

          return {
            ...item,
            columns: item.columns.map((col) => {
              if (col.id === fromColId && col.id === toColId) {
                // Moving within the same column
                const without = col.blocks.filter((b) => b.id !== blockId)
                const clamped = Math.max(
                  0,
                  Math.min(toIndex, without.length),
                )
                const reordered = [...without]
                reordered.splice(clamped, 0, block)
                return { ...col, blocks: reordered }
              }
              if (col.id === fromColId) {
                return {
                  ...col,
                  blocks: col.blocks.filter((b) => b.id !== blockId),
                }
              }
              if (col.id === toColId) {
                const clamped = Math.max(
                  0,
                  Math.min(toIndex, col.blocks.length),
                )
                const newBlocks = [...col.blocks]
                newBlocks.splice(clamped, 0, block)
                return { ...col, blocks: newBlocks }
              }
              return col
            }),
          }
        }),
      }
    }),
    updatedAt: new Date().toISOString(),
  }
}
