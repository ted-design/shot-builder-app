import { useEffect, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/card"
import { Checkbox } from "@/ui/checkbox"
import { ShotStatusSelect } from "@/features/shots/components/ShotStatusSelect"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { Camera, Package, Users, MapPin } from "lucide-react"
import { textPreview } from "@/shared/lib/textPreview"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { TagBadge } from "@/shared/components/TagBadge"
import { getShotPrimaryLookProductLabels, resolveIdsToNames, summarizeLabels } from "@/features/shots/lib/shotListSummaries"
import type { Shot } from "@/shared/types"

interface ShotCardProps {
  readonly shot: Shot
  readonly selectable?: boolean
  readonly selected?: boolean
  readonly onSelectedChange?: (selected: boolean) => void
  readonly visibleFields?: Partial<ShotCardVisibleFields>
  readonly talentNameById?: ReadonlyMap<string, string> | null
  readonly locationNameById?: ReadonlyMap<string, string> | null
}

export interface ShotCardVisibleFields {
  readonly heroThumb: boolean
  readonly shotNumber: boolean
  readonly description: boolean
  readonly readiness: boolean
  readonly location: boolean
  readonly products: boolean
  readonly talent: boolean
  readonly tags: boolean
}

const DEFAULT_VISIBLE_FIELDS: ShotCardVisibleFields = {
  heroThumb: true,
  shotNumber: true,
  description: true,
  readiness: true,
  location: true,
  products: true,
  talent: true,
  tags: true,
}

export function ShotCard({
  shot,
  selectable,
  selected,
  onSelectedChange,
  visibleFields,
  talentNameById,
  locationNameById,
}: ShotCardProps) {
  const navigate = useNavigate()
  const { projectId } = useProjectScope()
  const heroCandidate = shot.heroImage?.downloadURL ?? shot.heroImage?.path
  const heroUrl = useStorageUrl(heroCandidate)
  const [imgVisible, setImgVisible] = useState(!!heroCandidate)

  useEffect(() => {
    setImgVisible(!!heroCandidate)
  }, [heroCandidate])

  const fields: ShotCardVisibleFields = {
    ...DEFAULT_VISIBLE_FIELDS,
    ...visibleFields,
  }

  const productLabels = getShotPrimaryLookProductLabels(shot)
  const hasProducts = productLabels.length > 0

  const talentIds = shot.talentIds ?? shot.talent
  const { names: talentNames, unknownCount: unknownTalentCount } = resolveIdsToNames(
    talentIds,
    talentNameById,
  )
  const hasTalent = talentNames.length + unknownTalentCount > 0

  const resolvedLocationName =
    shot.locationName ??
    (shot.locationId ? locationNameById?.get(shot.locationId) ?? undefined : undefined)
  const hasLocation = !!shot.locationId

  const talentSummary = summarizeLabels(talentNames, 2)

  const talentPreview =
    talentNames.length === 0
      ? unknownTalentCount > 0
        ? `${unknownTalentCount} selected`
        : ""
      : unknownTalentCount > 0
        ? `${talentSummary.preview} +${unknownTalentCount}`
        : talentSummary.preview

  const talentTitle =
    unknownTalentCount > 0
      ? `${talentSummary.title}${talentSummary.title ? "\n" : ""}${unknownTalentCount} unknown`
      : talentSummary.title

  const showReadiness = fields.readiness
  const detailsVisible = fields.location || fields.products || fields.talent

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => navigate(`/projects/${projectId}/shots/${shot.id}`)}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 p-4 pb-2">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {fields.heroThumb && (
            <div className="w-24 flex-shrink-0 sm:w-28">
              <div className="aspect-[16/9] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
                {heroUrl && imgVisible ? (
                  <img
                    src={heroUrl}
                    alt={shot.title || "Shot image"}
                    className="h-full w-full object-contain"
                    loading="lazy"
                    decoding="async"
                    onError={() => setImgVisible(false)}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[var(--color-text-subtle)]">
                    <Camera className="h-4 w-4" />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <div className="min-h-[2.25rem] min-w-0 flex-1">
                <CardTitle className="line-clamp-2 text-sm font-medium leading-tight">
                  {shot.title || "Untitled Shot"}
                </CardTitle>
              </div>
              {fields.shotNumber && shot.shotNumber && (
                <span className="flex-shrink-0 pt-0.5 text-xs text-[var(--color-text-subtle)]">
                  #{shot.shotNumber}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {selectable && (
            <Checkbox
              checked={!!selected}
              onCheckedChange={(v) => {
                if (v === "indeterminate") return
                onSelectedChange?.(v)
              }}
              aria-label={selected ? "Deselect shot" : "Select shot"}
            />
          )}
          <ShotStatusSelect
            shotId={shot.id}
            currentStatus={shot.status}
            shot={shot}
            disabled={false}
          />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-4 pt-0">
        {fields.description && shot.description && textPreview(shot.description) && (
          <p className="line-clamp-2 text-xs text-[var(--color-text-muted)]">
            {textPreview(shot.description)}
          </p>
        )}

        {/* Readiness indicators */}
        {showReadiness && (
          <div className="flex items-center gap-2 text-xs">
            <ReadinessIndicator icon={Package} ready={hasProducts} label="Products" compact={detailsVisible} />
            <ReadinessIndicator icon={Users} ready={hasTalent} label="Talent" compact={detailsVisible} />
            <ReadinessIndicator icon={MapPin} ready={hasLocation} label="Location" compact={detailsVisible} />
          </div>
        )}

        {(fields.location || fields.products || fields.talent) && (
          <div className="flex flex-col gap-1 text-xs text-[var(--color-text-secondary)]">
            {fields.location && hasLocation && (
              <MetaLine
                icon={MapPin}
                title={resolvedLocationName ?? shot.locationId ?? undefined}
              >
                {resolvedLocationName ?? "Location selected"}
              </MetaLine>
            )}
            {fields.talent && hasTalent && (
              <MetaLine icon={Users} title={talentTitle || undefined}>
                {talentPreview || "—"}
              </MetaLine>
            )}
            {fields.products && hasProducts && (
              <MetaBlock icon={Package} title={productLabels.join("\n")}>
                {productLabels.map((label, index) => (
                  <div key={`${label}-${index}`} className="truncate">
                    {label}
                  </div>
                ))}
              </MetaBlock>
            )}
          </div>
        )}

        {/* Tag badges (read-only) */}
        {fields.tags && shot.tags && shot.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {shot.tags.map((tag) => (
              <TagBadge key={tag.id} tag={tag} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ReadinessIndicator({
  icon: Icon,
  ready,
  label,
  compact,
}: {
  readonly icon: React.ComponentType<{ className?: string }>
  readonly ready: boolean
  readonly label: string
  readonly compact?: boolean
}) {
  return (
    <span
      className={`flex items-center gap-1 ${
        ready
          ? "text-[var(--color-text-secondary)]"
          : "text-[var(--color-error)] opacity-80"
      }`}
      title={ready ? `${label} assigned` : `No ${label.toLowerCase()}`}
    >
      <Icon className={compact ? "h-3.5 w-3.5" : "h-3 w-3"} />
      {compact ? <span className="sr-only">{label}</span> : <span>{label}</span>}
    </span>
  )
}

function MetaLine({
  icon: Icon,
  title,
  children,
}: {
  readonly icon: React.ComponentType<{ className?: string }>
  readonly title?: string
  readonly children: ReactNode
}) {
  return (
    <div className="flex items-center gap-1.5 min-w-0" title={title}>
      <Icon className="h-3.5 w-3.5 flex-shrink-0 text-[var(--color-text-subtle)]" />
      <span className="truncate">{children}</span>
    </div>
  )
}

function MetaBlock({
  icon: Icon,
  title,
  children,
}: {
  readonly icon: React.ComponentType<{ className?: string }>
  readonly title?: string
  readonly children: ReactNode
}) {
  return (
    <div className="flex items-start gap-1.5 min-w-0" title={title}>
      <Icon className="mt-[1px] h-3.5 w-3.5 flex-shrink-0 text-[var(--color-text-subtle)]" />
      <div className="flex min-w-0 flex-col gap-0.5">{children}</div>
    </div>
  )
}
