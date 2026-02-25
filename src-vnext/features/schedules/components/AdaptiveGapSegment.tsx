import type { GapSegment } from "@/features/schedules/lib/adaptiveSegments"

// ─── Props ───────────────────────────────────────────────────────────

interface AdaptiveGapSegmentProps {
  readonly segment: GapSegment
}

// ─── Component ───────────────────────────────────────────────────────

export function AdaptiveGapSegment({ segment }: AdaptiveGapSegmentProps) {
  return (
    <div className="flex items-center border-b border-[var(--color-border-muted)]">
      {/* Empty time gutter cell */}
      <div className="w-14 shrink-0 border-r border-[var(--color-border-muted)] bg-[var(--color-surface-subtle)]" />

      {/* Gap content: dashed line + label + dashed line */}
      <div className="flex flex-1 items-center justify-center gap-2 px-4 py-1">
        <div
          className="h-px flex-1"
          style={{
            background:
              "repeating-linear-gradient(to right, var(--color-border) 0px, var(--color-border) 4px, transparent 4px, transparent 8px)",
          }}
        />
        <span className="whitespace-nowrap text-3xs font-semibold uppercase tracking-widest text-[var(--color-text-subtle)]">
          {segment.label}
        </span>
        <div
          className="h-px flex-1"
          style={{
            background:
              "repeating-linear-gradient(to right, var(--color-border) 0px, var(--color-border) 4px, transparent 4px, transparent 8px)",
          }}
        />
      </div>
    </div>
  )
}
