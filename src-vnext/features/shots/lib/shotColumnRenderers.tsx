import { useState, useEffect } from "react"
import { Globe, Video, FileText } from "lucide-react"
import { TagBadge } from "@/shared/components/TagBadge"
import { NotesPreviewText } from "@/features/shots/components/NotesPreviewText"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { formatDateOnly } from "@/features/shots/lib/dateOnly"
import { textPreview } from "@/shared/lib/textPreview"
import {
  getShotNotesPreview,
  getShotPrimaryLookProductEntries,
  resolveIdsToNames,
} from "@/features/shots/lib/shotListSummaries"
import { computeShotReadiness, formatLaunchDateShort, launchUrgencyClass } from "@/features/shots/lib/shotProductReadiness"
import { formatUpdatedAt } from "@/features/shots/lib/shotListFilters"
import { getSceneColor } from "@/features/shots/lib/sceneColors"
import { ASSET_TYPE_SHORT_LABELS } from "@/features/products/lib/assetRequirements"
import type { Shot, ShotReferenceLinkType, ProductFamily, ProductSku, ProductSample, Lane } from "@/shared/types"
import type { ShotReadiness } from "@/features/shots/lib/shotProductReadiness"
import type React from "react"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REFERENCE_LINK_PREVIEW_LIMIT = 2

// ---------------------------------------------------------------------------
// Context interface — pre-computed per row
// ---------------------------------------------------------------------------

export interface ShotRowContext {
  readonly readiness: ShotReadiness | null
  readonly talentNames: readonly string[]
  readonly unknownTalentCount: number
  readonly resolvedLocationName: string | null | undefined
  readonly productEntries: ReturnType<typeof getShotPrimaryLookProductEntries>
  readonly referenceLinks: ReadonlyArray<{ id: string; url: string; title: string; type: ShotReferenceLinkType }>
  readonly notesPreview: string
  readonly title: string
  readonly hasTalent: boolean
  readonly talentTitle: string
  readonly sceneName: string | null
  readonly sceneColor: string | null
}

// ---------------------------------------------------------------------------
// Context computation — extract logic that was at the top of ShotsTableRow
// ---------------------------------------------------------------------------

export function computeShotRowContext(
  shot: Shot,
  familyById: ReadonlyMap<string, ProductFamily> | undefined,
  skuById: ReadonlyMap<string, ProductSku> | undefined,
  samplesByFamily: ReadonlyMap<string, ReadonlyArray<ProductSample>> | undefined,
  talentNameById: ReadonlyMap<string, string> | null | undefined,
  locationNameById: ReadonlyMap<string, string> | null | undefined,
  laneById?: ReadonlyMap<string, Lane> | null,
): ShotRowContext {
  const title = shot.title || "Untitled Shot"
  const readiness = familyById ? computeShotReadiness(shot, familyById, skuById, samplesByFamily) : null
  const productEntries = getShotPrimaryLookProductEntries(shot, familyById)
  const referenceLinks = (shot.referenceLinks ?? []) as ShotRowContext["referenceLinks"]
  const notesPreview = getShotNotesPreview(shot, 420)

  const talentIds = shot.talentIds ?? shot.talent
  const { names: talentNames, unknownCount: unknownTalentCount } = resolveIdsToNames(
    talentIds,
    talentNameById,
  )
  const hasTalent = talentNames.length + unknownTalentCount > 0
  const talentTitle =
    unknownTalentCount > 0
      ? `${talentNames.join("\n")}${talentNames.length > 0 ? "\n" : ""}${unknownTalentCount} unknown`
      : talentNames.join("\n")

  const resolvedLocationName =
    shot.locationName ??
    (shot.locationId ? locationNameById?.get(shot.locationId) ?? undefined : undefined)

  const lane = shot.laneId ? laneById?.get(shot.laneId) ?? null : null
  const sceneName = lane?.name ?? null
  const sceneColor = lane?.color ?? null

  return {
    readiness,
    talentNames,
    unknownTalentCount,
    resolvedLocationName,
    productEntries,
    referenceLinks,
    notesPreview,
    title,
    hasTalent,
    talentTitle,
    sceneName,
    sceneColor,
  }
}

// ---------------------------------------------------------------------------
// Hero thumb — React component (uses hook internally)
// ---------------------------------------------------------------------------

