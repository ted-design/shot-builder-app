import { ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import { getSceneColor } from "@/features/shots/lib/sceneColors"

interface SceneTableRowProps {
  readonly label: string
  readonly sceneNumber?: number
  readonly shotCount: number
  readonly color?: string
  readonly direction?: string
  readonly collapsed: boolean
  readonly onToggleCollapse: () => void
  readonly onEdit: () => void
  readonly onUngroupAll: () => void
  readonly onDelete: () => void
  readonly isUngrouped: boolean
  readonly colSpan: number
}

export function SceneTableRow({
  label,
  sceneNumber,
  shotCount,
  color,
  direction,
  collapsed,
  onToggleCollapse,
  onEdit,
  onUngroupAll,
  onDelete,
  isUngrouped,
  colSpan,
}: SceneTableRowProps) {
  const ChevronIcon = collapsed ? ChevronRight : ChevronDown
  const resolvedColor = getSceneColor(isUngrouped ? null : color)
  const trimmedDirection = direction ? direction.slice(0, 60) : null

  return (
    <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
      <td colSpan={colSpan} className="p-0">
        <div
          className="flex w-full items-center gap-2 px-3 py-2 transition-colors hover:bg-[var(--color-surface-muted)]"
          style={{ borderLeft: `3px solid ${resolvedColor}` }}
        >
          {/* Collapse toggle — a dedicated button that doesn't wrap other interactive elements */}
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            aria-label={`${collapsed ? "Expand" : "Collapse"} scene ${label}`}
          >
            <ChevronIcon className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-text-muted)]" />

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span
                className={`text-sm font-semibold truncate ${
                  isUngrouped
                    ? "text-[var(--color-text-muted)]"
                    : "text-[var(--color-text)]"
                }`}
              >
                {sceneNumber != null && !isUngrouped && (
                  <span className="text-[var(--color-text-subtle)] font-normal mr-1">
                    #{sceneNumber}
                  </span>
                )}
                {label}
              </span>
              {trimmedDirection && (
                <span
                  className="text-2xs text-[var(--color-text-subtle)] truncate"
                  title={direction && direction.length > 60 ? direction : undefined}
                >
                  {trimmedDirection}{direction && direction.length > 60 ? "\u2026" : ""}
                </span>
              )}
            </div>
          </button>

          <span className="flex-shrink-0 rounded-full bg-[var(--color-surface)] px-1.5 py-0.5 text-2xs text-[var(--color-text-muted)]">
            {shotCount}
          </span>

          {!isUngrouped && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex-shrink-0 rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]"
                  aria-label="Scene actions"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  Edit Scene
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onUngroupAll}>
                  Ungroup All
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-[var(--color-error)]"
                  onClick={onDelete}
                >
                  Delete Scene
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </td>
    </tr>
  )
}
