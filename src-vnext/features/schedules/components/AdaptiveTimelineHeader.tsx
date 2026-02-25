import { Clock } from "lucide-react"
import type { ScheduleTrack } from "@/shared/types"
import type { ProjectedScheduleRow } from "@/features/schedules/lib/projection"

// ─── Track dot colors ────────────────────────────────────────────────

function trackDotClass(trackId: string): string {
  const lower = trackId.toLowerCase()
  if (lower.includes("video")) return "bg-blue-500"
  if (lower.includes("photo")) return "bg-slate-500"
  return "bg-[var(--color-primary)]"
}

// ─── Props ───────────────────────────────────────────────────────────

interface AdaptiveTimelineHeaderProps {
  readonly tracks: readonly ScheduleTrack[]
  readonly trackCounts: ReadonlyMap<string, number>
}

// ─── Component ───────────────────────────────────────────────────────

export function AdaptiveTimelineHeader({
  tracks,
  trackCounts,
}: AdaptiveTimelineHeaderProps) {
  return (
    <div className="sticky top-0 z-10 flex border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
      {/* Time gutter header */}
      <div className="flex w-14 shrink-0 items-center justify-center border-r border-[var(--color-border-muted)]">
        <Clock className="h-3.5 w-3.5 text-[var(--color-text-subtle)]" />
      </div>

      {/* Track header cells */}
      {tracks.map((track, idx) => {
        const count = trackCounts.get(track.id) ?? 0
        const isLast = idx === tracks.length - 1
        return (
          <div
            key={track.id}
            className={`flex flex-1 items-center gap-2 px-3 py-1.5 ${isLast ? "" : "border-r border-[var(--color-border-muted)]"}`}
          >
            <div className={`h-2 w-2 shrink-0 rounded-full ${trackDotClass(track.id)}`} />
            <span className="text-xxs font-bold uppercase tracking-wider text-[var(--color-text-secondary)]">
              {track.name}
            </span>
            <span className="ml-auto text-2xs text-[var(--color-text-subtle)]">
              {count} {count === 1 ? "shot" : "shots"}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Utility: compute track counts from rows ─────────────────────────

export function computeTrackCounts(
  rows: readonly ProjectedScheduleRow[],
  tracks: readonly ScheduleTrack[],
): Map<string, number> {
  const counts = new Map<string, number>()
  for (const track of tracks) {
    counts.set(track.id, 0)
  }
  for (const row of rows) {
    if (row.startMin != null && !row.isBanner) {
      const current = counts.get(row.trackId) ?? 0
      counts.set(row.trackId, current + 1)
    }
  }
  return counts
}