function ShotHeroThumb({
  shot,
  alt,
}: {
  readonly shot: Shot
  readonly alt: string
}) {
  const heroCandidate = shot.heroImage?.downloadURL ?? shot.heroImage?.path
  const url = useStorageUrl(heroCandidate)
  const [visible, setVisible] = useState(true)

  useEffect(() => setVisible(true), [url])

  if (!url || !visible) return null

  return (
    <img
      src={url}
      alt={alt}
      className="h-9 w-9 rounded-[var(--radius-md)] border border-[var(--color-border)] object-cover"
      onError={() => setVisible(false)}
    />
  )
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Cell renderer — one case per column key
// ---------------------------------------------------------------------------

export function renderShotCell(
  shot: Shot,
  columnKey: string,
  ctx: ShotRowContext,
): React.ReactNode {
  const { readiness, talentNames, unknownTalentCount, resolvedLocationName, productEntries, referenceLinks, notesPreview, title, hasTalent, talentTitle } = ctx
  const referenceLinksPreview = referenceLinks.slice(0, REFERENCE_LINK_PREVIEW_LIMIT)

  switch (columnKey) {
    case "heroThumb":
      return <ShotHeroThumb shot={shot} alt={title} />

    case "shotNumber":
      return (
        <span className="text-xs font-medium tabular-nums text-[var(--color-text-subtle)]">
          {shot.shotNumber ? `#${shot.shotNumber}` : "\u2014"}
        </span>
      )

    case "shot":
      return (
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-[var(--color-text)]">{title}</span>
        </div>
      )

    case "date":
      return <>{formatDateOnly(shot.date) || "\u2014"}</>

    case "notes":
      return notesPreview ? (
        <div className="max-w-[420px] text-xs leading-4" title={notesPreview}>
          <NotesPreviewText
            text={notesPreview}
            className="line-clamp-3 min-w-0"
            onLinkClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : (
        <>{"\u2014"}</>
      )

    case "location":
      return resolvedLocationName ? (
        <div className="max-w-[240px] truncate" title={resolvedLocationName}>
          {resolvedLocationName}
        </div>
      ) : shot.locationId ? (
        <div className="max-w-[240px] truncate" title={shot.locationId}>
          Location selected
        </div>
      ) : (
        <>{"\u2014"}</>
      )

    case "products":
      return productEntries.length === 0 ? (
        <>{"\u2014"}</>
      ) : (
        <div
          className="flex max-w-[320px] flex-col gap-1"
          title={productEntries.map((e) => `${e.label}${e.styleNumber ? ` (${e.styleNumber})` : ""}`).join("\n")}
        >
          {productEntries.map((entry, i) => (
            <div key={`${entry.label}-${i}`}>
              <div className="truncate">{entry.label}</div>
              {entry.styleNumber && (
                <div className="truncate text-2xs text-[var(--color-text-subtle)]">
                  {entry.styleNumber}
                </div>
              )}
            </div>
          ))}
        </div>
      )

    case "links":
      return referenceLinks.length === 0 ? (
        <>{"\u2014"}</>
      ) : (
        <div className="flex max-w-[280px] flex-col gap-0.5">
          {referenceLinksPreview.map((entry) => {
            const Icon = getReferenceLinkIcon(entry.type)
            return (
              <a
                key={entry.id}
                href={entry.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 truncate hover:underline"
                title={`${entry.title}\n${entry.url}`}
              >
                <Icon className="h-3 w-3 flex-shrink-0 text-[var(--color-text-subtle)]" />
                <span className="truncate">{entry.title}</span>
              </a>
            )
          })}
          {referenceLinks.length > referenceLinksPreview.length && (
            <span className="text-2xs text-[var(--color-text-subtle)]">
              +{referenceLinks.length - referenceLinksPreview.length} more
            </span>
          )}
        </div>
      )

    case "talent":
      return !hasTalent ? (
        <>{"\u2014"}</>
      ) : (
        <div className="flex max-w-[260px] flex-col gap-0.5" title={talentTitle || undefined}>
          {talentNames.length > 0 ? (
            <>
              {talentNames.map((name) => (
                <div key={name} className="truncate">
                  {name}
                </div>
              ))}
              {unknownTalentCount > 0 && (
                <div className="truncate text-[var(--color-text-subtle)]">
                  +{unknownTalentCount} unknown
                </div>
              )}
            </>
          ) : (
            <div className="truncate">{unknownTalentCount} selected</div>
          )}
        </div>
      )

    case "tags":
      return shot.tags && shot.tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {shot.tags.slice(0, 3).map((tag) => (
            <div key={tag.id} onClick={(e) => e.stopPropagation()}>
              <TagBadge tag={tag} />
            </div>
          ))}
          {shot.tags.length > 3 && (
            <span className="text-2xs text-[var(--color-text-subtle)]">
              +{shot.tags.length - 3}
            </span>
          )}
        </div>
      ) : (
        <span className="text-[var(--color-text-subtle)]">{"\u2014"}</span>
      )

    case "launch":
      return readiness?.earliestLaunchDate ? (
        <span className={launchUrgencyClass(readiness.earliestLaunchDate)}>
          {formatLaunchDateShort(readiness.earliestLaunchDate)}
        </span>
      ) : (
        <>{"\u2014"}</>
      )

    case "reqs":
      return readiness && readiness.activeRequirementTypes.length > 0 ? (
        <div
          className="flex flex-col gap-0.5"
          title={readiness.activeRequirementTypes
            .map((k) => ASSET_TYPE_SHORT_LABELS[k] ?? k)
            .join(", ")}
        >
          {readiness.activeRequirementTypes.slice(0, 2).map((typeKey) => (
            <span
              key={typeKey}
              className="text-2xs text-[var(--color-status-amber-text)]"
            >
              {ASSET_TYPE_SHORT_LABELS[typeKey] ?? typeKey}
            </span>
          ))}
          {readiness.activeRequirementTypes.length > 2 && (
            <span className="text-2xs text-[var(--color-text-subtle)]">
              +{readiness.activeRequirementTypes.length - 2} more
            </span>
          )}
        </div>
      ) : readiness && readiness.totalRequirements > 0 ? (
        <span className="text-[var(--color-status-amber-text)]">
          {readiness.totalRequirements} needed
        </span>
      ) : readiness && readiness.heroFamilyNames.length > 0 ? (
        <span className="text-[var(--color-status-green-text)]">{"\u2713"}</span>
      ) : (
        <>{"\u2014"}</>
      )

    case "samples":
      return readiness && readiness.totalSamples > 0 ? (
        <span
          className={
            readiness.arrivedSamples >= readiness.totalSamples
              ? "text-[var(--color-status-green-text)]"
              : "text-[var(--color-status-amber-text)]"
          }
        >
          {readiness.arrivedSamples}/{readiness.totalSamples}
          {readiness.arrivedSamples >= readiness.totalSamples ? " \u2713" : ""}
        </span>
      ) : (
        <>{"\u2014"}</>
      )

    case "updated":
      return <>{formatUpdatedAt(shot)}</>

    case "scene":
      return ctx.sceneName ? (
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: getSceneColor(ctx.sceneColor) }}
          />
          <span className="text-xs truncate">{ctx.sceneName}</span>
        </div>
      ) : (
        <span className="text-[var(--color-text-subtle)]">{"\u2014"}</span>
      )

    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Per-column td class names (exact classes from original ShotsTableRow)
// ---------------------------------------------------------------------------

export function cellClassName(columnKey: string): string {
  switch (columnKey) {
    case "heroThumb":
      return "px-3 py-2"
    case "shotNumber":
      return "px-2 py-2 text-center"
    case "shot":
      return "px-3 py-2"
    case "notes":
      return "px-3 py-2 text-[var(--color-text-secondary)]"
    case "tags":
      return "px-3 py-2"
    case "scene":
      return "px-3 py-2 cursor-pointer"
    case "launch":
      return "px-3 py-2 text-[var(--color-text-secondary)]"
    case "reqs":
      return "px-3 py-2 text-[var(--color-text-secondary)]"
    case "samples":
      return "px-3 py-2 text-[var(--color-text-secondary)]"
    default:
      // date, location, products, links, talent, updated all use this class
      return "px-3 py-2 text-[var(--color-text-secondary)]"
  }
}

// ---------------------------------------------------------------------------
// Interactive cells — need stopPropagation on the td click
// (tags contain clickable badges, links are anchors, notes has clickable URLs)
// ---------------------------------------------------------------------------

export function isInteractiveCell(columnKey: string): boolean {
  return columnKey === "tags" || columnKey === "links" || columnKey === "notes" || columnKey === "scene"
}

// ---------------------------------------------------------------------------
// Per-column td title attribute (tooltip on the td element itself)
// ---------------------------------------------------------------------------

export function cellTitle(columnKey: string, ctx: ShotRowContext): string | undefined {
  switch (columnKey) {
    case "launch":
      return ctx.readiness?.heroFamilyNames.join(", ") || undefined
    default:
      return undefined
  }
}

// ---------------------------------------------------------------------------
// Description sub-row — renders below the shot title (description field)
// ---------------------------------------------------------------------------

export function renderShotDescriptionSubrow(shot: Shot): React.ReactNode | null {
  if (!shot.description) return null
  return (
    <div className="mt-0.5 line-clamp-1 text-xs text-[var(--color-text-muted)]">
      {textPreview(shot.description)}
    </div>
  )
}
