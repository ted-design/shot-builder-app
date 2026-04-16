import { useState, useCallback } from "react"
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
import { GripVertical, RotateCcw } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/ui/dialog"
import { Button } from "@/ui/button"
import { DEFAULT_SECTION_ORDER, type SectionKey } from "./CallSheetRenderer"

interface SectionOrderDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly sectionOrder: readonly SectionKey[]
  readonly onSave: (order: readonly SectionKey[]) => void
}

const SECTION_LABELS: Record<SectionKey, string> = {
  header: "Header",
  dayDetails: "Day Details",
  schedule: "Schedule",
  talent: "Cast / Talent",
  crew: "Crew",
  notes: "Production Notes",
}

function SortableSectionItem({ sectionKey }: { readonly sectionKey: SectionKey }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sectionKey })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="inline-flex h-5 w-5 shrink-0 cursor-grab items-center justify-center text-[var(--color-text-subtle)] hover:text-[var(--color-text)] active:cursor-grabbing"
        aria-label={`Reorder ${SECTION_LABELS[sectionKey]}`}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="text-sm text-[var(--color-text)]">
        {SECTION_LABELS[sectionKey]}
      </span>
    </div>
  )
}

export function SectionOrderDialog({
  open,
  onOpenChange,
  sectionOrder,
  onSave,
}: SectionOrderDialogProps) {
  const [order, setOrder] = useState<readonly SectionKey[]>(sectionOrder)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setOrder((prev) => {
      const oldIndex = prev.indexOf(active.id as SectionKey)
      const newIndex = prev.indexOf(over.id as SectionKey)
      if (oldIndex === -1 || newIndex === -1) return prev
      return arrayMove([...prev], oldIndex, newIndex)
    })
  }, [])

  const handleReset = useCallback(() => {
    setOrder(DEFAULT_SECTION_ORDER)
  }, [])

  const handleSave = useCallback(() => {
    onSave(order)
    onOpenChange(false)
  }, [order, onSave, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Section Order</DialogTitle>
          <DialogDescription>
            Drag sections to reorder how they appear on the call sheet.
          </DialogDescription>
        </DialogHeader>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={order as SectionKey[]}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-1.5">
              {order.map((key) => (
                <SortableSectionItem key={key} sectionKey={key} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <DialogFooter className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to Default
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Order
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
