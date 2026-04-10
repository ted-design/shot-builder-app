import { useCallback, useMemo, useRef, type ReactNode } from "react"
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
import { Settings, GripVertical } from "lucide-react"
import { Checkbox } from "@/ui/checkbox"
import { Button } from "@/ui/button"
import { useColumnResize } from "@/shared/hooks/useColumnResize"
import { useTableKeyboardNav } from "@/shared/hooks/useTableKeyboardNav"
import { useTableColumns } from "@/shared/hooks/useTableColumns"
import { ResizableHeader } from "@/shared/components/ResizableHeader"
import { ColumnSettingsPopover } from "@/shared/components/ColumnSettingsPopover"
import { ShotStatusSelect } from "@/features/shots/components/ShotStatusSelect"
import { SceneTableRow } from "@/features/shots/components/SceneTableRow"
import { SHOT_TABLE_COLUMNS } from "@/features/shots/lib/shotTableColumns"
import {
  computeShotRowContext,
  renderShotCell,
  renderShotDescriptionSubrow,
  cellClassName,
  cellTitle,
  isInteractiveCell,
} from "@/features/shots/lib/shotColumnRenderers"
import { SceneAssignPopover } from "@/features/shots/components/SceneAssignPopover"
import type { TableColumnConfig } from "@/shared/types/table"
import type { Shot, ProductFamily, ProductSku, ProductSample, Lane } from "@/shared/types"
import type { ShotGroup } from "@/features/shots/lib/shotListFilters"

// ---------------------------------------------------------------------------
// Migration from old localStorage key format
// ---------------------------------------------------------------------------

