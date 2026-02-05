import { parseTimeToMinutes } from "@/features/schedules/lib/time"
import type { Schedule, ScheduleEntry, ScheduleSettings, ScheduleTrack } from "@/shared/types"

export type ScheduleProjectionMode = "time" | "sequence"

export type TimeSource = "explicit" | "derived" | "none"

export type ApplicabilityKind = "all" | "subset" | "single" | "none"

export interface ProjectedScheduleRow {
  readonly id: string
  readonly entry: ScheduleEntry
  readonly trackId: string
  readonly isBanner: boolean
  readonly appliesToTrackIds: readonly string[] | null
  readonly applicabilityKind: ApplicabilityKind
  readonly startMin: number | null
  readonly endMin: number | null
  readonly durationMinutes: number | null
  readonly timeSource: TimeSource
}

export interface ScheduleProjection {
  readonly mode: ScheduleProjectionMode
  readonly tracks: readonly ScheduleTrack[]
  readonly rows: readonly ProjectedScheduleRow[]
}

const PRIMARY_TRACK: ScheduleTrack = { id: "primary", name: "Primary", order: 0 }

function defaultTracks(tracks: readonly ScheduleTrack[] | null | undefined): readonly ScheduleTrack[] {
  if (!tracks || tracks.length === 0) return [PRIMARY_TRACK]
  const normalized = tracks
    .filter((t) => t && typeof t.id === "string" && t.id.trim().length > 0)
    .map((t, index) => ({
      id: t.id.trim(),
      name: typeof t.name === "string" && t.name.trim().length > 0 ? t.name.trim() : `Track ${index + 1}`,
      order: typeof t.order === "number" ? t.order : index,
    }))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  const hasPrimary = normalized.some((t) => t.id === "primary")
  return hasPrimary ? normalized : [PRIMARY_TRACK, ...normalized]
}

function getSettings(schedule: Schedule | null | undefined): ScheduleSettings {
  const s = schedule?.settings
  return {
    cascadeChanges: s?.cascadeChanges !== false,
    dayStartTime: typeof s?.dayStartTime === "string" ? s.dayStartTime : "06:00",
    defaultEntryDurationMinutes: typeof s?.defaultEntryDurationMinutes === "number" ? s.defaultEntryDurationMinutes : 15,
  }
}

function getDurationMinutes(entry: ScheduleEntry, settings: ScheduleSettings): number | null {
  const raw = entry.duration
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) {
    return settings.defaultEntryDurationMinutes
  }
  return Math.round(raw)
}

function inferStartMin(entry: ScheduleEntry): { startMin: number | null; timeSource: TimeSource } {
  const explicit = parseTimeToMinutes(entry.startTime) ?? parseTimeToMinutes(entry.time)
  if (explicit == null) return { startMin: null, timeSource: "none" }
  return { startMin: explicit, timeSource: "explicit" }
}

function isAllTracks(
  appliesToTrackIds: readonly string[] | null,
  trackIds: ReadonlySet<string>,
): boolean {
  if (!appliesToTrackIds || appliesToTrackIds.length === 0) return false
  if (appliesToTrackIds.length !== trackIds.size) return false
  for (const id of appliesToTrackIds) if (!trackIds.has(id)) return false
  return true
}

function computeApplicability(params: {
  readonly entry: ScheduleEntry
  readonly trackId: string
  readonly trackIds: ReadonlySet<string>
}): { appliesToTrackIds: readonly string[] | null; applicabilityKind: ApplicabilityKind; isBanner: boolean } {
  const { entry, trackId, trackIds } = params

  const raw = Array.isArray(entry.appliesToTrackIds)
    ? entry.appliesToTrackIds.filter((id) => typeof id === "string" && id.trim().length > 0)
    : null
  const appliesToTrackIds = raw && raw.length > 0 ? raw : null

  const bannerByType = entry.type === "banner"
  const bannerByApplicability = appliesToTrackIds ? isAllTracks(appliesToTrackIds, trackIds) : false
  const isBanner = bannerByType || bannerByApplicability

  if (isBanner) {
    return { appliesToTrackIds: appliesToTrackIds ?? [...trackIds], applicabilityKind: "all", isBanner: true }
  }

  if (appliesToTrackIds && appliesToTrackIds.length > 0) {
    return { appliesToTrackIds, applicabilityKind: appliesToTrackIds.length === 1 ? "single" : "subset", isBanner: false }
  }

  if (trackId && trackIds.has(trackId)) return { appliesToTrackIds: null, applicabilityKind: "single", isBanner: false }
  return { appliesToTrackIds: null, applicabilityKind: "none", isBanner: false }
}

