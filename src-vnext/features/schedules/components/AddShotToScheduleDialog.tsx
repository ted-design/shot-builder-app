import { useEffect, useMemo, useState } from "react"
import { Camera, Plus, Search } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/dialog"
import { Input } from "@/ui/input"
import { Button } from "@/ui/button"
import { TagBadge } from "@/shared/components/TagBadge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { textPreview } from "@/shared/lib/textPreview"
import type { Shot, ScheduleEntry, TalentRecord } from "@/shared/types"
import type { ScheduleTrack } from "@/shared/types"

interface AddShotToScheduleDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly shots: readonly Shot[]
  readonly existingEntries: readonly ScheduleEntry[]
  readonly tracks: readonly ScheduleTrack[]
  readonly talentLookup?: readonly TalentRecord[]
  readonly defaultTrackId?: string
  readonly onAdd: (shot: Shot, trackId: string) => void
}

export function AddShotToScheduleDialog({
  open,
  onOpenChange,
  shots,
  existingEntries,
  tracks,
  talentLookup,
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

  const talentNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const talent of talentLookup ?? []) {
      const name = talent.name?.trim()
      if (name) map.set(talent.id, name)
    }
    return map
  }, [talentLookup])

  const searchableRows = useMemo(() => {
    return shots
      .filter((shot) => !existingShotIds.has(shot.id))
      .map((shot) => {
        const talentIds = shot.talentIds && shot.talentIds.length > 0
          ? shot.talentIds
          : shot.talent
        const talentNames = talentIds
          .map((id) => talentNameById.get(id) ?? null)
          .filter(Boolean) as string[]
        const tagLabels = (shot.tags ?? []).map((tag) => tag.label.trim()).filter(Boolean)
        const haystack = [
          shot.title,
          shot.shotNumber ?? "",
          shot.description ?? "",
          shot.locationName ?? "",
          talentNames.join(" "),
          tagLabels.join(" "),
        ]
          .join(" ")
          .toLowerCase()

        return {
          shot,
          talentNames,
          tagLabels,
          tags: shot.tags ?? [],
          haystack,
        }
      })
  }, [shots, existingShotIds, talentNameById])

  const availableShots = useMemo(() => {
    if (!search.trim()) return searchableRows
    const q = search.trim().toLowerCase()
    return searchableRows.filter((row) => row.haystack.includes(q))
  }, [search, searchableRows])

  function handleAdd(shot: Shot) {
    onAdd(shot, trackId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[75vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add shot to schedule</DialogTitle>
          <DialogDescription>
            Pick from unscheduled shots with visual context from description, tags, talent, and location.
          </DialogDescription>
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

        <div className="flex max-h-[24rem] flex-col gap-1 overflow-y-auto">
          {availableShots.length === 0 && (
            <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">
              {searchableRows.length === 0
                ? "All shots are already scheduled."
                : "No matching shots found."}
            </p>
          )}
          {availableShots.map(({ shot, talentNames, tagLabels, tags }) => (
            <button
              key={shot.id}
              type="button"
              onClick={() => handleAdd(shot)}
              className="group flex min-h-[76px] items-start gap-3 rounded-md border border-transparent px-3 py-2.5 text-left transition-colors hover:border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)] active:bg-[var(--color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-1"
            >
              <Camera className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium text-[var(--color-text)]">
                    {shot.title}
                  </span>
                  {shot.shotNumber && (
                    <span className="rounded bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-subtle)]">
                      Shot {shot.shotNumber}
                    </span>
                  )}
                </div>

                {shot.description && (
                  <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                    {textPreview(shot.description, 140)}
                  </p>
                )}

                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {talentNames.length > 0 && (
                    <span className="rounded bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-2xs font-medium text-[var(--color-text-muted)]">
                      Talent: {talentNames.slice(0, 2).join(", ")}
                      {talentNames.length > 2 ? ` +${talentNames.length - 2}` : ""}
                    </span>
                  )}
                  {shot.locationName && (
                    <span className="rounded bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-2xs font-medium text-[var(--color-text-muted)]">
                      {shot.locationName}
                    </span>
                  )}
                  {tags.slice(0, 3).map((tag) => (
                    <TagBadge key={`${shot.id}:${tag.id}`} tag={tag} />
                  ))}
                </div>
              </div>
              <Plus className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-subtle)] transition-colors group-hover:text-[var(--color-primary)]" />
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
