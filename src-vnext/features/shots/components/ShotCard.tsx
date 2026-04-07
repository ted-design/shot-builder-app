import { useEffect, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardTitle } from "@/ui/card"
import { Checkbox } from "@/ui/checkbox"
import { ShotStatusSelect } from "@/features/shots/components/ShotStatusSelect"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { Package, Users, MapPin, StickyNote, Link2, Globe, Video, FileText } from "lucide-react"
import { textPreview } from "@/shared/lib/textPreview"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { TagBadge } from "@/shared/components/TagBadge"
import { sortTagsByCategory } from "@/shared/lib/tagSort"
import { getShotNotesPreview, getShotPrimaryLookProductEntries, resolveIdsToNames, summarizeLabels } from "@/features/shots/lib/shotListSummaries"
import { NotesPreviewText } from "@/features/shots/components/NotesPreviewText"
import type { Shot, ShotReferenceLinkType, ProductFamily, ProductSku, ProductSample } from "@/shared/types"
import { computeShotReadiness, formatLaunchDateShort, launchUrgencyClass } from "@/features/shots/lib/shotProductReadiness"
import { ASSET_TYPE_SHORT_LABELS } from "@/features/products/lib/assetRequirements"

interface ShotCardProps {
  readonly shot: Shot
  readonly selectable?: boolean
  readonly selected?: boolean
  readonly onSelectedChange?: (selected: boolean) => void
  readonly onOpenShot?: (shotId: string) => void
  readonly leadingControl?: ReactNode
  readonly actionControl?: ReactNode
  readonly visibleFields?: Partial<ShotCardVisibleFields>
  readonly talentNameById?: ReadonlyMap<string, string> | null
  readonly locationNameById?: ReadonlyMap<string, string> | null
  readonly familyById?: ReadonlyMap<string, ProductFamily>
  readonly skuById?: ReadonlyMap<string, ProductSku>
  readonly samplesByFamily?: ReadonlyMap<string, ReadonlyArray<ProductSample>>
}

export interface ShotCardVisibleFields {
  readonly heroThumb: boolean
  readonly shotNumber: boolean
  readonly description: boolean
  readonly notes: boolean
  readonly readiness: boolean
  readonly location: boolean
  readonly products: boolean
  readonly links: boolean
  readonly talent: boolean
  readonly tags: boolean
}

const DEFAULT_VISIBLE_FIELDS: ShotCardVisibleFields = {
  heroThumb: false,
  shotNumber: true,
  description: true,
  notes: false,
  readiness: false,
  location: false,
  products: false,
  links: false,
  talent: false,
  tags: true,
}

const PRODUCT_PREVIEW_LIMIT = 2
const REFERENCE_LINK_PREVIEW_LIMIT = 2

function getReferenceLinkIcon(type: ShotReferenceLinkType) {
  switch (type) {
    case "video":
      return Video
    case "document":
      return FileText
    case "web":
    default:
      return Globe
  }
}


