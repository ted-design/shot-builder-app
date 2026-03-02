import { ChevronDown, ChevronUp } from "lucide-react"
import type { TalentRecord } from "@/shared/types"
import type { CastingBrief, TalentMatchResult } from "@/features/library/lib/castingMatch"
import { scoreColorClass } from "@/features/library/lib/castingScoreUtils"
import { CastingBriefMatcher } from "@/features/library/components/CastingBriefMatcher"
import { Button } from "@/ui/button"

interface CastingBriefPanelProps {
  readonly open: boolean
  readonly onToggle: () => void
  readonly talent: readonly TalentRecord[]
  readonly brief: CastingBrief
  readonly onBriefChange: (next: CastingBrief) => void
  readonly hasRequirements: boolean
  readonly matchCount: number
  readonly results: readonly TalentMatchResult[]
}

export function CastingBriefPanel({
  open,
  onToggle,
  talent,
  brief,
  onBriefChange,
  hasRequirements,
  matchCount,
  results,
}: CastingBriefPanelProps) {
  if (!open) return null

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="heading-section">Casting Brief</h2>
          {hasRequirements ? (
            <p className="mt-0.5 text-2xs text-[var(--color-text-muted)]">
              {matchCount} talent matched
            </p>
          ) : (
            <p className="mt-0.5 text-2xs text-[var(--color-text-muted)]">
              Set gender and requirements to score talent.
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onToggle}
          aria-label={open ? "Close casting brief" : "Open casting brief"}
        >
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
      </div>
      <CastingBriefMatcher
        talent={talent}
        brief={brief}
        onBriefChange={onBriefChange}
        results={results}
      />
    </div>
  )
}

interface CastingModeButtonProps {
  readonly active: boolean
  readonly onToggle: () => void
  readonly matchCount: number
}

export function CastingModeButton({ active, onToggle, matchCount }: CastingModeButtonProps) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onToggle}
      className="gap-1.5"
      aria-label={active ? "Close casting brief" : "Open casting brief"}
    >
      {active ? (
        <>
          <ChevronDown className="h-3.5 w-3.5" />
          Casting
          {matchCount > 0 ? (
            <span className="rounded-full bg-background/20 px-1.5 text-2xs">
              {matchCount}
            </span>
          ) : null}
        </>
      ) : (
        <>Casting</>
      )}
    </Button>
  )
}

interface ScoreBadgeProps {
  readonly score: number
}

export function ScoreBadge({ score }: ScoreBadgeProps) {
  const pct = Math.round(score * 100)
  return (
    <span
      className={`absolute right-2 top-2 rounded-full px-1.5 py-0.5 text-2xs font-semibold ${scoreColorClass(score)}`}
    >
      {pct}%
    </span>
  )
}
