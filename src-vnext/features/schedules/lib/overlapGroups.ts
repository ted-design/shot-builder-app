import type { ProjectedScheduleRow } from "@/features/schedules/lib/projection"

// ─── Types ────────────────────────────────────────────────────────────

export interface OverlapGroup {
  /** Unique key for React rendering. */
  readonly key: string
  /** Track this group belongs to. */
  readonly trackId: string
  /** Earliest startMin across all entries in this group. */
  readonly startMin: number
  /** Latest endMin across all entries in this group. */
  readonly endMin: number
  /** The projected rows in this group. */
  readonly entries: readonly ProjectedScheduleRow[]
  /** True when only one entry — renders at COMPACT_HEIGHT (64px). */
  readonly isIsolated: boolean
}

// ─── Algorithm ────────────────────────────────────────────────────────

/**
 * Clamp an entry's endMin to the end of the current day (1439 = 23:59).
 *
 * Handles two midnight-crossing scenarios:
 * 1. endMin > 1439 (e.g. startMin=1380, duration=60 → endMin=1440): clamp to 1439.
 * 2. endMin < startMin (wrapped midnight crossing, e.g. startMin=1380, endMin=60):
 *    treat as extending to end-of-day → clamp to 1439.
 */
function clampEndMin(startMin: number, endMin: number): number {
  if (endMin < startMin) return 1439
  return Math.min(endMin, 1439)
}

/**
 * Groups timed, non-banner schedule entries by time overlap within each track.
 *
 * - Per-track only: entries in different tracks never merge.
 * - Banners are excluded.
 * - Midnight-crossing entries are clamped to end-of-day (1439).
 * - Uses a sweep-line merge: entries are sorted by startMin, then any entry
 *   whose startMin < current group endMin is added to the group (extending
 *   the group's endMin as needed). Adjacent entries (startMin === prev endMin)
 *   are NOT considered overlapping.
 */
export function buildOverlapGroups(
  rows: readonly ProjectedScheduleRow[],
): readonly OverlapGroup[] {
  // Filter to timed, non-banner rows only.
  // Clamp endMin to handle midnight-spanning and midnight-crossing entries.
  const timedRows = rows
    .filter((r) => !r.isBanner && r.startMin != null && r.endMin != null)
    .map((r) => ({
      ...r,
      endMin: clampEndMin(r.startMin!, r.endMin!),
    }))

  if (timedRows.length === 0) return []

  // Group rows by track
  const byTrack = new Map<string, ProjectedScheduleRow[]>()
  for (const row of timedRows) {
    const trackId = row.trackId
    const list = byTrack.get(trackId)
    if (list) {
      list.push(row)
    } else {
      byTrack.set(trackId, [row])
    }
  }

  const allGroups: OverlapGroup[] = []

  for (const [trackId, trackRows] of byTrack) {
    // Sort by startMin, then by id for stability
    const sorted = trackRows.slice().sort((a, b) => {
      const aStart = a.startMin!
      const bStart = b.startMin!
      if (aStart !== bStart) return aStart - bStart
      return a.id.localeCompare(b.id)
    })

    // Sweep-line grouping
    let groupStart = sorted[0]!.startMin!
    let groupEnd = sorted[0]!.endMin!
    let groupEntries: ProjectedScheduleRow[] = [sorted[0]!]

    const flushGroup = (): void => {
      allGroups.push({
        key: `overlap-${trackId}-${groupStart}`,
        trackId,
        startMin: groupStart,
        endMin: groupEnd,
        entries: groupEntries,
        isIsolated: groupEntries.length === 1,
      })
    }

    for (let i = 1; i < sorted.length; i++) {
      const row = sorted[i]!
      const rowStart = row.startMin!
      const rowEnd = row.endMin!

      if (rowStart < groupEnd) {
        // Overlaps with current group — extend
        groupEntries = [...groupEntries, row]
        if (rowEnd > groupEnd) groupEnd = rowEnd
      } else {
        // No overlap — flush current group, start new one
        flushGroup()
        groupStart = rowStart
        groupEnd = rowEnd
        groupEntries = [row]
      }
    }

    // Flush last group
    flushGroup()
  }

  // Sort all groups by startMin for consistent ordering
  return allGroups.slice().sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin
    return a.trackId.localeCompare(b.trackId)
  })
}
