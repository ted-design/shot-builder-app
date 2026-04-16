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
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/ui/command"
import { BLOCK_REGISTRY, type BlockRegistryEntry } from "../lib/blockRegistry"
import type { BlockType } from "../types/exportBuilder"

interface InlineBlockPickerProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onSelectBlock: (type: BlockType | "hstack") => void
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

const CATEGORY_LABELS: Record<BlockRegistryEntry["category"], string> = {
  content: "Content",
  data: "Data",
  layout: "Layout",
}

function groupByCategory(
  entries: readonly BlockRegistryEntry[],
): ReadonlyMap<BlockRegistryEntry["category"], readonly BlockRegistryEntry[]> {
  const groups = new Map<BlockRegistryEntry["category"], BlockRegistryEntry[]>()
  for (const entry of entries) {
    const existing = groups.get(entry.category) ?? []
    groups.set(entry.category, [...existing, entry])
  }
  return groups
}

const GROUPED_BLOCKS = groupByCategory(BLOCK_REGISTRY)

export function InlineBlockPicker({
  open,
  onOpenChange,
  onSelectBlock,
}: InlineBlockPickerProps) {
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search blocks..." />
      <CommandList>
        <CommandEmpty>No matching blocks.</CommandEmpty>
        {Array.from(GROUPED_BLOCKS.entries()).map(([category, entries]) => (
          <CommandGroup key={category} heading={CATEGORY_LABELS[category]}>
            {entries.map((entry) => {
              const Icon = ICON_MAP[entry.icon]
              return (
                <CommandItem
                  key={entry.type}
                  value={`${entry.label} ${entry.description}`}
                  onSelect={() => {
                    onSelectBlock(entry.type)
                    onOpenChange(false)
                  }}
                >
                  {Icon && <Icon className="h-4 w-4 text-[var(--color-text-muted)]" />}
                  <div className="flex flex-col">
                    <span>{entry.label}</span>
                    <span className="text-2xs text-[var(--color-text-muted)]">
                      {entry.description}
                    </span>
                  </div>
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  )
}
