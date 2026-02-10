import { parseTimeToMinutes } from "@/features/schedules/lib/time"
import type { ScheduleEntry, ScheduleTrack } from "@/shared/types"

interface EntryPatch {
  readonly entryId: string
  readonly patch: Record<string, unknown>
}

function hasValidDuration(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0
}

function normalizeTrackId(entry: ScheduleEntry, trackIdSet: Set<string>): string {
  if (entry.trackId && trackIdSet.has(entry.trackId)) return entry.trackId
  return "primary"
}

/**
 * Auto-fills missing duration from adjacent explicit start times within each track.
 * Only entries with missing/invalid duration are patched.
 */
export function buildAutoDurationFillPatches(params: {
  readonly entries: readonly ScheduleEntry[]
  readonly tracks: readonly ScheduleTrack[]
}): readonly EntryPatch[] {
  const { entries, tracks } = params
  const trackIdSet = new Set((tracks.length > 0 ? tracks : [{ id: "primary", name: "Primary", order: 0 }]).map((t) => t.id))

  const byTrack = new Map<string, ScheduleEntry[]>()
  for (const trackId of trackIdSet) byTrack.set(trackId, [])

  for (const entry of entries) {
    if (entry.type === "banner") continue
    const tid = normalizeTrackId(entry, trackIdSet)
    const list = byTrack.get(tid) ?? []
    list.push(entry)
    byTrack.set(tid, list)
  }

  const patches: EntryPatch[] = []

  for (const [, list] of byTrack) {
    const ordered = list
      .slice()
      .sort((a, b) => {
        const aOrder = a.order ?? Number.MAX_SAFE_INTEGER
        const bOrder = b.order ?? Number.MAX_SAFE_INTEGER
        if (aOrder !== bOrder) return aOrder - bOrder
        return a.id.localeCompare(b.id)
      })

    for (let i = 0; i < ordered.length - 1; i++) {
      const current = ordered[i]!
      const next = ordered[i + 1]!

      if (hasValidDuration(current.duration)) continue

      const currentStart = parseTimeToMinutes(current.startTime ?? current.time)
      const nextStart = parseTimeToMinutes(next.startTime ?? next.time)
      if (currentStart == null || nextStart == null) continue

      const delta = nextStart - currentStart
      if (!Number.isFinite(delta) || delta <= 0) continue

      patches.push({
        entryId: current.id,
        patch: { duration: Math.round(delta) },
      })
    }
  }

  return patches
}
