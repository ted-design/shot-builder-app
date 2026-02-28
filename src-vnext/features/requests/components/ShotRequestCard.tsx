import { cn } from "@/shared/lib/utils"
import { ShotRequestStatusBadge } from "./ShotRequestStatusBadge"
import { formatRelativeTime } from "@/features/requests/lib/formatRelativeTime"
import type { ShotRequest } from "@/shared/types"

interface ShotRequestCardProps {
  readonly request: ShotRequest
  readonly selected: boolean
  readonly onClick: () => void
}

export function ShotRequestCard({ request, selected, onClick }: ShotRequestCardProps) {
  const isUrgent = request.priority === "urgent"

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-2.5 border-b border-[var(--color-border)] px-3 py-3 text-left transition-colors",
        "hover:bg-[var(--color-surface-subtle)]",
        selected && "border-l-2 border-l-[var(--color-primary)] bg-[var(--color-surface-subtle)]",
        !selected && "border-l-2 border-l-transparent",
      )}
    >
      <div className="mt-1.5 flex-shrink-0">
        {isUrgent ? (
          <span className="block h-2 w-2 rounded-full bg-[var(--color-error)]" aria-label="Urgent" />
        ) : (
          <span className="block h-2 w-2" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate text-sm font-medium text-[var(--color-text)]">
          {request.title}
        </span>
        <div className="flex items-center gap-2">
          <span className="truncate text-xs text-[var(--color-text-muted)]">
            {request.submittedByName ?? "Unknown"}
          </span>
          <span className="text-xs text-[var(--color-text-muted)]">
            {formatRelativeTime(request.submittedAt)}
          </span>
        </div>
      </div>

      <div className="flex-shrink-0 pt-0.5">
        <ShotRequestStatusBadge status={request.status} />
      </div>
    </button>
  )
}
