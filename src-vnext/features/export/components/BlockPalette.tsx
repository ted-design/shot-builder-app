import {
  ClipboardList,
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
import type { BlockType } from "../types/exportBuilder"
import { BLOCK_REGISTRY, type BlockRegistryEntry } from "../lib/blockRegistry"

interface BlockPaletteProps {
  readonly onAddBlock: (type: BlockType) => void
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
}

const CATEGORY_ACCENT: Record<BlockRegistryEntry["category"], string> = {
  content: "border-l-blue-500",
  data: "border-l-green-500",
  layout: "border-l-zinc-500",
}

export function BlockPalette({ onAddBlock }: BlockPaletteProps) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="px-4 pt-4 pb-2">
        <h2 className="text-sm font-medium text-[var(--color-text)]">Blocks</h2>
        <p className="text-2xs text-[var(--color-text-muted)]">
          Click to add to the page
        </p>
      </div>

      <div className="flex flex-col gap-1.5 overflow-y-auto px-3 pb-4">
        {BLOCK_REGISTRY.map((entry) => {
          const Icon = ICON_MAP[entry.icon]
          return (
            <button
              key={entry.type}
              type="button"
              onClick={() => onAddBlock(entry.type)}
              className={`flex items-start gap-3 rounded-md border-l-2 ${CATEGORY_ACCENT[entry.category]} bg-[var(--color-surface-subtle)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-surface-muted)]`}
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
        })}
      </div>
    </aside>
  )
}
