import type { ProjectedScheduleRow } from "./projection"

export interface ScheduleGap {
  readonly trackId: string
  readonly startMin: number
  readonly endMin: number
  readonly durationMinutes: number
}

const DEFAULT_MIN_GAP_MINUTES = 30

export function detectScheduleGaps(
  rows: readonly ProjectedScheduleRow[],
  opts?: { readonly minGapMinutes?: number },
): readonly ScheduleGap[] {
  const threshold = opts?.minGapMinutes ?? DEFAULT_MIN_GAP_MINUTES

  // Group by trackId, filtering out rows with null times
  const byTrack = new Map<string, { startMin: number; endMin: number }[]>()
  for (const row of rows) {
    if (row.startMin == null || row.endMin == null) continue
    const list = byTrack.get(row.trackId) ?? []
    list.push({ startMin: row.startMin, endMin: row.endMin })
    byTrack.set(row.trackId, list)
  }

  const gaps: ScheduleGap[] = []

  for (const [trackId, entries] of byTrack) {
    // Sort by startMin (immutable — spread before sort)
    const sorted = [...entries].sort((a, b) => a.startMin - b.startMin)

    for (let i = 0; i < sorted.length - 1; i++) {
      const currentEnd = sorted[i]!.endMin
      const nextStart = sorted[i + 1]!.startMin
      const gapDuration = nextStart - currentEnd

      if (gapDuration > threshold) {
        gaps.push({
          trackId,
          startMin: currentEnd,
          endMin: nextStart,
          durationMinutes: gapDuration,
        })
      }
    }
  }

  return gaps
}
