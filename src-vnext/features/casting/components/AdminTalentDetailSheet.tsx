/**
 * Admin-facing talent detail sheet for the internal casting page.
 *
 * Shows the same rich profile data as the public TalentDetailSheet
 * (headshot, measurements, portfolio, casting images) PLUS aggregated
 * vote tallies and individual reviewer feedback. Does NOT include
 * vote buttons or comment input — admin views, doesn't vote.
 */

import { useState, useMemo } from "react"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/ui/sheet"
import { Badge } from "@/ui/badge"
import { ImageLightbox } from "@/shared/components/ImageLightbox"
import { MeasurementUnitToggle } from "@/features/library/components/MeasurementUnitToggle"
import { formatLabeledMeasurements } from "@/features/library/lib/measurementOptions"
import { useMeasurementUnits } from "@/shared/hooks/useMeasurementUnits"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import {
  getCastingStatusLabel,
  getCastingStatusColor,
} from "@/features/casting/lib/castingStatuses"
import {
  buildBoardImageModel,
  type BoardImage,
} from "@/features/casting/lib/castingBoardImages"
import { updateCastingEntryVisibility } from "@/features/casting/lib/castingWrites"
import type { CastingBoardEntry, TalentRecord } from "@/shared/types"
import type { VoteAggregate } from "@/features/casting/hooks/useCastingVoteAggregates"

interface AdminTalentDetailSheetProps {
  readonly talent: TalentRecord | null
  readonly entry: CastingBoardEntry | null
  readonly voteAggregate: VoteAggregate | null
  readonly canEdit: boolean
  readonly clientId: string | null
  readonly projectId: string | null
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")
}

function VoteTallyBar({ aggregate }: { readonly aggregate: VoteAggregate }) {
  const total = aggregate.approve + aggregate.maybe + aggregate.disapprove
  if (total === 0) return null

  return (
    <div className="flex flex-col gap-2">
      <div className="heading-subsection">
        Vote Summary
        <span className="ml-2 text-2xs font-normal text-[var(--color-text-subtle)]">
          {total} vote{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Bar chart */}
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {aggregate.approve > 0 && (
          <div
            className="bg-[var(--color-status-green-text)]"
            style={{ width: `${(aggregate.approve / total) * 100}%` }}
          />
        )}
        {aggregate.maybe > 0 && (
          <div
            className="bg-[var(--color-status-amber-text)]"
            style={{ width: `${(aggregate.maybe / total) * 100}%` }}
          />
        )}
        {aggregate.disapprove > 0 && (
          <div
            className="bg-[var(--color-error)]"
            style={{ width: `${(aggregate.disapprove / total) * 100}%` }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-2xs text-[var(--color-text-muted)]">
        {aggregate.approve > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--color-status-green-text)]" />
            Approve ({aggregate.approve})
          </span>
        )}
        {aggregate.maybe > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--color-status-amber-text)]" />
            Maybe ({aggregate.maybe})
          </span>
        )}
        {aggregate.disapprove > 0 && (
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-[var(--color-error)]" />
            Pass ({aggregate.disapprove})
          </span>
        )}
      </div>
    </div>
  )
}

