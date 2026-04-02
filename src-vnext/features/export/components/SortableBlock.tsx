import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import type { ExportBlock, ExportVariable } from "../types/exportBuilder"
import { BlockRenderer } from "./BlockRenderer"

interface SortableBlockProps {
  readonly block: ExportBlock
  readonly selected: boolean
  readonly onSelect: () => void
  readonly variables: readonly ExportVariable[]
}

export function SortableBlock({
  block,
  selected,
  onSelect,
  variables,
}: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="group relative">
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
      <BlockRenderer
        block={block}
        selected={selected}
        onSelect={onSelect}
        variables={variables}
      />
    </div>
  )
}
