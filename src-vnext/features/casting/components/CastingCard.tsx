import { useMemo } from "react"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/ui/button"
import { Checkbox } from "@/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import {
  resolveVisibleBoardImages,
  type BoardImage,
} from "@/features/casting/lib/castingBoardImages"
import {
  getCastingStatusLabel,
  getCastingStatusColor,
  CASTING_STATUS_MAP,
} from "@/features/casting/lib/castingStatuses"
import { formatLabeledMeasurements } from "@/features/library/lib/measurementOptions"
import { useMeasurementUnits } from "@/shared/hooks/useMeasurementUnits"
import type { CastingBoardEntry, CastingBoardStatus, TalentRecord } from "@/shared/types"

import type { VoteAggregate } from "@/features/casting/hooks/useCastingVoteAggregates"

interface CastingCardProps {
  readonly entry: CastingBoardEntry
  readonly talent: TalentRecord | null
  readonly selected: boolean
  readonly canEdit: boolean
  readonly voteAggregate?: VoteAggregate | null
  readonly onClick?: () => void
  readonly onSelect: (id: string) => void
  readonly onStatusChange: (talentId: string, status: CastingBoardStatus) => void
  readonly onBook: (talentId: string) => void
  readonly onRemove: (talentId: string) => void
}

function initials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? "?"
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] : ""
  return `${first}${last}`.toUpperCase()
}

function statusBadgeClasses(status: CastingBoardStatus): string {
  const color = getCastingStatusColor(status)
  return `bg-[var(--color-${color}-bg)] text-[var(--color-${color}-text)]`
}

/** Max thumbnails shown inline before collapsing the remainder into a +N chip. */
const MAX_STRIP_THUMBS = 4

/**
 * Resolves a single board image's Storage URL (prefers a pre-resolved
 * downloadURL, else resolves the path via `useStorageUrl`). A child component
 * is required because `useStorageUrl` is a hook and cannot run inside a map.
 */
function BoardThumb({
  image,
  alt,
}: {
  readonly image: BoardImage
  readonly alt: string
}) {
  const resolvedUrl = useStorageUrl(image.path || undefined)
  const url = image.downloadURL || resolvedUrl
  return (
    <div className="aspect-square overflow-hidden rounded-sm bg-[var(--color-surface-subtle)]">
      {url ? (
        <img src={url} alt={alt} className="h-full w-full object-cover" />
      ) : null}
    </div>
  )
}

