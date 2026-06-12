// Client review gallery — the image-led approval tiles (Phase 5f, spec §PR
// partition 5f-II).
//
// Mounted by ShotListPage INSTEAD of the producer table/card forks when
// `featureReviewSurface` is ON and the resolved surface === 'review-client'
// (surface-keyed, not device-keyed — the Shoot-shell precedent). This is the
// LIST counterpart to ReviewShotDetail's approval detail: the client's job is
// to DECIDE / APPROVE, so each tile leads with the hero / reference image,
// then shot # / title / read-only status, with products shown read-only as
// quiet context chips.
//
// PRESENTATION, not a permission boundary (spec §Rules-vs-UI): these tiles are
// strictly read-only — no bulk actions, no quick-add, no FAB, no lifecycle
// menu, no status writes. The firestore rules already gate every write; this
// surface simply does not render the producer affordances.
//
// Each tile resolves its own hero URL (useStorageUrl is a hook, so it lives in
// the per-tile child, not a .map callback). No hero → a quiet neutral panel,
// never a broken image.
import { useState } from "react"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { StatusBadge } from "@/shared/components/StatusBadge"
import { getShotStatusLabel, getShotStatusColor } from "@/shared/lib/statusMappings"
import { getShotPrimaryLookProductEntries } from "@/features/shots/lib/shotListSummaries"
import type { Shot, ProductFamily } from "@/shared/types"

const PRODUCT_CHIP_LIMIT = 3

export interface ReviewClientGalleryProps {
  /** Display-order shots to review. */
  readonly shots: ReadonlyArray<Shot>
  /** Resolves product style numbers for the read-only context chips. */
  readonly familyById: ReadonlyMap<string, ProductFamily>
  readonly onOpenShot: (shotId: string) => void
}

export function ReviewClientGallery({
  shots,
  familyById,
  onOpenShot,
}: ReviewClientGalleryProps) {
  return (
    <div
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      data-testid="review-client-gallery"
    >
      {shots.map((shot) => (
        <ReviewGalleryTile
          key={shot.id}
          shot={shot}
          familyById={familyById}
          onOpenShot={onOpenShot}
        />
      ))}
    </div>
  )
}

function ReviewGalleryTile({
  shot,
  familyById,
  onOpenShot,
}: {
  readonly shot: Shot
  readonly familyById: ReadonlyMap<string, ProductFamily>
  readonly onOpenShot: (shotId: string) => void
}) {
  const heroCandidate = shot.heroImage?.downloadURL ?? shot.heroImage?.path
  const heroUrl = useStorageUrl(heroCandidate)
  const [imgVisible, setImgVisible] = useState(true)
  const showHero = !!heroUrl && imgVisible

  const productEntries = getShotPrimaryLookProductEntries(shot, familyById)
  const productPreview = productEntries.slice(0, PRODUCT_CHIP_LIMIT)
  const hiddenProductCount = Math.max(0, productEntries.length - productPreview.length)

  return (
    <button
      type="button"
      onClick={() => onOpenShot(shot.id)}
      className="group flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] text-left transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      data-testid="review-gallery-tile"
      data-shot-id={shot.id}
    >
      {/* ── Hero / reference image leads — the client decides off the image.
          Read-only: no upload, no edit. Quiet neutral panel when absent. ── */}
      <div className="relative flex aspect-[4/5] items-end overflow-hidden bg-[var(--color-surface-subtle)]">
        {showHero ? (
          <img
            src={heroUrl}
            alt={shot.title || "Shot reference"}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            onError={() => setImgVisible(false)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-2xs uppercase tracking-wider text-[var(--color-text-subtle)]">
            No reference image
          </div>
        )}
        {shot.shotNumber && (
          <span className="absolute left-2.5 top-2.5 rounded-[var(--radius-sm)] bg-black/45 px-2 py-0.5 text-2xs font-semibold text-white backdrop-blur-sm">
            #{shot.shotNumber}
          </span>
        )}
        {showHero && (
          <span className="relative z-10 line-clamp-2 px-3 pb-3 text-base font-semibold leading-tight text-white [font-family:var(--font-serif)] [text-shadow:0_1px_12px_rgba(0,0,0,0.55)]">
            {shot.title || "Untitled Shot"}
          </span>
        )}
      </div>

      {/* ── Meta: title (when no hero overlay) + read-only status + read-only
          product context chips. ── */}
      <div className="flex flex-col gap-2 px-3 py-3">
        {!showHero && (
          <p className="line-clamp-2 text-sm font-semibold leading-tight text-[var(--color-text)] [font-family:var(--font-serif)]">
            {shot.title || "Untitled Shot"}
          </p>
        )}
        <div className="flex items-center">
          <StatusBadge
            label={getShotStatusLabel(shot.status)}
            color={getShotStatusColor(shot.status)}
          />
        </div>
        {productPreview.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {productPreview.map((entry, index) => (
              <span
                key={`${entry.label}-${index}`}
                className="inline-flex max-w-full items-center truncate rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-2 py-0.5 text-2xs text-[var(--color-text-secondary)]"
              >
                {entry.label}
              </span>
            ))}
            {hiddenProductCount > 0 && (
              <span className="inline-flex items-center text-2xs text-[var(--color-text-subtle)]">
                +{hiddenProductCount} more
              </span>
            )}
          </div>
        )}
      </div>
    </button>
  )
}
