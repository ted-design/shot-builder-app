import { useMemo, type CSSProperties } from "react"
import { textPreview } from "@/shared/lib/textPreview"
import type {
  Schedule,
  DayDetails,
  ScheduleEntry,
  ScheduleEntryType,
  TalentCallSheet,
  CrewCallSheet,
  TalentRecord,
  CrewRecord,
  Shot,
} from "@/shared/types"

// --- Configuration types (Slice 4 will pass these; Slice 3 uses defaults) ---

export interface CallSheetSectionVisibility {
  readonly header?: boolean
  readonly dayDetails?: boolean
  readonly schedule?: boolean
  readonly talent?: boolean
  readonly crew?: boolean
  readonly notes?: boolean
}

export interface CallSheetColors {
  readonly primary?: string
  readonly accent?: string
  readonly text?: string
}

export interface ScheduleBlockFields {
  readonly showShotNumber?: boolean
  readonly showShotName?: boolean
  readonly showDescription?: boolean
  readonly showTalent?: boolean
  readonly showLocation?: boolean
  readonly showNotes?: boolean
}

export interface CallSheetConfig {
  readonly sections?: CallSheetSectionVisibility
  readonly colors?: CallSheetColors
  readonly scheduleBlockFields?: ScheduleBlockFields
}

// --- Data props ---

export interface CallSheetRendererProps {
  readonly projectName?: string
  readonly schedule: Schedule | null
  readonly dayDetails: DayDetails | null
  readonly entries?: readonly ScheduleEntry[]
  readonly shots?: readonly Shot[]
  readonly talentCalls?: readonly TalentCallSheet[]
  readonly crewCalls?: readonly CrewCallSheet[]
  readonly talentLookup?: readonly TalentRecord[]
  readonly crewLookup?: readonly CrewRecord[]
  readonly config?: CallSheetConfig
}

// --- Defaults ---

const DEFAULT_SECTIONS: Required<CallSheetSectionVisibility> = {
  header: true,
  dayDetails: true,
  schedule: true,
  talent: true,
  crew: true,
  notes: true,
}

const DEFAULT_SCHEDULE_FIELDS: Required<ScheduleBlockFields> = {
  showShotNumber: true,
  showShotName: true,
  showDescription: true,
  showTalent: true,
  showLocation: true,
  showNotes: true,
}

function formatDate(date: Schedule["date"]): string {
  if (!date) return ""
  try {
    return date.toDate().toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return ""
  }
}

function TimeField({ label, value }: { readonly label: string; readonly value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </span>
      <span className="text-sm font-semibold text-[var(--color-text)]">
        {value}
      </span>
    </div>
  )
}

// --- Entry type styles for renderer ---

const RHYTHM_TYPES = new Set<ScheduleEntryType>(["break", "move"])

