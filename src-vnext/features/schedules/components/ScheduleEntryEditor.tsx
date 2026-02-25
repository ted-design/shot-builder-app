import { useCallback, useMemo, useState } from "react"
import { Camera, Plus } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/ui/button"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import {
  addScheduleEntryShot,
  addScheduleEntryCustom,
  batchUpdateScheduleEntries,
  removeScheduleEntry,
  updateScheduleEntryFields,
} from "@/features/schedules/lib/scheduleWrites"
import {
  buildCascadeDurationPatches,
  buildCascadeReorderPatches,
  buildCascadeStartTimePatches,
} from "@/features/schedules/lib/cascade"
import { ScheduleEntryCard } from "@/features/schedules/components/ScheduleEntryCard"
import { AddShotToScheduleDialog } from "@/features/schedules/components/AddShotToScheduleDialog"
import { AddCustomEntryDialog } from "@/features/schedules/components/AddCustomEntryDialog"
import type {
  Schedule,
  ScheduleEntry,
  Shot,
  ScheduleEntryHighlight,
  ScheduleTrack,
} from "@/shared/types"

interface ScheduleEntryEditorProps {
  readonly scheduleId: string
  readonly schedule: Schedule | null
  readonly entries: readonly ScheduleEntry[]
  readonly shots: readonly Shot[]
}

