// ─── Types ────────────────────────────────────────────────────────────

interface TimelineNowIndicatorProps {
  readonly startMin: number
  readonly endMin: number
  readonly nowMinute: number
  readonly pxPerMin: number
}

// ─── Component ───────────────────────────────────────────────────────

/**
 * Renders the NOW indicator inside the timeline content area:
 * - A "NOW" label in the gutter
 * - An 8px pulsing red dot at the left edge of the track area
 * - A 1px red horizontal line across the track columns (50% opacity)
 *
 * Only renders when nowMinute is within the visible time window.
 */
export function TimelineNowIndicator({
  startMin,
  endMin,
  nowMinute,
  pxPerMin,
}: TimelineNowIndicatorProps) {
  if (nowMinute < startMin || nowMinute > endMin) return null

  const offsetPx = (nowMinute - startMin) * pxPerMin

  return (
    <>
      {/* NOW label in gutter */}
      <span
        className="pointer-events-none absolute z-20 font-mono text-3xs font-bold text-immediate-red"
        style={{
          top: `${offsetPx}px`,
          left: 0,
          width: "52px",
          textAlign: "right",
          paddingRight: "10px",
          transform: "translateY(-50%)",
          letterSpacing: "0.02em",
        }}
      >
        NOW
      </span>

      {/* Pulsing dot */}
      <div
        className="pointer-events-none absolute z-20 h-2 w-2 animate-pulse rounded-full bg-immediate-red"
        style={{
          top: `${offsetPx}px`,
          left: "53px",
          transform: "translateY(-50%)",
        }}
      />

      {/* Horizontal line across track area */}
      <div
        className="pointer-events-none absolute z-20 h-px bg-immediate-red"
        style={{
          top: `${offsetPx}px`,
          left: "60px",
          right: 0,
          opacity: 0.5,
        }}
      />
    </>
  )
}
