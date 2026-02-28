import type { CSSProperties } from "react"
import {
  Camera,
  Wrench,
  Coffee,
  Truck,
  StickyNote,
  Sparkles,
  Package,
  User,
  Users,
  MapPin,
  FileText,
} from "lucide-react"
import { formatTimeShort, computeCardHeight } from "@/features/schedules/lib/adaptiveSegments"
import type { VisibleFields } from "@/features/schedules/lib/adaptiveSegments"
import type { ProjectedScheduleRow } from "@/features/schedules/lib/projection"
import type { Shot, ScheduleEntryType } from "@/shared/types"

// ─── Type visual config ──────────────────────────────────────────────

const ENTRY_TYPE_STYLE: Record<
  ScheduleEntryType,
  {
    readonly icon: typeof Camera
    readonly barColor: string
  }
> = {
  shot: { icon: Camera, barColor: "bg-[var(--color-primary)]" },
  setup: { icon: Wrench, barColor: "bg-[var(--color-text-muted)]" },
  break: { icon: Coffee, barColor: "bg-amber-400" },
  move: { icon: Truck, barColor: "bg-[var(--color-text-subtle)]" },
  banner: { icon: StickyNote, barColor: "bg-[var(--color-text-subtle)]" },
}

// ─── Track colors ────────────────────────────────────────────────────