function migrateOldColumnPrefs(clientId: string, projectId: string): void {
  const oldKey = `sb:shots:list:${clientId}:${projectId}:fields:v1`
  const newKey = `sb:shots-table:${clientId}:${projectId}`
  try {
    if (globalThis.localStorage?.getItem(newKey)) return
    const oldData = globalThis.localStorage?.getItem(oldKey)
    if (!oldData) return
    const fields = JSON.parse(oldData) as Record<string, boolean>
    const migrated = SHOT_TABLE_COLUMNS.map((col) => ({
      ...col,
      visible: col.pinned ? true : (fields[col.key] ?? col.visible),
    }))
    globalThis.localStorage?.setItem(newKey, JSON.stringify(migrated))
    globalThis.localStorage?.removeItem(oldKey)
  } catch {
    // Ignore migration errors
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type ShotsTableProps = {
  readonly clientId: string | null | undefined
  readonly projectId: string
  readonly shots: ReadonlyArray<Shot>
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
  readonly familyById?: ReadonlyMap<string, ProductFamily>
  readonly skuById?: ReadonlyMap<string, ProductSku>
  readonly samplesByFamily?: ReadonlyMap<string, ReadonlyArray<ProductSample>>
  readonly reorderEnabled?: boolean
  readonly onReorder?: (reordered: ReadonlyArray<Shot>, affectedRange: { from: number; to: number }) => void
  readonly groups?: ReadonlyArray<ShotGroup> | null
  readonly collapsedScenes?: ReadonlySet<string>
  readonly onToggleSceneCollapse?: (key: string) => void
  readonly onEditScene?: (key: string) => void
  readonly onDeleteScene?: (key: string, name: string) => void
  readonly onUngroupScene?: (key: string) => void
  readonly laneById?: ReadonlyMap<string, Lane>
  readonly lanes?: ReadonlyArray<Lane>
  readonly onAssignScene?: (shotId: string, laneId: string | null) => void
}

// ---------------------------------------------------------------------------
// Row cell content helper (shared between sortable and non-sortable rows)
// ---------------------------------------------------------------------------

type RowCellsProps = {
  readonly shot: Shot
  readonly visibleColumns: readonly TableColumnConfig[]
  readonly selectionEnabled: boolean
  readonly isSelected: boolean
  readonly onToggle?: () => void
  readonly showLifecycleActions: boolean
  readonly renderLifecycleAction?: (shot: Shot) => ReactNode
  readonly onOpenShot: (shotId: string) => void
  readonly ctx: ReturnType<typeof computeShotRowContext>
  readonly stopPropagation: (e: React.MouseEvent) => void
  readonly reorderDragHandle?: ReactNode
  readonly lanes?: ReadonlyArray<Lane>
  readonly onAssignScene?: (shotId: string, laneId: string | null) => void
}

function RowCells({
  shot,
  visibleColumns,
  selectionEnabled,
  isSelected,
  onToggle,
  showLifecycleActions,
  renderLifecycleAction,
  ctx,
  stopPropagation,
  reorderDragHandle,
  lanes,
  onAssignScene,
}: RowCellsProps) {
  return (
    <>
      {reorderDragHandle !== undefined && (
        <td className="w-9 px-1 py-2" onClick={stopPropagation}>
          {reorderDragHandle}
        </td>
      )}
      {selectionEnabled && (
        <td className="px-3 py-2" onClick={stopPropagation}>
          <Checkbox
            checked={isSelected}
            onCheckedChange={(v) => {
              if (v === "indeterminate") return
              onToggle?.()
            }}
            aria-label={isSelected ? "Deselect shot" : "Select shot"}
          />
        </td>
      )}
      {visibleColumns.map((col) => {
        const content =
          col.key === "shot" ? (
            <>
              {renderShotCell(shot, col.key, ctx)}
              {renderShotDescriptionSubrow(shot)}
            </>
          ) : (
            renderShotCell(shot, col.key, ctx)
          )

        if (col.key === "scene" && lanes && onAssignScene) {
          return (
            <td
              key={col.key}
              className={cellClassName(col.key)}
              title={cellTitle(col.key, ctx)}
              onClick={stopPropagation}
            >
              <SceneAssignPopover
                shot={shot}
                lanes={lanes}
                onAssign={onAssignScene}
              >
                <button type="button" className="w-full text-left">
                  {content}
                </button>
              </SceneAssignPopover>
            </td>
          )
        }

        return (
          <td
            key={col.key}
            className={cellClassName(col.key)}
            title={cellTitle(col.key, ctx)}
            onClick={isInteractiveCell(col.key) ? stopPropagation : undefined}
          >
            {content}
          </td>
        )
      })}
      {showLifecycleActions && (
        <td className="px-3 py-2" onClick={stopPropagation}>
          {renderLifecycleAction?.(shot)}
        </td>
      )}
      <td className="px-3 py-2" onClick={stopPropagation}>
        <ShotStatusSelect
          shotId={shot.id}
          currentStatus={shot.status}
          shot={shot}
          disabled={false}
        />
      </td>
    </>
  )
}

// ---------------------------------------------------------------------------
// Sortable row (DnD)
// ---------------------------------------------------------------------------

type SortableRowProps = Omit<RowCellsProps, "reorderDragHandle"> & {
  readonly onOpenShot: (shotId: string) => void
}

function SortableRow(props: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.shot.id,
  })

  const dragHandle = (
    <button
      type="button"
      className="flex cursor-grab items-center justify-center rounded p-1 text-[var(--color-text-subtle)] hover:text-[var(--color-text-muted)] active:cursor-grabbing"
      {...(listeners as React.HTMLAttributes<HTMLButtonElement>)}
      {...(attributes as React.HTMLAttributes<HTMLButtonElement>)}
      aria-label="Drag to reorder"
    >
      <GripVertical className="h-4 w-4" />
    </button>
  )

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`border-b border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)] data-[active-row]:bg-[var(--color-primary)]/5${isDragging ? " opacity-30" : ""}`}
      onClick={() => props.onOpenShot(props.shot.id)}
    >
      <RowCells {...props} reorderDragHandle={dragHandle} />
    </tr>
  )
}

// ---------------------------------------------------------------------------
// DnD context wrapper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Group rows (scene header + shot rows)
// ---------------------------------------------------------------------------

type GroupRowsProps = {
  readonly group: ShotGroup
  readonly isCollapsed: boolean
  readonly isUngrouped: boolean
  readonly colSpan: number
  readonly contextById: ReadonlyMap<string, ReturnType<typeof computeShotRowContext>>
  readonly visibleColumns: readonly TableColumnConfig[]
  readonly selectionEnabled: boolean
  readonly selection?: ShotsTableProps["selection"]
  readonly showLifecycleActions: boolean
  readonly renderLifecycleAction?: (shot: Shot) => ReactNode
  readonly onOpenShot: (shotId: string) => void
  readonly stopPropagation: (e: React.MouseEvent) => void
  readonly onToggleCollapse: () => void
  readonly onEdit: () => void
  readonly onUngroupAll: () => void
  readonly onDelete: () => void
  readonly lanes?: ReadonlyArray<Lane>
  readonly onAssignScene?: (shotId: string, laneId: string | null) => void
}