function deriveMissingTimes(params: {
  readonly entries: readonly ScheduleEntry[]
  readonly trackIds: readonly string[]
  readonly settings: ScheduleSettings
}): Map<string, { startMin: number; timeSource: TimeSource }> {
  const { entries, trackIds, settings } = params

  const byId = new Map<string, { startMin: number; timeSource: TimeSource }>()

  for (const trackId of trackIds) {
    const trackEntries = entries
      .filter((e) => (e.trackId ?? "primary") === trackId && e.type !== "banner")
      .slice()
      .sort((a, b) => {
        const aOrder = a.order ?? Number.MAX_SAFE_INTEGER
        const bOrder = b.order ?? Number.MAX_SAFE_INTEGER
        if (aOrder !== bOrder) return aOrder - bOrder
        return a.id.localeCompare(b.id)
      })

    if (trackEntries.length === 0) continue

    const firstExplicit = inferStartMin(trackEntries[0]!).startMin
    const anchor = firstExplicit ?? parseTimeToMinutes(settings.dayStartTime) ?? 6 * 60

    let cursor = anchor
    for (const entry of trackEntries) {
      const { startMin, timeSource } = inferStartMin(entry)
      if (startMin != null) {
        byId.set(entry.id, { startMin, timeSource })
        cursor = startMin + (getDurationMinutes(entry, settings) ?? settings.defaultEntryDurationMinutes)
        continue
      }
      byId.set(entry.id, { startMin: cursor, timeSource: "derived" })
      cursor += getDurationMinutes(entry, settings) ?? settings.defaultEntryDurationMinutes
    }
  }

  // Banners: derive only if missing and we have a usable day anchor.
  const bannerAnchor = parseTimeToMinutes(settings.dayStartTime) ?? 6 * 60
  for (const entry of entries) {
    if (entry.type !== "banner") continue
    const { startMin } = inferStartMin(entry)
    if (startMin != null) {
      byId.set(entry.id, { startMin, timeSource: "explicit" })
      continue
    }
    byId.set(entry.id, { startMin: bannerAnchor, timeSource: "derived" })
  }

  return byId
}

export function buildScheduleProjection(params: {
  readonly schedule: Schedule | null
  readonly entries: readonly ScheduleEntry[]
  readonly mode: ScheduleProjectionMode
}): ScheduleProjection {
  const { schedule, entries, mode } = params

  const tracks = defaultTracks(schedule?.tracks)
  const settings = getSettings(schedule)
  const trackIds = tracks.map((t) => t.id)
  const trackIdSet = new Set(trackIds)

  const derivedTimesById = deriveMissingTimes({ entries, trackIds, settings })

  const rows: ProjectedScheduleRow[] = entries.map((entry) => {
    const rawTrackId = entry.trackId ?? "primary"
    const trackId = trackIdSet.has(rawTrackId) ? rawTrackId : "primary"
    const applicability = computeApplicability({ entry, trackId, trackIds: trackIdSet })

    const derived = derivedTimesById.get(entry.id) ?? { startMin: null as number | null, timeSource: "none" as TimeSource }
    const startMin = derived.startMin
    const durationMinutes = getDurationMinutes(entry, settings)
    const endMin = startMin != null && durationMinutes != null ? startMin + durationMinutes : null

    return {
      id: entry.id,
      entry,
      trackId,
      isBanner: applicability.isBanner,
      appliesToTrackIds: applicability.appliesToTrackIds,
      applicabilityKind: applicability.applicabilityKind,
      startMin,
      endMin,
      durationMinutes,
      timeSource: derived.timeSource,
    }
  })

  const sorted = rows.slice().sort((a, b) => {
    if (mode === "sequence") {
      const aOrder = a.entry.order ?? Number.MAX_SAFE_INTEGER
      const bOrder = b.entry.order ?? Number.MAX_SAFE_INTEGER
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.id.localeCompare(b.id)
    }

    const aStart = a.startMin ?? Number.MAX_SAFE_INTEGER
    const bStart = b.startMin ?? Number.MAX_SAFE_INTEGER
    if (aStart !== bStart) return aStart - bStart

    const aTrack = tracks.find((t) => t.id === a.trackId)?.order ?? 0
    const bTrack = tracks.find((t) => t.id === b.trackId)?.order ?? 0
    if (aTrack !== bTrack) return aTrack - bTrack

    const aOrder = a.entry.order ?? Number.MAX_SAFE_INTEGER
    const bOrder = b.entry.order ?? Number.MAX_SAFE_INTEGER
    if (aOrder !== bOrder) return aOrder - bOrder

    return a.id.localeCompare(b.id)
  })

  return { mode, tracks, rows: sorted }
}

