import { useState, useEffect } from "react"
import { Checkbox } from "@/ui/checkbox"
import { ShotStatusSelect } from "@/features/shots/components/ShotStatusSelect"
import { formatDateOnly } from "@/features/shots/lib/dateOnly"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { textPreview } from "@/shared/lib/textPreview"
import { TagBadge } from "@/shared/components/TagBadge"
import {
  getShotNotesPreview,
  getShotPrimaryLookProductEntries,
  resolveIdsToNames,
} from "@/features/shots/lib/shotListSummaries"
import { NotesPreviewText } from "@/features/shots/components/NotesPreviewText"
import { Globe, Video, FileText, GripVertical } from "lucide-react"
import type { Shot, ShotReferenceLinkType, ProductFamily, ProductSku, ProductSample } from "@/shared/types"
import { computeShotReadiness, formatLaunchDateShort, launchUrgencyClass } from "@/features/shots/lib/shotProductReadiness"
import { type ShotsListFields, formatUpdatedAt } from "@/features/shots/lib/shotListFilters"
import { ASSET_TYPE_SHORT_LABELS } from "@/features/products/lib/assetRequirements"
import type { ReactNode, Ref, CSSProperties, HTMLAttributes } from "react"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REFERENCE_LINK_PREVIEW_LIMIT = 2

// ---------------------------------------------------------------------------
// Helpers
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
// Props
// ---------------------------------------------------------------------------

