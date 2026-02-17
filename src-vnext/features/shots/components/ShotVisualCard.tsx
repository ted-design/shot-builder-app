import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent } from "@/ui/card"
import { Checkbox } from "@/ui/checkbox"
import { Camera, MapPin, Package, StickyNote, Users } from "lucide-react"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { StatusBadge } from "@/shared/components/StatusBadge"
import { getShotStatusColor, getShotStatusLabel } from "@/shared/lib/statusMappings"
import type { Shot } from "@/shared/types"
import { TagBadge } from "@/shared/components/TagBadge"
import { extractShotAssignedProducts } from "@/shared/lib/shotProducts"
import { getShotNotesPreview } from "@/features/shots/lib/shotListSummaries"
import { NotesPreviewText } from "@/features/shots/components/NotesPreviewText"

interface ShotVisualCardProps {
  readonly shot: Shot
  readonly selectable?: boolean
  readonly selected?: boolean
  readonly onSelectedChange?: (next: boolean) => void
  readonly showShotNumber?: boolean
  readonly showTags?: boolean
  readonly showReadiness?: boolean
  readonly showNotes?: boolean
}

export function ShotVisualCard({
  shot,
  selectable,
  selected,
  onSelectedChange,
  showShotNumber = true,
  showTags = true,
  showReadiness = true,
  showNotes = false,
}: ShotVisualCardProps) {
  const navigate = useNavigate()
  const { projectId } = useProjectScope()

  const heroCandidate = shot.heroImage?.downloadURL ?? shot.heroImage?.path
  const heroUrl = useStorageUrl(heroCandidate)
  const [imgVisible, setImgVisible] = useState(!!heroCandidate)

  useEffect(() => {
    setImgVisible(!!heroCandidate)
  }, [heroCandidate])

  const showImage = !!heroUrl && imgVisible

  const hasProducts = extractShotAssignedProducts(shot).length > 0
  const hasTalent = (shot.talentIds ?? shot.talent).some(
    (t) => typeof t === "string" && t.trim().length > 0,
  )
  const hasLocation = !!shot.locationId
  const notesPreview = showNotes ? getShotNotesPreview(shot, 220) : ""

  return (
    <Card
      className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
      onClick={() => navigate(`/projects/${projectId}/shots/${shot.id}`)}
    >
      <div className="relative aspect-[16/9] w-full bg-[var(--color-surface-subtle)]">
        {showImage ? (
          <img
            src={heroUrl}
            alt={shot.title || "Shot image"}
            className="h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            onError={() => setImgVisible(false)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--color-text-subtle)]">
            <Camera className="h-6 w-6" />
          </div>
        )}

        <div
          className="absolute left-2 top-2 flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {selectable && (
            <div className="rounded bg-black/35 p-1 text-white backdrop-blur-sm">
              <Checkbox
                checked={!!selected}
                onCheckedChange={(v) => {
                  if (v === "indeterminate") return
                  onSelectedChange?.(v)
                }}
                aria-label={selected ? "Deselect shot" : "Select shot"}
              />
            </div>
          )}
        </div>

        <div
          className="absolute right-2 top-2"
          onClick={(e) => e.stopPropagation()}
        >
          <StatusBadge
            label={getShotStatusLabel(shot.status)}
            color={getShotStatusColor(shot.status)}
          />
        </div>
      </div>

      <CardContent className="flex flex-col gap-2 p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="min-h-[2.25rem] text-sm font-medium leading-tight">
              <div className="line-clamp-2">
                {shot.title || "Untitled Shot"}
              </div>
            </div>
          </div>
          {showShotNumber && shot.shotNumber && (
            <span className="flex-shrink-0 text-xs text-[var(--color-text-subtle)]">
              #{shot.shotNumber}
            </span>
          )}
        </div>

        {showTags && shot.tags && shot.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {shot.tags.slice(0, 6).map((tag) => (
              <TagBadge key={tag.id} tag={tag} />
            ))}
            {shot.tags.length > 6 && (
              <span className="text-xs text-[var(--color-text-subtle)]">
                +{shot.tags.length - 6}
              </span>
            )}
          </div>
        )}

        {showNotes && notesPreview && (
          <div className="flex items-start gap-1 text-xs text-[var(--color-text-muted)]">
            <StickyNote className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--color-text-subtle)]" />
            <NotesPreviewText
              text={notesPreview}
              className="line-clamp-3 min-w-0"
              onLinkClick={(event) => event.stopPropagation()}
            />
          </div>
        )}

        {showReadiness && (
          <div className="flex items-center gap-2 text-xs">
            <span
              className={hasProducts ? "text-[var(--color-text-secondary)]" : "text-[var(--color-error)] opacity-80"}
              title={hasProducts ? "Products assigned" : "No products"}
            >
              <Package className="h-3.5 w-3.5" />
              <span className="sr-only">Products</span>
            </span>
            <span
              className={hasTalent ? "text-[var(--color-text-secondary)]" : "text-[var(--color-error)] opacity-80"}
              title={hasTalent ? "Talent assigned" : "No talent"}
            >
              <Users className="h-3.5 w-3.5" />
              <span className="sr-only">Talent</span>
            </span>
            <span
              className={hasLocation ? "text-[var(--color-text-secondary)]" : "text-[var(--color-error)] opacity-80"}
              title={hasLocation ? "Location assigned" : "No location"}
            >
              <MapPin className="h-3.5 w-3.5" />
              <span className="sr-only">Location</span>
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
