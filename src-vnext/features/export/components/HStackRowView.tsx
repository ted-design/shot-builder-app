import { useCallback } from "react"
import { Columns, Minus, Plus } from "lucide-react"
import type {
  ExportBlock,
  ExportVariable,
  HStackRow,
} from "../types/exportBuilder"
import { BlockRenderer } from "./BlockRenderer"
import { ColumnResizeHandle } from "./ColumnResizeHandle"

interface HStackRowViewProps {
  readonly row: HStackRow
  readonly selectedBlockId: string | null
  readonly onSelectBlock: (blockId: string | null) => void
  readonly variables: readonly ExportVariable[]
  readonly onResizeColumns: (
    rowId: string,
    widths: Record<string, number>,
  ) => void
  readonly onUpdateBlock?: (
    blockId: string,
    updates: Partial<ExportBlock>,
  ) => void
  readonly onAddColumn?: (rowId: string) => void
  readonly onRemoveColumn?: (rowId: string, columnId: string) => void
}

/**
 * Renders an HStack row as a flex container with percentage-width columns.
 * Columns are separated by draggable resize handles.
 */
export function HStackRowView({
  row,
  selectedBlockId,
  onSelectBlock,
  variables,
  onResizeColumns,
  onUpdateBlock,
  onAddColumn,
  onRemoveColumn,
}: HStackRowViewProps) {
  const handleResize = useCallback(
    (leftIndex: number, deltaPercent: number) => {
      const leftCol = row.columns[leftIndex]
      const rightCol = row.columns[leftIndex + 1]
      if (!leftCol || !rightCol) return

      const newLeft = Math.round(leftCol.widthPercent + deltaPercent)
      const newRight = Math.round(rightCol.widthPercent - deltaPercent)

      const widths: Record<string, number> = {}
      for (const col of row.columns) {
        if (col.id === leftCol.id) {
          widths[col.id] = newLeft
        } else if (col.id === rightCol.id) {
          widths[col.id] = newRight
        } else {
          widths[col.id] = col.widthPercent
        }
      }

      onResizeColumns(row.id, widths)
    },
    [row.columns, row.id, onResizeColumns],
  )

  const columnCount = row.columns.length

  return (
    <div
      data-testid={`hstack-row-${row.id}`}
      className="group/hstack relative flex min-h-[80px] rounded border border-dashed border-[var(--color-border)] transition-colors hover:border-[var(--color-border-hover)]"
    >
      {/* Column count label — visible on hover */}
      <span className="absolute -top-5 left-1 text-2xs text-[var(--color-text-subtle)] opacity-0 transition-opacity group-hover/hstack:opacity-100">
        {String(columnCount)} {columnCount === 1 ? "column" : "columns"}
      </span>

      {row.columns.map((col, colIndex) => (
        <div
          key={col.id}
          className="group/col relative flex"
          style={{ width: `${String(col.widthPercent)}%` }}
        >
          {/* Remove column button — hover on row, per column */}
          {columnCount > 1 && onRemoveColumn && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onRemoveColumn(row.id, col.id)
              }}
              className="absolute -top-2.5 right-1 z-10 flex h-5 w-5 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-subtle)] opacity-0 transition-opacity hover:border-[var(--color-danger)] hover:text-[var(--color-danger)] group-hover/hstack:opacity-100"
              aria-label="Remove column"
            >
              <Minus className="h-3 w-3" />
            </button>
          )}

          {/* Column content */}
          <div className="flex flex-1 flex-col gap-1 rounded p-2 transition-colors group-hover/col:bg-[var(--color-surface-subtle)]/40">
            {col.blocks.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded border border-dashed border-[var(--color-border)] bg-[var(--color-surface-subtle)]/60 p-3">
                <Columns className="h-4 w-4 text-[var(--color-text-subtle)]" />
                <span className="text-2xs text-[var(--color-text-subtle)]">
                  Drop blocks here
                </span>
              </div>
            ) : (
              col.blocks.map((block) => (
                <BlockRenderer
                  key={block.id}
                  block={block}
                  selected={selectedBlockId === block.id}
                  onSelect={() => onSelectBlock(block.id)}
                  variables={variables}
                  onUpdateBlock={onUpdateBlock}
                />
              ))
            )}
          </div>

          {/* Resize handle between columns (not after the last) */}
          {colIndex < row.columns.length - 1 && (
            <ColumnResizeHandle
              onResize={(delta) => handleResize(colIndex, delta)}
            />
          )}
        </div>
      ))}

      {/* Add column button — right edge, visible on hover */}
      {onAddColumn && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onAddColumn(row.id)
          }}
          className="absolute -right-3 top-1/2 z-10 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-subtle)] opacity-0 shadow-sm transition-opacity hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] group-hover/hstack:opacity-100"
          aria-label="Add column"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