export function ShotCard({
  shot,
  selectable,
  selected,
  onSelectedChange,
  onOpenShot,
  leadingControl,
  actionControl,
  visibleFields,
  talentNameById,
  locationNameById,
  familyById,
  skuById,
  samplesByFamily,
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

  const productEntries = getShotPrimaryLookProductEntries(shot, familyById)
  const hasProducts = productEntries.length > 0
  const referenceLinks = shot.referenceLinks ?? []

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
  const showReferenceLinksDetails = fields.links && referenceLinks.length > 0
  const shotReadiness = fields.readiness && familyById
    ? computeShotReadiness(shot, familyById, skuById, samplesByFamily)
    : null
  const showReadiness = fields.readiness && shotReadiness !== null && (
    shotReadiness.earliestLaunchDate !== null ||
    shotReadiness.totalRequirements > 0 ||
    shotReadiness.totalSamples > 0
  )
  const showHeroImage = fields.heroThumb && !!heroUrl && imgVisible
  const allTags = sortTagsByCategory(shot.tags ?? [])
  const productPreview = productEntries.slice(0, PRODUCT_PREVIEW_LIMIT)
  const hiddenProductCount = Math.max(0, productEntries.length - productPreview.length)
  const referenceLinkPreview = referenceLinks.slice(0, REFERENCE_LINK_PREVIEW_LIMIT)
  const hiddenReferenceLinkCount = Math.max(0, referenceLinks.length - referenceLinkPreview.length)
  const notesPreview = fields.notes ? getShotNotesPreview(shot, 320) : ""

  return (
    <Card
      className="cursor-pointer hover-lift"
      onClick={() => onOpenShot ? onOpenShot(shot.id) : navigate(`/projects/${projectId}/shots/${shot.id}`)}
    >
      <CardContent className="flex flex-col gap-2.5 px-4 py-3.5">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1 space-y-1">
            <CardTitle className="line-clamp-2 text-sm font-semibold leading-[1.3]">
              {shot.title || "Untitled Shot"}
            </CardTitle>
            {fields.shotNumber && shot.shotNumber && (
              <span className="block text-xxs text-[var(--color-text-subtle)]">
                #{shot.shotNumber}
              </span>
            )}
            {fields.description && shot.description && textPreview(shot.description) && (
              <p className="line-clamp-2 text-xxs leading-4 text-[var(--color-text-muted)]">
                {textPreview(shot.description)}
              </p>
            )}
            {fields.notes && notesPreview && (
              <div className="flex items-start gap-1 text-xxs leading-4 text-[var(--color-text-muted)]">
                <StickyNote className="mt-0.5 h-3 w-3 flex-shrink-0 text-[var(--color-text-subtle)]" />
                <NotesPreviewText
                  text={notesPreview}
                  className="line-clamp-4 min-w-0"
                  onLinkClick={(event) => event.stopPropagation()}
                />
              </div>
            )}
          </div>
          <div
            className="flex flex-shrink-0 items-center gap-1"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {leadingControl}
            {actionControl}
            <ShotStatusSelect
              shotId={shot.id}
              currentStatus={shot.status}
              shot={shot}
              disabled={false}
              compact
            />
          </div>
        </div>

        {selectable && (
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
          </div>
        )}

        {(showHeroImage || showTalentDetails || showLocationDetails || showProductsDetails || showReferenceLinksDetails || showReadiness) && (
          <div
            className={`grid gap-3.5 ${
              showHeroImage ? "grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start" : "grid-cols-1"
            }`}
          >
            {(showTalentDetails || showLocationDetails || showProductsDetails || showReferenceLinksDetails || showReadiness) && (
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
                  <MetaField
                    icon={Package}
                    label="Products"
                    title={productEntries.map((e) => `${e.label}${e.styleNumber ? ` (${e.styleNumber})` : ""}`).join("\n")}
                  >
                    <div className="space-y-1">
                      {productPreview.map((entry, index) => (
                        <div key={`${entry.label}-${index}`}>
                          <div className="truncate">{entry.label}</div>
                          {entry.styleNumber && (
                            <div className="truncate text-2xs text-[var(--color-text-subtle)]">
                              {entry.styleNumber}
                            </div>
                          )}
                        </div>
                      ))}
                      {hiddenProductCount > 0 && (
                        <div className="text-2xs text-[var(--color-text-subtle)]">
                          +{hiddenProductCount} more
                        </div>
                      )}
                    </div>
                  </MetaField>
                )}

                {showReferenceLinksDetails && (
                  <MetaField icon={Link2} label="Reference links" title={referenceLinks.map((entry) => `${entry.title} — ${entry.url}`).join("\n")}>
                    <div className="space-y-1">
                      {referenceLinkPreview.map((entry) => {
                        const Icon = getReferenceLinkIcon(entry.type)
                        return (
                          <a
                            key={entry.id}
                            href={entry.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex max-w-full items-center gap-1 hover:underline"
                            title={`${entry.title}\n${entry.url}`}
                          >
                            <Icon className="h-3 w-3 flex-shrink-0 text-[var(--color-text-subtle)]" />
                            <span className="truncate">{entry.title}</span>
                          </a>
                        )
                      })}
                      {hiddenReferenceLinkCount > 0 && (
                        <div className="text-2xs text-[var(--color-text-subtle)]">
                          +{hiddenReferenceLinkCount} more
                        </div>
                      )}
                    </div>
                  </MetaField>
                )}

                {showReadiness && shotReadiness && (
                  <div
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--color-border)] pt-2 text-2xs"
                    title={shotReadiness.heroFamilyNames.length > 0 ? `Based on: ${shotReadiness.heroFamilyNames.join(", ")}` : undefined}
                  >
                    {shotReadiness.earliestLaunchDate ? (
                      <span className={launchUrgencyClass(shotReadiness.earliestLaunchDate)}>
                        {formatLaunchDateShort(shotReadiness.earliestLaunchDate)}
                      </span>
                    ) : null}
                    {shotReadiness.activeRequirementTypes.length > 0 ? (
                      <span
                        className="text-[var(--color-status-amber-text)]"
                        title={shotReadiness.activeRequirementTypes
                          .map((k) => ASSET_TYPE_SHORT_LABELS[k] ?? k)
                          .join(", ")}
                      >
                        {shotReadiness.activeRequirementTypes
                          .slice(0, 2)
                          .map((k) => ASSET_TYPE_SHORT_LABELS[k] ?? k)
                          .join(", ")}
                        {shotReadiness.activeRequirementTypes.length > 2
                          ? ` +${shotReadiness.activeRequirementTypes.length - 2}`
                          : ""}
                      </span>
                    ) : shotReadiness.totalRequirements > 0 ? (
                      <span className="text-[var(--color-status-amber-text)]">
                        {shotReadiness.totalRequirements} req
                      </span>
                    ) : null}
                    {shotReadiness.totalSamples > 0 ? (
                      <span className={shotReadiness.arrivedSamples >= shotReadiness.totalSamples ? "text-[var(--color-status-green-text)]" : "text-[var(--color-status-amber-text)]"}>
                        {shotReadiness.arrivedSamples}/{shotReadiness.totalSamples}
                        {shotReadiness.arrivedSamples >= shotReadiness.totalSamples ? " \u2713" : ""}
                      </span>
                    ) : null}
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

        {fields.tags && allTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {allTags.map((tag) => (
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
      <p className="mb-1 flex items-center gap-1 text-3xs font-semibold uppercase tracking-[0.06em] text-[var(--color-text-subtle)]">
        <Icon className="h-3 w-3 flex-shrink-0" />
        <span>{label}</span>
      </p>
      <div className="min-w-0 text-xxs leading-4 text-[var(--color-text)]">{children}</div>
    </div>
  )
}
