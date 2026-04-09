import { ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"

export const SCENE_COLORS = [
  { key: "teal", hex: "#14b8a6" },
  { key: "purple", hex: "#a78bfa" },
  { key: "green", hex: "#22c55e" },
  { key: "orange", hex: "#fb923c" },
  { key: "pink", hex: "#fb7185" },
  { key: "blue", hex: "#3b82f6" },
] as const

export type SceneColorKey = (typeof SCENE_COLORS)[number]["key"]

export function getSceneColor(color?: string | null): string {
  if (!color) return "var(--color-text-subtle)"
  const found = SCENE_COLORS.find((c) => c.key === color)
  return found?.hex ?? color
}

interface SceneHeaderProps {
  readonly name: string
  readonly shotCount: number
  readonly color?: string | null
  readonly collapsed: boolean
  readonly onToggleCollapse: () => void
  readonly onRename: () => void
  readonly onUngroupAll: () => void
  readonly onDelete: () => void
  readonly isUngrouped?: boolean
}

export function SceneHeader({
  name,
  shotCount,
  color,
  collapsed,
  onToggleCollapse,
  onRename,
  onUngroupAll,
  onDelete,
  isUngrouped,
}: SceneHeaderProps) {
  const ChevronIcon = collapsed ? ChevronRight : ChevronDown

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

      <span
        className={`text-sm font-semibold flex-1 ${
          isUngrouped
            ? "text-[var(--color-text-muted)]"
            : "text-[var(--color-text)]"
        }`}
      >
        {name}
      </span>

      <span className="text-2xs text-[var(--color-text-muted)] bg-[var(--color-surface-subtle)] px-1.5 py-0.5 rounded-full">
        {shotCount}
      </span>

      {!isUngrouped && (
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
            <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
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
    </button>
  )
}
