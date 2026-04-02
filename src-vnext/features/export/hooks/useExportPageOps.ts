import { useCallback, type Dispatch, type SetStateAction } from "react"
import { toast } from "sonner"
import type { ExportDocument } from "../types/exportBuilder"
import {
  addColumnToRow,
  addPage,
  duplicatePage,
  removeColumnFromRow,
  removePage,
  resizeColumns,
} from "../lib/documentOperations"

export function useExportPageOps(
  document: ExportDocument,
  setDocument: Dispatch<SetStateAction<ExportDocument>>,
  activePageId: string | null,
  setActivePageId: (id: string | null) => void,
) {
  const handleAddPage = useCallback(() => {
    setDocument((prev) => {
      const updated = addPage(prev)
      const newPage = updated.pages[updated.pages.length - 1]
      if (newPage) {
        setActivePageId(newPage.id)
      }
      return updated
    })
  }, [setDocument, setActivePageId])

  const handleDuplicatePage = useCallback((pageId: string) => {
    setDocument((prev) => {
      const updated = duplicatePage(prev, pageId)
      // The duplicated page is inserted after the original
      const originalIdx = prev.pages.findIndex((p) => p.id === pageId)
      const newPage = updated.pages[originalIdx + 1]
      if (newPage) {
        setActivePageId(newPage.id)
      }
      return updated
    })
  }, [setDocument, setActivePageId])

  const handleDeletePage = useCallback(
    (pageId: string) => {
      if (document.pages.length <= 1) return
      const pageIdx = document.pages.findIndex((p) => p.id === pageId)
      const prevPage = document.pages[pageIdx - 1] ?? document.pages[pageIdx + 1]
      setDocument((prev) => removePage(prev, pageId))
      if (activePageId === pageId) {
        setActivePageId(prevPage?.id ?? null)
      }
      toast.success("Page deleted")
    },
    [document.pages, setDocument, activePageId, setActivePageId],
  )

  const handleResizeColumns = useCallback(
    (rowId: string, widths: Record<string, number>) => {
      setDocument((prev) => {
        const targetPage = prev.pages.find((p) => p.id === activePageId) ?? prev.pages[0]
        const targetPageId = targetPage?.id ?? "page-1"
        return resizeColumns(prev, targetPageId, rowId, widths)
      })
    },
    [setDocument, activePageId],
  )

  const handleAddColumn = useCallback(
    (rowId: string) => {
      const targetPage = document.pages.find((p) => p.id === activePageId) ?? document.pages[0]
      const pageId = targetPage?.id ?? "page-1"
      setDocument((prev) => addColumnToRow(prev, pageId, rowId))
    },
    [document.pages, setDocument, activePageId],
  )

  const handleRemoveColumn = useCallback(
    (rowId: string, columnId: string) => {
      const targetPage = document.pages.find((p) => p.id === activePageId) ?? document.pages[0]
      const pageId = targetPage?.id ?? "page-1"
      setDocument((prev) => removeColumnFromRow(prev, pageId, rowId, columnId))
    },
    [document.pages, setDocument, activePageId],
  )

  return {
    handleAddPage,
    handleDuplicatePage,
    handleDeletePage,
    handleResizeColumns,
    handleAddColumn,
    handleRemoveColumn,
  }
}
