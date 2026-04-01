import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from "react"
import { Settings } from "lucide-react"
import { Checkbox } from "@/ui/checkbox"
import { Button } from "@/ui/button"
import { ShotStatusSelect } from "@/features/shots/components/ShotStatusSelect"
import { formatDateOnly } from "@/features/shots/lib/dateOnly"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { textPreview } from "@/shared/lib/textPreview"
import { useColumnResize } from "@/shared/hooks/useColumnResize"
import { useTableKeyboardNav } from "@/shared/hooks/useTableKeyboardNav"
import { ResizableHeader } from "@/shared/components/ResizableHeader"
import { ColumnSettingsPopover } from "@/shared/components/ColumnSettingsPopover"
import { fieldsToColumnConfigs, columnKeyToFieldKey } from "@/features/shots/lib/shotTableColumns"
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
const WIDTHS_STORAGE_KEY = "sb:shots-table-widths"

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
  readonly onFieldToggle?: (fieldKey: keyof ShotsListFields) => void
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
  onFieldToggle,
}: ShotsTableProps) {
  const selectionEnabled = selection?.enabled === true

  const allSelected = selectionEnabled && shots.length > 0 && shots.every((s) => selection!.selectedIds.has(s.id))
  const someSelected = selectionEnabled && shots.some((s) => selection!.selectedIds.has(s.id))

  // -- Column resize (separate storage from field visibility) --
  const [savedWidths, setSavedWidths] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem(WIDTHS_STORAGE_KEY) ?? "{}") as Record<string, number>
    } catch {
      return {}
    }
  })

  const handleWidthChange = useCallback((key: string, width: number) => {
    setSavedWidths((prev) => {
      const next = { ...prev, [key]: width }
      try { localStorage.setItem(WIDTHS_STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  const { startResize } = useColumnResize({ onWidthChange: handleWidthChange })

  // -- Keyboard nav --
  const tableRef = useRef<HTMLTableElement>(null)
  const { onTableKeyDown } = useTableKeyboardNav({
    tableRef,
    rowCount: shots.length,
    onActivateRow: (i) => {
      const shot = shots[i]
      if (shot) onOpenShot(shot.id)
    },
  })

  // -- Build column configs from ShotsListFields for the popover --
  const columnConfigs = useMemo(
    () => fieldsToColumnConfigs(fields, savedWidths),
    [fields, savedWidths],
  )

  const visibleConfigs = useMemo(
    () => columnConfigs.filter((c) => c.visible),
    [columnConfigs],
  )

  // Helper to look up a column's current width
  const colWidth = useCallback(
    (key: string): number => {
      const col = columnConfigs.find((c) => c.key === key)
      return col?.width ?? 120
    },
    [columnConfigs],
  )

  const handleResetWidths = useCallback(() => {
    setSavedWidths({})
    try { localStorage.removeItem(WIDTHS_STORAGE_KEY) } catch { /* ignore */ }
  }, [])

  return (
    <div className="flex flex-col gap-2">
      {/* Column settings toolbar */}
      {onFieldToggle && (
        <div className="flex justify-end">
          <ColumnSettingsPopover
            columns={columnConfigs}
            onToggleVisibility={(key) => {
              const fieldKey = columnKeyToFieldKey(key)
              if (fieldKey) onFieldToggle(fieldKey)
            }}
            onReorder={() => {}}
            showReorder={false}
            onReset={handleResetWidths}
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 px-2 text-2xs text-[var(--color-text-muted)]"
              aria-label="Column settings"
            >
              <Settings className="h-3.5 w-3.5" />
              Columns
            </Button>
          </ColumnSettingsPopover>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table
          ref={tableRef}
          tabIndex={0}
          onKeyDown={onTableKeyDown}
          className="w-full text-sm outline-none"
        >
          <colgroup>
            {selectionEnabled && <col style={{ width: 40 }} />}
            {visibleConfigs.map((c) => (
              <col key={c.key} style={{ width: c.width }} />
            ))}
            {showLifecycleActions && <col style={{ width: 64 }} />}
            <col style={{ width: 110 }} /> {/* Status column - always visible */}
          </colgroup>
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
              {fields.heroThumb && (
                <ResizableHeader
                  columnKey="heroThumb"
                  width={colWidth("heroThumb")}
                  onStartResize={startResize}
                  className="px-3 py-2"
                />
              )}
              <ResizableHeader
                columnKey="shot"
                width={colWidth("shot")}
                onStartResize={startResize}
                className="px-3 py-2 text-left font-medium"
              >
                Shot
              </ResizableHeader>
              {fields.date && (
                <ResizableHeader
                  columnKey="date"
                  width={colWidth("date")}
                  onStartResize={startResize}
                  className="px-3 py-2 text-left font-medium"
                >
                  Date
                </ResizableHeader>
              )}
              {fields.notes && (
                <ResizableHeader
                  columnKey="notes"
                  width={colWidth("notes")}
                  onStartResize={startResize}
                  className="px-3 py-2 text-left font-medium"
                >
                  Notes
                </ResizableHeader>
              )}
              {fields.location && (
                <ResizableHeader
                  columnKey="location"
                  width={colWidth("location")}
                  onStartResize={startResize}
                  className="px-3 py-2 text-left font-medium"
                >
                  Location
                </ResizableHeader>
              )}
              {fields.products && (
                <ResizableHeader
                  columnKey="products"
                  width={colWidth("products")}
                  onStartResize={startResize}
                  className="px-3 py-2 text-left font-medium"
                >
                  Products
                </ResizableHeader>
              )}
              {fields.links && (
                <ResizableHeader
                  columnKey="links"
                  width={colWidth("links")}
                  onStartResize={startResize}
                  className="px-3 py-2 text-left font-medium"
                >
                  Reference links
                </ResizableHeader>
              )}
              {fields.talent && (
                <ResizableHeader
                  columnKey="talent"
                  width={colWidth("talent")}
                  onStartResize={startResize}
                  className="px-3 py-2 text-left font-medium"
                >
                  Talent
                </ResizableHeader>
              )}
              {fields.tags && (
                <ResizableHeader
                  columnKey="tags"
                  width={colWidth("tags")}
                  onStartResize={startResize}
                  className="px-3 py-2 text-left font-medium"
                >
                  Tags
                </ResizableHeader>
              )}
              {fields.updated && (
                <ResizableHeader
                  columnKey="updated"
                  width={colWidth("updated")}
                  onStartResize={startResize}
                  className="px-3 py-2 text-left font-medium"
                >
                  Updated
                </ResizableHeader>
              )}
              {showLifecycleActions && <th className="w-16 px-3 py-2 text-left font-medium">Actions</th>}
              <th className="w-28 px-3 py-2 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {shots.map((shot, index) => (
              <ShotsTableRow
                key={shot.id}
                shot={shot}
                index={index}
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function ShotsTableRow({
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
}: {
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
      className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)] data-[active-row]:bg-[var(--color-primary)]/5"
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
          {productLabels.length === 0 ? (
            "\u2014"
          ) : (
            <div className="flex max-w-[320px] flex-col gap-0.5" title={productLabels.join("\n")}>
              {productLabels.map((label, i) => (
                <div key={`${label}-${i}`} className="truncate">
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
