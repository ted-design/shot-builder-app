import { useCallback, useState, type KeyboardEvent, type RefObject } from "react"

/**
 * Keyboard navigation for table rows.
 * Arrow keys navigate rows, Enter activates, Escape clears selection.
 */
export function useTableKeyboardNav(opts: {
  readonly tableRef: RefObject<HTMLTableElement | null>
  readonly rowCount: number
  readonly onActivateRow?: (index: number) => void
}): {
  readonly activeRowIndex: number | null
  readonly onTableKeyDown: (e: KeyboardEvent) => void
} {
  const { tableRef, rowCount, onActivateRow } = opts
  const [activeRowIndex, setActiveRowIndex] = useState<number | null>(null)

  const updateActiveRow = useCallback(
    (index: number | null) => {
      setActiveRowIndex(index)

      // Apply data-active-row attribute to the correct <tr>
      const table = tableRef.current
      if (!table) return

      const tbody = table.querySelector("tbody")
      if (!tbody) return

      const rows = tbody.querySelectorAll("tr")
      for (const row of rows) {
        row.removeAttribute("data-active-row")
      }

      if (index !== null && rows[index]) {
        rows[index].setAttribute("data-active-row", "true")
      }
    },
    [tableRef],
  )

  const onTableKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (rowCount === 0) return

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault()
          const next = activeRowIndex === null
            ? 0
            : (activeRowIndex + 1) % rowCount
          updateActiveRow(next)
          break
        }
        case "ArrowUp": {
          e.preventDefault()
          const prev = activeRowIndex === null
            ? rowCount - 1
            : (activeRowIndex - 1 + rowCount) % rowCount
          updateActiveRow(prev)
          break
        }
        case "Home": {
          e.preventDefault()
          updateActiveRow(0)
          break
        }
        case "End": {
          e.preventDefault()
          updateActiveRow(rowCount - 1)
          break
        }
        case "Enter": {
          if (activeRowIndex !== null) {
            e.preventDefault()
            onActivateRow?.(activeRowIndex)
          }
          break
        }
        case "Escape": {
          e.preventDefault()
          updateActiveRow(null)
          break
        }
        default:
          break
      }
    },
    [rowCount, activeRowIndex, updateActiveRow, onActivateRow],
  )

  return { activeRowIndex, onTableKeyDown }
}
