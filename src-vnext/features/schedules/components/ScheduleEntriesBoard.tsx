import { useCallback, useMemo, useState } from "react"
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
  buildCascadeReorderPatches,
  buildCascadeStartTimePatches,
} from "@/features/schedules/lib/cascade"
import type { Schedule, ScheduleEntry, ScheduleTrack, Shot } from "@/shared/types"

type ContainerId = string | "shared"

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
      if (entry.type === "banner") {
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
  const [customDialog, setCustomDialog] = useState<{ open: boolean; trackId: string; defaultType?: "setup" | "break" | "move" | "banner" }>({ open: false, trackId: "primary" })
  const showTimelineNode = false

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

  const handleUpdateStartTime = useCallback(async (entry: ScheduleEntry, startTime: string | null) => {
    if (!clientId) return
    if (entry.type === "banner") {
      await updateScheduleEntryFields(clientId, projectId, scheduleId, entry.id, { startTime })
      return
    }
    const trackId = entry.trackId && trackIdSet.has(entry.trackId) ? entry.trackId : "primary"
    const patches = buildCascadeStartTimePatches({
      entries,
      trackId,
      entryId: entry.id,
      nextStartTime: startTime,
      settings,
    })
    await batchUpdateScheduleEntries(clientId, projectId, scheduleId, patches)
  }, [batchUpdateScheduleEntries, clientId, entries, projectId, scheduleId, settings, trackIdSet])

  const handleUpdateDuration = useCallback(async (entry: ScheduleEntry, duration: number | undefined) => {
    if (!clientId) return
    if (entry.type === "banner") {
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
    await batchUpdateScheduleEntries(clientId, projectId, scheduleId, patches)
  }, [batchUpdateScheduleEntries, clientId, entries, projectId, scheduleId, settings, trackIdSet])

  const trackOptions = useMemo(
    () => tracks.map((t) => ({ value: t.id, label: t.name })),
    [tracks],
  )

  const handleMoveToTrack = useCallback(
    async (entry: ScheduleEntry, nextTrackId: string) => {
      if (!clientId) return
      if (entry.type === "banner") return

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
      await batchUpdateScheduleEntries(clientId, projectId, scheduleId, patches)
    },
    [batchUpdateScheduleEntries, clientId, entries, entriesByContainer, projectId, scheduleId, settings, trackIdSet],
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

    // Shared container only accepts banner entries for now.
    if (toContainer === "shared" && activeEntry.type !== "banner") {
      toast.info("Shared is for Banner entries. Use “Add Entry → Banner”.")
      return
    }
    if (fromContainer === "shared" && activeEntry.type !== "banner") return

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
        await batchUpdateScheduleEntries(clientId, projectId, scheduleId, patches)
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
      await batchUpdateScheduleEntries(clientId, projectId, scheduleId, patches)
    } catch (err) {
      toast.error("Failed to move entry.")
      throw err
    }
  }, [clientId, containerByEntryId, entries, entriesByContainer, projectId, scheduleId, settings])

  const activeEntry = activeId ? entries.find((e) => e.id === activeId) ?? null : null
  const hasBanners = (entriesByContainer.shared ?? []).length > 0
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
                        aria-label="Add entry"
                        title="Add entry"
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
                    {(entriesByContainer.shared ?? []).length} banners
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setCustomDialog({ open: true, trackId: "primary", defaultType: "banner" })}
                  aria-label="Add banner"
                  title="Add banner"
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
                      Add banners for shared notes or beats.
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
                        aria-label="Add entry"
                        title="Add entry"
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
                          Add a shot or a custom entry to start.
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

            {hasBanners ? (
              <DroppableColumn id="shared">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                      Banners
                    </div>
                    <div className="text-[10px] text-[var(--color-text-subtle)]">
                      {(entriesByContainer.shared ?? []).length} banner{(entriesByContainer.shared ?? []).length === 1 ? "" : "s"}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setCustomDialog({ open: true, trackId: "primary", defaultType: "banner" })}
                    aria-label="Add banner"
                    title="Add banner"
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
        defaultType={customDialog.defaultType}
        onAdd={async (type, title, trackId) => {
          if (!clientId) return
          const isBanner = type === "banner"
          const container: ContainerId = isBanner ? "shared" : trackId
          const list = entriesByContainer[container] ?? []
          const nextOrder = list.reduce((max, e) => Math.max(max, e.order ?? 0), -1) + 1
          await addScheduleEntryCustom(clientId, projectId, scheduleId, {
            type,
            title,
            order: nextOrder,
            trackId: isBanner ? "primary" : trackId,
            appliesToTrackIds: isBanner && tracks.length > 1 ? tracks.map((t) => t.id) : null,
          })
        }}
      />
    </div>
  )
}
