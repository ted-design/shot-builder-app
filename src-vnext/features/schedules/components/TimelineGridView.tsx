import { useMemo } from "react"
import { TimelineGutter } from "@/features/schedules/components/TimelineGutter"
import { TimelineNowIndicator } from "@/features/schedules/components/TimelineNowIndicator"
import { TimelineBlockGroup } from "@/features/schedules/components/TimelineBlockGroup"
import { useOverlapGroups } from "@/features/schedules/hooks/useOverlapGroups"
import { useNowMinute } from "@/shared/hooks/useNowMinute"
import { COMPACT_HEIGHT } from "@/features/schedules/components/TimelineBlockCard"
import type { DenseBlock } from "@/features/schedules/lib/adaptiveSegments"
import type { ScheduleTrack, Shot } from "@/shared/types"

// ─── Constants ────────────────────────────────────────────────────────

const PX_PER_MIN = 4

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
