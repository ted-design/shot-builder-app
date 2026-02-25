import { useState, useEffect, type ReactNode } from "react"
import { Checkbox } from "@/ui/checkbox"
import { ShotStatusSelect } from "@/features/shots/components/ShotStatusSelect"
import { formatDateOnly } from "@/features/shots/lib/dateOnly"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { textPreview } from "@/shared/lib/textPreview"
import type { Shot, ShotReferenceLinkType } from "@/shared/types"
import { type ShotsListFields, formatUpdatedAt } from "@/features/shots/lib/shotListFilters"
import { TagBadge } from "@/shared/components/TagBadge"
import {
  getShotNotesPreview,
  getShotPrimaryLookProductLabels,
  resolveIdsToNames,
} from "@/features/shots/lib/shotListSummaries"
import { NotesPreviewText } from "@/features/shots/components/NotesPreviewText"
import { Globe, Video, FileText } from "lucide-react"

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

type ShotsTableProps = {
  readonly shots: ReadonlyArray<Shot>
  readonly fields: ShotsListFields
  readonly talentNameById?: ReadonlyMap<string, string> | null
  readonly locationNameById?: ReadonlyMap<string, string> | null
  readonly showLifecycleActions?: boolean
  readonly renderLifecycleAction?: (shot: Shot) => ReactNode
  readonly selection?: {
    readonly enabled: boolean
    readonly selectedIds: ReadonlySet<string>
    readonly onToggle: (shotId: string) => void
    readonly onToggleAll: (next: ReadonlySet<string>) => void
  }
  readonly onOpenShot: (shotId: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ShotsTable({
  shots,
  fields,
  talentNameById,
  locationNameById,
  showLifecycleActions = false,
  renderLifecycleAction,
  selection,
  onOpenShot,
}: ShotsTableProps) {
  const selectionEnabled = selection?.enabled === true

  const allSelected = selectionEnabled && shots.length > 0 && shots.every((s) => selection!.selectedIds.has(s.id))
  const someSelected = selectionEnabled && shots.some((s) => selection!.selectedIds.has(s.id))

  return (
    <div className="overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
      <table className="w-full text-sm">
        <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-subtle)]">
          <tr>
            {selectionEnabled && (
              <th className="w-10 px-3 py-2 text-left">
                <Checkbox
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={(v) => {
                    if (v === "indeterminate") return
                    if (v) {
                      selection!.onToggleAll(new Set(shots.map((s) => s.id)))
                    } else {
                      selection!.onToggleAll(new Set())
                    }
                  }}
                  aria-label={allSelected ? "Deselect all shots" : "Select all shots"}
                />
              </th>
            )}
            {fields.heroThumb && <th className="w-14 px-3 py-2" />}
            <th className="min-w-[240px] px-3 py-2 text-left font-medium">Shot</th>
            {fields.date && <th className="w-32 px-3 py-2 text-left font-medium">Date</th>}
            {fields.notes && <th className="min-w-[260px] px-3 py-2 text-left font-medium">Notes</th>}
            {fields.location && <th className="min-w-[160px] px-3 py-2 text-left font-medium">Location</th>}
            {fields.products && <th className="min-w-[280px] px-3 py-2 text-left font-medium">Products</th>}
            {fields.links && <th className="min-w-[220px] px-3 py-2 text-left font-medium">Reference links</th>}
            {fields.talent && <th className="min-w-[220px] px-3 py-2 text-left font-medium">Talent</th>}
            {fields.tags && <th className="min-w-[180px] px-3 py-2 text-left font-medium">Tags</th>}
            {fields.updated && <th className="w-28 px-3 py-2 text-left font-medium">Updated</th>}
            {showLifecycleActions && <th className="w-16 px-3 py-2 text-left font-medium">Actions</th>}
            <th className="w-28 px-3 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {shots.map((shot) => (
            <ShotsTableRow
              key={shot.id}
              shot={shot}
              fields={fields}
              talentNameById={talentNameById}
              locationNameById={locationNameById}
              showLifecycleActions={showLifecycleActions}
              renderLifecycleAction={renderLifecycleAction}
              selectionEnabled={selectionEnabled}
              selected={selectionEnabled ? selection!.selectedIds.has(shot.id) : false}
              onToggle={selectionEnabled ? () => selection!.onToggle(shot.id) : undefined}
              onOpenShot={onOpenShot}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function ShotsTableRow({
  shot,
  fields,
  talentNameById,
  locationNameById,
  showLifecycleActions,
  renderLifecycleAction,
  selectionEnabled,
  selected,
  onToggle,
  onOpenShot,
}: {
  readonly shot: Shot
  readonly fields: ShotsListFields
  readonly talentNameById?: ReadonlyMap<string, string> | null
  readonly locationNameById?: ReadonlyMap<string, string> | null
  readonly showLifecycleActions: boolean
  readonly renderLifecycleAction?: (shot: Shot) => ReactNode
  readonly selectionEnabled: boolean
  readonly selected: boolean
  readonly onToggle?: () => void
  readonly onOpenShot: (shotId: string) => void
}) {
  const title = shot.title || "Untitled Shot"
  const productLabels = getShotPrimaryLookProductLabels(shot)
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
      className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)]"
      onClick={() => onOpenShot(shot.id)}
      role="row"
    >
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
      <td className="px-3 py-2">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-[var(--color-text)]">{title}</span>
          {fields.shotNumber && shot.shotNumber && (
            <span className="text-xs text-[var(--color-text-subtle)]">#{shot.shotNumber}</span>
          )}
        </div>
        {fields.description && shot.description && (
          <div className="mt-0.5 line-clamp-1 text-xs text-[var(--color-text-muted)]">
            {textPreview(shot.description)}
          </div>
        )}
      </td>
      {fields.date && (
        <td className="px-3 py-2 text-[var(--color-text-secondary)]">
          {formatDateOnly(shot.date) || "—"}
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
            "—"
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
            "—"
          )}
        </td>
      )}
      {fields.products && (
        <td className="px-3 py-2 text-[var(--color-text-secondary)]">
          {productLabels.length === 0 ? (
            "—"
          ) : (
            <div className="flex max-w-[320px] flex-col gap-0.5" title={productLabels.join("\n")}>
              {productLabels.map((label, index) => (
                <div key={`${label}-${index}`} className="truncate">
                  {label}
                </div>
              ))}
            </div>
          )}
        </td>
      )}
      {fields.links && (
        <td className="px-3 py-2 text-[var(--color-text-secondary)]">
          {referenceLinks.length === 0 ? (
            "—"
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
            "—"
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
            <span className="text-[var(--color-text-subtle)]">—</span>
          )}
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
