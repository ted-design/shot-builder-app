import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/select"
import { getSceneColor } from "@/features/shots/components/SceneHeader"

interface ScenePickerProps {
  readonly selectedLaneId: string | undefined | null
  readonly lanes: ReadonlyArray<{
    readonly id: string
    readonly name: string
    readonly color?: string | null
  }>
  readonly onSave: (laneId: string | null) => void
  readonly disabled?: boolean
  readonly compact?: boolean
}

const NONE_VALUE = "__none__"

function ColorDot({ color }: { readonly color: string }) {
  return <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: color }} />
}

export function ScenePicker({ selectedLaneId, lanes, onSave, disabled, compact }: ScenePickerProps) {
  const currentValue = selectedLaneId ?? NONE_VALUE
  const currentLane = lanes.find((l) => l.id === selectedLaneId)

  return (
    <Select
      value={currentValue}
      onValueChange={(v) => onSave(v === NONE_VALUE ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger className={compact ? "h-8 text-xs" : "text-sm"}>
        <SelectValue>
          <span className="flex items-center gap-1.5">
            {currentLane && <ColorDot color={getSceneColor(currentLane.color)} />}
            <span className={!currentLane ? "text-[var(--color-text-muted)]" : ""}>
              {currentLane?.name ?? "Ungrouped"}
            </span>
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>
          <span className="text-[var(--color-text-muted)]">None (ungrouped)</span>
        </SelectItem>
        {lanes.map((lane) => (
          <SelectItem key={lane.id} value={lane.id}>
            <span className="flex items-center gap-1.5">
              <ColorDot color={getSceneColor(lane.color)} />
              {lane.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
