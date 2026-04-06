import { useCallback, type ReactNode } from "react"
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
import type { ColumnWidthPreset, TableStyle } from "../../types/exportBuilder"
import { COLUMN_WIDTH_PRESETS } from "../../types/exportBuilder"

const WIDTH_PRESET_OPTIONS: readonly {
  readonly value: ColumnWidthPreset
  readonly label: string
}[] = Object.entries(COLUMN_WIDTH_PRESETS).map(([value, { label }]) => ({
  value: value as ColumnWidthPreset,
  label,
}))

interface ColumnDef {
  readonly key: string
  readonly label: string
  readonly visible: boolean
  readonly width?: ColumnWidthPreset
  readonly order?: number
}

interface ColumnTableSettingsProps<C extends ColumnDef> {
  readonly columns: readonly C[]
  readonly tableStyle: TableStyle | undefined
  readonly onColumnsChange: (columns: readonly C[]) => void
  readonly onTableStyleChange: (style: TableStyle) => void
  readonly children?: ReactNode
}

const STYLE_TOGGLES: readonly {
  readonly key: keyof TableStyle
  readonly label: string
}[] = [
  { key: "showBorders", label: "Borders" },
  { key: "showHeaderBg", label: "Header Background" },
  { key: "stripeRows", label: "Stripe Rows" },
]

interface SortableColumnRowProps<C extends ColumnDef> {
  readonly column: C
  readonly onToggle: (key: string) => void
  readonly onWidthChange: (key: string, width: string) => void
}

function SortableColumnRow<C extends ColumnDef>({
  column,
  onToggle,
  onWidthChange,
}: SortableColumnRowProps<C>) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-[var(--color-surface-subtle)]"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="inline-flex h-5 w-5 shrink-0 cursor-grab items-center justify-center text-[var(--color-text-subtle)] hover:text-[var(--color-text)] active:cursor-grabbing"
        aria-label={`Reorder ${column.label}`}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={() => onToggle(column.key)}
        data-testid={`col-toggle-${column.key}`}
        className="shrink-0"
      >
        {column.visible ? (
          <Eye className="h-3.5 w-3.5 text-[var(--color-text)]" />
        ) : (
          <EyeOff className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
        )}
      </button>

      <span
        className={`flex-1 ${
          column.visible
            ? "text-[var(--color-text)]"
            : "text-[var(--color-text-muted)]"
        }`}
      >
        {column.label}
      </span>

      <select
        value={column.width ?? "md"}
        onChange={(e) => onWidthChange(column.key, e.target.value)}
        onClick={(e) => e.stopPropagation()}
        data-testid={`col-width-${column.key}`}
        className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-2xs text-[var(--color-text)]"
      >
        {WIDTH_PRESET_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

export function ColumnTableSettings<C extends ColumnDef>({
  columns,
  tableStyle,
  onColumnsChange,
  onTableStyleChange,
  children,
}: ColumnTableSettingsProps<C>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const sorted = [...columns].sort(
    (a, b) => (a.order ?? 0) - (b.order ?? 0),
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return

      const oldIndex = sorted.findIndex((col) => col.key === active.id)
      const newIndex = sorted.findIndex((col) => col.key === over.id)
      if (oldIndex === -1 || newIndex === -1) return

      const reordered = arrayMove([...sorted], oldIndex, newIndex)
      const updatedColumns: C[] = reordered.map((col, index) => ({
        ...(col as C),
        order: index,
      }))
      onColumnsChange(updatedColumns)
    },
    [sorted, onColumnsChange],
  )

  const handleColumnToggle = useCallback(
    (columnKey: string) => {
      const updatedColumns = columns.map((col) =>
        col.key === columnKey ? { ...col, visible: !col.visible } : col,
      )
      onColumnsChange(updatedColumns)
    },
    [columns, onColumnsChange],
  )

  const handleColumnWidthChange = useCallback(
    (columnKey: string, width: string) => {
      const updatedColumns = columns.map((col) =>
        col.key === columnKey
          ? { ...col, width: width as ColumnWidthPreset }
          : col,
      )
      onColumnsChange(updatedColumns)
    },
    [columns, onColumnsChange],
  )

  const handleTableStyleToggle = useCallback(
    (key: keyof TableStyle) => {
      const current = tableStyle ?? {}
      onTableStyleChange({
        ...current,
        [key]: !current[key],
      })
    },
    [tableStyle, onTableStyleChange],
  )

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-2xs font-medium text-[var(--color-text-muted)]">
          Columns
        </label>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sorted.map((col) => col.key)}
            strategy={verticalListSortingStrategy}
          >
            <div className="mt-1 flex flex-col gap-1">
              {sorted.map((col) => (
                <SortableColumnRow
                  key={col.key}
                  column={col}
                  onToggle={handleColumnToggle}
                  onWidthChange={handleColumnWidthChange}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <div>
        <label className="text-2xs font-medium text-[var(--color-text-muted)]">
          Table Style
        </label>
        <div className="mt-1 flex flex-col gap-1">
          {STYLE_TOGGLES.map(({ key, label }) => {
            const checked = Boolean(tableStyle?.[key])
            return (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-[var(--color-surface-subtle)]"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => handleTableStyleToggle(key)}
                  data-testid={`style-toggle-${key}`}
                  className="rounded border-[var(--color-border)]"
                />
                <span className="text-[var(--color-text)]">{label}</span>
              </label>
            )
          })}
        </div>
      </div>

      {children}
    </div>
  )
}
