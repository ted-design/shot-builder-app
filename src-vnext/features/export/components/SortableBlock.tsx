import { useCallback, useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Copy, GripVertical, Trash2 } from "lucide-react"
import type { ExportBlock, ExportVariable } from "../types/exportBuilder"
import { BlockRenderer } from "./BlockRenderer"
import { BlockContextMenu } from "./BlockContextMenu"

interface SortableBlockProps {
  readonly block: ExportBlock
  readonly selected: boolean
  readonly onSelect: () => void
  readonly variables: readonly ExportVariable[]
  readonly onUpdateBlock?: (blockId: string, updates: Partial<ExportBlock>) => void
  readonly onDeleteBlock?: (blockId: string) => void
  readonly onDuplicateBlock?: (blockId: string) => void
  readonly onMoveBlockUp?: (blockId: string) => void
  readonly onMoveBlockDown?: (blockId: string) => void
  readonly isFirst?: boolean
  readonly isLast?: boolean
}

export function SortableBlock({
  block,
  selected,
  onSelect,
  variables,
  onUpdateBlock,
  onDeleteBlock,
  onDuplicateBlock,
  onMoveBlockUp,
  onMoveBlockDown,
  isFirst = false,
  isLast = false,
}: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id })

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setContextMenu({ x: e.clientX, y: e.clientY })
      onSelect()
    },
    [onSelect],
  )

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const hoverBtnClass =
    "inline-flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-subtle)] opacity-0 transition-opacity hover:bg-[var(--color-surface-muted)] group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100"

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative"
      onContextMenu={handleContextMenu}
    >
      {/* Drag handle — left edge */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute -left-8 top-1/2 z-10 inline-flex h-6 w-6 -translate-y-1/2 cursor-grab items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-subtle)] opacity-0 transition-opacity hover:text-[var(--color-text)] group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
        aria-label="Reorder block"
        title="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Inline action buttons — top-right */}
      <div className="absolute right-1 top-1 z-10 flex items-center gap-0.5">
        <button
          type="button"
          className={hoverBtnClass}
          aria-label="Duplicate block"
          title="Duplicate block"
          onClick={(e) => {
            e.stopPropagation()
            onDuplicateBlock?.(block.id)
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className={`${hoverBtnClass} hover:text-[var(--color-danger)]`}
          aria-label="Delete block"
          title="Delete block"
          onClick={(e) => {
            e.stopPropagation()
            onDeleteBlock?.(block.id)
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <BlockRenderer
        block={block}
        selected={selected}
        onSelect={onSelect}
        variables={variables}
        onUpdateBlock={onUpdateBlock}
      />

      {/* Context menu */}
      {contextMenu && (
        <BlockContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onDuplicate={() => onDuplicateBlock?.(block.id)}
          onDelete={() => onDeleteBlock?.(block.id)}
          onMoveUp={() => onMoveBlockUp?.(block.id)}
          onMoveDown={() => onMoveBlockDown?.(block.id)}
          canMoveUp={!isFirst}
          canMoveDown={!isLast}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
