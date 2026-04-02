import {
  ClipboardList,
  Columns,
  FileDown,
  Grid3x3,
  Image,
  Minus,
  Square,
  Table,
  Type,
  Users,
  type LucideIcon,
} from "lucide-react"
import type { BlockRegistryEntry } from "../lib/blockRegistry"

const ICON_MAP: Record<string, LucideIcon> = {
  Type,
  Image,
  Grid3X3: Grid3x3,
  Square,
  Table,
  ClipboardList,
  Users,
  Minus,
  FileDown,
  Columns,
}

interface PaletteDragOverlayProps {
  readonly entry: BlockRegistryEntry
}

/**
 * Floating card shown under the cursor while dragging a block from the palette.
 * Semi-transparent with an elevated shadow for visual distinction.
 */
export function PaletteDragOverlay({ entry }: PaletteDragOverlayProps) {
  const Icon = ICON_MAP[entry.icon]

  return (
    <div className="pointer-events-none flex w-48 items-center gap-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 opacity-85 shadow-lg">
      {Icon && (
        <Icon className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
      )}
      <span className="text-sm font-medium text-[var(--color-text)]">
        {entry.label}
      </span>
    </div>
  )
}