function ReviewerVoteList({ aggregate }: { readonly aggregate: VoteAggregate }) {
  if (aggregate.votes.length === 0) return null

  const decisionColor: Record<string, string> = {
    approve: "text-[var(--color-status-green-text)]",
    maybe: "text-[var(--color-status-amber-text)]",
    disapprove: "text-[var(--color-error)]",
  }
  const decisionLabel: Record<string, string> = {
    approve: "Approved",
    maybe: "Maybe",
    disapprove: "Passed",
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="heading-subsection">
        Reviewer Feedback
        <span className="ml-2 text-2xs font-normal text-[var(--color-text-subtle)]">
          {aggregate.votes.length} reviewer{aggregate.votes.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {aggregate.votes.map((vote, i) => (
          <div
            key={`${vote.reviewerEmail}-${i}`}
            className="flex flex-col gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--color-text)]">
                {vote.reviewerName}
              </span>
              <span className={`text-2xs font-medium ${decisionColor[vote.decision] ?? ""}`}>
                {decisionLabel[vote.decision] ?? vote.decision}
              </span>
            </div>
            {vote.comment && (
              <p className="text-xs text-[var(--color-text-muted)] italic">
                {"\u201C"}{vote.comment}{"\u201D"}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * A single image tile. Resolves its URL via `useStorageUrl` (a hook, so it
 * cannot run inside a `.map`) — prefers an already-resolved `downloadURL`,
 * falling back to resolving `path` through Storage. Renders dimmed when hidden.
 * When `canEdit`, exposes an eye / eye-off toggle (its own control — clicks are
 * stopped from bubbling to the tile's lightbox `onClick`).
 */
function BoardThumb({
  img,
  hidden,
  canEdit,
  alt,
  onOpen,
  onToggle,
}: {
  readonly img: BoardImage
  readonly hidden: boolean
  readonly canEdit: boolean
  readonly alt: string
  readonly onOpen: (resolvedUrl: string) => void
  readonly onToggle: () => void
}) {
  const resolved = useStorageUrl(img.path)
  const url = img.downloadURL ?? resolved

  return (
    <div className="relative overflow-hidden rounded">
      <button
        type="button"
        onClick={() => { if (url) onOpen(url) }}
        className={`block w-full overflow-hidden rounded ${hidden ? "opacity-40" : ""}`}
      >
        {url ? (
          <img
            src={url}
            alt={alt}
            className="aspect-square w-full object-cover object-top"
            loading="lazy"
          />
        ) : (
          <div className="aspect-square w-full bg-[var(--color-surface-subtle)]" />
        )}
      </button>

      {hidden && (
        <span className="pointer-events-none absolute left-1 top-1 rounded bg-[var(--color-surface-raised)]/90 px-1.5 py-0.5 text-3xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          Hidden
        </span>
      )}

      {canEdit && (
        <button
          type="button"
          aria-label={hidden ? "Show image" : "Hide image"}
          onClick={(e) => {
            e.stopPropagation()
            onToggle()
          }}
          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded bg-[var(--color-surface-raised)]/90 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  )
}

export function AdminTalentDetailSheet({
  talent,
  entry,
  voteAggregate,
  canEdit,
  clientId,
  projectId,
  open,
  onOpenChange,
}: AdminTalentDetailSheetProps) {
  const [lightboxState, setLightboxState] = useState<{
    images: readonly string[]
    index: number
  } | null>(null)

  const headshotPath = talent?.headshotPath || talent?.imageUrl || undefined
  const headshotUrl = useStorageUrl(headshotPath)
  const displayName = talent?.name || entry?.talentName || ""

  const { system } = useMeasurementUnits()
  const labeledMeasurements = useMemo(
    () =>
      talent?.measurements
        ? formatLabeledMeasurements(talent.measurements, talent.gender, "labeled", system)
        : [],
    [talent?.measurements, talent?.gender, system],
  )

  // Annotated gallery + session folders (unfiltered, with per-item `hidden`).
  const boardModel = useMemo(
    () => buildBoardImageModel(talent, entry),
    [talent, entry],
  )

  // When read-only, render only VISIBLE items (parity with the public viewer).
  const visibleGallery = canEdit
    ? boardModel.gallery
    : boardModel.gallery.filter((g) => !g.hidden)
  const visibleFolders = canEdit
    ? boardModel.folders
    : boardModel.folders
        .filter((f) => !f.hidden)
        .map((f) => ({ ...f, images: f.images.filter((i) => !i.hidden) }))

  const canToggle = canEdit && !!entry && !!clientId && !!projectId

  // Write the FULL recomputed arrays (immutable — never a delta).
  const writeVisibility = async (
    hiddenImageIds: readonly string[],
    hiddenSessionIds: readonly string[],
  ) => {
    if (!entry || !clientId || !projectId) return
    try {
      await updateCastingEntryVisibility({
        clientId,
        projectId,
        talentId: entry.talentId,
        hiddenImageIds,
        hiddenSessionIds,
      })
    } catch (err) {
      toast.error("Failed to update visibility", {
        description: err instanceof Error ? err.message : "Unknown error",
      })
    }
  }

  const toggleImage = (imageId: string) => {
    if (!entry) return
    const current = entry.hiddenImageIds ?? []
    const next = current.includes(imageId)
      ? current.filter((id) => id !== imageId)
      : [...current, imageId]
    void writeVisibility(next, entry.hiddenSessionIds ?? [])
  }

  const toggleFolder = (sessionId: string) => {
    if (!entry) return
    const current = entry.hiddenSessionIds ?? []
    const next = current.includes(sessionId)
      ? current.filter((id) => id !== sessionId)
      : [...current, sessionId]
    void writeVisibility(entry.hiddenImageIds ?? [], next)
  }

  // Lightbox is fed a RESOLVED url (the tile resolves path → Storage url and
  // passes it up), never a raw path.
  const openLightbox = (resolvedUrl: string) => {
    setLightboxState({ images: [resolvedUrl], index: 0 })
  }

  const statusColor = entry ? getCastingStatusColor(entry.status) : null

  if (!talent && !entry) return null

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="flex w-full flex-col overflow-y-auto p-0 sm:max-w-[480px]"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{displayName}</SheetTitle>
          </SheetHeader>

          {/* Headshot */}
          <div className="w-full flex-shrink-0 bg-[var(--color-surface-subtle)]">
            {headshotUrl ? (
              <img
                src={headshotUrl}
                alt={displayName}
                className="max-h-[50vh] w-full rounded-none object-cover object-top"
              />
            ) : (
              <div className="flex aspect-[3/4] w-full items-center justify-center">
                <span className="text-4xl font-semibold text-[var(--color-text-subtle)]">
                  {initials(displayName)}
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex flex-col gap-5 p-5">
            {/* Name + status + role + agency */}
            <div>
              <div className="heading-section">{displayName}</div>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {entry && (
                  <Badge className={`bg-[var(--color-${statusColor}-bg)] text-[var(--color-${statusColor}-text)] border-0 text-2xs font-semibold uppercase tracking-wide`}>
                    {getCastingStatusLabel(entry.status)}
                  </Badge>
                )}
                {entry?.roleLabel && (
                  <Badge className="border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-2xs font-medium uppercase tracking-wide">
                    {entry.roleLabel}
                  </Badge>
                )}
              </div>
              {talent?.agency && (
                <div className="mt-1 text-sm text-[var(--color-text-muted)]">
                  {talent.agency}
                </div>
              )}
            </div>

            {/* Vote tally */}
            {voteAggregate && (voteAggregate.approve + voteAggregate.maybe + voteAggregate.disapprove) > 0 && (
              <VoteTallyBar aggregate={voteAggregate} />
            )}

            {/* Reviewer feedback */}
            {voteAggregate && voteAggregate.votes.length > 0 && (
              <ReviewerVoteList aggregate={voteAggregate} />
            )}

            {/* Portfolio (gallery images) */}
            {visibleGallery.length > 0 && (
              <div>
                <div className="heading-subsection mb-2">Portfolio</div>
                <div className="grid grid-cols-2 gap-2">
                  {visibleGallery.map(({ img, hidden }) => (
                    <BoardThumb
                      key={img.id}
                      img={img}
                      hidden={hidden}
                      canEdit={canToggle}
                      alt={displayName}
                      onOpen={openLightbox}
                      onToggle={() => toggleImage(img.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Casting-session folders */}
            {visibleFolders.map((folder) =>
              folder.images.length > 0 ? (
                <div key={folder.id}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="heading-subsection">
                      {folder.title}
                      {folder.date && (
                        <span className="ml-2 text-2xs font-normal text-[var(--color-text-subtle)]">
                          {folder.date}
                        </span>
                      )}
                    </div>
                    {canToggle && (
                      <button
                        type="button"
                        aria-label={folder.hidden ? "Show folder" : "Hide folder"}
                        onClick={() => toggleFolder(folder.id)}
                        className="flex items-center gap-1 text-2xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                      >
                        {folder.hidden ? (
                          <EyeOff className="h-3.5 w-3.5" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                        {folder.hidden ? "Hidden" : "Visible"}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {folder.images.map(({ img, hidden }) => (
                      <BoardThumb
                        key={img.id}
                        img={img}
                        hidden={hidden}
                        canEdit={canToggle}
                        alt={displayName}
                        onOpen={openLightbox}
                        onToggle={() => toggleImage(img.id)}
                      />
                    ))}
                  </div>
                </div>
              ) : null,
            )}

            {/* Measurements */}
            {labeledMeasurements.length > 0 && (
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="heading-subsection">Measurements</div>
                  <MeasurementUnitToggle />
                </div>
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

            {/* Notes (from casting board entry) */}
            {entry?.notes && (
              <div>
                <div className="heading-subsection mb-1">Casting Notes</div>
                <p className="text-sm text-[var(--color-text-muted)]">{entry.notes}</p>
              </div>
            )}

            {/* No votes placeholder */}
            {(!voteAggregate || (voteAggregate.approve + voteAggregate.maybe + voteAggregate.disapprove) === 0) && (
              <div className="text-xs text-[var(--color-text-subtle)]">
                No votes collected yet. Share a casting link to gather reviewer feedback.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {lightboxState && (
        <ImageLightbox
          open
          onOpenChange={(v) => { if (!v) setLightboxState(null) }}
          images={lightboxState.images}
          initialIndex={lightboxState.index}
          alt={displayName}
        />
      )}
    </>
  )
}
