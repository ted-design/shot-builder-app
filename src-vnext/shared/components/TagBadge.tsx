import { X } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import type { ShotTag } from "@/shared/types"

export function TagBadge({
  tag,
  onRemove,
  className,
}: {
  readonly tag: ShotTag
  readonly onRemove?: (tag: ShotTag) => void
  readonly className?: string
}) {
  const hasRemove = typeof onRemove === "function"
  const label = (tag.label ?? "").trim()
  if (!label) return null

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-xxs font-medium text-[var(--color-text-secondary)]",
        className,
      )}
    >
      <span className="truncate" title={label}>
        {label}
      </span>
      {hasRemove ? (
        <button
          type="button"
          className="flex-shrink-0 opacity-70 transition-opacity hover:opacity-100"
          aria-label={`Remove ${label} tag`}
          onClick={(e) => {
            e.stopPropagation()
            onRemove(tag)
          }}
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  )
}
