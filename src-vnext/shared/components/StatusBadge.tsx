import { Badge } from "@/ui/badge"
import { cn } from "@/shared/lib/utils"

interface StatusBadgeProps {
  readonly label: string
  readonly color: string
  readonly className?: string
}

const COLOR_CLASSES: Record<string, string> = {
  gray: "bg-[var(--color-status-gray-bg)] text-[var(--color-status-gray-text)] border-[var(--color-status-gray-border)]",
  blue: "bg-[var(--color-status-blue-bg)] text-[var(--color-status-blue-text)] border-[var(--color-status-blue-border)]",
  green: "bg-[var(--color-status-green-bg)] text-[var(--color-status-green-text)] border-[var(--color-status-green-border)]",
  amber: "bg-[var(--color-status-amber-bg)] text-[var(--color-status-amber-text)] border-[var(--color-status-amber-border)]",
}

export function StatusBadge({ label, color, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xxs font-medium",
        COLOR_CLASSES[color] ?? COLOR_CLASSES["gray"],
        className,
      )}
    >
      {label}
    </Badge>
  )
}
