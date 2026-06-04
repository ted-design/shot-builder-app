import type { LedgerSegment } from "./lib/ledgerData"

interface SegmentedBarProps {
  /** Ordered segments from a {@link import("./lib/ledgerData").LedgerRow}. */
  readonly segments: readonly LedgerSegment[]
  /** Accessible label for the bar group (e.g. "Shot list progress"). */
  readonly ariaLabel?: string
}

/**
 * Proportional segmented progress bar (mockup zone D — `.segbar` + `.seglegend`).
 *
 * Each segment's flex weight is its raw `value`, so widths stay proportional to
 * counts. Zero-value segments are dropped from the bar so they don't render a
 * 0-width sliver, but the underlying ledgerData adapters already guarantee at
 * least one segment (a muted "empty" placeholder) so the bar never collapses.
 *
 * Colors are design-token names from the view-model (e.g. `--color-success`),
 * wrapped here in `var(...)`. No hardcoded hex.
 */
export function SegmentedBar({ segments, ariaLabel }: SegmentedBarProps) {
  // Drop zero-width slivers from the bar itself; keep every segment in the legend.
  const barSegments = segments.filter((s) => s.value > 0)
  // If every segment is zero (shouldn't happen — adapters add a placeholder),
  // fall back to rendering all so the bar still paints something.
  const renderable = barSegments.length > 0 ? barSegments : segments

  return (
    <div className="flex flex-col gap-2.5">
      <div
        className="flex h-[9px] items-center gap-[3px]"
        role="img"
        aria-label={ariaLabel}
      >
        {renderable.map((seg) => (
          <span
            key={seg.key}
            className="h-[9px] rounded-[2px]"
            style={{
              flex: seg.value > 0 ? seg.value : 1,
              backgroundColor: `var(${seg.colorVar})`,
            }}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10.5px] text-[var(--color-text-muted)]">
        {segments.map((seg) => (
          <span
            key={seg.key}
            className="flex items-center gap-1.5 tabular-nums"
          >
            <i
              aria-hidden="true"
              className="inline-block h-2 w-2 rounded-[2px]"
              style={{ backgroundColor: `var(${seg.colorVar})` }}
            />
            {seg.label}
            {!seg.isPlaceholder && (
              <b className="font-semibold text-[var(--color-text-secondary)]">
                {seg.value}
              </b>
            )}
          </span>
        ))}
      </div>
    </div>
  )
}