export function ScheduleEntryEditor({
  scheduleId,
  schedule,
  entries,
  shots,
}: ScheduleEntryEditorProps) {
  const { clientId } = useAuth()
  const { projectId } = useProjectScope()

  const [shotDialogOpen, setShotDialogOpen] = useState(false)
  const [customDialogOpen, setCustomDialogOpen] = useState(false)
  const [customTrackId, setCustomTrackId] = useState("primary")

  const tracks: readonly ScheduleTrack[] = useMemo(() => {
    const raw = schedule?.tracks
    if (raw && raw.length > 0) {
      return [...raw].slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    }
    return [{ id: "primary", name: "Primary", order: 0 }]
  }, [schedule?.tracks])

  const trackIdSet = useMemo(() => new Set(tracks.map((t) => t.id)), [tracks])

  const settings = schedule?.settings ?? {
    cascadeChanges: true,
    dayStartTime: "06:00",
    defaultEntryDurationMinutes: 15,
  }

  const bannerEntries = useMemo(
    () =>
      entries
        .filter((e) => e.type === "banner")
        .slice()
        .sort((a, b) => a.order - b.order),
    [entries],
  )

  function normalizedTrackId(entry: ScheduleEntry): string {
    const tid = entry.trackId
    if (tid && trackIdSet.has(tid)) return tid
    return "primary"
  }

  function entriesForTrack(trackId: string): ScheduleEntry[] {
    return entries
      .filter((e) => e.type !== "banner" && normalizedTrackId(e) === trackId)
      .slice()
      .sort((a, b) => a.order - b.order)
  }

  function nextOrderForTrack(trackId: string): number {
    const list = entriesForTrack(trackId)
    return list.reduce((max, e) => Math.max(max, e.order ?? 0), -1) + 1
  }

  const handleAddShot = useCallback(
    async (shot: Shot, trackId: string) => {
      if (!clientId) return
      try {
        await addScheduleEntryShot(clientId, projectId, scheduleId, {
          shotId: shot.id,
          title: shot.title,
          order: nextOrderForTrack(trackId),
          trackId,
        })
      } catch (err) {
        toast.error("Failed to add shot to schedule.")
        throw err
      }
    },
    [clientId, projectId, scheduleId, entries, trackIdSet],
  )

  const handleAddCustom = useCallback(
    async (input: {
      readonly title: string
      readonly description: string
      readonly trackId: string
      readonly highlight: ScheduleEntryHighlight
    }) => {
      if (!clientId) return
      try {
        const isBanner = input.trackId === "shared"
        const targetTrackId = isBanner ? "primary" : input.trackId
        await addScheduleEntryCustom(clientId, projectId, scheduleId, {
          type: isBanner ? "banner" : "setup",
          title: input.title,
          notes: input.description || null,
          order: nextOrderForTrack(targetTrackId),
          trackId: isBanner ? "shared" : targetTrackId,
          appliesToTrackIds:
            isBanner && tracks.length > 1 ? tracks.map((t) => t.id) : null,
          highlight: input.highlight,
        })
      } catch (err) {
        toast.error("Failed to add entry.")
        throw err
      }
    },
    [clientId, projectId, scheduleId, entries, tracks, trackIdSet],
  )

  const handleMoveWithinTrack = useCallback(
    async (trackId: string, indexA: number, indexB: number) => {
      if (!clientId) return
      const list = entriesForTrack(trackId)
      const entryA = list[indexA]
      const entryB = list[indexB]
      if (!entryA || !entryB) return

      try {
        const next = [...list]
        next.splice(indexA, 1)
        next.splice(indexB, 0, entryA)
        const patches = buildCascadeReorderPatches({
          entries,
          trackId,
          movedEntryId: entryA.id,
          nextOrderedIds: next.map((e) => e.id),
          settings,
        })
        await batchUpdateScheduleEntries(clientId, projectId, scheduleId, patches)
      } catch (err) {
        toast.error("Failed to reorder entries.")
        throw err
      }
    },
    [clientId, projectId, scheduleId, entries, settings, trackIdSet],
  )

  const handleSwapBanner = useCallback(
    async (indexA: number, indexB: number) => {
      if (!clientId) return
      const entryA = bannerEntries[indexA]
      const entryB = bannerEntries[indexB]
      if (!entryA || !entryB) return

      try {
        await batchUpdateScheduleEntries(clientId, projectId, scheduleId, [
          { entryId: entryA.id, patch: { order: entryB.order } },
          { entryId: entryB.id, patch: { order: entryA.order } },
        ])
      } catch (err) {
        toast.error("Failed to reorder shared entries.")
        throw err
      }
    },
    [clientId, projectId, scheduleId, bannerEntries],
  )

  const handleRemove = useCallback(
    async (entryId: string) => {
      if (!clientId) return
      try {
        await removeScheduleEntry(clientId, projectId, scheduleId, entryId)
      } catch (err) {
        toast.error("Failed to remove entry.")
        throw err
      }
    },
    [clientId, projectId, scheduleId],
  )

  const handleUpdateField = useCallback(
    async (entryId: string, patch: Record<string, unknown>) => {
      if (!clientId) return
      try {
        await updateScheduleEntryFields(
          clientId,
          projectId,
          scheduleId,
          entryId,
          patch,
        )
      } catch (err) {
        toast.error("Failed to update entry.")
        throw err
      }
    },
    [clientId, projectId, scheduleId],
  )

  const handleUpdateStartTime = useCallback(
    async (trackId: string, entryId: string, startTime: string | null) => {
      if (!clientId) return
      try {
        const patches = buildCascadeStartTimePatches({
          entries,
          trackId,
          entryId,
          nextStartTime: startTime,
          settings,
        })
        await batchUpdateScheduleEntries(clientId, projectId, scheduleId, patches)
      } catch (err) {
        toast.error("Failed to update time.")
        throw err
      }
    },
    [clientId, projectId, scheduleId, entries, settings],
  )

  const handleUpdateDuration = useCallback(
    async (trackId: string, entryId: string, duration: number | undefined) => {
      if (!clientId) return
      try {
        const patches = buildCascadeDurationPatches({
          entries,
          trackId,
          entryId,
          nextDurationMinutes: duration ?? null,
          settings,
        })
        await batchUpdateScheduleEntries(clientId, projectId, scheduleId, patches)
      } catch (err) {
        toast.error("Failed to update duration.")
        throw err
      }
    },
    [clientId, projectId, scheduleId, entries, settings],
  )

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Schedule
        </h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShotDialogOpen(true)}>
            <Camera className="mr-1.5 h-3.5 w-3.5" />
            Add Shot
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setCustomTrackId("primary")
              setCustomDialogOpen(true)
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Add Highlight
          </Button>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-[var(--color-border)] py-8">
          <p className="text-sm text-[var(--color-text-muted)]">No entries yet.</p>
          <p className="text-xs text-[var(--color-text-subtle)]">
            Add shots or custom entries to build the schedule.
          </p>
        </div>
      ) : (
        <div className={`grid gap-3 ${tracks.length > 1 ? "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3" : "grid-cols-1"}`}>
          {tracks.map((track) => {
            const list = entriesForTrack(track.id)
            return (
              <div key={track.id} className="flex flex-col gap-2">
                {tracks.length > 1 && (
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                      {track.name}
                    </h3>
                    <span className="text-2xs font-medium text-[var(--color-text-subtle)]">
                      {settings.cascadeChanges ? "Cascade ON" : "Cascade OFF"}
                    </span>
                  </div>
                )}

                {list.length === 0 ? (
                  <div className="rounded-md border border-dashed border-[var(--color-border)] px-3 py-4 text-xs text-[var(--color-text-subtle)]">
                    No entries.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {list.map((entry, idx) => (
                      <ScheduleEntryCard
                        key={entry.id}
                        entry={entry}
                        isFirst={idx === 0}
                        isLast={idx === list.length - 1}
                        onMoveUp={() => handleMoveWithinTrack(track.id, idx, idx - 1)}
                        onMoveDown={() => handleMoveWithinTrack(track.id, idx, idx + 1)}
                        onRemove={() => handleRemove(entry.id)}
                        onUpdateTitle={(title) =>
                          handleUpdateField(entry.id, { title: title || entry.title })
                        }
                        onUpdateStartTime={(startTime) =>
                          handleUpdateStartTime(track.id, entry.id, startTime)
                        }
                        onUpdateDuration={(duration) =>
                          handleUpdateDuration(track.id, entry.id, duration)
                        }
                        onUpdateNotes={(notes) =>
                          handleUpdateField(entry.id, { notes: notes || null })
                        }
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {bannerEntries.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Shared
                </h3>
              </div>
              <div className="flex flex-col gap-2">
                {bannerEntries.map((entry, idx) => (
                  <ScheduleEntryCard
                    key={entry.id}
                    entry={entry}
                    isFirst={idx === 0}
                    isLast={idx === bannerEntries.length - 1}
                    onMoveUp={() => handleSwapBanner(idx, idx - 1)}
                    onMoveDown={() => handleSwapBanner(idx, idx + 1)}
                    onRemove={() => handleRemove(entry.id)}
                    onUpdateTitle={(title) =>
                      handleUpdateField(entry.id, { title: title || entry.title })
                    }
                    onUpdateStartTime={(startTime) =>
                      handleUpdateField(entry.id, { startTime: startTime ?? null })
                    }
                    onUpdateDuration={(duration) =>
                      handleUpdateField(entry.id, { duration: duration ?? null })
                    }
                    onUpdateNotes={(notes) =>
                      handleUpdateField(entry.id, { notes: notes || null })
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AddShotToScheduleDialog
        open={shotDialogOpen}
        onOpenChange={setShotDialogOpen}
        shots={shots}
        existingEntries={entries}
        tracks={tracks}
        onAdd={handleAddShot}
      />
      <AddCustomEntryDialog
        open={customDialogOpen}
        onOpenChange={setCustomDialogOpen}
        tracks={tracks}
        defaultTrackId={customTrackId}
        onAdd={handleAddCustom}
      />
    </div>
  )
}
