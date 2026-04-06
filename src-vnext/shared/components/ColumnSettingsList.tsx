import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Eye, EyeOff, GripVertical } from "lucide-react"
import type { TableColumnConfig } from "@/shared/types/table"

export interface ColumnSettingsListProps {
  readonly columns: readonly TableColumnConfig[]
  readonly onToggleVisibility: (key: string) => void
  readonly onReorder: (orderedKeys: readonly string[]) => void
  readonly showReorder?: boolean
}

export function ColumnSettingsList({
  columns,
  onToggleVisibility,
  onReorder,
  showReorder = true,
}: ColumnSettingsListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const sorted = [...columns].sort((a, b) => a.order - b.order)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sorted.findIndex((col) => col.key === active.id)
    const newIndex = sorted.findIndex((col) => col.key === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove([...sorted], oldIndex, newIndex)
    onReorder(reordered.map((col) => col.key))
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={sorted.map((col) => col.key)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-col gap-0.5">
          {sorted.map((col) => (
            <SortableColumnItem
              key={col.key}
              column={col}
              onToggleVisibility={onToggleVisibility}
              showDragHandle={showReorder}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableColumnItem({
  column,
  onToggleVisibility,
  showDragHandle = true,
}: {
  readonly column: TableColumnConfig
  readonly onToggleVisibility: (key: string) => void
  readonly showDragHandle?: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.key })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const isPinned = column.pinned === true
  const isHidden = !column.visible

  const EyeIcon = isHidden ? EyeOff : Eye

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-[var(--radius-sm)] px-1.5 py-1 ${
        isHidden ? "opacity-40" : ""
      }`}
    >
      {showDragHandle ? (
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="inline-flex h-5 w-5 shrink-0 cursor-grab items-center justify-center text-[var(--color-text-subtle)] hover:text-[var(--color-text)] active:cursor-grabbing"
          aria-label={`Reorder ${column.label}`}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      ) : (
        <div className="w-5 shrink-0" />
      )}

      <span className="flex-1 truncate text-xs text-[var(--color-text)]">
        {column.label}
      </span>

      <button
        type="button"
        onClick={() => onToggleVisibility(column.key)}
        disabled={isPinned}
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-subtle)] transition-colors ${
          isPinned
            ? "cursor-not-allowed opacity-50"
            : "hover:text-[var(--color-text)]"
        }`}
        aria-label={
          isPinned
            ? `${column.label} is pinned`
            : isHidden
              ? `Show ${column.label}`
              : `Hide ${column.label}`
        }
      >
        <EyeIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
