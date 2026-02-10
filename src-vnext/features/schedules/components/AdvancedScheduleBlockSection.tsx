import { useMemo } from "react"
import { textPreview } from "@/shared/lib/textPreview"
import { formatMinutesTo12h } from "@/features/schedules/lib/time"
import { buildScheduleProjection } from "@/features/schedules/lib/projection"
import type { ProjectedScheduleRow } from "@/features/schedules/lib/projection"
import type { Schedule, ScheduleEntry, Shot, TalentRecord } from "@/shared/types"
import type { ScheduleBlockFields } from "@/features/schedules/components/CallSheetRenderer"

interface AdvancedScheduleBlockSectionProps {
  readonly schedule: Schedule | null
  readonly entries: readonly ScheduleEntry[]
  readonly shots: readonly Shot[]
  readonly talentLookup: readonly TalentRecord[]
  readonly fields: Required<ScheduleBlockFields>
}

type RenderGroup =
  | { readonly type: "shared"; readonly row: ProjectedScheduleRow }
  | { readonly type: "single"; readonly row: ProjectedScheduleRow }
  | { readonly type: "band"; readonly rows: readonly ProjectedScheduleRow[]; readonly bandStart: number; readonly bandEnd: number }

function computeTimeRange(row: ProjectedScheduleRow): string {
  if (row.startMin == null) return ""
  const start = formatMinutesTo12h(row.startMin)
  if (row.durationMinutes != null && row.durationMinutes > 0) {
    const end = formatMinutesTo12h(row.startMin + row.durationMinutes)
    return `${start}–${end}`
  }
  return start
}

function hasValidBounds(row: ProjectedScheduleRow): boolean {
  return row.startMin != null && row.endMin != null
}

function isSharedRow(row: ProjectedScheduleRow): boolean {
  return row.isBanner || row.applicabilityKind === "subset"
}

