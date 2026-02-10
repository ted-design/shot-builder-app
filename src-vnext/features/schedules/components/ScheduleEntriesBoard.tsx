import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  DragOverlay,
  useDroppable,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Plus, Camera, StickyNote } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/ui/button"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { AddShotToScheduleDialog } from "@/features/schedules/components/AddShotToScheduleDialog"
import { AddCustomEntryDialog } from "@/features/schedules/components/AddCustomEntryDialog"
import { ScheduleEntryCard } from "@/features/schedules/components/ScheduleEntryCard"
import {
  addScheduleEntryCustom,
  addScheduleEntryShot,
  batchUpdateScheduleEntries,
  removeScheduleEntry,
  updateScheduleEntryFields,
} from "@/features/schedules/lib/scheduleWrites"
import {
  buildCascadeMoveBetweenTracksPatches,
  buildCascadeDurationPatches,
  buildCascadeDirectStartEditPatches,
  buildCascadeReorderPatches,
} from "@/features/schedules/lib/cascade"
import { buildAutoDurationFillPatches } from "@/features/schedules/lib/autoDuration"
import { findTrackOverlapConflicts, type TrackOverlapConflict } from "@/features/schedules/lib/conflicts"
import type { Schedule, ScheduleEntry, ScheduleTrack, Shot } from "@/shared/types"

type ContainerId = string | "shared"
type EntryPatch = { readonly entryId: string; readonly patch: Record<string, unknown> }
const SHARED_TRACK_IDS = new Set(["shared", "all"])

function normalizeTracks(schedule: Schedule | null): readonly ScheduleTrack[] {
  const raw = schedule?.tracks
  if (raw && raw.length > 0) {
    return [...raw].slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }
  return [{ id: "primary", name: "Primary", order: 0 }]
}

function normalizeSettings(schedule: Schedule | null) {
  return schedule?.settings ?? {
    cascadeChanges: true,
    dayStartTime: "06:00",
    defaultEntryDurationMinutes: 15,
  }
}

function containerKey(id: ContainerId): string {
  return `container:${id}`
}

function isContainerKey(id: unknown): id is string {
  return typeof id === "string" && id.startsWith("container:")
}

function parseContainerKey(id: string): ContainerId {
  const raw = id.replace(/^container:/, "")
  return raw === "shared" ? "shared" : raw
}

function isSharedBannerEntry(entry: ScheduleEntry): boolean {
  if (entry.type === "banner") return true
  return !!entry.trackId && SHARED_TRACK_IDS.has(entry.trackId)
}

function applyEntryPatches(
  entries: readonly ScheduleEntry[],
  patches: readonly EntryPatch[],
): readonly ScheduleEntry[] {
  if (patches.length === 0) return entries
  const byId = new Map(patches.map((patch) => [patch.entryId, patch.patch]))
  return entries.map((entry) => {
    const patch = byId.get(entry.id)
    if (!patch) return entry
    return { ...entry, ...patch } as ScheduleEntry
  })
}

function conflictKey(conflict: TrackOverlapConflict): string {
  const pair = [conflict.firstEntryId, conflict.secondEntryId].sort().join("::")
  return `${conflict.trackId}:${pair}`
}

function findIntroducedConflict(params: {
  readonly before: readonly TrackOverlapConflict[]
  readonly after: readonly TrackOverlapConflict[]
  readonly scopedEntryIds: ReadonlySet<string>
}): TrackOverlapConflict | null {
  const { before, after, scopedEntryIds } = params
  const beforeSet = new Set(before.map(conflictKey))
  for (const conflict of after) {
    const touchesScoped =
      scopedEntryIds.has(conflict.firstEntryId) || scopedEntryIds.has(conflict.secondEntryId)
    if (!touchesScoped) continue
    if (!beforeSet.has(conflictKey(conflict))) return conflict
  }
  return null
}

