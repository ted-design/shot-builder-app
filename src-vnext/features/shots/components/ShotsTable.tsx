import { useState, useCallback, useMemo, useRef, type ReactNode } from "react"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Settings } from "lucide-react"
import { Checkbox } from "@/ui/checkbox"
import { Button } from "@/ui/button"
import { useColumnResize } from "@/shared/hooks/useColumnResize"
import { useTableKeyboardNav } from "@/shared/hooks/useTableKeyboardNav"
import { ResizableHeader } from "@/shared/components/ResizableHeader"
import { ColumnSettingsPopover } from "@/shared/components/ColumnSettingsPopover"
import { fieldsToColumnConfigs, columnKeyToFieldKey } from "@/features/shots/lib/shotTableColumns"
import type { Shot, ProductFamily, ProductSku, ProductSample } from "@/shared/types"
import type { ShotsListFields } from "@/features/shots/lib/shotListFilters"
import { ShotsTableRow, type ShotsTableRowProps } from "@/features/shots/components/ShotsTableRow"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WIDTHS_STORAGE_KEY = "sb:shots-table-widths"

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
  readonly familyById?: ReadonlyMap<string, ProductFamily>
  readonly skuById?: ReadonlyMap<string, ProductSku>
  readonly samplesByFamily?: ReadonlyMap<string, ReadonlyArray<ProductSample>>
  readonly reorderEnabled?: boolean
  readonly onReorder?: (reordered: ReadonlyArray<Shot>, affectedRange: { from: number; to: number }) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function SortableRow(props: ShotsTableRowProps & { readonly reorderEnabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.shot.id })

  return (
    <ShotsTableRow
      {...props}
      dragRef={setNodeRef}
      dragStyle={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      dragHandleProps={{ ...listeners, ...attributes } as React.HTMLAttributes<HTMLButtonElement>}
      isDragging={isDragging}
    />
  )
}

/** Wraps children with DndContext + SortableContext when enabled, passthrough otherwise. */
function DndWrapper({
  enabled,
  sensors: dndSensors,
  items,
  onDragEnd: onEnd,
  children,
}: {
  readonly enabled: boolean
  readonly sensors: ReturnType<typeof useSensors>
  readonly items: string[]
  readonly onDragEnd: (event: DragEndEvent) => void
  readonly children: ReactNode
}) {
  if (!enabled) return <>{children}</>
  return (
    <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={onEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  )
}

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
  familyById,
  skuById,
  samplesByFamily,
  reorderEnabled = false,
  onReorder,
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

  // -- DnD sensors + handler --
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = shots.findIndex((s) => s.id === active.id)
      const newIndex = shots.findIndex((s) => s.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return
      const reordered = arrayMove([...shots], oldIndex, newIndex)
      onReorder?.(reordered, { from: oldIndex, to: newIndex })
    },
    [shots, onReorder],
  )

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

      <DndWrapper
        enabled={reorderEnabled}
        sensors={sensors}
        items={shots.map((s) => s.id)}
        onDragEnd={handleDragEnd}
      >
      <div className="overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table
          ref={tableRef}
          tabIndex={0}
          onKeyDown={onTableKeyDown}
          className="w-full text-sm outline-none"
        >
          <colgroup>
            {reorderEnabled && <col style={{ width: 36 }} />}
            {selectionEnabled && <col style={{ width: 40 }} />}
            {visibleConfigs.map((c) => (
              <col key={c.key} style={{ width: c.width }} />
            ))}
            {showLifecycleActions && <col style={{ width: 64 }} />}
            <col style={{ width: 110 }} /> {/* Status column - always visible */}
          </colgroup>
          <thead className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text-subtle)]">
            <tr>
              {reorderEnabled && <th className="w-9" />}
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
              {fields.shotNumber && (
                <ResizableHeader
                  columnKey="shotNumber"
                  width={colWidth("shotNumber")}
                  onStartResize={startResize}
                  className="px-2 py-2 text-center font-medium"
                >
                  #
                </ResizableHeader>
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
              {fields.launch && (
                <ResizableHeader
                  columnKey="launch"
                  width={colWidth("launch")}
                  onStartResize={startResize}
                  className="px-3 py-2 text-left font-medium"
                >
                  Launch
                </ResizableHeader>
              )}
              {fields.reqs && (
                <ResizableHeader
                  columnKey="reqs"
                  width={colWidth("reqs")}
                  onStartResize={startResize}
                  className="px-3 py-2 text-left font-medium"
                >
                  Reqs
                </ResizableHeader>
              )}
              {fields.samples && (
                <ResizableHeader
                  columnKey="samples"
                  width={colWidth("samples")}
                  onStartResize={startResize}
                  className="px-3 py-2 text-left font-medium"
                >
                  Samples
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
          {reorderEnabled ? (
                <tbody>
                  {shots.map((shot, index) => (
                    <SortableRow
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
                      familyById={familyById}
                      skuById={skuById}
                      samplesByFamily={samplesByFamily}
                      reorderEnabled
                    />
                  ))}
                </tbody>
          ) : (
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
                  familyById={familyById}
                  skuById={skuById}
                  samplesByFamily={samplesByFamily}
                />
              ))}
            </tbody>
          )}
        </table>
      </div>
      </DndWrapper>
    </div>
  )
}

