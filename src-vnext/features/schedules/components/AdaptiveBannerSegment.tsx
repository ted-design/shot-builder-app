import { formatMinutesTo12h } from "@/features/schedules/lib/time"
import { formatTimeShort } from "@/features/schedules/lib/adaptiveSegments"
import type { BannerSegment } from "@/features/schedules/lib/adaptiveSegments"

// ─── Banner style mapping ────────────────────────────────────────────

function bannerStyle(entryType: string): {
  readonly pill: string
  readonly text: string
} {
  // Breaks/lunch → amber, everything else → indigo
  if (entryType === "break") {
    return {
      pill: "bg-gradient-to-r from-amber-50 to-amber-100 text-amber-800 dark:from-amber-950 dark:to-amber-900 dark:text-amber-200",
      text: "text-amber-800 dark:text-amber-200",
    }
  }
  return {
    pill: "bg-gradient-to-r from-indigo-50 to-indigo-100 text-indigo-800 dark:from-indigo-950 dark:to-indigo-900 dark:text-indigo-200",
    text: "text-indigo-800 dark:text-indigo-200",
  }
}

// ─── Props ───────────────────────────────────────────────────────────

interface AdaptiveBannerSegmentProps {
  readonly segment: BannerSegment
}

// ─── Component ───────────────────────────────────────────────────────

export function AdaptiveBannerSegment({ segment }: AdaptiveBannerSegmentProps) {
  const entryType = segment.row.entry.type ?? "banner"
  const style = bannerStyle(entryType)
  const endMin = segment.startMin + segment.durationMinutes
  const timeRange = `${formatMinutesTo12h(segment.startMin)} \u2013 ${formatMinutesTo12h(endMin)}`
  const durationLabel = `${segment.durationMinutes}m`

  return (
    <div className="flex items-center border-b border-[var(--color-border-muted)]">
      {/* Time gutter cell */}
      <div className="flex w-14 shrink-0 items-center justify-center border-r border-[var(--color-border-muted)] bg-[var(--color-surface-subtle)]">
        <span className="font-mono text-2xs font-semibold text-[var(--color-text-muted)]">
          {formatTimeShort(segment.startMin)}
        </span>
      </div>

      {/* Banner pill */}
      <div className={`flex flex-1 items-center gap-2.5 px-4 py-2.5 ${style.pill}`}>
        <span className="whitespace-nowrap rounded-full bg-black/[0.06] dark:bg-white/[0.08] px-2 py-0.5 font-mono text-2xs font-semibold">
          {timeRange}
        </span>
        <span className="text-xs font-bold uppercase tracking-wide">
          {segment.title}
        </span>
        <span className="h-px flex-1 bg-current opacity-15" />
        <span className="font-mono text-2xs opacity-60">
          {durationLabel}
        </span>
      </div>
    </div>
  )
}
