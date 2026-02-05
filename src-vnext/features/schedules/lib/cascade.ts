import { parseTimeToMinutes, minutesToHHMM } from "@/features/schedules/lib/time"
import type { ScheduleEntry, ScheduleSettings } from "@/shared/types"

export interface EntryPatch {
  readonly entryId: string
  readonly patch: Record<string, unknown>
}

function getDurationMinutes(entry: ScheduleEntry, defaultDurationMinutes: number): number {
  const raw = entry.duration
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return defaultDurationMinutes
  return Math.round(raw)
}

function getTrackEntries(entries: readonly ScheduleEntry[], trackId: string): ScheduleEntry[] {
  return entries
    .filter((e) => (e.trackId ?? "primary") === trackId && e.type !== "banner")
    .slice()
    .sort((a, b) => {
      const aOrder = a.order ?? Number.MAX_SAFE_INTEGER
      const bOrder = b.order ?? Number.MAX_SAFE_INTEGER
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.id.localeCompare(b.id)
    })
}

function getAnchorStartMinutes(
  trackEntries: readonly ScheduleEntry[],
  settings: ScheduleSettings | null | undefined,
): number {
  const fromFirst = trackEntries[0]?.startTime ?? trackEntries[0]?.time
  const firstMin = parseTimeToMinutes(fromFirst)
  if (firstMin != null) return firstMin

  const settingsMin = parseTimeToMinutes(settings?.dayStartTime)
  if (settingsMin != null) return settingsMin

  return 6 * 60
}

export function buildCascadeReorderPatches(params: {
  readonly entries: readonly ScheduleEntry[]
  readonly trackId: string
  readonly movedEntryId: string
  readonly nextOrderedIds: readonly string[]
  readonly settings?: ScheduleSettings | null
}): readonly EntryPatch[] {
  const { entries, trackId, movedEntryId, nextOrderedIds, settings } = params

  const defaultDurationMinutes = settings?.defaultEntryDurationMinutes ?? 15
  const cascadeEnabled = settings?.cascadeChanges !== false

  const byId = new Map(entries.map((e) => [e.id, e]))
  const trackEntries = nextOrderedIds
    .map((id) => byId.get(id))
    .filter(Boolean) as ScheduleEntry[]

  const patches: EntryPatch[] = []

  // Order patches (always)
  for (let i = 0; i < trackEntries.length; i++) {
    const entry = trackEntries[i]!
    if (entry.order !== i) {
      patches.push({ entryId: entry.id, patch: { order: i } })
    }
  }

  if (!cascadeEnabled) return patches

  const anchorStartMinutes = getAnchorStartMinutes(trackEntries, settings)

  // Compute start minutes for each entry in the next order.
  const startMinutesById = new Map<string, number>()
  let cursor = anchorStartMinutes
  for (const entry of trackEntries) {
    startMinutesById.set(entry.id, cursor)
    cursor += getDurationMinutes(entry, defaultDurationMinutes)
  }

  const movedIndex = nextOrderedIds.indexOf(movedEntryId)
  if (movedIndex === -1) return patches

  // Recompute moved + downstream only (writes minimized; upstream assumed already canonical).
  for (let i = movedIndex; i < trackEntries.length; i++) {
    const entry = trackEntries[i]!
    const nextStart = minutesToHHMM(startMinutesById.get(entry.id) ?? anchorStartMinutes)
    if (entry.startTime !== nextStart) {
      patches.push({ entryId: entry.id, patch: { startTime: nextStart } })
    }
  }

  return coalescePatches(patches)
}

export function buildCascadeStartTimePatches(params: {
  readonly entries: readonly ScheduleEntry[]
  readonly trackId: string
  readonly entryId: string
  readonly nextStartTime: string | null
  readonly settings?: ScheduleSettings | null
}): readonly EntryPatch[] {
  const { entries, trackId, entryId, nextStartTime, settings } = params

  const defaultDurationMinutes = settings?.defaultEntryDurationMinutes ?? 15
  const cascadeEnabled = settings?.cascadeChanges !== false

  const trackEntries = getTrackEntries(entries, trackId)
  const index = trackEntries.findIndex((e) => e.id === entryId)
  if (index === -1) return []

  const patches: EntryPatch[] = []

  // Always apply the direct edit.
  patches.push({ entryId, patch: { startTime: nextStartTime } })

  if (!cascadeEnabled) return coalescePatches(patches)

  const editedStartMin = parseTimeToMinutes(nextStartTime)
  if (editedStartMin == null) return coalescePatches(patches)

  // Cascade downstream from edited entry end time.
  let cursor = editedStartMin + getDurationMinutes(trackEntries[index]!, defaultDurationMinutes)
  for (let i = index + 1; i < trackEntries.length; i++) {
    const entry = trackEntries[i]!
    const next = minutesToHHMM(cursor)
    if (entry.startTime !== next) patches.push({ entryId: entry.id, patch: { startTime: next } })
    cursor += getDurationMinutes(entry, defaultDurationMinutes)
  }

  return coalescePatches(patches)
}