function trackDotColor(trackId: string): string {
  const lower = trackId.toLowerCase()
  if (lower.includes("video")) return "bg-blue-500"
  if (lower.includes("photo")) return "bg-[var(--color-text-muted)]"
  return "bg-[var(--color-primary)]"
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatDurationBadge(minutes: number | null | undefined): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null
  const rounded = Math.round(minutes)
  const hours = Math.floor(rounded / 60)
  const mins = rounded % 60
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`
  if (hours > 0) return `${hours}h`
  return `${mins}m`
}

function resolveProductsText(
  shot: Shot | undefined,
): string | null {
  if (!shot?.products?.length) return null
  const names = shot.products
    .map((p) => p.familyName ?? p.skuName)
    .filter(Boolean)
  return names.length > 0 ? names.join(", ") : null
}

function resolveTalentText(
  shot: Shot | undefined,
): string | null {
  if (!shot?.talent?.length) return null
  const filtered = shot.talent.filter(Boolean)
  return filtered.length > 0 ? filtered.join(", ") : null
}

function resolveLocationText(
  shot: Shot | undefined,
): string | null {
  return shot?.locationName ?? null
}

function resolveNotesText(
  row: ProjectedScheduleRow,
  shot: Shot | undefined,
): string | null {
  const entryNotes = row.entry.notes
  if (entryNotes && entryNotes.trim().length > 0) return entryNotes.trim()
  const shotNotes = shot?.notes
  if (shotNotes && shotNotes.trim().length > 0) return shotNotes.trim()
  return null
}

function resolveDescriptionText(
  shot: Shot | undefined,
): string | null {
  return shot?.description?.trim() || null
}

// ─── Props ───────────────────────────────────────────────────────────

interface AdaptiveEntryCardProps {
  readonly row: ProjectedScheduleRow
  readonly shot?: Shot
  readonly pxPerMin: number
  readonly blockStartMin: number
  readonly fields: VisibleFields
  readonly trackId: string
  readonly onClick?: () => void
}

// ─── Component ───────────────────────────────────────────────────────

export function AdaptiveEntryCard({
  row,
  shot,
  pxPerMin,
  blockStartMin,
  fields,
  trackId,
  onClick,
}: AdaptiveEntryCardProps) {
  const entry = row.entry
  const entryType = entry.type ?? "shot"
  const typeStyle = ENTRY_TYPE_STYLE[entryType] ?? ENTRY_TYPE_STYLE.shot
  const isHighlight = entryType !== "shot" && !!entry.highlight

  const startMin = row.startMin ?? blockStartMin
  const durationMinutes = row.durationMinutes ?? 15
  const topPx = (startMin - blockStartMin) * pxPerMin
  const heightPx = computeCardHeight(durationMinutes, pxPerMin, fields)

  const durationLabel = formatDurationBadge(durationMinutes)
  const timeLabel = row.startMin != null ? formatTimeShort(row.startMin) : null

  // Resolve data from shot
  const productsText = resolveProductsText(shot)
  const talentText = resolveTalentText(shot)
  const locationText = resolveLocationText(shot)
  const notesText = resolveNotesText(row, shot)
  const descriptionText = resolveDescriptionText(shot)
  const shotNumber = shot?.shotNumber ?? null
  const tags = shot?.tags ?? []

  const TalentIcon = talentText && talentText.includes(",") ? Users : User
  const TypeIcon = isHighlight ? Sparkles : typeStyle.icon

  const cardStyle: CSSProperties = {
    position: "absolute",
    top: `${topPx}px`,
    height: `${heightPx}px`,
    left: "6px",
    right: "6px",
  }

  // Highlight override styles
  const highlightStyle: CSSProperties | undefined =
    isHighlight && entry.highlight
      ? entry.highlight.variant === "outline"
        ? {
            borderColor: entry.highlight.color,
            backgroundColor: "var(--color-surface)",
          }
        : {
            borderColor: entry.highlight.color,
            backgroundColor: `${entry.highlight.color}1a`,
          }
      : undefined

  return (
    <button
      type="button"
      onClick={onClick}
      className="group absolute cursor-pointer overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-left shadow-[0_1px_3px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] transition-[box-shadow,transform] duration-150 hover:z-10 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(0,0,0,0.10),0_2px_4px_rgba(0,0,0,0.06)]"
      style={{ ...cardStyle, ...highlightStyle }}
      title={entry.title}
    >
      {/* Left color bar */}
      <div
        className={`absolute inset-y-0 left-0 w-1 ${isHighlight ? "" : typeStyle.barColor}`}
        style={isHighlight && entry.highlight ? { backgroundColor: entry.highlight.color } : undefined}
      />

      {/* Card content */}
      <div className="flex h-full flex-col overflow-hidden py-1.5 pl-3 pr-2.5">
        {/* Header row: track dot, set badge, spacer, time, duration */}
        <div className="flex shrink-0 items-center gap-1.5">
          <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${trackDotColor(trackId)}`} />
          {shotNumber ? (
            <span className="rounded border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-1 py-px font-mono text-3xs font-semibold text-[var(--color-text-subtle)]">
              {shotNumber}
            </span>
          ) : null}
          <span className="flex-1" />
          {timeLabel ? (
            <span className="font-mono text-2xs font-medium text-[var(--color-text-muted)]">
              {timeLabel}
            </span>
          ) : null}
          {durationLabel ? (
            <span className="rounded bg-[var(--color-surface-subtle)] px-1 py-px font-mono text-3xs text-[var(--color-text-subtle)]">
              {durationLabel}
            </span>
          ) : null}
        </div>

        {/* Title row */}
        <div className="flex shrink-0 items-baseline gap-1.5">
          <TypeIcon className="mt-0.5 h-3 w-3 shrink-0 text-[var(--color-text-muted)]" />
          <span className="truncate text-sm font-semibold leading-tight text-[var(--color-text)]">
            {entry.highlight?.emoji ? `${entry.highlight.emoji} ` : ""}
            {entry.title}
          </span>
        </div>

        {/* Metadata fields — each row truncates independently */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {fields.showDescription && descriptionText ? (
            <p className="mt-0.5 truncate text-xxs leading-snug text-[var(--color-text-secondary)]">
              {descriptionText}
            </p>
          ) : null}

          {fields.showProducts && productsText ? (
            <div className="mt-0.5 flex items-start gap-1">
              <Package className="mt-px h-[11px] w-[11px] shrink-0 text-teal-500" />
              <span className="truncate text-xxs leading-snug text-teal-700 dark:text-teal-300">
                {productsText}
              </span>
            </div>
          ) : null}

          {fields.showTalent && talentText ? (
            <div className="mt-0.5 flex items-start gap-1">
              <TalentIcon className="mt-px h-[11px] w-[11px] shrink-0 text-indigo-500" />
              <span className="truncate text-xxs leading-snug text-indigo-700 dark:text-indigo-300">
                {talentText}
              </span>
            </div>
          ) : null}

          {fields.showLocation && locationText ? (
            <div className="mt-0.5 flex items-start gap-1">
              <MapPin className="mt-px h-[11px] w-[11px] shrink-0 text-emerald-500" />
              <span className="truncate text-xxs leading-snug text-emerald-700 dark:text-emerald-300">
                {locationText}
              </span>
            </div>
          ) : null}

          {fields.showNotes && notesText ? (
            <div className="mt-0.5 flex items-start gap-1">
              <FileText className="mt-px h-[11px] w-[11px] shrink-0 text-amber-500" />
              <span className="truncate text-xxs italic leading-snug text-amber-800 dark:text-amber-300">
                {notesText}
              </span>
            </div>
          ) : null}

          {fields.showTags && tags.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {tags.map((tag) => (
                <span
                  key={typeof tag === "string" ? tag : tag.id}
                  className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-1.5 py-px text-3xs font-medium text-[var(--color-text-muted)]"
                >
                  {typeof tag === "string" ? tag : tag.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </button>
  )
}