function DroppableColumn({ id, children }: { readonly id: ContainerId; readonly children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: containerKey(id) })
  return (
    <div
      ref={setNodeRef}
      className={`rounded-md border border-[var(--color-border)] bg-white p-2 transition-colors ${
        isOver ? "border-[var(--color-primary)] bg-[var(--color-primary-subtle)]/30" : ""
      }`}
    >
      {children}
    </div>
  )
}

function SortableEntry({
  entry,
  showTimelineNode,
  trackSelect,
  isFirst,
  isLast,
  onRemove,
  onUpdateTitle,
  onUpdateStartTime,
  onUpdateDuration,
  onUpdateNotes,
}: {
  readonly entry: ScheduleEntry
  readonly showTimelineNode: boolean
  readonly trackSelect?: {
    readonly value: string
    readonly options: readonly { readonly value: string; readonly label: string }[]
    readonly onChange: (next: string) => void
  }
  readonly isFirst: boolean
  readonly isLast: boolean
  readonly onRemove: () => void
  readonly onUpdateTitle: (title: string) => void
  readonly onUpdateStartTime: (startTime: string | null) => void
  readonly onUpdateDuration: (duration: number | undefined) => void
  readonly onUpdateNotes: (notes: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} className="group relative">
      <div
        {...attributes}
        {...listeners}
        className="absolute left-2 top-3 z-10 cursor-grab rounded p-1 text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-subtle)] active:cursor-grabbing"
        aria-label="Drag to reorder"
        title="Drag to reorder or move tracks"
      >
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="pl-7">
        <ScheduleEntryCard
          entry={entry}
          isFirst={isFirst}
          isLast={isLast}
          reorderMode="none"
          showTimelineNode={showTimelineNode}
          trackSelect={trackSelect}
          onRemove={onRemove}
          onUpdateTitle={onUpdateTitle}
          onUpdateStartTime={onUpdateStartTime}
          onUpdateDuration={onUpdateDuration}
          onUpdateNotes={onUpdateNotes}
        />
      </div>
    </div>
  )
}

