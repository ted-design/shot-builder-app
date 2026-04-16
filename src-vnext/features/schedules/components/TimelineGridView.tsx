import { useMemo } from "react"
import { TimelineGutter } from "@/features/schedules/components/TimelineGutter"
import { TimelineNowIndicator } from "@/features/schedules/components/TimelineNowIndicator"
import { TimelineBlockGroup } from "@/features/schedules/components/TimelineBlockGroup"
import { useOverlapGroups } from "@/features/schedules/hooks/useOverlapGroups"
import { useNowMinute } from "@/shared/hooks/useNowMinute"
import { COMPACT_HEIGHT } from "@/features/schedules/components/TimelineBlockCard"
import type { DenseBlock } from "@/features/schedules/lib/adaptiveSegments"
import type { ProjectedScheduleRow } from "@/features/schedules/lib/projection"
import type { ScheduleTrack, Shot } from "@/shared/types"

// ─── Constants ────────────────────────────────────────────────────────

const PX_PER_MIN = 4

// ─── Cross-track overlap bands ───────────────────────────────────────

interface OverlapBand {
  readonly startMin: number
  readonly endMin: number
}

/**
 * Finds time ranges where entries on 2+ different tracks overlap.
 * Returns merged, sorted bands suitable for rendering highlight strips.
 */
function computeCrossTrackOverlapBands(
  rowsByTrack: ReadonlyMap<string, readonly ProjectedScheduleRow[]>,
): readonly OverlapBand[] {
  const trackIntervals: ReadonlyArray<{ startMin: number; endMin: number }>[] = []

  for (const rows of rowsByTrack.values()) {
    const intervals = rows
      .filter((r): r is ProjectedScheduleRow & { startMin: number; endMin: number } =>
        r.startMin != null && r.endMin != null,
      )
      .map((r) => ({ startMin: r.startMin, endMin: r.endMin }))
    if (intervals.length > 0) trackIntervals.push(intervals)
  }

  if (trackIntervals.length < 2) return []

  // For each pair of tracks, find pairwise entry overlaps
  const bands: OverlapBand[] = []
  for (let i = 0; i < trackIntervals.length; i++) {
    for (let j = i + 1; j < trackIntervals.length; j++) {
      for (const a of trackIntervals[i]) {
        for (const b of trackIntervals[j]) {
          const overlapStart = Math.max(a.startMin, b.startMin)
          const overlapEnd = Math.min(a.endMin, b.endMin)
          if (overlapStart < overlapEnd) {
            bands.push({ startMin: overlapStart, endMin: overlapEnd })
          }
        }
      }
    }
  }

  if (bands.length === 0) return []

  // Merge overlapping/adjacent bands into contiguous ranges
  const sorted = [...bands].sort((a, b) => a.startMin - b.startMin)
  const merged: OverlapBand[] = [sorted[0]]
  for (let k = 1; k < sorted.length; k++) {
    const last = merged[merged.length - 1]
    if (sorted[k].startMin <= last.endMin) {
      merged[merged.length - 1] = {
        startMin: last.startMin,
        endMin: Math.max(last.endMin, sorted[k].endMin),
      }
    } else {
      merged.push(sorted[k])
    }
  }

  return merged
}

// ─── Types ────────────────────────────────────────────────────────────

interface TimelineGridViewProps {
  readonly segment: DenseBlock
  readonly tracks: readonly ScheduleTrack[]
  readonly shotMap: ReadonlyMap<string, Shot>
  readonly selectedEntryId: string | null
  readonly onClickEntry: (entryId: string) => void
  readonly viewMode: "compressed" | "proportional"
}

// ─── Component ───────────────────────────────────────────────────────

/**
 * Renders a DenseBlock as a proper time-proportional grid:
 * - 60px time gutter on the left (TimelineGutter)
 * - Track columns with overlap group compression (TimelineBlockGroup)
 * - NOW indicator overlaid across the full width (TimelineNowIndicator)
 *
 * Used as the primary view when viewMode is "compressed" or "proportional".
 */
