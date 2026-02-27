import { Camera, Package, Users } from "lucide-react"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { extractShotAssignedProducts } from "@/shared/lib/shotProducts"
import type { Shot } from "@/shared/types"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BoardCardProps {
  readonly shot: Shot
  readonly isDragging: boolean
  readonly onOpenShot: (shotId: string) => void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_VISIBLE_TAGS = 3

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BoardCard({ shot, isDragging, onOpenShot }: BoardCardProps) {
  const heroCandidate = shot.heroImage?.downloadURL ?? shot.heroImage?.path
  const heroUrl = useStorageUrl(heroCandidate)

  const tags = shot.tags ?? []
  const visibleTags = tags.slice(0, MAX_VISIBLE_TAGS)
  const overflowCount = Math.max(0, tags.length - MAX_VISIBLE_TAGS)

  const talentCount = (shot.talentIds ?? shot.talent).filter(
    (t): t is string => typeof t === "string" && t.trim().length > 0,
  ).length
  const productCount = extractShotAssignedProducts(shot).length

  const showMeta = talentCount > 0 || productCount > 0

  return (
    <div
      className={`cursor-pointer rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 transition-shadow hover:border-[var(--color-border-hover)] hover:shadow-sm ${
        isDragging ? "opacity-50 shadow-md" : ""
      }`}
      onClick={() => onOpenShot(shot.id)}
    >
      {/* Top row: thumb + title/number */}
      <div className="flex items-start gap-2.5">
        {heroUrl ? (
          <img
            src={heroUrl}
            alt={shot.title || "Shot image"}
            className="h-11 w-11 flex-shrink-0 rounded-md object-cover"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-md bg-[var(--color-surface-subtle)]"
            aria-label="No image"
          >
            <Camera className="h-4 w-4 text-[var(--color-text-subtle)]" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 text-xs font-medium leading-tight text-[var(--color-text)]">
            {shot.title || "Untitled Shot"}
          </p>
          {shot.shotNumber && (
            <span className="text-xxs text-[var(--color-text-subtle)]">
              #{shot.shotNumber}
            </span>
          )}
        </div>
      </div>

      {/* Tags */}
      {visibleTags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {visibleTags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex rounded border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-1.5 py-px text-2xs font-medium text-[var(--color-text-secondary)]"
            >
              {tag.label}
            </span>
          ))}
          {overflowCount > 0 && (
            <span className="inline-flex rounded border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-1.5 py-px text-2xs font-medium text-[var(--color-text-subtle)]">
              +{overflowCount}
            </span>
          )}
        </div>
      )}

      {/* Meta row: talent + product counts */}
      {showMeta && (
        <div className="mt-2 flex items-center gap-2 text-xxs text-[var(--color-text-subtle)]">
          {talentCount > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3 opacity-60" />
              {talentCount}
            </span>
          )}
          {productCount > 0 && (
            <span className="flex items-center gap-1">
              <Package className="h-3 w-3 opacity-60" />
              {productCount}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
