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
import { useDraggable } from "@dnd-kit/core"
import type { BlockType } from "../types/exportBuilder"
import { BLOCK_REGISTRY, type BlockRegistryEntry } from "../lib/blockRegistry"

interface BlockPaletteProps {
  readonly onAddBlock: (type: BlockType | "hstack") => void
}

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

const CATEGORY_ACCENT: Record<BlockRegistryEntry["category"], string> = {
  content: "border-l-blue-500",
  data: "border-l-green-500",
  layout: "border-l-zinc-500",
}

interface DraggablePaletteItemProps {
  readonly entry: BlockRegistryEntry
  readonly onAddBlock: (type: BlockType | "hstack") => void
}

function DraggablePaletteItem({ entry, onAddBlock }: DraggablePaletteItemProps) {
  const Icon = ICON_MAP[entry.icon]
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${entry.type}`,
    data: { type: entry.type, source: "palette" },
  })

  return (
    <button
      ref={setNodeRef}
      key={entry.type}
      type="button"
      onClick={() => onAddBlock(entry.type)}
      {...attributes}
      {...listeners}
      className={`flex items-start gap-3 rounded-md border-l-2 ${CATEGORY_ACCENT[entry.category]} bg-[var(--color-surface-subtle)] px-3 py-2.5 text-left transition-all hover:bg-[var(--color-surface-muted)] ${isDragging ? "opacity-50 shadow-lg ring-1 ring-[var(--color-accent)]" : ""}`}
    >
      {Icon && (
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
      )}
      <div className="min-w-0">
        <div className="text-sm font-medium text-[var(--color-text)]">
          {entry.label}
        </div>
        <div className="text-2xs text-[var(--color-text-muted)]">
          {entry.description}
        </div>
      </div>
    </button>
  )
}

export function BlockPalette({ onAddBlock }: BlockPaletteProps) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-sm font-medium text-[var(--color-text)]">Blocks</h2>
        <p className="text-2xs text-[var(--color-text-muted)]">
          Drag or click to add
        </p>
      </div>

      <div className="flex flex-col gap-1.5 overflow-y-auto px-3 pb-4">
        {BLOCK_REGISTRY.map((entry) => (
          <DraggablePaletteItem
            key={entry.type}
            entry={entry}
            onAddBlock={onAddBlock}
          />
        ))}
      </div>
    </aside>
  )
}
