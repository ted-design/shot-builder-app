import { useState } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { Button } from "@/ui/button"
import { Input } from "@/ui/input"
import { SCENE_COLORS, getSceneColor } from "@/features/shots/components/SceneHeader"

interface GroupIntoSceneDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly selectedShotIds: readonly string[]
  readonly existingLanes: ReadonlyArray<{
    readonly id: string
    readonly name: string
    readonly color?: string | null
    readonly shotCount: number
  }>
  readonly onCreateAndAssign: (name: string, color: string) => Promise<void>
  readonly onAssignToExisting: (laneId: string) => Promise<void>
}

export function GroupIntoSceneDialog({
  open,
  onOpenChange,
  selectedShotIds,
  existingLanes,
  onCreateAndAssign,
  onAssignToExisting,
}: GroupIntoSceneDialogProps) {
  const [tab, setTab] = useState<"create" | "existing">("create")
  const [name, setName] = useState("")
  const [color, setColor] = useState<string>(SCENE_COLORS[0].key)
  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const canSubmit =
    tab === "create" ? name.trim().length > 0 : selectedLaneId !== null

  const handleSubmit = async () => {
    setSaving(true)
    try {
      if (tab === "create") {
        await onCreateAndAssign(name.trim(), color)
      } else if (selectedLaneId) {
        await onAssignToExisting(selectedLaneId)
      }
      onOpenChange(false)
      setName("")
      setColor(SCENE_COLORS[0].key)
      setSelectedLaneId(null)
    } catch (err) {
      toast.error("Failed to group shots into scene")
    } finally {
      setSaving(false)
    }
  }

  const shotLabel =
    selectedShotIds.length === 1 ? "shot" : "shots"

  const tabClass = (active: boolean) =>
    `flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
      active
        ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm"
        : "text-[var(--color-text-muted)]"
    }`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Group into Scene</DialogTitle>
          <p className="text-xs text-[var(--color-text-muted)]">
            Add {selectedShotIds.length} selected {shotLabel} to a new or
            existing scene.
          </p>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex gap-1 rounded-md bg-[var(--color-surface-subtle)] p-0.5">
          <button className={tabClass(tab === "create")} onClick={() => setTab("create")}>
            Create New
          </button>
          <button
            className={tabClass(tab === "existing")}
            onClick={() => setTab("existing")}
            disabled={existingLanes.length === 0}
          >
            Add to Existing
          </button>
        </div>

        {tab === "create" && (
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1 block">
                Scene Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Beach Lifestyle"
                autoFocus
              />
            </div>
            <div>
              <label className="text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-1 block">
                Color
              </label>
              <div className="flex gap-2">
                {SCENE_COLORS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setColor(c.key)}
                    className={`h-6 w-6 rounded-full transition-all ${
                      color === c.key
                        ? "ring-2 ring-white ring-offset-2 ring-offset-[var(--color-surface)]"
                        : ""
                    }`}
                    style={{ background: c.hex }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === "existing" && (
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
            {existingLanes.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)] py-4 text-center">
                No scenes yet. Create one first.
              </p>
            ) : (
              existingLanes.map((lane) => (
                <button
                  key={lane.id}
                  onClick={() => setSelectedLaneId(lane.id)}
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition-colors ${
                    selectedLaneId === lane.id
                      ? "bg-[var(--color-primary)]/10 border border-[var(--color-primary)]/30"
                      : "hover:bg-[var(--color-surface-subtle)] border border-transparent"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                    style={{ background: getSceneColor(lane.color) }}
                  />
                  <span className="flex-1 font-medium">{lane.name}</span>
                  <span className="text-2xs text-[var(--color-text-muted)]">
                    {lane.shotCount} {lane.shotCount === 1 ? "shot" : "shots"}
                  </span>
                </button>
              ))
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={!canSubmit || saving} onClick={handleSubmit}>
            {saving
              ? "Saving..."
              : tab === "create"
                ? "Create Scene"
                : "Add to Scene"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