export function ScheduleEntriesBoard({
  scheduleId,
  schedule,
  entries,
  shots,
}: {
  readonly scheduleId: string
  readonly schedule: Schedule | null
  readonly entries: readonly ScheduleEntry[]
  readonly shots: readonly Shot[]
}) {
  const { clientId } = useAuth()
  const { projectId } = useProjectScope()

  const tracks = useMemo(() => normalizeTracks(schedule), [schedule])
  const settings = useMemo(() => normalizeSettings(schedule), [schedule])
  const trackIdSet = useMemo(() => new Set(tracks.map((t) => t.id)), [tracks])

  const entriesByContainer = useMemo(() => {
    const by: Record<string, ScheduleEntry[]> = {}
    for (const t of tracks) by[t.id] = []
    by.shared = []

    for (const entry of entries) {
      if (isSharedBannerEntry(entry)) {
        by.shared.push(entry)
        continue
      }
      const tid = entry.trackId && trackIdSet.has(entry.trackId) ? entry.trackId : "primary"
      ;(by[tid] ?? (by[tid] = [])).push(entry)
    }

    for (const key of Object.keys(by)) {
      by[key] = by[key]!.slice().sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    }

    return by as Record<ContainerId, ScheduleEntry[]>
  }, [entries, tracks, trackIdSet])

  const containerByEntryId = useMemo(() => {
    const map = new Map<string, ContainerId>()
    for (const [containerId, list] of Object.entries(entriesByContainer) as Array<[ContainerId, ScheduleEntry[]]>) {
      for (const entry of list) map.set(entry.id, containerId)
    }
    return map
  }, [entriesByContainer])

  const [activeId, setActiveId] = useState<string | null>(null)
  const [shotDialog, setShotDialog] = useState<{ open: boolean; trackId: string }>({ open: false, trackId: "primary" })
  const [customDialog, setCustomDialog] = useState<{ open: boolean; trackId: string }>({ open: false, trackId: "primary" })
  const showTimelineNode = false

  const autoDurationPatches = useMemo(() => buildAutoDurationFillPatches({ entries, tracks }), [entries, tracks])
  const autoDurationFingerprint = useMemo(
    () => autoDurationPatches.map((p) => `${p.entryId}:${String(p.patch.duration ?? "")}`).sort().join("|"),
    [autoDurationPatches],
  )
  const lastAutoDurationFingerprintRef = useRef<string | null>(null)

  useEffect(() => {
    if (!clientId) return
    if (autoDurationPatches.length === 0) {
      lastAutoDurationFingerprintRef.current = null
      return
    }
    if (lastAutoDurationFingerprintRef.current === autoDurationFingerprint) return

    lastAutoDurationFingerprintRef.current = autoDurationFingerprint

    void batchUpdateScheduleEntries(clientId, projectId, scheduleId, autoDurationPatches)
      .catch(() => {
        if (lastAutoDurationFingerprintRef.current === autoDurationFingerprint) {
          lastAutoDurationFingerprintRef.current = null
        }
        toast.error("Failed to auto-fill duration.")
      })
  }, [autoDurationFingerprint, autoDurationPatches, clientId, projectId, scheduleId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleRemove = useCallback(async (entryId: string) => {
    if (!clientId) return
    await removeScheduleEntry(clientId, projectId, scheduleId, entryId)
  }, [clientId, projectId, scheduleId])

  const handleUpdateNotes = useCallback(async (entryId: string, notes: string) => {
    if (!clientId) return
    await updateScheduleEntryFields(clientId, projectId, scheduleId, entryId, {
      notes: notes || null,
    })
  }, [clientId, projectId, scheduleId])

  const handleUpdateTitle = useCallback(async (entryId: string, title: string) => {
    if (!clientId) return
    const trimmed = title.trim()
    if (!trimmed) return
    await updateScheduleEntryFields(clientId, projectId, scheduleId, entryId, {
      title: trimmed,
    })
  }, [clientId, projectId, scheduleId])

  const commitPatchesWithConflictGuard = useCallback(
    async (params: {
      readonly patches: readonly EntryPatch[]
      readonly affectedTrackIds: readonly string[]
      readonly scopedEntryIds: readonly string[]
    }): Promise<boolean> => {
      if (!clientId) return false
      const { patches, affectedTrackIds, scopedEntryIds } = params
      if (patches.length === 0) return true

      const before = findTrackOverlapConflicts({
        entries,
        tracks,
        settings,
        trackIds: affectedTrackIds,
      })
      const simulated = applyEntryPatches(entries, patches)
      const after = findTrackOverlapConflicts({
        entries: simulated,
        tracks,
        settings,
        trackIds: affectedTrackIds,
      })
      const introduced = findIntroducedConflict({
        before,
        after,
        scopedEntryIds: new Set(scopedEntryIds),
      })
      if (introduced) {
        toast.error(
          `Time conflict in ${introduced.trackName}: "${introduced.firstTitle}" overlaps "${introduced.secondTitle}".`,
        )
        return false
      }

      await batchUpdateScheduleEntries(clientId, projectId, scheduleId, patches)
      return true
    },
    [clientId, entries, projectId, scheduleId, settings, tracks],
  )

  const handleUpdateStartTime = useCallback(async (entry: ScheduleEntry, startTime: string | null) => {
    if (!clientId) return
    if (isSharedBannerEntry(entry)) {
      await updateScheduleEntryFields(clientId, projectId, scheduleId, entry.id, { startTime })
      return
    }
    const trackId = entry.trackId && trackIdSet.has(entry.trackId) ? entry.trackId : "primary"
    const patches = buildCascadeDirectStartEditPatches({
      entries,
      trackId,
      entryId: entry.id,
      nextStartTime: startTime,
      settings,
    })
    await commitPatchesWithConflictGuard({
      patches,
      affectedTrackIds: [trackId],
      scopedEntryIds: [entry.id, ...patches.map((patch) => patch.entryId)],
    })
  }, [clientId, commitPatchesWithConflictGuard, entries, projectId, scheduleId, settings, trackIdSet])

  const handleUpdateDuration = useCallback(async (entry: ScheduleEntry, duration: number | undefined) => {
    if (!clientId) return
    if (isSharedBannerEntry(entry)) {
      await updateScheduleEntryFields(clientId, projectId, scheduleId, entry.id, { duration: duration ?? null })
      return
    }
    const trackId = entry.trackId && trackIdSet.has(entry.trackId) ? entry.trackId : "primary"
    const patches = buildCascadeDurationPatches({
      entries,
      trackId,
      entryId: entry.id,
      nextDurationMinutes: duration ?? null,
      settings,
    })
    await commitPatchesWithConflictGuard({
      patches,
      affectedTrackIds: [trackId],
      scopedEntryIds: [entry.id, ...patches.map((patch) => patch.entryId)],
    })
  }, [clientId, commitPatchesWithConflictGuard, entries, projectId, scheduleId, settings, trackIdSet])

  const trackOptions = useMemo(
    () => tracks.map((t) => ({ value: t.id, label: t.name })),
    [tracks],
  )

  const handleMoveToTrack = useCallback(
    async (entry: ScheduleEntry, nextTrackId: string) => {
      if (!clientId) return
      if (isSharedBannerEntry(entry)) return

      const fromTrackId = entry.trackId && trackIdSet.has(entry.trackId) ? entry.trackId : "primary"
      if (fromTrackId === nextTrackId) return

      const insertIndex = (entriesByContainer[nextTrackId] ?? []).length
      const patches = buildCascadeMoveBetweenTracksPatches({
        entries,
        fromTrackId,
        toTrackId: nextTrackId,
        entryId: entry.id,
        insertIndex,
        settings,
      })
      await commitPatchesWithConflictGuard({
        patches,
        affectedTrackIds: [fromTrackId, nextTrackId],
        scopedEntryIds: [entry.id, ...patches.map((patch) => patch.entryId)],
      })
    },
    [clientId, commitPatchesWithConflictGuard, entries, entriesByContainer, settings, trackIdSet],
  )

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over || !clientId) return

    const activeEntryId = String(active.id)
    const overId = over.id

    const fromContainer = containerByEntryId.get(activeEntryId)
    if (!fromContainer) return

    let toContainer: ContainerId | null = null
    let insertIndex: number | null = null

    if (isContainerKey(overId)) {
      toContainer = parseContainerKey(overId)
      insertIndex = (entriesByContainer[toContainer] ?? []).length
    } else {
      const overEntryId = String(overId)
      toContainer = containerByEntryId.get(overEntryId) ?? null
      if (!toContainer) return
      insertIndex = (entriesByContainer[toContainer] ?? []).findIndex((e) => e.id === overEntryId)
      if (insertIndex < 0) insertIndex = (entriesByContainer[toContainer] ?? []).length
    }

    if (!toContainer || insertIndex == null) return

    const activeEntry = entries.find((e) => e.id === activeEntryId) ?? null
    if (!activeEntry) return

    // Shared container only accepts shared highlight blocks.
    if (toContainer === "shared" && !isSharedBannerEntry(activeEntry)) {
      toast.info("Shared is for shared highlights. Use “Add Highlight” in Shared.")
      return
    }
    if (fromContainer === "shared" && !isSharedBannerEntry(activeEntry)) return

    try {
      if (fromContainer === toContainer) {
        const list = entriesByContainer[fromContainer] ?? []
        const oldIndex = list.findIndex((e) => e.id === activeEntryId)
        const newIndex = typeof insertIndex === "number" ? insertIndex : oldIndex
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return

        const next = arrayMove(list, oldIndex, newIndex)

        if (fromContainer === "shared") {
          const updates = next
            .map((e, idx) => (e.order === idx ? null : { entryId: e.id, patch: { order: idx } }))
            .filter(Boolean) as { entryId: string; patch: Record<string, unknown> }[]
          await batchUpdateScheduleEntries(clientId, projectId, scheduleId, updates)
          return
        }

        const patches = buildCascadeReorderPatches({
          entries,
          trackId: fromContainer,
          movedEntryId: activeEntryId,
          nextOrderedIds: next.map((e) => e.id),
          settings,
        })
        await commitPatchesWithConflictGuard({
          patches,
          affectedTrackIds: [fromContainer],
          scopedEntryIds: [activeEntryId, ...patches.map((patch) => patch.entryId)],
        })
        return
      }

      // Move between tracks (non-shared).
      if (fromContainer === "shared" || toContainer === "shared") return

      const patches = buildCascadeMoveBetweenTracksPatches({
        entries,
        fromTrackId: fromContainer,
        toTrackId: toContainer,
        entryId: activeEntryId,
        insertIndex,
        settings,
      })
      await commitPatchesWithConflictGuard({
        patches,
        affectedTrackIds: [fromContainer, toContainer],
        scopedEntryIds: [activeEntryId, ...patches.map((patch) => patch.entryId)],
      })
    } catch (err) {
      toast.error("Failed to move entry.")
      throw err
    }
  }, [clientId, commitPatchesWithConflictGuard, containerByEntryId, entries, entriesByContainer, projectId, scheduleId, settings])

  const activeEntry = activeId ? entries.find((e) => e.id === activeId) ?? null : null
  const hasSharedHighlights = (entriesByContainer.shared ?? []).length > 0
  const isMulti = tracks.length > 1

  return (
    <div className="flex flex-col gap-2">
      {isMulti && (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-text-muted)]">
          Tip: grab the handle on the left of an entry to drag it between tracks.
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={(e) => setActiveId(String(e.active.id))}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
      >
        {isMulti ? (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {tracks.map((track) => {
              const list = entriesByContainer[track.id] ?? []
              return (
                <DroppableColumn key={track.id} id={track.id}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                        {track.name}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-subtle)]">
                        {list.length} {list.length === 1 ? "entry" : "entries"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setShotDialog({ open: true, trackId: track.id })}
                        aria-label="Add shot"
                        title="Add shot"
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setCustomDialog({ open: true, trackId: track.id })}
                        aria-label="Add highlight"
                        title="Add highlight"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <SortableContext
                    items={list.map((e) => e.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex flex-col gap-2">
                      {list.length === 0 ? (
                        <div className="rounded border border-dashed border-[var(--color-border)] px-3 py-4 text-xs text-[var(--color-text-subtle)]">
                          No entries.
                        </div>
                      ) : (
                        list.map((entry, idx) => (
                          <SortableEntry
                            key={entry.id}
                            entry={entry}
                            showTimelineNode={showTimelineNode}
                            trackSelect={{
                              value: entry.trackId && trackIdSet.has(entry.trackId) ? entry.trackId : "primary",
                              options: trackOptions,
                              onChange: (next) => void handleMoveToTrack(entry, next)
                                .catch(() => toast.error("Failed to move entry.")),
                            }}
                            isFirst={idx === 0}
                            isLast={idx === list.length - 1}
                            onRemove={() => void handleRemove(entry.id).catch(() => toast.error("Failed to remove entry."))}
                            onUpdateTitle={(title) =>
                              void handleUpdateTitle(entry.id, title)
                                .catch(() => toast.error("Failed to update title."))
                            }
                            onUpdateStartTime={(startTime) =>
                              void handleUpdateStartTime(entry, startTime)
                                .catch(() => toast.error("Failed to update time."))
                            }
                            onUpdateDuration={(duration) =>
                              void handleUpdateDuration(entry, duration)
                                .catch(() => toast.error("Failed to update duration."))
                            }
                            onUpdateNotes={(notes) =>
                              void handleUpdateNotes(entry.id, notes)
                                .catch(() => toast.error("Failed to update notes."))
                            }
                          />
                        ))
                      )}
                    </div>
                  </SortableContext>
                </DroppableColumn>
              )
            })}

            <DroppableColumn id="shared">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                    Shared
                  </div>
                  <div className="text-[10px] text-[var(--color-text-subtle)]">
                    {(entriesByContainer.shared ?? []).length} highlights
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCustomDialog({ open: true, trackId: "shared" })}
                  aria-label="Add shared highlight"
                  title="Add shared highlight"
                >
                  <StickyNote className="h-4 w-4" />
                </Button>
              </div>

              <SortableContext
                items={(entriesByContainer.shared ?? []).map((e) => e.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="flex flex-col gap-2">
                  {(entriesByContainer.shared ?? []).length === 0 ? (
                    <div className="rounded border border-dashed border-[var(--color-border)] px-3 py-4 text-xs text-[var(--color-text-subtle)]">
                      Add shared highlights for notes, transitions, or reminders.
                    </div>
                  ) : (
                    (entriesByContainer.shared ?? []).map((entry, idx, arr) => (
                      <SortableEntry
                        key={entry.id}
                        entry={entry}
                        showTimelineNode={showTimelineNode}
                        isFirst={idx === 0}
                        isLast={idx === arr.length - 1}
                        onRemove={() => void handleRemove(entry.id).catch(() => toast.error("Failed to remove entry."))}
                        onUpdateTitle={(title) =>
                          void handleUpdateTitle(entry.id, title)
                            .catch(() => toast.error("Failed to update title."))
                        }
                        onUpdateStartTime={(startTime) =>
                          void handleUpdateStartTime(entry, startTime)
                            .catch(() => toast.error("Failed to update time."))
                        }
                        onUpdateDuration={(duration) =>
                          void handleUpdateDuration(entry, duration)
                            .catch(() => toast.error("Failed to update duration."))
                        }
                        onUpdateNotes={(notes) =>
                          void handleUpdateNotes(entry.id, notes)
                            .catch(() => toast.error("Failed to update notes."))
                        }
                      />
                    ))
                  )}
                </div>
              </SortableContext>
            </DroppableColumn>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {tracks.map((track) => {
              const list = entriesByContainer[track.id] ?? []
              return (
                <DroppableColumn key={track.id} id={track.id}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                        Schedule
                      </div>
                      <div className="text-[10px] text-[var(--color-text-subtle)]">
                        {list.length} {list.length === 1 ? "entry" : "entries"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setShotDialog({ open: true, trackId: track.id })}
                        aria-label="Add shot"
                        title="Add shot"
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setCustomDialog({ open: true, trackId: track.id })}
                        aria-label="Add highlight"
                        title="Add highlight"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <SortableContext
                    items={list.map((e) => e.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex flex-col gap-2">
                      {list.length === 0 ? (
                        <div className="rounded border border-dashed border-[var(--color-border)] px-3 py-6 text-center text-xs text-[var(--color-text-subtle)]">
                          Add a shot or a highlight block to start.
                        </div>
                      ) : (
                        list.map((entry, idx) => (
                          <SortableEntry
                            key={entry.id}
                            entry={entry}
                            showTimelineNode={showTimelineNode}
                            isFirst={idx === 0}
                            isLast={idx === list.length - 1}
                            onRemove={() => void handleRemove(entry.id).catch(() => toast.error("Failed to remove entry."))}
                            onUpdateTitle={(title) =>
                              void handleUpdateTitle(entry.id, title)
                                .catch(() => toast.error("Failed to update title."))
                            }
                            onUpdateStartTime={(startTime) =>
                              void handleUpdateStartTime(entry, startTime)
                                .catch(() => toast.error("Failed to update time."))
                            }
                            onUpdateDuration={(duration) =>
                              void handleUpdateDuration(entry, duration)
                                .catch(() => toast.error("Failed to update duration."))
                            }
                            onUpdateNotes={(notes) =>
                              void handleUpdateNotes(entry.id, notes)
                                .catch(() => toast.error("Failed to update notes."))
                            }
                          />
                        ))
                      )}
                    </div>
                  </SortableContext>
                </DroppableColumn>
              )
            })}

            {hasSharedHighlights ? (
              <DroppableColumn id="shared">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                      Banners
                    </div>
                    <div className="text-[10px] text-[var(--color-text-subtle)]">
                      {(entriesByContainer.shared ?? []).length} highlight{(entriesByContainer.shared ?? []).length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCustomDialog({ open: true, trackId: "shared" })}
                    aria-label="Add shared highlight"
                    title="Add shared highlight"
                  >
                    <StickyNote className="h-4 w-4" />
                  </Button>
                </div>

                <SortableContext
                  items={(entriesByContainer.shared ?? []).map((e) => e.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="flex flex-col gap-2">
                    {(entriesByContainer.shared ?? []).map((entry, idx, arr) => (
                      <SortableEntry
                        key={entry.id}
                        entry={entry}
                        showTimelineNode={showTimelineNode}
                        isFirst={idx === 0}
                        isLast={idx === arr.length - 1}
                        onRemove={() => void handleRemove(entry.id).catch(() => toast.error("Failed to remove entry."))}
                        onUpdateTitle={(title) =>
                          void handleUpdateTitle(entry.id, title)
                            .catch(() => toast.error("Failed to update title."))
                        }
                        onUpdateStartTime={(startTime) =>
                          void handleUpdateStartTime(entry, startTime)
                            .catch(() => toast.error("Failed to update time."))
                        }
                        onUpdateDuration={(duration) =>
                          void handleUpdateDuration(entry, duration)
                            .catch(() => toast.error("Failed to update duration."))
                        }
                        onUpdateNotes={(notes) =>
                          void handleUpdateNotes(entry.id, notes)
                            .catch(() => toast.error("Failed to update notes."))
                        }
                      />
                    ))}
                  </div>
                </SortableContext>
              </DroppableColumn>
            ) : null}
          </div>
        )}

        <DragOverlay>
          {activeEntry ? (
            <div className="w-[340px] opacity-95">
              <ScheduleEntryCard
                entry={activeEntry}
                isFirst
                isLast
                reorderMode="none"
                showTimelineNode={false}
                onRemove={() => {}}
                onUpdateTitle={() => {}}
                onUpdateStartTime={() => {}}
                onUpdateDuration={() => {}}
                onUpdateNotes={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <AddShotToScheduleDialog
        open={shotDialog.open}
        onOpenChange={(open) => setShotDialog((s) => ({ ...s, open }))}
        shots={shots}
        existingEntries={entries}
        tracks={tracks}
        defaultTrackId={shotDialog.trackId}
        onAdd={async (shot, trackId) => {
          if (!clientId) return
          const list = entriesByContainer[trackId] ?? []
          const nextOrder = list.reduce((max, e) => Math.max(max, e.order ?? 0), -1) + 1
          await addScheduleEntryShot(clientId, projectId, scheduleId, {
            shotId: shot.id,
            title: shot.title,
            order: nextOrder,
            trackId,
          })
        }}
      />

      <AddCustomEntryDialog
        open={customDialog.open}
        onOpenChange={(open) => setCustomDialog((s) => ({ ...s, open }))}
        tracks={tracks}
        defaultTrackId={customDialog.trackId}
        onAdd={async (input) => {
          if (!clientId) return
          const { title, description, trackId, highlight } = input
          const isBanner = trackId === "shared"
          const container: ContainerId = isBanner ? "shared" : trackId
          const list = entriesByContainer[container] ?? []
          const nextOrder = list.reduce((max, e) => Math.max(max, e.order ?? 0), -1) + 1
          await addScheduleEntryCustom(clientId, projectId, scheduleId, {
            type: isBanner ? "banner" : "setup",
            title,
            notes: description || null,
            order: nextOrder,
            trackId: isBanner ? "shared" : trackId,
            appliesToTrackIds: isBanner ? tracks.map((t) => t.id) : null,
            highlight,
          })
        }}
      />
    </div>
  )
}
