import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Plus, Camera, StickyNote } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/ui/button"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { AddShotToScheduleDialog } from "@/features/schedules/components/AddShotToScheduleDialog"
import { AddCustomEntryDialog } from "@/features/schedules/components/AddCustomEntryDialog"
import { ScheduleEntryEditSheet } from "@/features/schedules/components/ScheduleEntryEditSheet"
import { AdaptiveBannerSegment } from "@/features/schedules/components/AdaptiveBannerSegment"
import { AdaptiveGapSegment } from "@/features/schedules/components/AdaptiveGapSegment"
import { AdaptiveDenseBlock } from "@/features/schedules/components/AdaptiveDenseBlock"
import {
  AdaptiveTimelineHeader,
  computeTrackCounts,
} from "@/features/schedules/components/AdaptiveTimelineHeader"
import { AdaptiveUnscheduledTray } from "@/features/schedules/components/AdaptiveUnscheduledTray"
import { useAdaptiveSegments } from "@/features/schedules/hooks/useAdaptiveSegments"
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
} from "@/features/schedules/lib/cascade"
import { buildAutoDurationFillPatches } from "@/features/schedules/lib/autoDuration"
import { findTrackOverlapConflicts, type TrackOverlapConflict } from "@/features/schedules/lib/conflicts"
import { parseTimeToMinutes } from "@/features/schedules/lib/time"
import type { VisibleFields } from "@/features/schedules/lib/adaptiveSegments"
import type {
  Schedule,
  ScheduleEntry,
  ScheduleSettings,
  ScheduleTrack,
  Shot,
  TalentRecord,
} from "@/shared/types"

// ─── Helpers ─────────────────────────────────────────────────────────

type EntryPatch = { readonly entryId: string; readonly patch: Record<string, unknown> }

const SHARED_TRACK_IDS = new Set(["shared", "all"])

function normalizeTracks(schedule: Schedule | null): readonly ScheduleTrack[] {
  const raw = schedule?.tracks
  if (raw && raw.length > 0) {
    return [...raw].slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }
  return [{ id: "primary", name: "Primary", order: 0 }]
}