export type ShotsTableRowProps = {
  readonly shot: Shot
  readonly index: number
  readonly fields: ShotsListFields
  readonly talentNameById?: ReadonlyMap<string, string> | null
  readonly locationNameById?: ReadonlyMap<string, string> | null
  readonly showLifecycleActions: boolean
  readonly renderLifecycleAction?: (shot: Shot) => ReactNode
  readonly selectionEnabled: boolean
  readonly selected: boolean
  readonly onToggle?: () => void
  readonly onOpenShot: (shotId: string) => void
  readonly familyById?: ReadonlyMap<string, ProductFamily>
  readonly skuById?: ReadonlyMap<string, ProductSku>
  readonly samplesByFamily?: ReadonlyMap<string, ReadonlyArray<ProductSample>>
  readonly reorderEnabled?: boolean
  readonly dragHandleProps?: HTMLAttributes<HTMLButtonElement>
  readonly dragRef?: Ref<HTMLTableRowElement>
  readonly dragStyle?: CSSProperties
  readonly isDragging?: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShotsTableRow({
  shot,
  index: _index,
  fields,
  talentNameById,
  locationNameById,
  showLifecycleActions,
  renderLifecycleAction,
  selectionEnabled,
  selected,
  onToggle,
  onOpenShot,
  familyById,
  skuById,
  samplesByFamily,
  reorderEnabled,
  dragHandleProps,
  dragRef,
  dragStyle,
  isDragging,
}: ShotsTableRowProps) {
  const title = shot.title || "Untitled Shot"
  const readiness = familyById ? computeShotReadiness(shot, familyById, skuById, samplesByFamily) : null
  const productEntries = getShotPrimaryLookProductEntries(shot, familyById)
  const referenceLinks = shot.referenceLinks ?? []
  const referenceLinksPreview = referenceLinks.slice(0, REFERENCE_LINK_PREVIEW_LIMIT)
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

  return (
    <tr
      ref={dragRef}
      style={dragStyle}
      className={`border-b border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)] data-[active-row]:bg-[var(--color-primary)]/5${isDragging ? " opacity-30" : ""}`}
      onClick={() => onOpenShot(shot.id)}
      role="row"
    >
      {reorderEnabled && (
        <td className="w-9 px-1 py-2" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="flex cursor-grab items-center justify-center rounded p-1 text-[var(--color-text-subtle)] hover:text-[var(--color-text-muted)] active:cursor-grabbing"
            {...dragHandleProps}
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </td>
      )}
      {selectionEnabled && (
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected}
            onCheckedChange={(v) => {
              if (v === "indeterminate") return
              onToggle?.()
            }}
            aria-label={selected ? "Deselect shot" : "Select shot"}
          />
        </td>
      )}
      {fields.heroThumb && (
        <td className="px-3 py-2">
          <ShotHeroThumb shot={shot} alt={title} />
        </td>
      )}
      {fields.shotNumber && (
        <td className="px-2 py-2 text-center">
          <span className="text-xs font-medium tabular-nums text-[var(--color-text-subtle)]">
            {shot.shotNumber ? `#${shot.shotNumber}` : "\u2014"}
          </span>
        </td>
      )}
      <td className="px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-[var(--color-text)]">{title}</span>
        </div>
        {fields.description && shot.description && (
          <div className="mt-0.5 line-clamp-1 text-xs text-[var(--color-text-muted)]">
            {textPreview(shot.description)}
          </div>
        )}
      </td>
      {fields.date && (
        <td className="px-3 py-2 text-[var(--color-text-secondary)]">
          {formatDateOnly(shot.date) || "\u2014"}
        </td>
      )}
      {fields.notes && (
        <td className="px-3 py-2 text-[var(--color-text-secondary)]">
          {notesPreview ? (
            <div className="max-w-[420px] text-xs leading-4" title={notesPreview}>
              <NotesPreviewText
                text={notesPreview}
                className="line-clamp-3 min-w-0"
                onLinkClick={(event) => event.stopPropagation()}
              />
            </div>
          ) : (
            "\u2014"
          )}
        </td>
      )}
      {fields.location && (
        <td className="px-3 py-2 text-[var(--color-text-secondary)]">
          {resolvedLocationName ? (
            <div className="max-w-[240px] truncate" title={resolvedLocationName}>
              {resolvedLocationName}
            </div>
          ) : shot.locationId ? (
            <div className="max-w-[240px] truncate" title={shot.locationId}>
              Location selected
            </div>
          ) : (
            "\u2014"
          )}
        </td>
      )}
      {fields.products && (
        <td className="px-3 py-2 text-[var(--color-text-secondary)]">
          {productEntries.length === 0 ? (
            "\u2014"
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
          )}
        </td>
      )}
      {fields.links && (
        <td className="px-3 py-2 text-[var(--color-text-secondary)]">
          {referenceLinks.length === 0 ? (
            "\u2014"
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
          )}
        </td>
      )}
      {fields.talent && (
        <td className="px-3 py-2 text-[var(--color-text-secondary)]">
          {!hasTalent ? (
            "\u2014"
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
          )}
        </td>
      )}
      {fields.tags && (
        <td className="px-3 py-2">
          {shot.tags && shot.tags.length > 0 ? (
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
          )}
        </td>
      )}
      {fields.launch && (
        <td className="px-3 py-2 text-[var(--color-text-secondary)]" title={readiness?.heroFamilyNames.join(", ") || undefined}>
          {readiness?.earliestLaunchDate ? (
            <span className={launchUrgencyClass(readiness.earliestLaunchDate)}>
              {formatLaunchDateShort(readiness.earliestLaunchDate)}
            </span>
          ) : "\u2014"}
        </td>
      )}
      {fields.reqs && (
        <td className="px-3 py-2 text-[var(--color-text-secondary)]">
          {readiness && readiness.activeRequirementTypes.length > 0 ? (
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
            "\u2014"
          )}
        </td>
      )}
      {fields.samples && (
        <td className="px-3 py-2 text-[var(--color-text-secondary)]">
          {readiness && readiness.totalSamples > 0 ? (
            <span className={readiness.arrivedSamples >= readiness.totalSamples ? "text-[var(--color-status-green-text)]" : "text-[var(--color-status-amber-text)]"}>
              {readiness.arrivedSamples}/{readiness.totalSamples}
              {readiness.arrivedSamples >= readiness.totalSamples ? " \u2713" : ""}
            </span>
          ) : "\u2014"}
        </td>
      )}
      {fields.updated && (
        <td className="px-3 py-2 text-[var(--color-text-secondary)]">
          {formatUpdatedAt(shot)}
        </td>
      )}
      {showLifecycleActions && (
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          {renderLifecycleAction?.(shot)}
        </td>
      )}
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <ShotStatusSelect
          shotId={shot.id}
          currentStatus={shot.status}
          shot={shot}
          disabled={false}
        />
      </td>
    </tr>
  )
}
