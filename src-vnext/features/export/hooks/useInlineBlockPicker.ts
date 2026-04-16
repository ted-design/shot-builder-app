import { useState, useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react"
import type { BlockType, ExportBlock, ExportDocument, ExportPage } from "../types/exportBuilder"
import { createBlock } from "../lib/blockDefaults"
import { insertBlockAtIndex } from "../lib/documentOperations"

export interface UseInlineBlockPickerReturn {
  readonly blockPickerOpen: boolean
  readonly setBlockPickerOpen: Dispatch<SetStateAction<boolean>>
  readonly handleBlockPickerSelect: (type: BlockType | "hstack") => void
  readonly handleOpenBlockPicker: (pageId: string, insertIndex: number) => void
}

export function useInlineBlockPicker(
  document: ExportDocument,
  setDocument: Dispatch<SetStateAction<ExportDocument>>,
  setSelectedBlockId: Dispatch<SetStateAction<string | null>>,
  handleAddBlock: (type: BlockType | "hstack") => void,
  activePageIdRef: React.RefObject<string | null>,
): UseInlineBlockPickerReturn {
  const [blockPickerOpen, setBlockPickerOpen] = useState(false)
  const insertRef = useRef<{ pageId: string; index: number } | null>(null)

  useEffect(() => {
    const handleCmdSlash = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key !== "/") return
      const target = e.target as HTMLElement
      if (target.isContentEditable || target.tagName === "INPUT" || target.tagName === "TEXTAREA") return
      e.preventDefault()
      const pageId = activePageIdRef.current ?? document.pages[0]?.id
      if (!pageId) return
      const page = document.pages.find((p) => p.id === pageId)
      insertRef.current = { pageId, index: page?.items.length ?? 0 }
      setBlockPickerOpen(true)
    }
    window.document.addEventListener("keydown", handleCmdSlash)
    return () => window.document.removeEventListener("keydown", handleCmdSlash)
  }, [document.pages, activePageIdRef])

  const handleBlockPickerSelect = useCallback(
    (type: BlockType | "hstack") => {
      const insert = insertRef.current
      if (!insert) {
        handleAddBlock(type)
        return
      }
      if (type === "hstack") {
        setDocument((prev) => {
          const row = {
            id: crypto.randomUUID(),
            type: "hstack" as const,
            columns: [
              { id: crypto.randomUUID(), widthPercent: 50, blocks: [] as readonly ExportBlock[] },
              { id: crypto.randomUUID(), widthPercent: 50, blocks: [] as readonly ExportBlock[] },
            ],
          }
          return insertBlockAtIndex(prev, insert.pageId, row, insert.index)
        })
      } else {
        const newBlock = createBlock(type)
        setDocument((prev) =>
          insertBlockAtIndex(prev, insert.pageId, newBlock, insert.index),
        )
        setSelectedBlockId(newBlock.id)
      }
      insertRef.current = null
    },
    [handleAddBlock, setDocument, setSelectedBlockId],
  )

  const handleOpenBlockPicker = useCallback(
    (pageId: string, insertIndex: number) => {
      insertRef.current = { pageId, index: insertIndex }
      setBlockPickerOpen(true)
    },
    [],
  )

  return {
    blockPickerOpen,
    setBlockPickerOpen,
    handleBlockPickerSelect,
    handleOpenBlockPicker,
  }
}
