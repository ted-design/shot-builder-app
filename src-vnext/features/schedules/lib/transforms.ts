import { minutesToHHMM, parseTimeToMinutes } from "@/features/schedules/lib/time"
import type { ScheduleEntry, ScheduleSettings, ScheduleTrack } from "@/shared/types"

const PRIMARY_TRACK: ScheduleTrack = { id: "primary", name: "Primary", order: 0 }

function getDurationMinutes(entry: ScheduleEntry, settings: ScheduleSettings): number {
  const raw = entry.duration
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return settings.defaultEntryDurationMinutes
  }
  return Math.round(raw)
}

function getStartMin(entry: ScheduleEntry): number | null {
  return parseTimeToMinutes(entry.startTime) ?? parseTimeToMinutes(entry.time)
}

export function buildCollapseToSingleTrack(params: {
  readonly entries: readonly ScheduleEntry[]
  readonly settings: ScheduleSettings
}): {
  readonly tracks: readonly ScheduleTrack[]
  readonly entryUpdates: readonly { readonly entryId: string; readonly patch: Record<string, unknown> }[]
} {
  const { entries, settings } = params

  const sortable = entries
    .slice()
    .map((e) => ({
      entry: e,
      startMin: getStartMin(e),
      order: e.order ?? Number.MAX_SAFE_INTEGER,
    }))
    .sort((a, b) => {
      const aStart = a.startMin ?? Number.MAX_SAFE_INTEGER
      const bStart = b.startMin ?? Number.MAX_SAFE_INTEGER
      if (aStart !== bStart) return aStart - bStart
      if (a.order !== b.order) return a.order - b.order
      return a.entry.id.localeCompare(b.entry.id)
    })

  const firstStart = sortable.find((s) => s.startMin != null)?.startMin
  const anchor = firstStart ?? parseTimeToMinutes(settings.dayStartTime) ?? 6 * 60

  const updates: { entryId: string; patch: Record<string, unknown> }[] = []

  let cursor = anchor
  for (let index = 0; index < sortable.length; index++) {
    const entry = sortable[index]!.entry
    const duration = getDurationMinutes(entry, settings)
    const nextStart = minutesToHHMM(cursor)

    const patch: Record<string, unknown> = {
      order: index,
      trackId: "primary",
      appliesToTrackIds: null,
      startTime: nextStart,
    }

    // Avoid writing no-op patches.
    const hasChange =
      entry.order !== index ||
      (entry.trackId ?? "primary") !== "primary" ||
      (entry.appliesToTrackIds != null && entry.appliesToTrackIds.length > 0) ||
      entry.startTime !== nextStart

    if (hasChange) updates.push({ entryId: entry.id, patch })

    cursor += duration
  }

  return {
    tracks: [PRIMARY_TRACK],
    entryUpdates: updates,
  }
}

