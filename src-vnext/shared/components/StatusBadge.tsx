import { Badge } from "@/ui/badge"
import { cn } from "@/shared/lib/utils"

interface StatusBadgeProps {
  readonly label: string
  readonly color: string
}

const COLOR_CLASSES: Record<string, string> = {
  gray: "bg-slate-100 text-slate-700 border-slate-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
}

export function StatusBadge({ label, color }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs font-medium",
        COLOR_CLASSES[color] ?? COLOR_CLASSES["gray"],
      )}
    >
      {label}
    </Badge>
  )
}
