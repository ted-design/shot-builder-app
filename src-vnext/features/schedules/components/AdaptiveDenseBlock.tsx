import { useMemo } from "react"
import { formatTimeShort } from "@/features/schedules/lib/adaptiveSegments"
import type { DenseBlock } from "@/features/schedules/lib/adaptiveSegments"
import type { VisibleFields } from "@/features/schedules/lib/adaptiveSegments"
import type { ScheduleTrack, Shot } from "@/shared/types"
import { AdaptiveEntryCard } from "@/features/schedules/components/AdaptiveEntryCard"

// ─── Time markers ────────────────────────────────────────────────────

interface TimeMarker {
  readonly minuteOfDay: number
  readonly offsetPx: number
  readonly label: string
  readonly isHour: boolean
}

function buildTimeMarkers(
  startMin: number,
  endMin: number,
  pxPerMin: number,
): readonly TimeMarker[] {
  const markers: TimeMarker[] = []
  // Start from the next 15-min boundary at or after startMin
  const firstTick = Math.ceil(startMin / 15) * 15

  for (let min = firstTick; min <= endMin; min += 15) {
    const offsetPx = (min - startMin) * pxPerMin
    markers.push({
      minuteOfDay: min,
      offsetPx,
      label: formatTimeShort(min),
      isHour: min % 60 === 0,
    })
  }
  return markers
}

// ─── Props ───────────────────────────────────────────────────────────

interface AdaptiveDenseBlockProps {
  readonly segment: DenseBlock
  readonly tracks: readonly ScheduleTrack[]
  readonly shotMap: ReadonlyMap<string, Shot>
  readonly fields: VisibleFields
  readonly onClickEntry?: (entryId: string) => void
}

// ─── Component ───────────────────────────────────────────────────────

export function AdaptiveDenseBlock({
  segment,
  tracks,
  shotMap,
  fields,
  onClickEntry,
}: AdaptiveDenseBlockProps) {
  const { startMin, endMin, pxPerMin } = segment
  const blockHeightPx = (endMin - startMin) * pxPerMin

  const markers = useMemo(
    () => buildTimeMarkers(startMin, endMin, pxPerMin),
    [startMin, endMin, pxPerMin],
  )

  return (
    <div
      className="flex border-b border-[var(--color-border-muted)]"
      style={{ minHeight: `${blockHeightPx}px` }}
    >
      {/* Time gutter */}
      <div
        className="relative w-14 shrink-0 border-r border-[var(--color-border-muted)] bg-[var(--color-surface-subtle)]"
        style={{ height: `${blockHeightPx}px` }}
      >
        {markers.map((marker) => (
          <div key={marker.minuteOfDay}>
            <span
              className={`absolute right-1.5 font-mono text-[10px] leading-none ${
                marker.isHour
                  ? "font-semibold text-[var(--color-text-muted)]"
                  : "font-medium text-[var(--color-text-subtle)]"
              }`}
              style={{ top: `${marker.offsetPx}px`, transform: "translateY(-50%)" }}
            >
              {marker.label}
            </span>
            <div
              className="absolute right-0 h-px w-1.5"
              style={{
                top: `${marker.offsetPx}px`,
                backgroundColor: marker.isHour
                  ? "var(--color-border)"
                  : "var(--color-border-muted)",
              }}
            />
          </div>
        ))}
      </div>

      {/* Track columns */}
      <div className="flex min-w-0 flex-1">
        {tracks.map((track, idx) => {
          const trackRows = segment.rowsByTrack.get(track.id) ?? []
          const isLast = idx === tracks.length - 1

          return (
            <div
              key={track.id}
              className={`relative flex-1 ${isLast ? "" : "border-r border-[var(--color-border-muted)]"}`}
              style={{ height: `${blockHeightPx}px`, padding: "6px" }}
            >
              {/* Gridlines */}
              {markers.map((marker) => (
                <div
                  key={`grid-${marker.minuteOfDay}`}
                  className={`pointer-events-none absolute inset-x-0 h-px ${
                    marker.isHour
                      ? "bg-[var(--color-border)]"
                      : "bg-[var(--color-border-muted)]"
                  }`}
                  style={{ top: `${marker.offsetPx}px` }}
                />
              ))}

              {/* Entry cards */}
              {trackRows.map((row) => {
                const shotId = row.entry.shotId
                const shot = shotId ? shotMap.get(shotId) : undefined

                return (
                  <AdaptiveEntryCard
                    key={row.id}
                    row={row}
                    shot={shot}
                    pxPerMin={pxPerMin}
                    blockStartMin={startMin}
                    fields={fields}
                    trackId={track.id}
                    onClick={onClickEntry ? () => onClickEntry(row.id) : undefined}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
