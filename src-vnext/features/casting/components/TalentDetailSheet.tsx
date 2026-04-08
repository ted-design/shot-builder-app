import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/ui/sheet"
import { ImageLightbox } from "@/shared/components/ImageLightbox"
import { formatLabeledMeasurements } from "@/features/library/lib/measurementOptions"
import { VOTE_OPTIONS, type TalentVoteState } from "./PublicCastingCard"
import type {
  CastingShareVisibility,
  CastingVoteDecision,
  ResolvedCastingTalent,
} from "@/shared/types"

interface TalentDetailSheetProps {
  readonly talent: ResolvedCastingTalent | null
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly visibleFields: CastingShareVisibility
  readonly voteState: TalentVoteState
  readonly identified: boolean
  readonly onVote: (talentId: string, decision: CastingVoteDecision | null) => void
  readonly onCommentChange: (talentId: string, comment: string) => void
  readonly onCommentBlur: (talentId: string) => void
}

// ---------------------------------------------------------------------------
// Image grid subcomponent
// ---------------------------------------------------------------------------

function ImageGrid(props: {
  readonly urls: readonly string[]
  readonly talentName: string
  readonly onImageClick: (index: number) => void
}) {
  const { urls, talentName, onImageClick } = props
  return (
    <div className="grid grid-cols-2 gap-2">
      {urls.map((url, i) => (
        <button
          key={url}
          type="button"
          onClick={() => onImageClick(i)}
          className="overflow-hidden rounded"
          aria-label={`View image ${i + 1} for ${talentName}`}
        >
          <img
            src={url}
            alt=""
            className="aspect-square w-full object-cover object-top"
            loading="lazy"
          />
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function TalentDetailSheet({
  talent,
  open,
  onOpenChange,
  visibleFields,
  voteState,
  identified,
  onVote,
  onCommentChange,
  onCommentBlur,
}: TalentDetailSheetProps) {
  const [lightboxState, setLightboxState] = useState<{
    images: readonly string[]
    index: number
  } | null>(null)

  if (!talent) return null

  const labeledMeasurements =
    visibleFields.measurements && talent.measurements
      ? formatLabeledMeasurements(talent.measurements, talent.gender, "labeled")
      : []

  const hasCastingSessions =
    visibleFields.portfolio &&
    (talent.castingSessions?.length ?? 0) > 0

  // Fallback: if no session-grouped data, use flat castingImageUrls (backward compat)
  const hasFlatCastingPhotos =
    !hasCastingSessions &&
    visibleFields.portfolio &&
    (talent.castingImageUrls?.length ?? 0) > 0

  const hasPortfolio =
    visibleFields.portfolio && talent.galleryUrls.length > 0

  // Build a combined image array for lightbox navigation across all sessions
  const allCastingImages: readonly string[] = hasCastingSessions
    ? talent.castingSessions!.flatMap((s) => s.imageUrls)
    : talent.castingImageUrls ?? []

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col overflow-y-auto p-0 sm:max-w-[480px]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{talent.name}</SheetTitle>
          </SheetHeader>

          {/* Headshot */}
          <div className="w-full flex-shrink-0 bg-[var(--color-surface-subtle)]">
            {talent.headshotUrl ? (
              <img
                src={talent.headshotUrl}
                alt={talent.name}
                className="max-h-[50vh] w-full rounded-none object-cover object-top"
              />
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center">
                <span className="text-4xl font-semibold text-[var(--color-text-subtle)]">
                  {talent.name
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0]!.toUpperCase())
                    .join("")}
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex flex-col gap-5 p-5">
            {/* Name + role + agency */}
            <div>
              <div className="heading-section">{talent.name}</div>
              {talent.roleLabel && (
                <span className="mt-1 inline-block rounded border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10 px-2 py-0.5 text-2xs font-medium uppercase tracking-wide text-[var(--color-accent)]">
                  {talent.roleLabel}
                </span>
              )}
              {visibleFields.agency && talent.agency && (
                <div className="mt-1 text-sm text-[var(--color-text-muted)]">
                  {talent.agency}
                </div>
              )}
            </div>

            {/* Casting Photos — grouped by session */}
            {hasCastingSessions && talent.castingSessions!.map((session, sessionIdx) => {
              // Calculate the offset into the combined allCastingImages array
              const offset = talent.castingSessions!
                .slice(0, sessionIdx)
                .reduce((sum, s) => sum + s.imageUrls.length, 0)

              return (
                <div key={`session-${sessionIdx}`}>
                  <div className="heading-subsection mb-1">{session.title}</div>
                  {session.date && (
                    <div className="mb-2 text-2xs text-[var(--color-text-subtle)]">
                      {session.imageUrls.length} photo{session.imageUrls.length !== 1 ? "s" : ""}
                    </div>
                  )}
                  <ImageGrid
                    urls={session.imageUrls}
                    talentName={talent.name}
                    onImageClick={(i) =>
                      setLightboxState({ images: allCastingImages, index: offset + i })
                    }
                  />
                </div>
              )
            })}

            {/* Fallback: flat casting photos for shares created before session grouping */}
            {hasFlatCastingPhotos && (
              <div>
                <div className="heading-subsection mb-2">
                  Casting Photos
                  <span className="ml-2 text-2xs text-[var(--color-text-subtle)]">
                    {talent.castingImageUrls!.length} photo{talent.castingImageUrls!.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <ImageGrid
                  urls={talent.castingImageUrls!}
                  talentName={talent.name}
                  onImageClick={(i) =>
                    setLightboxState({ images: talent.castingImageUrls!, index: i })
                  }
                />
              </div>
            )}

            {/* Portfolio */}
            {hasPortfolio && (
              <div>
                <div className="heading-subsection mb-2">Portfolio</div>
                <ImageGrid
                  urls={talent.galleryUrls}
                  talentName={talent.name}
                  onImageClick={(i) =>
                    setLightboxState({ images: talent.galleryUrls, index: i })
                  }
                />
              </div>
            )}

            {/* Measurements */}
            {labeledMeasurements.length > 0 && (
              <div>
                <div className="heading-subsection mb-2">Measurements</div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {labeledMeasurements.map((m) => (
                    <div key={m.label}>
                      <div className="text-3xs uppercase tracking-wide text-[var(--color-text-subtle)]">
                        {m.label}
                      </div>
                      <div className="text-sm text-[var(--color-text)]">
                        {m.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vote buttons */}
            <div>
              <div className="heading-subsection mb-2">Your vote</div>
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

              {/* Comment */}
              <textarea
                value={voteState.comment}
                onChange={(e) => onCommentChange(talent.talentId, e.target.value)}
                onBlur={() => onCommentBlur(talent.talentId)}
                placeholder={identified ? "Add a note\u2026" : "Enter your info above to comment"}
                disabled={!identified}
                rows={2}
                className="mt-2 w-full resize-y rounded border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:border-[var(--color-accent)] focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              />
              {identified && !voteState.decision && voteState.comment.trim().length > 0 && (
                <p className="mt-1 text-3xs text-[var(--color-text-subtle)]">
                  Vote to save your note
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Lightbox rendered outside Sheet to avoid stacking-context clipping */}
      {lightboxState && (
        <ImageLightbox
          open
          onOpenChange={(v) => { if (!v) setLightboxState(null) }}
          images={lightboxState.images}
          initialIndex={lightboxState.index}
          alt={talent.name}
        />
      )}
    </>
  )
}
