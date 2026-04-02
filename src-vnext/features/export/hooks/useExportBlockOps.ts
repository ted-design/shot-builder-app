import { useCallback, type Dispatch, type SetStateAction } from "react"
import type {
  BlockType,
  ExportBlock,
  ExportDocument,
  ExportPage,
  PageItem,
} from "../types/exportBuilder"
import { isHStackRow } from "../types/exportBuilder"
import { createBlock } from "../lib/blockDefaults"
import { addHStackRow, moveBlock } from "../lib/documentOperations"

export function useExportBlockOps(
  setDocument: Dispatch<SetStateAction<ExportDocument>>,
  setSelectedBlockId: Dispatch<SetStateAction<string | null>>,
  activePageId: string | null,
) {
  const handleAddBlock = useCallback((type: BlockType | "hstack") => {
    if (type === "hstack") {
      setDocument((prev) => {
        const targetPage = prev.pages.find((p) => p.id === activePageId) ?? prev.pages[0]
        if (!targetPage) return prev
        return addHStackRow(prev, targetPage.id)
      })
      return
    }

    const newBlock = createBlock(type)
    setDocument((prev) => {
      const targetPage = prev.pages.find((p) => p.id === activePageId) ?? prev.pages[0]
      if (!targetPage) return prev
      const updatedPage: ExportPage = {
        ...targetPage,
        items: [...targetPage.items, newBlock],
      }
      return {
        ...prev,
        pages: prev.pages.map((p) => (p.id === updatedPage.id ? updatedPage : p)),
        updatedAt: new Date().toISOString(),
      }
    })
    setSelectedBlockId(newBlock.id)
  }, [setDocument, setSelectedBlockId, activePageId])

  const handleUpdateBlock = useCallback(
    (blockId: string, updates: Partial<ExportBlock>) => {
      setDocument((prev) => ({
        ...prev,
        pages: prev.pages.map((page) => ({
          ...page,
          items: page.items.map((item): PageItem => {
            if (isHStackRow(item)) {
              return {
                ...item,
                columns: item.columns.map((col) => ({
                  ...col,
                  blocks: col.blocks.map((block) =>
                    block.id === blockId
                      ? ({ ...block, ...updates } as ExportBlock)
                      : block,
                  ),
                })),
              }
            }
            return item.id === blockId
              ? ({ ...item, ...updates } as ExportBlock)
              : item
          }),
        })),
        updatedAt: new Date().toISOString(),
      }))
    },
    [setDocument],
  )

  const handleDeleteBlock = useCallback((blockId: string) => {
    setDocument((prev) => ({
      ...prev,
      pages: prev.pages.map((page) => ({
        ...page,
        items: page.items
          .map((item): PageItem | null => {
            if (isHStackRow(item)) {
              return {
                ...item,
                columns: item.columns.map((col) => ({
                  ...col,
                  blocks: col.blocks.filter((block) => block.id !== blockId),
                })),
              }
            }
            return item.id === blockId ? null : item
          })
          .filter((item): item is PageItem => item !== null),
      })),
      updatedAt: new Date().toISOString(),
    }))
    setSelectedBlockId((prev) => (prev === blockId ? null : prev))
  }, [setDocument, setSelectedBlockId])

  const handleDuplicateBlock = useCallback((blockId: string) => {
    setDocument((prev) => {
      const now = new Date().toISOString()
      const newPages = prev.pages.map((page) => {
        const newItems: PageItem[] = []
        for (const item of page.items) {
          newItems.push(item)
          if (isHStackRow(item)) {
            // Check columns for the block
            const colBlock = item.columns.flatMap((c) => c.blocks).find((b) => b.id === blockId)
            if (colBlock) {
              // Duplicate inside the same column
              const updatedColumns = item.columns.map((col) => {
                const idx = col.blocks.findIndex((b) => b.id === blockId)
                if (idx === -1) return col
                const clone = { ...col.blocks[idx]!, id: crypto.randomUUID() } as ExportBlock
                const blocks = [...col.blocks]
                blocks.splice(idx + 1, 0, clone)
                return { ...col, blocks }
              })
              // Replace the HStack we just pushed with updated version
              newItems[newItems.length - 1] = { ...item, columns: updatedColumns }
            }
          } else if (item.id === blockId) {
            const clone = { ...item, id: crypto.randomUUID() } as ExportBlock
            newItems.push(clone)
            setSelectedBlockId(clone.id)
          }
        }
        return { ...page, items: newItems }
      })
      return { ...prev, pages: newPages, updatedAt: now }
    })
  }, [setDocument, setSelectedBlockId])

  const handleMoveBlockUp = useCallback((blockId: string) => {
    setDocument((prev) => {
      const page = prev.pages.find((p) => p.id === activePageId) ?? prev.pages[0]
      if (!page) return prev
      const idx = page.items.findIndex((item) => !isHStackRow(item) && item.id === blockId)
      if (idx <= 0) return prev
      return moveBlock(prev, page.id, blockId, idx - 1)
    })
  }, [setDocument, activePageId])

  const handleMoveBlockDown = useCallback((blockId: string) => {
    setDocument((prev) => {
      const page = prev.pages.find((p) => p.id === activePageId) ?? prev.pages[0]
      if (!page) return prev
      const idx = page.items.findIndex((item) => !isHStackRow(item) && item.id === blockId)
      if (idx === -1 || idx >= page.items.length - 1) return prev
      return moveBlock(prev, page.id, blockId, idx + 1)
    })
  }, [setDocument, activePageId])

  return {
    handleAddBlock,
    handleUpdateBlock,
    handleDeleteBlock,
    handleDuplicateBlock,
    handleMoveBlockUp,
    handleMoveBlockDown,
  }
}
