import { useEffect, useMemo, useState } from "react"
import { Camera, Plus, Search } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import type { Shot, ScheduleEntry } from "@/shared/types"
import type { ScheduleTrack } from "@/shared/types"

interface AddShotToScheduleDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly shots: readonly Shot[]
  readonly existingEntries: readonly ScheduleEntry[]
  readonly tracks: readonly ScheduleTrack[]
  readonly defaultTrackId?: string
  readonly onAdd: (shot: Shot, trackId: string) => void
}

export function AddShotToScheduleDialog({
  open,
  onOpenChange,
  shots,
  existingEntries,
  tracks,
  defaultTrackId,
  onAdd,
}: AddShotToScheduleDialogProps) {
  const [search, setSearch] = useState("")
  const [trackId, setTrackId] = useState(tracks[0]?.id ?? "primary")

  useEffect(() => {
    if (!open) return
    const next = defaultTrackId && tracks.some((t) => t.id === defaultTrackId)
      ? defaultTrackId
      : (tracks[0]?.id ?? "primary")
    setTrackId(next)
  }, [defaultTrackId, open, tracks])

  const existingShotIds = useMemo(
    () => new Set(existingEntries.filter((e) => e.shotId).map((e) => e.shotId)),
    [existingEntries],
  )

  const availableShots = useMemo(() => {
    const unscheduled = shots.filter((s) => !existingShotIds.has(s.id))
    if (!search.trim()) return unscheduled
    const q = search.trim().toLowerCase()
    return unscheduled.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.shotNumber && s.shotNumber.toLowerCase().includes(q)),
    )
  }, [shots, existingShotIds, search])

  function handleAdd(shot: Shot) {
    onAdd(shot, trackId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[70vh] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add shot to schedule</DialogTitle>
        </DialogHeader>

        {tracks.length > 1 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-[var(--color-text-muted)]">
              Track
            </span>
            <Select value={trackId} onValueChange={setTrackId}>
              <SelectTrigger>
                <SelectValue placeholder="Select track" />
              </SelectTrigger>
              <SelectContent>
                {tracks.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--color-text-muted)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search shots..."
            className="pl-9"
          />
        </div>

        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {availableShots.length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">
              {shots.length === existingShotIds.size
                ? "All shots are already scheduled."
                : "No matching shots found."}
            </p>
          )}
          {availableShots.map((shot) => (
            <button
              key={shot.id}
              type="button"
              onClick={() => handleAdd(shot)}
              className="flex min-h-[44px] items-center gap-3 rounded-md border border-transparent px-3 py-2 text-left transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)] active:bg-[var(--color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1"
            >
              <Camera className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-[var(--color-text)]">
                  {shot.title}
                </span>
                {shot.shotNumber && (
                  <span className="text-xs text-[var(--color-text-muted)]">
                    #{shot.shotNumber}
                  </span>
                )}
              </div>
              <Plus className="h-4 w-4 shrink-0 text-[var(--color-text-subtle)] transition-colors group-hover:text-[var(--color-primary)]" />
            </button>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
