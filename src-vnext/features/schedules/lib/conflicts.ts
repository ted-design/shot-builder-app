import { parseTimeToMinutes } from "@/features/schedules/lib/time"
import type { ScheduleEntry, ScheduleSettings, ScheduleTrack } from "@/shared/types"

export interface TrackOverlapConflict {
  readonly trackId: string
  readonly trackName: string
  readonly firstEntryId: string
  readonly secondEntryId: string
  readonly firstTitle: string
  readonly secondTitle: string
  readonly firstStartMin: number
  readonly firstEndMin: number
  readonly secondStartMin: number
}

const PRIMARY_TRACK: ScheduleTrack = { id: "primary", name: "Primary", order: 0 }
const SHARED_TRACK_IDS = new Set(["shared", "all"])

function normalizeSettings(settings: ScheduleSettings | null | undefined): ScheduleSettings {
  return {
    cascadeChanges: settings?.cascadeChanges !== false,
    dayStartTime: typeof settings?.dayStartTime === "string" ? settings.dayStartTime : "06:00",
    defaultEntryDurationMinutes:
      typeof settings?.defaultEntryDurationMinutes === "number" && settings.defaultEntryDurationMinutes > 0
        ? Math.round(settings.defaultEntryDurationMinutes)
        : 15,
  }
}

function normalizeTracks(tracks: readonly ScheduleTrack[] | null | undefined): readonly ScheduleTrack[] {
  if (!tracks || tracks.length === 0) return [PRIMARY_TRACK]
  const normalized = tracks
    .filter((track) => typeof track.id === "string" && track.id.trim().length > 0)
    .map((track, index) => ({
      id: track.id.trim(),
      name: typeof track.name === "string" && track.name.trim().length > 0 ? track.name.trim() : `Track ${index + 1}`,
      order: typeof track.order === "number" ? track.order : index,
    }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const hasPrimary = normalized.some((track) => track.id === "primary")
  return hasPrimary ? normalized : [PRIMARY_TRACK, ...normalized]
}

function hasExplicitDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function normalizeTrackId(entry: ScheduleEntry, trackIdSet: ReadonlySet<string>): string {
  const raw = entry.trackId ?? "primary"
  return trackIdSet.has(raw) ? raw : "primary"
}

interface TimedEntry {
  readonly entry: ScheduleEntry
  readonly startMin: number
}

function getEffectiveDurationMinutes(params: {
  readonly current: ScheduleEntry
  readonly currentStartMin: number
  readonly nextStartMin: number | null
  readonly settings: ScheduleSettings
}): number {
  const { current, currentStartMin, nextStartMin, settings } = params
  if (hasExplicitDuration(current.duration)) return Math.round(current.duration)
  if (nextStartMin != null && nextStartMin > currentStartMin) {
    return Math.round(nextStartMin - currentStartMin)
  }
  return settings.defaultEntryDurationMinutes
}

export function findTrackOverlapConflicts(params: {
  readonly entries: readonly ScheduleEntry[]
  readonly tracks?: readonly ScheduleTrack[] | null
  readonly settings?: ScheduleSettings | null
  readonly trackIds?: readonly string[]
}): readonly TrackOverlapConflict[] {
  const { entries, trackIds } = params
  const tracks = normalizeTracks(params.tracks)
  const settings = normalizeSettings(params.settings)
  const trackMap = new Map(tracks.map((track) => [track.id, track]))
  const allTrackIds = new Set(trackMap.keys())
  const scopedTrackIds = new Set(
    (trackIds && trackIds.length > 0 ? trackIds : [...allTrackIds]).filter((trackId) => allTrackIds.has(trackId)),
  )

  const byTrack = new Map<string, ScheduleEntry[]>()
  for (const trackId of scopedTrackIds) byTrack.set(trackId, [])

  for (const entry of entries) {
    if (entry.type === "banner") continue
    if (entry.trackId && SHARED_TRACK_IDS.has(entry.trackId)) continue
    const trackId = normalizeTrackId(entry, allTrackIds)
    if (!scopedTrackIds.has(trackId)) continue
    const list = byTrack.get(trackId) ?? []
    list.push(entry)
    byTrack.set(trackId, list)
  }

  const conflicts: TrackOverlapConflict[] = []

  for (const [trackId, list] of byTrack) {
    const timed: TimedEntry[] = list
      .map((entry) => {
        const startMin = parseTimeToMinutes(entry.startTime ?? entry.time)
        if (startMin == null) return null
        return { entry, startMin }
      })
      .filter(Boolean) as TimedEntry[]

    timed.sort((a, b) => {
      if (a.startMin !== b.startMin) return a.startMin - b.startMin
      const aOrder = a.entry.order ?? Number.MAX_SAFE_INTEGER
      const bOrder = b.entry.order ?? Number.MAX_SAFE_INTEGER
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.entry.id.localeCompare(b.entry.id)
    })

    for (let i = 0; i < timed.length - 1; i++) {
      const current = timed[i]!
      const next = timed[i + 1]!
      const duration = getEffectiveDurationMinutes({
        current: current.entry,
        currentStartMin: current.startMin,
        nextStartMin: next.startMin,
        settings,
      })
      const endMin = current.startMin + duration
      if (endMin <= next.startMin) continue

      const trackName = trackMap.get(trackId)?.name ?? trackId
      conflicts.push({
        trackId,
        trackName,
        firstEntryId: current.entry.id,
        secondEntryId: next.entry.id,
        firstTitle: current.entry.title,
        secondTitle: next.entry.title,
        firstStartMin: current.startMin,
        firstEndMin: endMin,
        secondStartMin: next.startMin,
      })
    }
  }

  return conflicts
}
