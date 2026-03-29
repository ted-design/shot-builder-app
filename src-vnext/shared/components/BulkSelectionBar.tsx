import { Button } from "@/ui/button"
import { cn } from "@/shared/lib/utils"

interface BulkSelectionBarProps {
  readonly count: number
  readonly onAction: () => void
  readonly onClear: () => void
  readonly actionLabel?: string
}

export function BulkSelectionBar({
  count,
  onAction,
  onClear,
  actionLabel = "Add to Project",
}: BulkSelectionBarProps) {
  const visible = count > 0

  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 z-50 -translate-x-1/2 transition-all duration-200",
        visible
          ? "translate-y-0 opacity-100"
          : "translate-y-4 opacity-0 pointer-events-none",
      )}
      data-testid="bulk-selection-bar"
      aria-hidden={!visible}
    >
      <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-lg backdrop-blur-sm">
        <span className="text-sm text-[var(--color-text-muted)]">
          {count} {count === 1 ? "item" : "items"} selected
        </span>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClear}
            data-testid="bulk-selection-bar-clear"
          >
            Clear
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onAction}
            data-testid="bulk-selection-bar-action"
          >
            {actionLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