function GroupRows({
  group,
  isCollapsed,
  isUngrouped,
  colSpan,
  contextById,
  visibleColumns,
  selectionEnabled,
  selection,
  showLifecycleActions,
  renderLifecycleAction,
  onOpenShot,
  stopPropagation,
  onToggleCollapse,
  onEdit,
  onUngroupAll,
  onDelete,
  lanes,
  onAssignScene,
}: GroupRowsProps) {
  return (
    <>
      <SceneTableRow
        label={group.label}
        sceneNumber={group.sceneNumber}
        shotCount={group.shots.length}
        color={group.color}
        direction={group.direction}
        collapsed={isCollapsed}
        onToggleCollapse={onToggleCollapse}
        onEdit={onEdit}
        onUngroupAll={onUngroupAll}
        onDelete={onDelete}
        isUngrouped={isUngrouped}
        colSpan={colSpan}
      />
      {!isCollapsed &&
        group.shots.map((shot) => {
          const ctx = contextById.get(shot.id)
          if (!ctx) return null
          const isSelected = selectionEnabled ? selection!.selectedIds.has(shot.id) : false
          const onToggle = selectionEnabled ? () => selection!.onToggle(shot.id) : undefined

          return (
            <tr
              key={shot.id}
              className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)] data-[active-row]:bg-[var(--color-primary)]/5"
              onClick={() => onOpenShot(shot.id)}
            >
              <RowCells
                shot={shot}
                visibleColumns={visibleColumns}
                selectionEnabled={selectionEnabled}
                isSelected={isSelected}
                onToggle={onToggle}
                showLifecycleActions={showLifecycleActions}
                renderLifecycleAction={renderLifecycleAction}
                onOpenShot={onOpenShot}
                ctx={ctx}
                stopPropagation={stopPropagation}
                lanes={lanes}
                onAssignScene={onAssignScene}
              />
            </tr>
          )
        })}
    </>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ShotsTable({
  clientId,
  projectId,
  shots,
  talentNameById,
  locationNameById,
  showLifecycleActions = false,
  renderLifecycleAction,
  selection,
  onOpenShot,
  familyById,
  skuById,
  samplesByFamily,
  reorderEnabled: reorderEnabledProp = false,
  onReorder,
  groups,
  collapsedScenes,
  onToggleSceneCollapse,
  onEditScene,
  onDeleteScene,
  onUngroupScene,
  laneById,
  lanes,
  onAssignScene,
}: ShotsTableProps) {
  const selectionEnabled = selection?.enabled === true

  // Auto-disable DnD reorder for large projects — @dnd-kit's sortable overhead
  // becomes noticeable past ~500 sortable items. Users can still reorder via
  // the custom sort + renumber flow.
  const REORDER_SHOT_LIMIT = 500
  const reorderEnabled = reorderEnabledProp && shots.length <= REORDER_SHOT_LIMIT

  const allSelected =
    selectionEnabled && shots.length > 0 && shots.every((s) => selection!.selectedIds.has(s.id))
  const someSelected = selectionEnabled && shots.some((s) => selection!.selectedIds.has(s.id))

  // -- Migrate old localStorage column prefs then let useTableColumns read new key --
  if (clientId && projectId) {
    migrateOldColumnPrefs(clientId, projectId)
  }
  const storageKey =
    clientId && projectId ? `shots-table:${clientId}:${projectId}` : `shots-table:${projectId}`

  // -- Column management via useTableColumns --
  const { columns, visibleColumns, setColumnWidth, toggleVisibility, reorderColumns, resetToDefaults } =
    useTableColumns(storageKey, SHOT_TABLE_COLUMNS)

  const { startResize } = useColumnResize({ onWidthChange: setColumnWidth })

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

  // -- Pre-compute row contexts (memoized) --
  const rowContexts = useMemo(
    () =>
      shots.map((shot) =>
        computeShotRowContext(shot, familyById, skuById, samplesByFamily, talentNameById, locationNameById, laneById),
      ),
    [shots, familyById, skuById, samplesByFamily, talentNameById, locationNameById, laneById],
  )

  // -- Context lookup by shot id (for grouped rendering) --
  const contextById = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeShotRowContext>>()
    for (let i = 0; i < shots.length; i++) {
      map.set(shots[i]!.id, rowContexts[i]!)
    }
    return map
  }, [shots, rowContexts])

  // -- Compute colSpan for scene header rows --
  // Scene header <tr> must span every column the data rows render. This mirrors the
  // <colgroup>/<thead> structure below:
  //   [optional drag handle] + [optional selection] + visibleColumns + [optional lifecycle] + status
  // The trailing `+ 1` accounts for the pinned status column which is NOT part of
  // `visibleColumns` (it's always rendered at the end of every row).
  const sceneColSpan = useMemo(() => {
    let count = visibleColumns.length + 1 // visibleColumns + pinned status column
    if (reorderEnabled) count += 1 // drag handle column
    if (selectionEnabled) count += 1 // selection checkbox column
    if (showLifecycleActions) count += 1 // lifecycle actions column
    return count
  }, [visibleColumns.length, reorderEnabled, selectionEnabled, showLifecycleActions])

  const hasGroups = groups != null && groups.length > 0

  const stopPropagation = useCallback((e: React.MouseEvent) => e.stopPropagation(), [])

  return (
    <div className="flex flex-col gap-2">
      {/* Column settings toolbar */}
      <div className="flex justify-end">
        <ColumnSettingsPopover
          columns={columns}
          onToggleVisibility={toggleVisibility}
          onReorder={reorderColumns}
          showReorder={true}
          onReset={resetToDefaults}
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
              {visibleColumns.map((c) => (
                <col key={c.key} style={{ width: c.width }} />
              ))}
              {showLifecycleActions && <col style={{ width: 64 }} />}
              <col style={{ width: 110 }} />
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
                {visibleColumns.map((col) => (
                  <ResizableHeader
                    key={col.key}
                    columnKey={col.key}
                    width={col.width}
                    onStartResize={startResize}
                    className={
                      col.key === "shotNumber"
                        ? "px-2 py-2 text-center font-medium"
                        : col.key === "heroThumb"
                          ? "px-3 py-2"
                          : "px-3 py-2 text-left font-medium"
                    }
                  >
                    {col.key === "links" ? "Reference links" : col.label}
                  </ResizableHeader>
                ))}
                {showLifecycleActions && (
                  <th className="w-16 px-3 py-2 text-left font-medium">Actions</th>
                )}
                <th className="w-28 px-3 py-2 text-left font-medium">Status</th>
              </tr>
            </thead>

            <tbody>
              {hasGroups ? (
                groups!.map((group) => {
                  const isCollapsed = collapsedScenes?.has(group.key) ?? false
                  const isUngrouped = group.key === "__ungrouped"

                  return (
                    <GroupRows
                      key={group.key}
                      group={group}
                      isCollapsed={isCollapsed}
                      isUngrouped={isUngrouped}
                      colSpan={sceneColSpan}
                      contextById={contextById}
                      visibleColumns={visibleColumns}
                      selectionEnabled={selectionEnabled}
                      selection={selection}
                      showLifecycleActions={showLifecycleActions}
                      renderLifecycleAction={renderLifecycleAction}
                      onOpenShot={onOpenShot}
                      stopPropagation={stopPropagation}
                      onToggleCollapse={() => onToggleSceneCollapse?.(group.key)}
                      onEdit={() => onEditScene?.(group.key)}
                      onUngroupAll={() => onUngroupScene?.(group.key)}
                      onDelete={() => onDeleteScene?.(group.key, group.label)}
                      lanes={lanes}
                      onAssignScene={onAssignScene}
                    />
                  )
                })
              ) : (
                shots.map((shot, index) => {
                  const ctx = rowContexts[index]!
                  const isSelected = selectionEnabled ? selection!.selectedIds.has(shot.id) : false
                  const onToggle = selectionEnabled ? () => selection!.onToggle(shot.id) : undefined

                  const commonCellProps = {
                    shot,
                    visibleColumns,
                    selectionEnabled,
                    isSelected,
                    onToggle,
                    showLifecycleActions,
                    renderLifecycleAction,
                    onOpenShot,
                    ctx,
                    stopPropagation,
                    lanes,
                    onAssignScene,
                  }

                  if (reorderEnabled) {
                    return (
                      <SortableRow
                        key={shot.id}
                        {...commonCellProps}
                      />
                    )
                  }

                  return (
                    <tr
                      key={shot.id}
                      className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)] data-[active-row]:bg-[var(--color-primary)]/5"
                      onClick={() => onOpenShot(shot.id)}
                    >
                      <RowCells {...commonCellProps} />
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </DndWrapper>
    </div>
  )
}
