import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import type { TalentRecord } from "@/shared/types"
import type { GenderKey } from "@/features/library/lib/measurementOptions"
import { getMeasurementOptionsForGender } from "@/features/library/lib/measurementOptions"
import type { MeasurementRange } from "@/features/library/lib/talentFilters"
import type { CastingBrief, TalentMatchResult, FieldMatchDetail } from "@/features/library/lib/castingMatch"
import { EMPTY_CASTING_BRIEF } from "@/features/library/lib/castingMatch"
import { scoreColorClass, scoreBarFillClass } from "@/features/library/lib/castingScoreUtils"
import { Button } from "@/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { MeasurementRangeSlider } from "@/features/library/components/MeasurementRangeSlider"
import { useMeasurementBounds } from "@/features/library/hooks/useMeasurementBounds"

// ---------------------------------------------------------------------------
// Score helpers
// ---------------------------------------------------------------------------

function fieldPillClass(detail: FieldMatchDetail): string {
  if (detail.score === null) return "bg-[var(--color-surface-subtle)] text-[var(--color-text-subtle)]"
  if (detail.score >= 0.9) return "bg-[var(--color-status-green-bg)] text-[var(--color-status-green-text)]"
  if (detail.score >= 0.5) return "bg-[var(--color-status-amber-bg)] text-[var(--color-status-amber-text)]"
  return "bg-[var(--color-status-red-bg)] text-[var(--color-status-red-text)]"
}

function fieldDotClass(detail: FieldMatchDetail): string {
  if (detail.score === null) return "bg-[var(--color-text-subtle)]"
  if (detail.score >= 0.9) return "bg-[var(--color-status-green-text)]"
  if (detail.score >= 0.5) return "bg-[var(--color-status-amber-text)]"
  return "bg-[var(--color-status-red-text)]"
}

function formatFieldValue(detail: FieldMatchDetail): string {
  if (detail.rawValue === null || detail.rawValue === undefined) return "\u2014"
  return String(detail.rawValue)
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? "?"
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : ""
  return `${first}${last}`.toUpperCase()
}

// ---------------------------------------------------------------------------
// Brief form
// ---------------------------------------------------------------------------

interface BriefFormProps {
  readonly brief: CastingBrief
  readonly onBriefChange: (next: CastingBrief) => void
  readonly onClear: () => void
  readonly collapsed?: boolean
  readonly onToggleCollapse?: () => void
  readonly talent: readonly TalentRecord[]
}

