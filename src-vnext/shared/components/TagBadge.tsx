import { X } from "lucide-react"
import { cn } from "@/shared/lib/utils"
import type { ShotTag, ShotTagCategory } from "@/shared/types"
import { resolveShotTagCategory } from "@/shared/lib/tagCategories"
import { isTagColorKey } from "@/shared/lib/tagColors"

function getCategoryAccentClass(category: ShotTagCategory): string {
  switch (category) {
    case "priority": return "border-l-red-500 dark:border-l-red-400"
    case "gender": return "border-l-blue-500 dark:border-l-blue-400"
    case "media": return "border-l-emerald-500 dark:border-l-emerald-400"
    default: return "border-l-neutral-400 dark:border-l-neutral-500"
  }
}

const TAG_ACCENT_MAP: Record<string, string> = {
  red: "border-l-red-500 dark:border-l-red-400",
  orange: "border-l-orange-500 dark:border-l-orange-400",
  amber: "border-l-amber-500 dark:border-l-amber-400",
  yellow: "border-l-yellow-500 dark:border-l-yellow-400",
  green: "border-l-green-500 dark:border-l-green-400",
  emerald: "border-l-emerald-500 dark:border-l-emerald-400",
  blue: "border-l-blue-500 dark:border-l-blue-400",
  indigo: "border-l-indigo-500 dark:border-l-indigo-400",
  purple: "border-l-purple-500 dark:border-l-purple-400",
  pink: "border-l-pink-500 dark:border-l-pink-400",
  gray: "border-l-neutral-400 dark:border-l-neutral-500",
}

function getTagAccentClass(color: unknown, category: ShotTagCategory): string {
  if (typeof color === "string" && isTagColorKey(color)) {
    return TAG_ACCENT_MAP[color] ?? getCategoryAccentClass(category)
  }
  return getCategoryAccentClass(category)
}

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
        "inline-flex items-center gap-1 rounded-md border border-[var(--color-border)] border-l-[2.5px] bg-[var(--color-surface)] px-2 text-xxs font-medium text-[var(--color-text-secondary)]",
        getTagAccentClass(tag.color, resolveShotTagCategory(tag)),
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