export function buildCascadeDurationPatches(params: {
  readonly entries: readonly ScheduleEntry[]
  readonly trackId: string
  readonly entryId: string
  readonly nextDurationMinutes: number | null
  readonly settings?: ScheduleSettings | null
}): readonly EntryPatch[] {
  const { entries, trackId, entryId, nextDurationMinutes, settings } = params

  const defaultDurationMinutes = settings?.defaultEntryDurationMinutes ?? 15
  const cascadeEnabled = settings?.cascadeChanges !== false

  const trackEntries = getTrackEntries(entries, trackId)
  const index = trackEntries.findIndex((e) => e.id === entryId)
  if (index === -1) return []

  const patches: EntryPatch[] = []
  patches.push({ entryId, patch: { duration: nextDurationMinutes } })

  if (!cascadeEnabled) return coalescePatches(patches)

  const entry = trackEntries[index]!
  const startMin = parseTimeToMinutes(entry.startTime ?? entry.time)
  if (startMin == null) return coalescePatches(patches)

  const effectiveDuration = typeof nextDurationMinutes === "number" && nextDurationMinutes > 0
    ? Math.round(nextDurationMinutes)
    : getDurationMinutes(entry, defaultDurationMinutes)

  let cursor = startMin + effectiveDuration
  for (let i = index + 1; i < trackEntries.length; i++) {
    const downstream = trackEntries[i]!
    const nextStart = minutesToHHMM(cursor)
    if (downstream.startTime !== nextStart) {
      patches.push({ entryId: downstream.id, patch: { startTime: nextStart } })
    }
    cursor += getDurationMinutes(downstream, defaultDurationMinutes)
  }

  return coalescePatches(patches)
}

export function buildCascadeMoveBetweenTracksPatches(params: {
  readonly entries: readonly ScheduleEntry[]
  readonly fromTrackId: string
  readonly toTrackId: string
  readonly entryId: string
  readonly insertIndex: number
  readonly settings?: ScheduleSettings | null
}): readonly EntryPatch[] {
  const { entries, fromTrackId, toTrackId, entryId, insertIndex, settings } = params

  const defaultDurationMinutes = settings?.defaultEntryDurationMinutes ?? 15
  const cascadeEnabled = settings?.cascadeChanges !== false

  const byId = new Map(entries.map((e) => [e.id, e]))
  const moved = byId.get(entryId)
  if (!moved) return []
  if (moved.type === "banner") return []

  const normalizeTrack = (entry: ScheduleEntry) => entry.trackId ?? "primary"

  const fromList = entries
    .filter((e) => e.type !== "banner" && normalizeTrack(e) === fromTrackId && e.id !== entryId)
    .slice()
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))

  const toList = entries
    .filter((e) => e.type !== "banner" && normalizeTrack(e) === toTrackId && e.id !== entryId)
    .slice()
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))

  const clampedIndex = Math.max(0, Math.min(toList.length, insertIndex))
  const movedNext: ScheduleEntry = { ...moved, trackId: toTrackId }

  const nextTo = [...toList]
  nextTo.splice(clampedIndex, 0, movedNext)

  const patches: EntryPatch[] = []

  // Always write moved trackId when changing containers.
  if (normalizeTrack(moved) !== toTrackId) {
    patches.push({ entryId, patch: { trackId: toTrackId } })
  }

  // Order patches for both tracks.
  for (let i = 0; i < fromList.length; i++) {
    const e = fromList[i]!
    if (e.order !== i) patches.push({ entryId: e.id, patch: { order: i } })
  }

  for (let i = 0; i < nextTo.length; i++) {
    const e = nextTo[i]!
    if (e.order !== i) patches.push({ entryId: e.id, patch: { order: i } })
  }

  if (!cascadeEnabled) return coalescePatches(patches)

  function computeGaplessStartTimes(trackEntries: readonly ScheduleEntry[]): Map<string, string> {
    const startMap = new Map<string, string>()
    if (trackEntries.length === 0) return startMap

    const anchorMin = getAnchorStartMinutes(trackEntries, settings)
    let cursor = anchorMin
    for (const e of trackEntries) {
      startMap.set(e.id, minutesToHHMM(cursor))
      cursor += getDurationMinutes(e, defaultDurationMinutes)
    }
    return startMap
  }

  const fromStartTimes = computeGaplessStartTimes(fromList)
  const toStartTimes = computeGaplessStartTimes(nextTo)

  for (const e of fromList) {
    const nextStart = fromStartTimes.get(e.id)
    if (!nextStart) continue
    if (e.startTime !== nextStart) patches.push({ entryId: e.id, patch: { startTime: nextStart } })
  }

  for (const e of nextTo) {
    const nextStart = toStartTimes.get(e.id)
    if (!nextStart) continue
    if (e.startTime !== nextStart) patches.push({ entryId: e.id, patch: { startTime: nextStart } })
  }

  return coalescePatches(patches)
}

function coalescePatches(patches: readonly EntryPatch[]): readonly EntryPatch[] {
  const byId = new Map<string, Record<string, unknown>>()
  for (const p of patches) {
    const current = byId.get(p.entryId) ?? {}
    byId.set(p.entryId, { ...current, ...p.patch })
  }
  return [...byId.entries()].map(([entryId, patch]) => ({ entryId, patch }))
}
