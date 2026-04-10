import { ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import { SCENE_COLORS, getSceneColor, type SceneColorKey } from "@/features/shots/lib/sceneColors"

// Re-exports for backward compatibility — new code should import directly from
// `@/features/shots/lib/sceneColors`.
export { SCENE_COLORS, getSceneColor }
export type { SceneColorKey }

interface SceneHeaderProps {
  readonly name: string
  readonly shotCount: number
  readonly color?: string | null
  readonly sceneNumber?: number
  readonly direction?: string
  readonly collapsed: boolean
  readonly onToggleCollapse: () => void
  readonly onEdit?: () => void
  readonly onUngroupAll?: () => void
  readonly onDelete?: () => void
  readonly isUngrouped?: boolean
  /** When false, hides the kebab menu entirely (crew-level read access). */
  readonly canManageLanes?: boolean
}

export function SceneHeader({
  name,
  shotCount,
  color,
  sceneNumber,
  direction,
  collapsed,
  onToggleCollapse,
  onEdit,
  onUngroupAll,
  onDelete,
  isUngrouped,
  canManageLanes = true,
}: SceneHeaderProps) {
  const ChevronIcon = collapsed ? ChevronRight : ChevronDown
  const trimmedDirection = direction ? direction.slice(0, 60) : null

  return (
    <button
      type="button"
      className="flex w-full items-center gap-2 px-3 py-2 bg-[var(--color-surface)] border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-surface-subtle)] text-left"
      onClick={onToggleCollapse}
    >
      <div
        className="w-[3px] h-5 rounded-sm flex-shrink-0"
        style={{ background: getSceneColor(isUngrouped ? null : color) }}
      />

      <ChevronIcon className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />

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
          {name}
        </span>
        {trimmedDirection && !isUngrouped && (
          <span
            className="text-2xs text-[var(--color-text-muted)] truncate"
            title={direction && direction.length > 60 ? direction : undefined}
          >
            {trimmedDirection}{direction && direction.length > 60 ? "\u2026" : ""}
          </span>
        )}
      </div>

      <span className="text-2xs text-[var(--color-text-muted)] bg-[var(--color-surface-subtle)] px-1.5 py-0.5 rounded-full">
        {shotCount}
      </span>

      {!isUngrouped && canManageLanes && (
        <DropdownMenu>
          <DropdownMenuTrigger
            onClick={(e) => e.stopPropagation()}
            asChild
          >
            <button className="rounded p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-subtle)]">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit && (
              <DropdownMenuItem onClick={onEdit}>
                Edit Scene
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {onUngroupAll && (
              <DropdownMenuItem onClick={onUngroupAll}>
                Ungroup All
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                className="text-[var(--color-error)]"
                onClick={onDelete}
              >
                Delete Scene
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </button>
  )
}
