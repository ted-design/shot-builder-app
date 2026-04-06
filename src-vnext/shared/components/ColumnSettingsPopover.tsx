import { RotateCcw } from "lucide-react"
import { Button } from "@/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui/popover"
import type { TableColumnConfig } from "@/shared/types/table"
import { ColumnSettingsList } from "./ColumnSettingsList"

interface ColumnSettingsPopoverProps {
  readonly columns: readonly TableColumnConfig[]
  readonly onToggleVisibility: (key: string) => void
  readonly onReorder: (orderedKeys: readonly string[]) => void
  readonly onReset: () => void
  readonly showReorder?: boolean
  readonly children: React.ReactNode
}

export function ColumnSettingsPopover({
  columns,
  onToggleVisibility,
  onReorder,
  onReset,
  showReorder = true,
  children,
}: ColumnSettingsPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="flex items-center justify-between pb-2">
          <span className="text-sm font-medium text-[var(--color-text)]">
            Columns
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-7 gap-1 px-2 text-2xs"
            aria-label="Reset columns to defaults"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        </div>

        <ColumnSettingsList
          columns={columns}
          onToggleVisibility={onToggleVisibility}
          onReorder={onReorder}
          showReorder={showReorder}
        />
      </PopoverContent>
    </Popover>
  )
}