export function TimelineGridView({
  segment,
  tracks,
  shotMap,
  selectedEntryId,
  onClickEntry,
  viewMode,
}: TimelineGridViewProps) {
  const { startMin, endMin, rowsByTrack } = segment
  const nowMinute = useNowMinute()

  // Collect all rows across all tracks for overlap group computation
  const allRows = useMemo(() => {
    const rows = []
    for (const trackRows of rowsByTrack.values()) {
      rows.push(...trackRows)
    }
    return rows
  }, [rowsByTrack])

  const overlapGroups = useOverlapGroups(allRows)

  // Cross-track overlap highlight bands (only meaningful with 2+ tracks)
  const overlapBands = useMemo(
    () => computeCrossTrackOverlapBands(rowsByTrack),
    [rowsByTrack],
  )

  // Empty state: no scheduled entries in this segment
  const hasEntries = allRows.length > 0

  // Compute total block height based on time range
  const totalHeightPx = useMemo(() => {
    if (viewMode === "compressed") {
      // In compressed mode, compute height per track from its groups
      // Total height = max across all tracks of their compressed height
      let maxHeight = COMPACT_HEIGHT
      for (const track of tracks) {
        const trackGroups = overlapGroups.filter((g) => g.trackId === track.id)
        if (trackGroups.length === 0) continue
        let trackHeight = 0
        for (const g of trackGroups) {
          const groupStart = g.startMin - startMin
          const groupHeight = g.isIsolated
            ? COMPACT_HEIGHT
            : (g.endMin - g.startMin) * PX_PER_MIN
          trackHeight = Math.max(trackHeight, groupStart * PX_PER_MIN + groupHeight)
        }
        maxHeight = Math.max(maxHeight, trackHeight)
      }
      return Math.max(COMPACT_HEIGHT * 2, maxHeight)
    }
    return Math.max(COMPACT_HEIGHT * 2, (endMin - startMin) * PX_PER_MIN)
  }, [viewMode, overlapGroups, tracks, startMin, endMin])

  if (!hasEntries) {
    return (
      <div className="flex min-w-[600px] items-center justify-center border-b border-[var(--color-border-muted)] py-12">
        <p className="text-sm text-[var(--color-text-subtle)]">No scheduled entries</p>
      </div>
    )
  }

  return (
    <div
      className="relative flex min-w-[600px] border-b border-[var(--color-border-muted)]"
      style={{ minHeight: `${totalHeightPx}px` }}
    >
      {/* Time gutter */}
      <TimelineGutter
        startMin={startMin}
        endMin={endMin}
        totalHeightPx={totalHeightPx}
        pxPerMin={PX_PER_MIN}
      />

      {/* Track columns */}
      <div className="relative flex min-w-0 flex-1" style={{ height: `${totalHeightPx}px` }}>
        {/* Gridlines */}
        {buildGridlines(startMin, endMin, PX_PER_MIN).map((line) => (
          <div
            key={line.minuteOfDay}
            className={`pointer-events-none absolute inset-x-0 h-px ${
              line.isHour ? "bg-[var(--color-border)]" : "bg-[var(--color-border-muted)]"
            }`}
            style={{ top: `${line.offsetPx}px` }}
          />
        ))}

        {/* Cross-track overlap highlights */}
        {overlapBands.map((band, i) => (
          <div
            key={`overlap-${i}`}
            className="pointer-events-none absolute inset-x-0 bg-[var(--color-primary)]/5"
            style={{
              top: `${(band.startMin - startMin) * PX_PER_MIN}px`,
              height: `${(band.endMin - band.startMin) * PX_PER_MIN}px`,
            }}
          />
        ))}

        {/* Track columns with block groups */}
        {tracks.map((track, idx) => {
          const trackGroups = overlapGroups.filter((g) => g.trackId === track.id)
          const isLast = idx === tracks.length - 1

          return (
            <div
              key={track.id}
              className={`relative flex-1 ${isLast ? "" : "border-r border-[var(--color-border-muted)]"}`}
              style={{ height: `${totalHeightPx}px` }}
            >
              {trackGroups.map((group) => (
                <TimelineBlockGroup
                  key={group.key}
                  group={group}
                  blockStartMin={startMin}
                  pxPerMin={PX_PER_MIN}
                  shotMap={shotMap}
                  selectedEntryId={selectedEntryId}
                  onClickEntry={onClickEntry}
                  viewMode={viewMode}
                />
              ))}
            </div>
          )
        })}

        {/* NOW indicator — overlaid across all track columns */}
        <TimelineNowIndicator
          startMin={startMin}
          endMin={endMin}
          nowMinute={nowMinute}
          pxPerMin={PX_PER_MIN}
        />
      </div>
    </div>
  )
}

// ─── Gridline helpers ──────────────────────────────────────────────────

interface Gridline {
  readonly minuteOfDay: number
  readonly offsetPx: number
  readonly isHour: boolean
}

function buildGridlines(
  startMin: number,
  endMin: number,
  pxPerMin: number,
): readonly Gridline[] {
  const lines: Gridline[] = []
  const firstTick = Math.ceil(startMin / 15) * 15
  for (let min = firstTick; min <= endMin; min += 15) {
    lines.push({
      minuteOfDay: min,
      offsetPx: (min - startMin) * pxPerMin,
      isHour: min % 60 === 0,
    })
  }
  return lines
}
