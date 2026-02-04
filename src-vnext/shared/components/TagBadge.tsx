import { X } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import { isTagColorKey, getTagColorClasses } from "@/shared/lib/tagColors"
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

  const useClasses = isTagColorKey(tag.color)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 text-[10px] font-medium",
        useClasses ? getTagColorClasses(tag.color) : "bg-transparent",
        className,
      )}
      style={
        useClasses
          ? undefined
          : { borderColor: tag.color || "#94a3b8", color: tag.color || "#94a3b8" }
      }
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

