import { useMemo, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { BoardColumn } from "@/features/shots/components/BoardColumn"
import { BoardCard } from "@/features/shots/components/BoardCard"
import type { Shot, ShotFirestoreStatus } from "@/shared/types"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ShotBoardViewProps {
  readonly shots: ReadonlyArray<Shot>
  readonly onStatusChange: (shotId: string, newStatus: ShotFirestoreStatus, shot: Shot) => void
  readonly onOpenShot: (shotId: string) => void
}

// ---------------------------------------------------------------------------
// Status column order
// ---------------------------------------------------------------------------

const COLUMN_STATUSES: ReadonlyArray<ShotFirestoreStatus> = [
  "todo",
  "in_progress",
  "on_hold",
  "complete",
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShotBoardView({ shots, onStatusChange, onOpenShot }: ShotBoardViewProps) {
  const [activeShotId, setActiveShotId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const buckets = useMemo(() => {
    const map: Record<ShotFirestoreStatus, Shot[]> = {
      todo: [],
      in_progress: [],
      on_hold: [],
      complete: [],
    }
    for (const shot of shots) {
      const bucket = map[shot.status]
      if (bucket) bucket.push(shot)
    }
    return map
  }, [shots])

  const activeShot = activeShotId
    ? shots.find((s) => s.id === activeShotId) ?? null
    : null

  const handleDragStart = (event: DragStartEvent) => {
    setActiveShotId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveShotId(null)
    const { active, over } = event
    if (!over) return

    const shotId = active.id as string
    const newStatus = over.id as ShotFirestoreStatus
    const shot = shots.find((s) => s.id === shotId)
    if (!shot || shot.status === newStatus) return

    onStatusChange(shotId, newStatus, shot)
  }

  const handleDragCancel = () => {
    setActiveShotId(null)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid grid-cols-[repeat(4,minmax(260px,1fr))] gap-4 overflow-x-auto pb-2">
        {COLUMN_STATUSES.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            shots={buckets[status]}
            onOpenShot={onOpenShot}
            renderCard={(shot) => (
              <DraggableBoardCard
                key={shot.id}
                shot={shot}
                onOpenShot={onOpenShot}
              />
            )}
          />
        ))}
      </div>

      <DragOverlay>
        {activeShot ? (
          <BoardCard shot={activeShot} isDragging onOpenShot={onOpenShot} />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

// ---------------------------------------------------------------------------
// DraggableBoardCard — wraps BoardCard with useDraggable
// ---------------------------------------------------------------------------

function DraggableBoardCard({
  shot,
  onOpenShot,
}: {
  readonly shot: Shot
  readonly onOpenShot: (shotId: string) => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: shot.id,
  })

  return (
    <div ref={setNodeRef} {...attributes} {...listeners}>
      <BoardCard shot={shot} isDragging={isDragging} onOpenShot={onOpenShot} />
    </div>
  )
}
