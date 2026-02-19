import { Camera, Wrench, Sparkles } from "lucide-react"
import type { ProjectedScheduleRow } from "@/features/schedules/lib/projection"
import type { Shot, ScheduleEntryType } from "@/shared/types"

// ─── Icon config ─────────────────────────────────────────────────────

const TRAY_TYPE_ICON: Record<ScheduleEntryType, typeof Camera> = {
  shot: Camera,
  setup: Wrench,
  break: Camera,
  move: Camera,
  banner: Camera,
}

// ─── Props ───────────────────────────────────────────────────────────

interface AdaptiveUnscheduledTrayProps {
  readonly rows: readonly ProjectedScheduleRow[]
  readonly shotMap: ReadonlyMap<string, Shot>
  readonly onClickEntry?: (entryId: string) => void
}

// ─── Component ───────────────────────────────────────────────────────

export function AdaptiveUnscheduledTray({
  rows,
  shotMap,
  onClickEntry,
}: AdaptiveUnscheduledTrayProps) {
  if (rows.length === 0) return null

  return (
    <div className="mt-5">
      {/* Header */}
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-text-subtle)]">
          Unscheduled
        </span>
        <span className="h-px flex-1 bg-[var(--color-border-muted)]" />
        <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-2 py-px text-[10px] text-[var(--color-text-subtle)]">
          {rows.length}
        </span>
      </div>

      {/* Grid of cards */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2">
        {rows.map((row) => {
          const entry = row.entry
          const shotId = entry.shotId
          const shot = shotId ? shotMap.get(shotId) : undefined
          const isHighlight = entry.type !== "shot" && !!entry.highlight
          const TypeIcon = isHighlight ? Sparkles : (TRAY_TYPE_ICON[entry.type] ?? Camera)
          const shotNumber = shot?.shotNumber ?? null

          return (
            <button
              key={row.id}
              type="button"
              onClick={onClickEntry ? () => onClickEntry(row.id) : undefined}
              className="relative cursor-pointer overflow-hidden rounded-lg border-[1.5px] border-dashed border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2.5 text-left transition-all hover:border-solid hover:border-[var(--color-primary)] hover:bg-[var(--color-surface)] hover:shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
            >
              {/* Left accent bar */}
              <div className="absolute inset-y-0 left-0 w-[3px] bg-[var(--color-text-subtle)]" />

              <div className="flex items-center gap-2">
                <TypeIcon className="h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
                {shotNumber ? (
                  <span className="font-mono text-[10px] font-semibold text-[var(--color-text-subtle)]">
                    {shotNumber}
                  </span>
                ) : null}
                <span className="truncate text-[13px] font-semibold text-[var(--color-text)]">
                  {entry.highlight?.emoji ? `${entry.highlight.emoji} ` : ""}
                  {entry.title}
                </span>
              </div>

              {shot?.description ? (
                <p className="mt-0.5 truncate pl-5.5 text-[11px] text-[var(--color-text-muted)]">
                  {shot.description}
                </p>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