export function CastingCard({
  entry,
  talent,
  selected,
  canEdit,
  voteAggregate,
  onClick,
  onSelect,
  onStatusChange,
  onBook,
  onRemove,
}: CastingCardProps) {
  const headshotPath = talent?.headshotPath || talent?.imageUrl || undefined
  const headshotUrl = useStorageUrl(headshotPath)
  const displayName = talent?.name || entry.talentName
  const agency = talent?.agency || entry.talentAgency || null
  const { system } = useMeasurementUnits()
  const measurementText = useMemo(() => {
    const text = formatLabeledMeasurements(
      talent?.measurements,
      talent?.gender,
      "compact",
      system,
    )
    return text.length > 0 ? text : null
  }, [talent?.measurements, talent?.gender, system])

  const visibleImages = useMemo(
    () => resolveVisibleBoardImages(talent, entry).allVisible,
    [talent, entry],
  )
  const stripThumbs = visibleImages.slice(0, MAX_STRIP_THUMBS)
  const overflowCount = visibleImages.length - stripThumbs.length

  const showBookButton =
    canEdit && (entry.status === "shortlist" || entry.status === "hold")
  const isBooked = entry.status === "booked"

  return (
    <div
      className={`relative overflow-hidden rounded-md border transition-colors ${
        selected
          ? "border-[var(--color-primary)]"
          : "border-[var(--color-border)] hover:border-[var(--color-border-hover)]"
      } bg-[var(--color-surface-raised)]`}
    >
      {/* Checkbox */}
      {canEdit && (
        <div className="absolute left-2 top-2 z-10">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onSelect(entry.id)}
            className="border-white/35 bg-black/45 backdrop-blur-sm data-[state=checked]:border-[var(--color-primary)] data-[state=checked]:bg-[var(--color-primary)]"
          />
        </div>
      )}

      {/* Menu */}
      {canEdit && (
        <div className="absolute right-2 top-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 bg-black/45 p-0 text-white/70 backdrop-blur-sm hover:text-white"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(Object.keys(CASTING_STATUS_MAP) as CastingBoardStatus[]).map(
                (status) => (
                  <DropdownMenuItem
                    key={status}
                    disabled={status === entry.status}
                    onSelect={() => onStatusChange(entry.talentId, status)}
                  >
                    {getCastingStatusLabel(status)}
                  </DropdownMenuItem>
                ),
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-[var(--color-error)]"
                onSelect={() => onRemove(entry.talentId)}
              >
                Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Headshot — clickable to open detail sheet */}
      <button
        type="button"
        className="aspect-[3/4] w-full bg-[var(--color-surface-subtle)] cursor-pointer"
        onClick={onClick}
        aria-label={`View details for ${displayName}`}
      >
        {headshotUrl ? (
          <img
            src={headshotUrl}
            alt={displayName}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-[var(--color-text-muted)]">
            {initials(displayName)}
          </div>
        )}
      </button>

      {/* Body */}
      <div className="px-3 pb-3 pt-2.5">
        <div className="truncate text-sm font-semibold text-[var(--color-text)]">
          {displayName}
        </div>
        {agency && (
          <div className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">
            {agency}
          </div>
        )}

        {/* Status + Role row */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-block rounded px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide ${statusBadgeClasses(entry.status)}`}
          >
            {getCastingStatusLabel(entry.status)}
          </span>
          {entry.roleLabel && (
            <span className="inline-block rounded border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/10 px-1.5 py-0.5 text-2xs font-medium uppercase tracking-wide text-[var(--color-primary)]">
              {entry.roleLabel}
            </span>
          )}
        </div>

        {/* Measurements */}
        {measurementText && (
          <div className="mt-1.5 text-2xs text-[var(--color-text-muted)]">
            {measurementText}
          </div>
        )}

        {/* Visible board-image strip — opens the detail sheet on click */}
        {stripThumbs.length > 0 && (
          <button
            type="button"
            onClick={onClick}
            aria-label={`View ${visibleImages.length} image${visibleImages.length !== 1 ? "s" : ""} for ${displayName}`}
            className="mt-2 grid w-full grid-cols-4 gap-1"
          >
            {stripThumbs.map((image, index) => {
              const isLast = index === stripThumbs.length - 1
              return (
                <div key={image.id} className="relative">
                  <BoardThumb image={image} alt={`${displayName} image ${index + 1}`} />
                  {isLast && overflowCount > 0 && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-sm bg-black/45 text-2xs font-semibold text-white">
                      +{overflowCount}
                    </div>
                  )}
                </div>
              )
            })}
          </button>
        )}

        {/* Vote tally */}
        {voteAggregate && (voteAggregate.approve + voteAggregate.maybe + voteAggregate.disapprove) > 0 ? (
          <div className="mt-1.5 flex items-center gap-1.5 text-2xs">
            {voteAggregate.approve > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[var(--color-status-green-text)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-status-green-text)]" />
                {voteAggregate.approve}
              </span>
            )}
            {voteAggregate.maybe > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[var(--color-status-amber-text)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-status-amber-text)]" />
                {voteAggregate.maybe}
              </span>
            )}
            {voteAggregate.disapprove > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[var(--color-error)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-error)]" />
                {voteAggregate.disapprove}
              </span>
            )}
            <span className="text-[var(--color-text-subtle)]">
              {voteAggregate.votes.length} vote{voteAggregate.votes.length !== 1 ? "s" : ""}
            </span>
          </div>
        ) : (
          <div className="mt-1.5 text-2xs text-[var(--color-text-subtle)]">
            No votes yet
          </div>
        )}

        {/* Book / Booked action */}
        {showBookButton && (
          <div className="mt-2">
            <Button
              size="sm"
              className="w-full"
              onClick={() => onBook(entry.talentId)}
            >
              Book
            </Button>
          </div>
        )}
        {isBooked && (
          <div className="mt-2 text-center text-2xs font-semibold uppercase tracking-wider text-[var(--color-status-blue-text)]">
            Booked
          </div>
        )}
      </div>
    </div>
  )
}
