import { useEffect, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardTitle } from "@/ui/card"
import { Checkbox } from "@/ui/checkbox"
import { ShotStatusSelect } from "@/features/shots/components/ShotStatusSelect"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { Package, Users, MapPin } from "lucide-react"
import { textPreview } from "@/shared/lib/textPreview"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { TagBadge } from "@/shared/components/TagBadge"
import { getShotPrimaryLookProductLabels, resolveIdsToNames, summarizeLabels } from "@/features/shots/lib/shotListSummaries"
import type { Shot, ShotTag } from "@/shared/types"
import { getShotTagCategoryLabel, resolveShotTagCategory } from "@/shared/lib/tagCategories"

interface ShotCardProps {
  readonly shot: Shot
  readonly selectable?: boolean
  readonly selected?: boolean
  readonly onSelectedChange?: (selected: boolean) => void
  readonly leadingControl?: ReactNode
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

const PRODUCT_PREVIEW_LIMIT = 2

function groupTagsByCategory(tags: ReadonlyArray<ShotTag>): ReadonlyArray<{
  readonly key: "priority" | "gender" | "media" | "other"
  readonly label: string
  readonly tags: ReadonlyArray<ShotTag>
}> {
  if (tags.length === 0) return []

  const grouped: Record<"priority" | "gender" | "media" | "other", ShotTag[]> = {
    priority: [],
    gender: [],
    media: [],
    other: [],
  }

  for (const tag of tags) {
    grouped[resolveShotTagCategory(tag)].push(tag)
  }

  return (["priority", "gender", "media", "other"] as const)
    .filter((key) => grouped[key].length > 0)
    .map((key) => ({
      key,
      label: getShotTagCategoryLabel(key),
      tags: grouped[key],
    }))
}

export function ShotCard({
  shot,
  selectable,
  selected,
  onSelectedChange,
  leadingControl,
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

  const showTalentDetails = fields.talent && hasTalent
  const showLocationDetails = fields.location && hasLocation
  const showProductsDetails = fields.products && hasProducts
  const showReadiness =
    fields.readiness &&
    !showTalentDetails &&
    !showLocationDetails &&
    !showProductsDetails
  const showHeroImage = fields.heroThumb && !!heroUrl && imgVisible
  const tagGroups = groupTagsByCategory(shot.tags ?? [])
  const productPreview = productLabels.slice(0, PRODUCT_PREVIEW_LIMIT)
  const hiddenProductCount = Math.max(0, productLabels.length - productPreview.length)

  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-sm"
      onClick={() => navigate(`/projects/${projectId}/shots/${shot.id}`)}
    >
      <CardContent className="flex flex-col gap-2.5 px-4 py-3.5">
        <div className="space-y-1">
          <CardTitle className="line-clamp-2 text-[14px] font-semibold leading-[1.3] md:text-[15px]">
            {shot.title || "Untitled Shot"}
          </CardTitle>
          {fields.description && shot.description && textPreview(shot.description) && (
            <p className="line-clamp-2 text-[11px] leading-4 text-[var(--color-text-muted)]">
              {textPreview(shot.description)}
            </p>
          )}
        </div>

        <div
          className="flex items-center justify-between gap-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            {leadingControl}
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
          </div>
          <div className="flex items-center gap-2">
            {fields.shotNumber && shot.shotNumber && (
              <span className="flex-shrink-0 text-[11px] text-[var(--color-text-subtle)]">
                #{shot.shotNumber}
              </span>
            )}
            <ShotStatusSelect
              shotId={shot.id}
              currentStatus={shot.status}
              shot={shot}
              disabled={false}
            />
          </div>
        </div>

        {(showHeroImage || showTalentDetails || showLocationDetails || showProductsDetails || showReadiness) && (
          <div
            className={`grid gap-3.5 ${
              showHeroImage ? "grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start" : "grid-cols-1"
            }`}
          >
            {(showTalentDetails || showLocationDetails || showProductsDetails || showReadiness) && (
              <div className="min-w-0 space-y-2.5">
                {(showTalentDetails || showLocationDetails) && (
                  <div
                    className={`grid gap-2.5 ${
                      showTalentDetails && showLocationDetails ? "grid-cols-2" : "grid-cols-1"
                    }`}
                  >
                    {showTalentDetails && (
                      <MetaField icon={Users} label="Talent" title={talentTitle || undefined}>
                        <span className="line-clamp-2">{talentPreview || "—"}</span>
                      </MetaField>
                    )}
                    {showLocationDetails && (
                      <MetaField
                        icon={MapPin}
                        label="Location"
                        title={resolvedLocationName ?? shot.locationId ?? undefined}
                      >
                        <span className="line-clamp-2">{resolvedLocationName ?? "Location selected"}</span>
                      </MetaField>
                    )}
                  </div>
                )}

                {showProductsDetails && (
                  <MetaField icon={Package} label="Products" title={productLabels.join("\n")}>
                    <div className="space-y-0.5">
                      {productPreview.map((label, index) => (
                        <div key={`${label}-${index}`} className="truncate">
                          {label}
                        </div>
                      ))}
                      {hiddenProductCount > 0 && (
                        <div className="text-[10px] text-[var(--color-text-subtle)]">
                          +{hiddenProductCount} more
                        </div>
                      )}
                    </div>
                  </MetaField>
                )}

                {showReadiness && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[var(--radius-sm)] bg-[var(--color-surface-subtle)] px-2.5 py-2 text-[11px]">
                    <ReadinessIndicator icon={Package} ready={hasProducts} label="Products" />
                    <ReadinessIndicator icon={Users} ready={hasTalent} label="Talent" />
                    <ReadinessIndicator icon={MapPin} ready={hasLocation} label="Location" />
                  </div>
                )}
              </div>
            )}

            {showHeroImage && (
              <div className="flex items-start justify-start sm:justify-end">
                <img
                  src={heroUrl}
                  alt={shot.title || "Shot image"}
                  className="block h-auto max-h-[150px] w-auto max-w-[150px] rounded-[var(--radius-md)] object-contain shadow-sm"
                  loading="lazy"
                  decoding="async"
                  onError={() => setImgVisible(false)}
                />
              </div>
            )}
          </div>
        )}

        {fields.tags && tagGroups.length > 0 && (
          <div className="border-t border-[var(--color-border)] pt-3">
            <div className="grid gap-2.5 sm:grid-cols-2">
              {tagGroups.map((group) => (
                <div key={group.key} className="min-w-0 rounded-[var(--radius-sm)] px-1 py-1.5">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
                    {group.label}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {group.tags.map((tag) => (
                      <TagBadge key={tag.id} tag={tag} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
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
}: {
  readonly icon: React.ComponentType<{ className?: string }>
  readonly ready: boolean
  readonly label: string
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
      <Icon className="h-3 w-3" />
      <span>{label}</span>
    </span>
  )
}

function MetaField({
  icon: Icon,
  label,
  title,
  children,
}: {
  readonly icon: React.ComponentType<{ className?: string }>
  readonly label: string
  readonly title?: string
  readonly children: ReactNode
}) {
  return (
    <div className="min-w-0 rounded-[var(--radius-sm)] bg-[var(--color-surface-subtle)] px-2.5 py-2" title={title}>
      <p className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
        <Icon className="h-3 w-3 flex-shrink-0" />
        <span>{label}</span>
      </p>
      <div className="min-w-0 text-[11px] leading-4 text-[var(--color-text)]">{children}</div>
    </div>
  )
}
