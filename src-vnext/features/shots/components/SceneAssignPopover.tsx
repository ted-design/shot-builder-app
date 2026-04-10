import { useState } from "react"
import { Check } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/ui/popover"
import { getSceneColor } from "@/features/shots/lib/sceneColors"
import type { Lane } from "@/shared/types"

interface SceneAssignPopoverProps {
  readonly shot: { readonly id: string; readonly laneId?: string | null }
  readonly lanes: ReadonlyArray<Lane>
  readonly onAssign: (shotId: string, laneId: string | null) => void
  readonly children: React.ReactNode
}

export function SceneAssignPopover({
  shot,
  lanes,
  onAssign,
  children,
}: SceneAssignPopoverProps) {
  const [open, setOpen] = useState(false)
  const currentLaneId = shot.laneId ?? null

  const handleSelect = (laneId: string | null) => {
    onAssign(shot.id, laneId)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-52 p-1"
        align="start"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-[var(--color-surface-subtle)]"
          onClick={() => handleSelect(null)}
        >
          <span className="inline-block h-2 w-2 rounded-full flex-shrink-0 bg-[var(--color-text-subtle)]" />
          <span className="flex-1 text-left text-[var(--color-text-muted)]">
            None (ungrouped)
          </span>
          {currentLaneId === null && (
            <Check className="h-3.5 w-3.5 text-[var(--color-text-subtle)]" />
          )}
        </button>

        {lanes.map((lane) => (
          <button
            key={lane.id}
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-[var(--color-surface-subtle)]"
            onClick={() => handleSelect(lane.id)}
          >
            <span
              className="inline-block h-2 w-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: getSceneColor(lane.color) }}
            />
            <span className="flex-1 truncate text-left text-[var(--color-text)]">
              {lane.sceneNumber != null ? `#${lane.sceneNumber} ` : ""}
              {lane.name}
            </span>
            {currentLaneId === lane.id && (
              <Check className="h-3.5 w-3.5 text-[var(--color-text-subtle)]" />
            )}
          </button>
        ))}

        {lanes.length === 0 && (
          <div className="px-2 py-3 text-center text-2xs text-[var(--color-text-muted)]">
            No scenes created yet
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
