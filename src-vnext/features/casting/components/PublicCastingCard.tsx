import { formatLabeledMeasurements } from "@/features/library/lib/measurementOptions"
import { PortfolioThumbnailStrip } from "@/features/casting/components/PortfolioThumbnailStrip"
import type {
  CastingShareVisibility,
  CastingVoteDecision,
  ResolvedCastingTalent,
} from "@/shared/types"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TalentVoteState = {
  readonly decision: CastingVoteDecision | null
  readonly comment: string
}

type OtherVote = {
  readonly reviewerName: string
  readonly reviewerEmail: string
  readonly decision: CastingVoteDecision
  readonly comment: string | null
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const VOTE_OPTIONS: readonly {
  readonly decision: CastingVoteDecision
  readonly label: string
  readonly emoji: string
  readonly selectedClass: string
}[] = [
  {
    decision: "approve",
    label: "Approve",
    emoji: "\uD83D\uDC4D",
    selectedClass: "bg-green-500/10 border-green-500/35 text-green-500",
  },
  {
    decision: "maybe",
    label: "Maybe",
    emoji: "\uD83E\uDD14",
    selectedClass: "bg-amber-500/10 border-amber-500/35 text-amber-500",
  },
  {
    decision: "disapprove",
    label: "Pass",
    emoji: "\uD83D\uDC4E",
    selectedClass: "bg-red-500/10 border-red-500/35 text-red-500",
  },
]

const DECISION_LABELS: Record<CastingVoteDecision, string> = {
  approve: "Approved",
  maybe: "Maybe",
  disapprove: "Passed",
  withdrawn: "Withdrawn",
}

const DECISION_COLOR_CLASSES: Record<
  CastingVoteDecision,
  { text: string; avatar: string }
> = {
  approve: { text: "text-green-500", avatar: "bg-green-500/15 text-green-500" },
  maybe: { text: "text-amber-500", avatar: "bg-amber-500/15 text-amber-500" },
  disapprove: { text: "text-red-500", avatar: "bg-red-500/15 text-red-500" },
  withdrawn: { text: "text-[var(--color-text-subtle)]", avatar: "bg-[var(--color-surface-subtle)] text-[var(--color-text-subtle)]" },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PublicCastingCardProps {
  readonly talent: ResolvedCastingTalent
  readonly visibleFields: CastingShareVisibility
  readonly voteState: TalentVoteState
  readonly otherVotes: readonly OtherVote[]
  readonly showVoteTallies: boolean
  readonly identified: boolean
  readonly onVote: (talentId: string, decision: CastingVoteDecision | null) => void
  readonly onCommentChange: (talentId: string, comment: string) => void
  readonly onCommentBlur: (talentId: string) => void
  readonly onOpenDetail: (talentId: string) => void
  readonly onPortfolioImageClick: (talentId: string, index: number) => void
}

export function PublicCastingCard({
  talent,
  visibleFields,
  voteState,
  otherVotes,
  showVoteTallies,
  identified,
  onVote,
  onCommentChange,
  onCommentBlur,
  onOpenDetail,
  onPortfolioImageClick,
}: PublicCastingCardProps) {
  const measurementText =
    visibleFields.measurements && talent.measurements
      ? formatLabeledMeasurements(talent.measurements, talent.gender, "compact")
      : null

  // Combine casting images + portfolio for the thumbnail strip
  const stripUrls: readonly string[] = visibleFields.portfolio
    ? [
        ...(talent.castingImageUrls ?? []),
        ...talent.galleryUrls,
      ]
    : []

  const showVoteHint =
    identified && !voteState.decision && voteState.comment.trim().length > 0

  return (
    <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)]">
      {/* Headshot — clickable to open detail sheet */}
      <button
        type="button"
        className="block w-full text-left"
        onClick={() => onOpenDetail(talent.talentId)}
        aria-label={`View full profile for ${talent.name}`}
      >
        {talent.headshotUrl ? (
          <img
            src={talent.headshotUrl}
            alt={talent.name}
            className="aspect-[3/4] w-full object-cover object-top"
            loading="lazy"
          />
        ) : (
          <div className="flex aspect-[3/4] w-full items-center justify-center bg-[var(--color-surface-subtle)]">
            <span className="text-2xl font-semibold text-[var(--color-text-subtle)]">
              {getInitials(talent.name)}
            </span>
          </div>
        )}
      </button>

      {/* Body */}
      <div className="flex flex-col gap-3 p-4">
        {/* Name + agency */}
        <div>
          <button
            type="button"
            className="text-base font-semibold text-[var(--color-text)] hover:underline"
            onClick={() => onOpenDetail(talent.talentId)}
          >
            {talent.name}
          </button>
          {visibleFields.agency && talent.agency && (
            <div className="text-sm text-[var(--color-text-muted)]">{talent.agency}</div>
          )}
        </div>

        {/* Measurements */}
        {measurementText && measurementText.length > 0 && (
          <div className="text-xs text-[var(--color-text-muted)]">{measurementText}</div>
        )}

        {/* Role label */}
        {talent.roleLabel && (
          <div className="inline-flex self-start rounded border border-[var(--color-border)] px-2 py-0.5 text-2xs text-[var(--color-text-secondary)]">
            {talent.roleLabel}
          </div>
        )}

        {/* Portfolio thumbnail strip */}
        {stripUrls.length > 0 && (
          <PortfolioThumbnailStrip
            urls={stripUrls}
            talentName={talent.name}
            onThumbnailClick={(i) => onPortfolioImageClick(talent.talentId, i)}
          />
        )}

        {/* Vote buttons */}
        <div className="flex gap-2">
          {VOTE_OPTIONS.map((opt) => {
            const isSelected = voteState.decision === opt.decision
            return (
              <button
                key={opt.decision}
                type="button"
                disabled={!identified}
                onClick={() =>
                  onVote(talent.talentId, isSelected ? null : opt.decision)
                }
                className={`flex flex-1 items-center justify-center gap-1.5 rounded border text-sm transition-colors ${
                  isSelected
                    ? opt.selectedClass
                    : "border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] hover:border-[var(--color-border-hover)] hover:text-[var(--color-text-secondary)]"
                } min-h-[44px] disabled:cursor-not-allowed disabled:opacity-50`}
              >
                <span className="text-base">{opt.emoji}</span>
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* Comment input */}
        <div>
          <textarea
            value={voteState.comment}
            onChange={(e) => onCommentChange(talent.talentId, e.target.value)}
            onBlur={() => onCommentBlur(talent.talentId)}
            placeholder={identified ? "Add a note\u2026" : "Enter your info above to comment"}
            disabled={!identified}
            rows={1}
            className="w-full resize-y rounded border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          />
          {showVoteHint && (
            <p className="mt-1 text-3xs text-[var(--color-text-subtle)]">
              Vote to save your note
            </p>
          )}
        </div>

        {/* "View full profile" link */}
        <button
          type="button"
          onClick={() => onOpenDetail(talent.talentId)}
          className="self-start text-xs text-[var(--color-accent)] hover:underline"
        >
          View full profile &rarr;
        </button>

        {/* Other reviewers' votes */}
        {showVoteTallies && otherVotes.length > 0 && (
          <div className="border-t border-[var(--color-border)] pt-3">
            <div className="mb-2 text-3xs font-semibold uppercase tracking-wide text-[var(--color-text-subtle)]">
              Other reviews
            </div>
            <div className="flex flex-col gap-1.5">
              {otherVotes.map((v) => {
                const colors = DECISION_COLOR_CLASSES[v.decision]
                return (
                  <div key={v.reviewerEmail} className="flex items-center gap-2">
                    <div
                      className={`flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full text-3xs font-semibold ${colors.avatar}`}
                    >
                      {getInitials(v.reviewerName)}
                    </div>
                    <span className="text-xs text-[var(--color-text-muted)]">
                      {v.reviewerName}
                    </span>
                    <span className={`ml-auto text-xxs ${colors.text}`}>
                      {DECISION_LABELS[v.decision]}
                    </span>
                  </div>
                )
              })}

              {/* Other reviewer comments */}
              {otherVotes
                .filter((v) => v.comment)
                .map((v) => (
                  <div
                    key={`comment-${v.reviewerEmail}`}
                    className="mt-1 rounded border-l-2 border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2"
                  >
                    <div className="text-xs leading-relaxed text-[var(--color-text-muted)]">
                      {v.comment}
                    </div>
                    <div className="mt-1 text-3xs text-[var(--color-text-subtle)]">
                      {v.reviewerName}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
