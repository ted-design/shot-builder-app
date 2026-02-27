import { useDroppable } from "@dnd-kit/core"
import { getShotStatusLabel } from "@/shared/lib/statusMappings"
import type { Shot, ShotFirestoreStatus } from "@/shared/types"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BoardColumnProps {
  readonly status: ShotFirestoreStatus
  readonly shots: ReadonlyArray<Shot>
  readonly onOpenShot: (shotId: string) => void
  readonly renderCard: (shot: Shot) => React.ReactNode
}

// ---------------------------------------------------------------------------
// Status accent colors
// ---------------------------------------------------------------------------

const ACCENT_COLORS: Record<ShotFirestoreStatus, string> = {
  todo: "bg-neutral-400",
  in_progress: "bg-blue-500",
  on_hold: "bg-amber-500",
  complete: "bg-green-500",
}

const DOT_COLORS: Record<ShotFirestoreStatus, string> = {
  todo: "bg-neutral-400",
  in_progress: "bg-blue-500",
  on_hold: "bg-amber-500",
  complete: "bg-green-500",
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BoardColumn({ status, shots, renderCard }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status })

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[400px] flex-col rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] transition-colors ${
        isOver ? "border-[var(--color-border-strong)] bg-[var(--color-surface-muted)]" : ""
      }`}
      data-testid={`board-column-${status}`}
    >
      {/* Accent bar */}
      <div className={`h-[3px] rounded-t-[10px] ${ACCENT_COLORS[status]}`} />

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3.5 py-3">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${DOT_COLORS[status]}`} />
          <span className="text-xs font-semibold text-[var(--color-text)]">
            {getShotStatusLabel(status)}
          </span>
        </div>
        <span className="text-xs font-medium text-[var(--color-text-subtle)]">
          {shots.length}
        </span>
      </div>

      {/* Card list */}
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2.5">
        {shots.length === 0 ? (
          <p className="py-8 text-center text-xs text-[var(--color-text-subtle)]">
            No shots
          </p>
        ) : (
          shots.map((shot) => renderCard(shot))
        )}
      </div>
    </div>
  )
}
