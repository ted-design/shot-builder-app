import { useState } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
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
import { ShotCard, type ShotCardVisibleFields } from "@/features/shots/components/ShotCard"
import { persistShotOrder } from "@/features/shots/lib/reorderShots"
import { useAuth } from "@/app/providers/AuthProvider"
import { GripVertical } from "lucide-react"
import { toast } from "sonner"
import type { Shot } from "@/shared/types"

interface DraggableShotListProps {
  readonly shots: ReadonlyArray<Shot>
  readonly disabled?: boolean
  readonly visibleFields?: Partial<ShotCardVisibleFields>
  readonly talentNameById?: ReadonlyMap<string, string> | null
  readonly locationNameById?: ReadonlyMap<string, string> | null
  readonly selection?: {
    readonly enabled: boolean
    readonly selectedIds: ReadonlySet<string>
    readonly onToggle: (shotId: string) => void
  }
}

export function DraggableShotList({
  shots,
  disabled,
  visibleFields,
  talentNameById,
  locationNameById,
  selection,
}: DraggableShotListProps) {
  const { clientId } = useAuth()
  const [optimisticOrder, setOptimisticOrder] = useState<ReadonlyArray<Shot> | null>(null)
  const displayShots = optimisticOrder ?? shots

  const selectionEnabled = selection?.enabled === true

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !clientId) return

    const oldIndex = displayShots.findIndex((s) => s.id === active.id)
    const newIndex = displayShots.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove([...displayShots], oldIndex, newIndex)
    setOptimisticOrder(reordered)

    try {
      await persistShotOrder(reordered, clientId)
      setOptimisticOrder(null)
    } catch {
      setOptimisticOrder(null)
      toast.error("Failed to save shot order. Reverting.")
    }
  }

  if (disabled || selectionEnabled) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {displayShots.map((shot) => (
          <ShotCard
            key={shot.id}
            shot={shot}
            selectable={selectionEnabled}
            selected={selection?.selectedIds.has(shot.id) ?? false}
            onSelectedChange={() => selection?.onToggle(shot.id)}
            visibleFields={visibleFields}
            talentNameById={talentNameById}
            locationNameById={locationNameById}
          />
        ))}
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={displayShots.map((s) => s.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayShots.map((shot) => (
            <SortableShotCard
              key={shot.id}
              shot={shot}
              visibleFields={visibleFields}
              talentNameById={talentNameById}
              locationNameById={locationNameById}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  )
}

function SortableShotCard({
  shot,
  visibleFields,
  talentNameById,
  locationNameById,
}: {
  readonly shot: Shot
  readonly visibleFields?: Partial<ShotCardVisibleFields>
  readonly talentNameById?: ReadonlyMap<string, string> | null
  readonly locationNameById?: ReadonlyMap<string, string> | null
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: shot.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="group">
      <ShotCard
        shot={shot}
        leadingControl={
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="inline-flex h-7 w-7 cursor-grab items-center justify-center rounded-[var(--radius-sm)] border border-transparent text-[var(--color-text-subtle)] opacity-100 transition-opacity hover:border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)] md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 focus-visible:opacity-100 active:cursor-grabbing"
            aria-label="Reorder shot"
            title="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        }
        visibleFields={visibleFields}
        talentNameById={talentNameById}
        locationNameById={locationNameById}
      />
    </div>
  )
}