export function AdvancedScheduleBlockSection({
  schedule,
  entries,
  shots,
  talentLookup,
  fields,
}: AdvancedScheduleBlockSectionProps) {
  const projection = useMemo(
    () => buildScheduleProjection({ schedule, entries, mode: "time" }),
    [schedule, entries],
  )

  const shotMap = useMemo(() => {
    const m = new Map<string, Shot>()
    for (const s of shots) m.set(s.id, s)
    return m
  }, [shots])

  const talentNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const t of talentLookup) {
      const name = (t.name ?? "").trim()
      if (name) m.set(t.id, name)
    }
    return m
  }, [talentLookup])

  const groups = useMemo((): readonly RenderGroup[] => {
    const rows = projection.rows
    if (rows.length === 0) return []

    const out: RenderGroup[] = []
    let pending: ProjectedScheduleRow[] = []
    let bandEnd: number | null = null

    function flush() {
      if (pending.length === 0) return
      if (pending.length === 1) {
        out.push({ type: "single", row: pending[0]! })
      } else {
        const bandStart = Math.min(...pending.map((r) => r.startMin ?? Number.MAX_SAFE_INTEGER))
        const computedBandEnd = Math.max(...pending.map((r) => r.endMin ?? 0))
        out.push({ type: "band", rows: pending.slice(), bandStart, bandEnd: computedBandEnd })
      }
      pending = []
      bandEnd = null
    }

    for (const row of rows) {
      if (isSharedRow(row)) {
        flush()
        out.push({ type: "shared", row })
        continue
      }

      if (!hasValidBounds(row)) {
        flush()
        out.push({ type: "single", row })
        continue
      }

      const start = row.startMin!
      const end = row.endMin!
      if (bandEnd != null && start < bandEnd) {
        pending.push(row)
        bandEnd = Math.max(bandEnd, end)
      } else {
        flush()
        pending = [row]
        bandEnd = end
      }
    }

    flush()
    return out
  }, [projection.rows])

  function renderRow(row: ProjectedScheduleRow) {
    const entry = row.entry
    const shot = entry.type === "shot" && entry.shotId ? shotMap.get(entry.shotId) ?? null : null

    const title = fields.showShotName
      ? (shot?.title ?? entry.title)
      : entry.title

    const shotNumber = fields.showShotNumber ? (shot?.shotNumber ?? null) : null
    const description = fields.showDescription ? (shot?.description ?? null) : null
    const location = fields.showLocation ? (shot?.locationName ?? null) : null

    const talentNames = fields.showTalent && shot
      ? (shot.talentIds && shot.talentIds.length > 0
          ? shot.talentIds
          : shot.talent)
          .map((id) => talentNameById.get(id) ?? null)
          .filter(Boolean) as string[]
      : []

    const notesPreview = fields.showNotes ? textPreview(entry.notes ?? "", 140) : ""
    const timeRange = computeTimeRange(row)
    const isRhythm = entry.type === "break" || entry.type === "move"
    const isHighlight = entry.type !== "shot" && !!entry.highlight
    const highlightStyle = isHighlight
      ? (entry.highlight?.variant === "outline"
        ? {
            borderColor: entry.highlight.color,
            borderLeftColor: entry.highlight.color,
            borderLeftWidth: "3px",
            backgroundColor: "white",
          }
        : {
            borderColor: entry.highlight?.color,
            borderLeftColor: entry.highlight?.color,
            borderLeftWidth: "3px",
            backgroundColor: `${entry.highlight?.color ?? "#2563eb"}1a`,
          })
      : undefined

    return (
      <div
        className={`callsheet-block rounded border px-2.5 py-2 ${isRhythm ? "border-amber-200 bg-amber-50/40" : "border-[var(--color-border)] bg-white"}`}
        style={highlightStyle}
      >
        <div className="flex items-start gap-2">
          <div className="w-24 shrink-0 font-mono text-[10px] font-semibold tabular-nums text-[var(--color-text)]">
            {timeRange || "—"}
            {row.timeSource === "derived" && (
              <span className="ml-1 font-sans text-[10px] font-medium text-[var(--color-text-subtle)]">
                (est)
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              {shotNumber && (
                <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-subtle)]">
                  {shotNumber}
                </span>
              )}
              <span className="truncate text-sm font-medium text-[var(--color-text)]">
                {entry.highlight?.emoji ? `${entry.highlight.emoji} ` : ""}
                {title}
              </span>
              {projection.tracks.length > 1 && (
                <span className="shrink-0 rounded bg-[var(--color-surface-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-text-muted)]">
                  {projection.tracks.find((t) => t.id === row.trackId)?.name ?? "Track"}
                </span>
              )}
            </div>

            {description && (
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {textPreview(description, 200)}
              </p>
            )}

            {(talentNames.length > 0 || location) && (
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[var(--color-text-muted)]">
                {talentNames.length > 0 && (
                  <span className="truncate">
                    <span className="font-semibold uppercase tracking-wide text-[var(--color-text-subtle)]">
                      Talent
                    </span>{" "}
                    {talentNames.join(", ")}
                  </span>
                )}
                {location && (
                  <span className="truncate">
                    <span className="font-semibold uppercase tracking-wide text-[var(--color-text-subtle)]">
                      Location
                    </span>{" "}
                    {location}
                  </span>
                )}
              </div>
            )}

            {notesPreview && (
              <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
                {notesPreview}
              </p>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (projection.rows.length === 0) {
    return (
      <div className="rounded border border-dashed border-[var(--color-border)] px-3 py-6 text-center text-xs text-[var(--color-text-subtle)]">
        No entries scheduled.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {groups.map((group, idx) => {
        if (group.type === "shared") {
          const trackLabels = group.row.appliesToTrackIds
            ? group.row.appliesToTrackIds
                .map((id) => projection.tracks.find((t) => t.id === id)?.name ?? null)
                .filter(Boolean)
                .join(", ")
            : ""

          return (
            <div key={`${group.type}-${group.row.id}-${idx}`} className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
              {trackLabels && (
                <div className="mb-1 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                  Applies to: {trackLabels}
                </div>
              )}
              {renderRow(group.row)}
            </div>
          )
        }

        if (group.type === "single") {
          return (
            <div key={`${group.type}-${group.row.id}-${idx}`}>
              {renderRow(group.row)}
            </div>
          )
        }

        // band
        const columns = projection.tracks
        const byTrack = new Map<string, ProjectedScheduleRow[]>()
        for (const t of columns) byTrack.set(t.id, [])
        for (const row of group.rows) {
          const list = byTrack.get(row.trackId) ?? []
          list.push(row)
          byTrack.set(row.trackId, list)
        }

        return (
          <div key={`${group.type}-${group.bandStart}-${group.bandEnd}-${idx}`} className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--color-text)]">
                {formatMinutesTo12h(group.bandStart)}–{formatMinutesTo12h(group.bandEnd)}
              </span>
              <span className="text-[10px] font-medium text-[var(--color-text-subtle)]">
                Simultaneous
              </span>
            </div>

            <div
              className={columns.length > 3 ? "overflow-x-auto" : undefined}
            >
              <div
                className="grid gap-2"
                style={{
                  gridTemplateColumns: `repeat(${columns.length}, minmax(220px, 1fr))`,
                }}
              >
                {columns.map((t) => {
                const list = (byTrack.get(t.id) ?? []).slice().sort((a, b) => (a.startMin ?? 0) - (b.startMin ?? 0))
                return (
                  <div key={t.id} className="flex flex-col gap-2">
                    {columns.length > 1 && (
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                        {t.name}
                      </div>
                    )}
                    {list.map((row) => (
                      <div key={row.id}>{renderRow(row)}</div>
                    ))}
                  </div>
                )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