function RendererEntryRow({
  entry,
  shot,
  fields,
  talentNames,
}: {
  readonly entry: ScheduleEntry
  readonly shot: Shot | null
  readonly fields: Required<ScheduleBlockFields>
  readonly talentNames: readonly string[]
}) {
  const isRhythm = RHYTHM_TYPES.has(entry.type)

  if (isRhythm) {
    return (
      <div className="callsheet-block flex items-center gap-3 border-b border-amber-100 bg-amber-50/40 px-2 py-1 last:border-b-0">
        {entry.time && (
          <span className="w-16 shrink-0 font-mono text-[10px] font-semibold tabular-nums text-[var(--color-text-muted)]">
            {entry.time}
          </span>
        )}
        <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {entry.title}
        </span>
        {entry.duration != null && (
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-[var(--color-text-subtle)]">
            {entry.duration}m
          </span>
        )}
      </div>
    )
  }

  const locationLabel =
    (fields.showLocation ? (shot?.locationName ?? null) : null) ??
    null

  const notesPreview = fields.showNotes
    ? textPreview(entry.notes ?? "", 160)
    : ""

  return (
    <div className="callsheet-block flex flex-col gap-1 border-b border-[var(--color-border)] py-2 last:border-b-0">
      <div className="flex items-baseline gap-3">
        {entry.time && (
          <span className="w-16 shrink-0 font-mono text-xs font-semibold tabular-nums text-[var(--color-text)]">
            {entry.time}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            {fields.showShotNumber && shot?.shotNumber && (
              <span className="shrink-0 font-mono text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-subtle)]">
                {shot.shotNumber}
              </span>
            )}
            <span className="truncate text-sm font-medium text-[var(--color-text)]">
              {fields.showShotName ? (shot?.title ?? entry.title) : entry.title}
            </span>
          </div>

          {fields.showDescription && shot?.description && (
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              {textPreview(shot.description, 220)}
            </p>
          )}

          {(fields.showTalent || fields.showLocation) && (talentNames.length > 0 || locationLabel) && (
            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[var(--color-text-muted)]">
              {fields.showTalent && talentNames.length > 0 && (
                <span className="truncate">
                  <span className="font-semibold uppercase tracking-wide text-[var(--color-text-subtle)]">
                    Talent
                  </span>{" "}
                  {talentNames.join(", ")}
                </span>
              )}
              {fields.showLocation && locationLabel && (
                <span className="truncate">
                  <span className="font-semibold uppercase tracking-wide text-[var(--color-text-subtle)]">
                    Location
                  </span>{" "}
                  {locationLabel}
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

        {entry.duration != null && (
          <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--color-text-muted)]">
            {entry.duration}m
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Canonical call sheet renderer.
 *
 * ONE component for both Slice 3 (editor preview) and Slice 4 (print/export).
 * Renders safely with partial data — missing sections are hidden, not broken.
 */
export function CallSheetRenderer({
  projectName,
  schedule,
  dayDetails,
  entries,
  shots,
  talentCalls,
  crewCalls,
  talentLookup,
  crewLookup,
  config,
}: CallSheetRendererProps) {
  const sections = { ...DEFAULT_SECTIONS, ...config?.sections }
  const scheduleFields = { ...DEFAULT_SCHEDULE_FIELDS, ...config?.scheduleBlockFields }

  const colors = config?.colors
  const primary = colors?.primary
  const text = colors?.text

  const talentMap = useMemo(() => {
    const m = new Map<string, TalentRecord>()
    if (talentLookup) {
      for (const t of talentLookup) m.set(t.id, t)
    }
    return m
  }, [talentLookup])

  const crewMap = useMemo(() => {
    const m = new Map<string, CrewRecord>()
    if (crewLookup) {
      for (const c of crewLookup) m.set(c.id, c)
    }
    return m
  }, [crewLookup])

  const shotMap = useMemo(() => {
    const m = new Map<string, Shot>()
    if (shots) {
      for (const s of shots) m.set(s.id, s)
    }
    return m
  }, [shots])

  if (!schedule) {
    return null
  }

  const dateStr = formatDate(schedule.date)
  const headerTitle = projectName?.trim() ? projectName.trim() : schedule.name
  const headerSubtitle = projectName?.trim() ? schedule.name : ""

  return (
    <div
      className="flex flex-col gap-4"
      style={{
        color: "var(--color-doc-ink)",
        ...(primary
          ? ({ ["--doc-section-band-bg" as string]: primary } as CSSProperties)
          : {}),
        ...(text ? ({ ["--color-doc-ink" as string]: text } as CSSProperties) : {}),
      }}
    >
      {/* Header section */}
      {sections.header && (
        <div className="border-b-2 border-[var(--color-doc-ink)] pb-3">
          <h2 className="text-lg font-bold" style={{ color: "var(--color-doc-ink)" }}>
            {headerTitle}
          </h2>
          {headerSubtitle && (
            <p className="mt-0.5 text-sm font-medium" style={{ color: "var(--color-doc-ink)", opacity: 0.9 }}>
              {headerSubtitle}
            </p>
          )}
          {dateStr && (
            <p className="mt-0.5 text-sm font-medium" style={{ color: "var(--color-doc-ink)", opacity: 0.7 }}>
              {dateStr}
            </p>
          )}
        </div>
      )}

      {/* Day details section */}
      {sections.dayDetails && dayDetails && (
        <div className="flex flex-col gap-3">
          <div className="doc-section-header--band">Day Details</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            <TimeField label="Crew Call" value={dayDetails.crewCallTime} />
            <TimeField label="Shooting Call" value={dayDetails.shootingCallTime} />
            <TimeField label="Estimated Wrap" value={dayDetails.estimatedWrap} />
            <TimeField label="Breakfast" value={dayDetails.breakfastTime} />
            <TimeField label="1st Meal" value={dayDetails.firstMealTime} />
            <TimeField label="2nd Meal" value={dayDetails.secondMealTime} />
          </div>
          {dayDetails.weather?.summary && (
            <p className="text-xs text-[var(--color-text-muted)]">
              <span className="font-semibold uppercase tracking-wide text-[var(--color-text-subtle)]">
                Weather
              </span>{" "}
              {dayDetails.weather.summary}
            </p>
          )}
          {dayDetails.locations && dayDetails.locations.length > 0 && (
            <div className="flex flex-col gap-1 text-xs text-[var(--color-text-muted)]">
              {dayDetails.locations.map((loc) => (
                <p key={loc.id}>
                  <span className="font-semibold uppercase tracking-wide text-[var(--color-text-subtle)]">
                    {loc.title}
                  </span>{" "}
                  {loc.ref?.label ?? loc.ref?.locationId ?? ""}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Schedule entries */}
      {sections.schedule && (
        <div className="flex flex-col gap-1">
          <div className="doc-section-header--band">Schedule</div>
          {(!entries || entries.length === 0) ? (
            <p className="py-2 text-xs text-[var(--color-text-subtle)]">
              No entries scheduled.
            </p>
          ) : (
            <div className="flex flex-col">
              {entries.map((entry) => {
                const shot = entry.shotId ? (shotMap.get(entry.shotId) ?? null) : null
                const talentNames = (entry.type === "shot" && shot?.talentIds)
                  ? shot.talentIds
                    .map((id) => talentMap.get(id)?.name ?? id)
                    .filter(Boolean)
                  : []
                return (
                  <RendererEntryRow
                    key={entry.id}
                    entry={entry}
                    shot={shot}
                    fields={scheduleFields}
                    talentNames={talentNames}
                  />
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Talent calls */}
      {sections.talent && (
        <div className="flex flex-col gap-1">
          <div className="doc-section-header--band">Talent</div>
          {(!talentCalls || talentCalls.length === 0) ? (
            <p className="py-2 text-xs text-[var(--color-text-subtle)]">
              No talent overrides set.
            </p>
          ) : (
            <div className="flex flex-col">
              {talentCalls.map((tc) => {
                const talent = talentMap.get(tc.talentId)
                const displayTime = tc.callTime ?? dayDetails?.shootingCallTime ?? ""
                const isOverridden = !!tc.callTime
                return (
                  <div
                    key={tc.id}
                    className="callsheet-block flex items-baseline gap-3 border-b border-[var(--color-border)] py-2 last:border-b-0"
                  >
                    {displayTime && (
                      <span className={`w-14 shrink-0 text-xs font-semibold ${isOverridden ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]"}`}>
                        {displayTime}
                      </span>
                    )}
                    <span className="flex-1 truncate text-sm text-[var(--color-text)]">
                      {talent?.name ?? tc.talentId}
                    </span>
                    {tc.role && (
                      <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                        {tc.role}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Crew calls */}
      {sections.crew && (
        <div className="flex flex-col gap-1">
          <div className="doc-section-header--band">Crew</div>
          {(!crewCalls || crewCalls.length === 0) ? (
            <p className="py-2 text-xs text-[var(--color-text-subtle)]">
              No crew overrides set.
            </p>
          ) : (
            <div className="flex flex-col">
              {crewCalls.map((cc) => {
                const crew = crewMap.get(cc.crewMemberId)
                const displayTime = cc.callTime ?? dayDetails?.crewCallTime ?? ""
                const isOverridden = !!cc.callTime
                const deptPosition = [
                  cc.department ?? crew?.department,
                  cc.position ?? crew?.position,
                ].filter(Boolean).join(" — ")
                return (
                  <div
                    key={cc.id}
                    className="callsheet-block flex items-baseline gap-3 border-b border-[var(--color-border)] py-2 last:border-b-0"
                  >
                    {displayTime && (
                      <span className={`w-14 shrink-0 text-xs font-semibold ${isOverridden ? "text-[var(--color-text)]" : "text-[var(--color-text-muted)]"}`}>
                        {displayTime}
                      </span>
                    )}
                    <span className="flex-1 truncate text-sm text-[var(--color-text)]">
                      {crew?.name ?? cc.crewMemberId}
                    </span>
                    {deptPosition && (
                      <span className="shrink-0 text-xs text-[var(--color-text-muted)]">
                        {deptPosition}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {sections.notes && dayDetails?.notes && dayDetails.notes.trim().length > 0 && (
        <div className="flex flex-col gap-1">
          <div className="doc-section-header--band">Notes</div>
          <div className="whitespace-pre-wrap text-xs text-[var(--color-text)]">
            {dayDetails.notes}
          </div>
        </div>
      )}
    </div>
  )
}
