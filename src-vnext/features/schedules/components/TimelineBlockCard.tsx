import type { CSSProperties } from "react"
import { Camera, StickyNote } from "lucide-react"
import { formatTimeShort } from "@/features/schedules/lib/adaptiveSegments"
import { getBlockColors } from "@/features/schedules/lib/blockColors"
import type { ProjectedScheduleRow } from "@/features/schedules/lib/projection"
import type { Shot } from "@/shared/types"

// ─── Constants ────────────────────────────────────────────────────────

export const COMPACT_HEIGHT = 64

// ─── Types ────────────────────────────────────────────────────────────

interface TimelineBlockCardProps {
  readonly row: ProjectedScheduleRow
  readonly shot?: Shot
  /** Height in pixels for this card. */
  readonly heightPx: number
  /** onClick reports the entry id. */
  readonly onClick?: (entryId: string) => void
  /** Whether this card is currently selected (shown in PropertiesDrawer). */
  readonly isSelected?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────

function formatDuration(minutes: number | null): string | null {
  if (!minutes || !Number.isFinite(minutes) || minutes <= 0) return null
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

// ─── Component ───────────────────────────────────────────────────────

/**
 * A single schedule block in the Timeline Grid view.
 * Color is derived from entry type + banner label via getBlockColors(),
 * which returns CSS variable references from tokens.css — dark mode safe.
 */
export function TimelineBlockCard({
  row,
  shot,
  heightPx,
  onClick,
  isSelected,
}: TimelineBlockCardProps) {
  const { entry } = row
  const colors = getBlockColors(entry)
  const isBanner = entry.type === "banner"
  const Icon = isBanner ? StickyNote : Camera

  const timeLabel = row.startMin != null ? formatTimeShort(row.startMin) : null
  const durationLabel = formatDuration(row.durationMinutes)
  const shotNumber = shot?.shotNumber ?? null
  const title = entry.title

  const isCompact = heightPx <= COMPACT_HEIGHT

  const cardStyle: CSSProperties = {
    height: `${heightPx}px`,
    borderLeftColor: colors.borderColorVar,
    backgroundColor: colors.bgColorVar,
    boxShadow: isSelected ? "0 0 0 2px rgba(59,130,246,0.3)" : undefined,
  }

  return (
    <button
      type="button"
      onClick={onClick ? () => onClick(entry.id) : undefined}
      className="group flex w-full flex-col overflow-hidden rounded-md border border-[var(--color-border)] border-l-[3px] text-left shadow-sm transition-[box-shadow,transform] duration-150 hover:z-10 hover:-translate-y-px hover:shadow-md"
      style={cardStyle}
      title={title}
    >
      <div className="flex h-full flex-col overflow-hidden px-2 py-1.5">
        {/* Header: shot number / time / duration */}
        <div className="flex shrink-0 items-center gap-1">
          {shotNumber ? (
            <span className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1 font-mono text-3xs font-semibold text-[var(--color-text-subtle)]">
              {shotNumber}
            </span>
          ) : null}
          <span className="flex-1" />
          {timeLabel ? (
            <span className="font-mono text-2xs text-[var(--color-text-subtle)]">
              {timeLabel}
            </span>
          ) : null}
          {durationLabel && !isCompact ? (
            <span className="rounded bg-[var(--color-surface-subtle)] px-1 font-mono text-3xs text-[var(--color-text-subtle)]">
              {durationLabel}
            </span>
          ) : null}
        </div>

        {/* Title */}
        <div className="flex shrink-0 items-baseline gap-1">
          <Icon className="mt-0.5 h-3 w-3 shrink-0 text-[var(--color-text-muted)]" />
          <span
            className={[
              "font-semibold leading-tight text-[var(--color-text)]",
              isCompact ? "text-xxs" : "text-sm",
            ].join(" ")}
          >
            {title}
          </span>
        </div>

        {/* Subtitle: shot description or banner notes */}
        {!isCompact && shot?.description ? (
          <p className="mt-0.5 truncate text-3xs text-[var(--color-text-secondary)]">
            {shot.description}
          </p>
        ) : null}
      </div>
    </button>
  )
}
