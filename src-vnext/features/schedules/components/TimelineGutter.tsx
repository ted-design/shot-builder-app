import { formatTimeShort } from "@/features/schedules/lib/adaptiveSegments"

// ─── Types ────────────────────────────────────────────────────────────

interface TimeMarker {
  readonly minuteOfDay: number
  readonly offsetPx: number
  readonly label: string
  readonly isHour: boolean
}

interface TimelineGutterProps {
  readonly startMin: number
  readonly endMin: number
  readonly totalHeightPx: number
  readonly pxPerMin: number
}

// ─── Helpers ──────────────────────────────────────────────────────────

function buildMarkers(
  startMin: number,
  endMin: number,
  pxPerMin: number,
): readonly TimeMarker[] {
  const markers: TimeMarker[] = []
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

// ─── Component ───────────────────────────────────────────────────────

/**
 * The 60px time gutter on the left of the timeline grid.
 * Renders 15-minute tick marks and hour labels.
 */
export function TimelineGutter({
  startMin,
  endMin,
  totalHeightPx,
  pxPerMin,
}: TimelineGutterProps) {
  const markers = buildMarkers(startMin, endMin, pxPerMin)

  return (
    <div
      className="relative w-[60px] shrink-0 border-r border-[var(--color-border-muted)] bg-[var(--color-surface-subtle)]"
      style={{ height: `${totalHeightPx}px` }}
    >
      {markers.map((marker) => (
        <div key={marker.minuteOfDay}>
          <span
            className={`absolute right-3 font-mono leading-none ${
              marker.isHour
                ? "text-xxs font-semibold text-[var(--color-text-muted)]"
                : "text-3xs font-medium text-[var(--color-text-subtle)]"
            }`}
            style={{ top: `${marker.offsetPx}px`, transform: "translateY(-50%)" }}
          >
            {marker.label}
          </span>
          <div
            className="absolute right-0 h-px"
            style={{
              top: `${marker.offsetPx}px`,
              width: marker.isHour ? "8px" : "4px",
              backgroundColor: marker.isHour
                ? "var(--color-border)"
                : "var(--color-border-muted)",
            }}
          />
        </div>
      ))}
    </div>
  )
}