function BriefForm({ brief, onBriefChange, onClear, collapsed, onToggleCollapse, talent }: BriefFormProps) {
  const fields = useMemo(() => getMeasurementOptionsForGender(brief.gender), [brief.gender])
  const bounds = useMeasurementBounds(talent, brief.gender)

  const setGender = (gender: string) => {
    onBriefChange({ ...brief, gender: gender as GenderKey, requirements: {} })
  }

  const setRange = (key: string, range: MeasurementRange) => {
    if (range.min === null && range.max === null) {
      const { [key]: _removed, ...rest } = brief.requirements
      onBriefChange({ ...brief, requirements: rest })
    } else {
      onBriefChange({ ...brief, requirements: { ...brief.requirements, [key]: range } })
    }
  }

  const requirementCount = Object.values(brief.requirements).filter(
    (r) => r.min !== null || r.max !== null,
  ).length

  // Mobile collapsed summary
  if (collapsed) {
    const fieldLabels = Object.keys(brief.requirements)
      .filter((k) => {
        const r = brief.requirements[k]!
        return r.min !== null || r.max !== null
      })
      .map((k) => k.charAt(0).toUpperCase() + k.slice(1))

    return (
      <div className="flex items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div>
          <div className="text-xs font-medium text-[var(--color-text)]">
            {brief.gender.charAt(0).toUpperCase() + brief.gender.slice(1)}
            {requirementCount > 0 ? ` \u00b7 ${requirementCount} requirement${requirementCount === 1 ? "" : "s"} set` : ""}
          </div>
          {fieldLabels.length > 0 ? (
            <div className="text-2xs text-[var(--color-text-muted)]">
              {fieldLabels.join(", ")}
            </div>
          ) : null}
        </div>
        <Button variant="outline" size="sm" onClick={onToggleCollapse}>
          Edit
        </Button>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-5 lg:sticky lg:top-20">
      <div className="mb-4 flex items-center justify-between border-b border-[var(--color-border)] pb-3">
        <span className="heading-section">Requirements</span>
        <Button variant="outline" size="sm" onClick={onClear} className="h-7 px-2.5 text-2xs">
          Clear
        </Button>
      </div>

      {/* Gender */}
      <div className="mb-4">
        <div className="mb-1.5 text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Gender
        </div>
        <Select value={brief.gender} onValueChange={setGender}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="women">Women</SelectItem>
            <SelectItem value="men">Men</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="mb-4 h-px bg-[var(--color-border)]" />

      {/* Measurement ranges — dual-thumb sliders */}
      <div className="mb-4">
        <div className="mb-2 text-2xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          Measurement Ranges
        </div>
        <div className="space-y-4">
          {fields.map((field) => {
            const range = brief.requirements[field.key] ?? { min: null, max: null }
            const fieldBounds = bounds[field.key]
            if (!fieldBounds) return null
            return (
              <MeasurementRangeSlider
                key={field.key}
                label={field.label}
                fieldKey={field.key}
                boundsMin={fieldBounds.min}
                boundsMax={fieldBounds.max}
                step={fieldBounds.step}
                value={range}
                onChange={(next) => setRange(field.key, next)}
              />
            )
          })}
        </div>
      </div>

      {onToggleCollapse ? (
        <Button variant="outline" size="sm" onClick={onToggleCollapse} className="w-full justify-center">
          Collapse
        </Button>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Match card
// ---------------------------------------------------------------------------

interface MatchCardProps {
  readonly result: TalentMatchResult
  readonly compact?: boolean
}

function MatchCard({ result, compact }: MatchCardProps) {
  const { talent, overallScore, fieldDetails, measuredFieldCount, requiredFieldCount } = result
  const pct = Math.round(overallScore * 100)
  const name = talent.name || "Unnamed"

  if (compact) {
    const inRangeCount = fieldDetails.filter((f) => f.score !== null && f.score >= 0.9).length
    return (
      <div className="flex items-center gap-2.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-sm font-semibold text-[var(--color-text-muted)]">
          {initials(name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="truncate text-sm font-medium text-[var(--color-text)]">{name}</span>
            <span className={`ml-2 flex-shrink-0 rounded-full px-2 py-0.5 text-2xs font-semibold ${scoreColorClass(overallScore)}`}>
              {pct}%
            </span>
          </div>
          <div className="text-2xs text-[var(--color-text-muted)]">
            {talent.agency ?? "No agency"}
            {requiredFieldCount > 0 ? ` \u00b7 ${inRangeCount}/${requiredFieldCount} in range` : ""}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-colors hover:border-[var(--color-border-strong)]">
      <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-md border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-base font-semibold text-[var(--color-text-muted)]">
        {initials(name)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--color-text)]">{name}</span>
          <span className={`ml-2 flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${scoreColorClass(overallScore)}`}>
            {pct}%
          </span>
        </div>
        <div className="mb-2 text-xs text-[var(--color-text-muted)]">
          {talent.agency ?? "No agency"} {talent.gender ? `\u00b7 ${talent.gender.charAt(0).toUpperCase() + talent.gender.slice(1)}` : ""}
        </div>

        {/* Field breakdown pills */}
        {fieldDetails.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {fieldDetails.filter((f) => f.required).map((detail) => (
              <span
                key={detail.key}
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-2xs font-medium ${fieldPillClass(detail)}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${fieldDotClass(detail)}`} />
                {detail.label} {formatFieldValue(detail)}
              </span>
            ))}
          </div>
        ) : null}

        {/* Missing data hint */}
        {requiredFieldCount > 0 && measuredFieldCount < requiredFieldCount ? (
          <div className="mt-1 text-2xs text-[var(--color-text-subtle)]">
            Missing {requiredFieldCount - measuredFieldCount} of {requiredFieldCount} required measurement{requiredFieldCount === 1 ? "" : "s"}
          </div>
        ) : null}

        {/* Score bar */}
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--color-surface-subtle)]">
          <div
            className={`h-full rounded-full transition-all ${scoreBarFillClass(overallScore)}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface CastingBriefMatcherProps {
  readonly talent: readonly TalentRecord[]
  readonly brief: CastingBrief
  readonly onBriefChange: (next: CastingBrief) => void
  readonly results?: readonly TalentMatchResult[]
}

export function CastingBriefMatcher({ talent, brief, onBriefChange, results: externalResults }: CastingBriefMatcherProps) {
  const isMobile = useIsMobile()
  const [collapsed, setCollapsed] = useState(false)

  const hasRequirements = Object.values(brief.requirements).some(
    (r) => r.min !== null || r.max !== null,
  )

  const results = externalResults ?? []

  const clearBrief = () => {
    onBriefChange(EMPTY_CASTING_BRIEF)
    setCollapsed(false)
  }

  return (
    <div className={isMobile ? "space-y-4" : "grid grid-cols-[360px_1fr] items-start gap-6"}>
      {/* Brief form */}
      <BriefForm
        brief={brief}
        onBriefChange={onBriefChange}
        onClear={clearBrief}
        collapsed={isMobile && collapsed && hasRequirements}
        onToggleCollapse={isMobile ? () => setCollapsed((prev) => !prev) : undefined}
        talent={talent}
      />

      {/* Results */}
      <div>
        {hasRequirements ? (
          <>
            <div className="mb-3 flex items-center justify-between">
              <span className="heading-section">Match Results</span>
              <span className="text-xs text-[var(--color-text-muted)]">
                {results.length} talent matched
              </span>
            </div>

            {results.length === 0 ? (
              <div className="py-8 text-center text-sm text-[var(--color-text-subtle)]">
                No talent match the current requirements.
              </div>
            ) : (
              <div className="space-y-2">
                {results.map((r) => (
                  <MatchCard
                    key={r.talent.id}
                    result={r}
                    compact={isMobile}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center py-10 text-center text-sm text-[var(--color-text-subtle)]">
            <Search className="mb-2 h-6 w-6" />
            Set gender and at least one measurement range to find matches.
          </div>
        )}
      </div>
    </div>
  )
}