function normalizeSettings(schedule: Schedule | null): ScheduleSettings {
  return schedule?.settings ?? {
    cascadeChanges: true,
    dayStartTime: "06:00",
    defaultEntryDurationMinutes: 15,
  }
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

function conflictKey(c: TrackOverlapConflict): string {
  return [c.firstEntryId, c.secondEntryId].sort().join("|")
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

// ─── Props ───────────────────────────────────────────────────────────

interface AdaptiveTimelineViewProps {
  readonly scheduleId: string
  readonly schedule: Schedule | null
  readonly entries: readonly ScheduleEntry[]
  readonly shots: readonly Shot[]
  readonly talentLookup?: readonly TalentRecord[]
}

// ─── Component ───────────────────────────────────────────────────────

export function AdaptiveTimelineView({
  scheduleId,
  schedule,
  entries,
  shots,
  talentLookup,
}: AdaptiveTimelineViewProps) {
  const { clientId } = useAuth()
  const { projectId } = useProjectScope()

  const tracks = useMemo(() => normalizeTracks(schedule), [schedule])
  const settings = useMemo(() => normalizeSettings(schedule), [schedule])
  const trackIdSet = useMemo(() => new Set(tracks.map((t) => t.id)), [tracks])

  // Adaptive layout
  const layout = useAdaptiveSegments(schedule, entries)

  // Shot lookup
  const shotMap = useMemo(() => {
    const map = new Map<string, Shot>()
    for (const shot of shots) map.set(shot.id, shot)
    return map
  }, [shots])

  // Track counts
  const trackCounts = useMemo(
    () => computeTrackCounts(layout.segments.flatMap((s) => {
      if (s.kind === "dense") {
        const rows: import("@/features/schedules/lib/projection").ProjectedScheduleRow[] = []
        for (const trackRows of s.rowsByTrack.values()) {
          rows.push(...trackRows)
        }
        return rows
      }
      return []
    }), tracks),
    [layout.segments, tracks],
  )

  // Visible fields — default all on
  const fields: VisibleFields = useMemo(() => ({
    showDescription: true,
    showProducts: true,
    showTalent: true,
    showLocation: true,
    showNotes: true,
    showTags: true,
  }), [])

  // ─── Dialog state ────────────────────────────────────────────────

  const [editEntryId, setEditEntryId] = useState<string | null>(null)
  const [shotDialog, setShotDialog] = useState<{ open: boolean; trackId: string }>({
    open: false,
    trackId: "primary",
  })
  const [customDialog, setCustomDialog] = useState<{ open: boolean; trackId: string }>({
    open: false,
    trackId: "primary",
  })

  const editEntry = editEntryId ? entries.find((e) => e.id === editEntryId) ?? null : null

  // Close sheet if entry disappears
  useEffect(() => {
    if (!editEntryId) return
    if (!editEntry) setEditEntryId(null)
  }, [editEntry, editEntryId])

  // ─── Auto-duration fill ──────────────────────────────────────────

  const autoDurationPatches = useMemo(
    () => buildAutoDurationFillPatches({ entries, tracks }),
    [entries, tracks],
  )
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

    batchUpdateScheduleEntries(clientId, projectId, scheduleId, autoDurationPatches)
      .catch(() => {
        lastAutoDurationFingerprintRef.current = null
        toast.error("Failed to auto-fill duration.")
      })
  }, [autoDurationFingerprint, autoDurationPatches, clientId, projectId, scheduleId])

  // ─── Entry-by-container for order computation ────────────────────

  const entriesByContainer = useMemo(() => {
    const by: Record<string, ScheduleEntry[]> = {}
    for (const t of tracks) by[t.id] = []
    by.shared = []

    for (const entry of entries) {
      if (isSharedBannerEntry(entry)) {
        by.shared!.push(entry)
        continue
      }
      const tid = entry.trackId && trackIdSet.has(entry.trackId) ? entry.trackId : "primary"
      ;(by[tid] ?? (by[tid] = [])).push(entry)
    }

    for (const key of Object.keys(by)) {
      by[key] = by[key]!.slice().sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
    }

    return by
  }, [entries, tracks, trackIdSet])

  // ─── Handlers ────────────────────────────────────────────────────

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

      const before = findTrackOverlapConflicts({ entries, tracks, settings, trackIds: affectedTrackIds })
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

  const trackOptions = useMemo(
    () => tracks.map((t) => ({ value: t.id, label: t.name })),
    [tracks],
  )

  // ─── Click handler ───────────────────────────────────────────────

  const handleClickEntry = useCallback((entryId: string) => {
    setEditEntryId(entryId)
  }, [])

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="flex flex-col">
      {/* Add buttons */}
      <div className="mb-2 flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShotDialog({ open: true, trackId: tracks[0]?.id ?? "primary" })}
        >
          <Camera className="mr-1.5 h-3.5 w-3.5" />
          Add Shot
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCustomDialog({ open: true, trackId: tracks[0]?.id ?? "primary" })}
        >
          <StickyNote className="mr-1.5 h-3.5 w-3.5" />
          Add Entry
        </Button>
      </div>

      {/* Timeline container */}
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          {/* Segments wrapper */}
          <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
            {/* Track header */}
            <AdaptiveTimelineHeader tracks={tracks} trackCounts={trackCounts} />

            {/* Segments */}
            {layout.segments.map((segment) => {
              switch (segment.kind) {
                case "banner":
                  return (
                    <AdaptiveBannerSegment key={segment.key} segment={segment} />
                  )
                case "gap":
                  return (
                    <AdaptiveGapSegment key={segment.key} segment={segment} />
                  )
                case "dense":
                  return (
                    <AdaptiveDenseBlock
                      key={segment.key}
                      segment={segment}
                      tracks={tracks}
                      shotMap={shotMap}
                      fields={fields}
                      onClickEntry={handleClickEntry}
                    />
                  )
              }
            })}

            {/* Empty state */}
            {layout.segments.length === 0 && layout.unscheduledRows.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <p className="text-sm text-[var(--color-text-muted)]">
                  No schedule entries yet
                </p>
                <p className="text-xs text-[var(--color-text-subtle)]">
                  Add shots or custom entries to build your timeline
                </p>
              </div>
            ) : null}
          </div>

          {/* Unscheduled tray */}
          <AdaptiveUnscheduledTray
            rows={layout.unscheduledRows}
            shotMap={shotMap}
            onClickEntry={handleClickEntry}
          />
        </div>
      </div>

      {/* Edit sheet */}
      <ScheduleEntryEditSheet
        open={!!editEntryId}
        entry={editEntry}
        trackOptions={trackOptions}
        onOpenChange={(next) => {
          if (!next) setEditEntryId(null)
        }}
        onUpdateTitle={async (title) => {
          if (!editEntryId) return
          await handleUpdateTitle(editEntryId, title)
        }}
        onUpdateStartTime={async (startTime) => {
          if (!editEntryId) return
          const current = entries.find((entry) => entry.id === editEntryId)
          if (!current) return
          await handleUpdateStartTime(current, startTime)
        }}
        onUpdateDuration={async (duration) => {
          if (!editEntryId) return
          const current = entries.find((entry) => entry.id === editEntryId)
          if (!current) return
          await handleUpdateDuration(current, duration)
        }}
        onUpdateNotes={async (notes) => {
          if (!editEntryId) return
          await handleUpdateNotes(editEntryId, notes)
        }}
        onUpdateHighlight={async (highlight) => {
          if (!editEntryId || !clientId) return
          await updateScheduleEntryFields(clientId, projectId, scheduleId, editEntryId, { highlight })
        }}
        onMoveToTrack={async (trackId) => {
          if (!editEntryId) return
          const current = entries.find((entry) => entry.id === editEntryId)
          if (!current) return
          await handleMoveToTrack(current, trackId)
        }}
      />

      {/* Add shot dialog */}
      <AddShotToScheduleDialog
        open={shotDialog.open}
        onOpenChange={(open) => setShotDialog((s) => ({ ...s, open }))}
        shots={shots}
        existingEntries={entries}
        tracks={tracks}
        talentLookup={talentLookup}
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

      {/* Add custom entry dialog */}
      <AddCustomEntryDialog
        open={customDialog.open}
        onOpenChange={(open) => setCustomDialog((s) => ({ ...s, open }))}
        tracks={tracks}
        defaultTrackId={customDialog.trackId}
        onAdd={async (input) => {
          if (!clientId) return
          const { title, description, trackId, highlight } = input
          const isBanner = trackId === "shared"
          const container = isBanner ? "shared" : trackId
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
