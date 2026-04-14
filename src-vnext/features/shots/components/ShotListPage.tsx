import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { PageHeader } from "@/shared/components/PageHeader"
import { EmptyState } from "@/shared/components/EmptyState"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { useShots } from "@/features/shots/hooks/useShots"
import { ShotCard } from "@/features/shots/components/ShotCard"
import { DraggableShotList } from "@/features/shots/components/DraggableShotList"
import { ShotReorderControls } from "@/features/shots/components/ShotReorderControls"
import { CreateShotDialog } from "@/features/shots/components/CreateShotDialog"
import { CreatePullFromShotsDialog } from "@/features/pulls/components/CreatePullFromShotsDialog"
import { ShotLifecycleActionsMenu } from "@/features/shots/components/ShotLifecycleActionsMenu"
import { ShotListToolbar } from "@/features/shots/components/ShotListToolbar"
import { ShotListFilterSheet } from "@/features/shots/components/ShotListFilterSheet"
import { ShotQuickAdd } from "@/features/shots/components/ShotQuickAdd"
import { ShotsTable } from "@/features/shots/components/ShotsTable"
import { useShotListState } from "@/features/shots/hooks/useShotListState"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { canGeneratePulls, canManageShots } from "@/shared/lib/rbac"
import { useIsMobile, useIsDesktop } from "@/shared/hooks/useMediaQuery"
import { useKeyboardShortcuts } from "@/shared/hooks/useKeyboardShortcuts"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { Camera, Plus, Info } from "lucide-react"
import type { Shot } from "@/shared/types"
import { SORT_LABELS } from "@/features/shots/lib/shotListFilters"
import { toast } from "sonner"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { backfillMissingShotDates } from "@/features/shots/lib/backfillShotDates"
import { persistShotOrder } from "@/features/shots/lib/reorderShots"
import { useLocations, useTalent, useProductFamilies } from "@/features/shots/hooks/usePickerData"
import { KeyboardShortcutsDialog } from "@/features/shots/components/KeyboardShortcutsDialog"
import { ShotsShareDialog } from "@/features/shots/components/ShotsShareDialog"
import { BulkActionBar } from "@/features/shots/components/BulkActionBar"
import { BulkDeleteShotsDialog } from "@/features/shots/components/BulkDeleteShotsDialog"
import { RenumberShotsDialog } from "@/features/shots/components/RenumberShotsDialog"
import { useHeroProductData } from "@/features/shots/hooks/useHeroProductData"
import { useLanes } from "@/features/shots/hooks/useLanes"
import { SceneHeader } from "@/features/shots/components/SceneHeader"
import { SceneDetailSheet } from "@/features/shots/components/SceneDetailSheet"
import { GroupIntoSceneDialog } from "@/features/shots/components/GroupIntoSceneDialog"
import { createLane, assignShotsToLane, ungroupAllShotsFromLane, deleteLane } from "@/features/shots/lib/laneActions"
import { Skeleton } from "@/ui/skeleton"
import { useStuckLoading } from "@/shared/hooks/useStuckLoading"
import { ThreePanelLayout } from "@/features/shots/components/ThreePanelLayout"

export default function ShotListPage() {
  const { data: shots, loading, error } = useShots()
  const { role, clientId, user } = useAuth()
  const { projectId, projectName } = useProjectScope()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const isDesktop = useIsDesktop()
  const { data: talentRecords } = useTalent()
  const { data: locationRecords } = useLocations()
  const { data: productFamilies } = useProductFamilies()

  // -- Three-panel state (desktop only) --
  const [selectedShotId, setSelectedShotId] = useState<string | null>(null)
  const threePanelActive = isDesktop && selectedShotId !== null

  const handleShotClick = useCallback((shotId: string) => {
    if (isDesktop) {
      setSelectedShotId(shotId)
    } else {
      navigate(`/projects/${projectId}/shots/${shotId}`)
    }
  }, [isDesktop, navigate, projectId])

  // -- FAB integration: ?create=1 opens the dialog --
  const [searchParams, setSearchParamsFab] = useSearchParams()
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    if (searchParams.get("create") === "1") {
      setCreateOpen(true)
      setSearchParamsFab((prev) => {
        const next = new URLSearchParams(prev)
        next.delete("create")
        return next
      }, { replace: true })
    }
  }, [searchParams, setSearchParamsFab])

  // -- Dialog state --
  const [reorderOptimistic, setMobileOptimistic] = useState<ReadonlyArray<Shot> | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [createPullOpen, setCreatePullOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [repairOpen, setRepairOpen] = useState(false)
  const [repairing, setRepairing] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [renumberOpen, setRenumberOpen] = useState(false)
  const [groupSceneOpen, setGroupSceneOpen] = useState(false)
  const [deleteSceneTarget, setDeleteSceneTarget] = useState<{ id: string; name: string } | null>(null)
  const [editSceneId, setEditSceneId] = useState<string | null>(null)
  const [collapsedScenes, setCollapsedScenes] = useState<ReadonlySet<string>>(new Set())

  // Scene shot count for the open SceneDetailSheet — memoized so we don't re-filter
  // the shots array on every render while the sheet is open.
  const editSceneShotCount = useMemo(
    () => (editSceneId ? shots.filter((s) => s.laneId === editSceneId).length : 0),
    [editSceneId, shots],
  )

  const toggleSceneCollapse = useCallback((key: string) => {
    setCollapsedScenes((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // -- Role-based flags --
  const showCreate = canManageShots(role)
  const canReorder = canManageShots(role)
  const canBulkPull = canGeneratePulls(role) && !isMobile
  const canRepair = (role === "admin" || role === "producer") && !isMobile
  const canShare = role === "admin" || role === "producer"
  const canExport = !isMobile
  const canManageLifecycle = (role === "admin" || role === "producer") && !isMobile
  // Scene/lane writes (edit, delete, ungroup) are gated to admin/producer/warehouse
  // to match the Firestore rule on /lanes. Crew users see the scene grouping UI
  // read-only — no kebab menu, no edit sheet access from the table header.
  const canManageLanes = role === "admin" || role === "producer" || role === "warehouse"

  // -- Lookup maps (computed from picker data, passed to list state hook) --
  const talentNameById = useMemo(() => new Map(talentRecords.map((t) => [t.id, t.name])), [talentRecords])
  const locationNameById = useMemo(() => new Map(locationRecords.map((l) => [l.id, l.name])), [locationRecords])
  const productNameById = useMemo(() => new Map(productFamilies.map((p) => [p.id, p.styleName])), [productFamilies])
  const familyById = useMemo(() => new Map(productFamilies.map((p) => [p.id, p])), [productFamilies])
  const { skuById, samplesByFamily } = useHeroProductData(shots, clientId)
  const { data: lanes, laneNameById, laneById } = useLanes()
  const laneOrder = useMemo(() => new Map(lanes.map((l) => [l.id, l.sortOrder])), [lanes])

  // -- All filter / sort / view state --
  const {
    sortKey, sortDir, viewMode, groupKey, isCustomSort,
    queryParam, talentParam, locationParam, productParam,
    statusFilter, missingFilter, tagFilter,
    conditions, addCondition, removeCondition, updateCondition,
    queryDraft, setQueryDraft,
    setSortKey, setSortDir, setViewMode, setGroupKey,
    toggleStatus, clearStatusFilter, toggleMissing, toggleTag,
    setTalentFilter, setLocationFilter, setProductFilter,
    clearFilters, clearQuery,
    fields, setFields,
    displayShots, insights, hasActiveFilters, hasActiveGrouping,
    shotGroups, activeFilterBadges, tagOptions,
    storageKeyBase,
  } = useShotListState({
    shots, reorderOptimistic, clientId, projectId, talentNameById, locationNameById, productNameById, familyById, skuById, laneNameById, laneOrder, laneById,
  })

  // -- Extra (advanced) filter count: conditions beyond status/missing inline filters --
  const extraFilterCount = useMemo(
    () => conditions.filter((c) => c.field !== "status" && c.field !== "missing").length,
    [conditions],
  )

  // -- Keyboard shortcuts: 1-2 switch view mode (disabled when three-panel active) --
  useKeyboardShortcuts([
    { key: "1", handler: () => setViewMode("card") },
    { key: "2", handler: () => setViewMode("table") },
    { key: "?", shift: true, handler: () => setShortcutsOpen(true) },
  ], { enabled: !threePanelActive })

  const renderLifecycleAction = (shot: Shot) => {
    if (!canManageLifecycle) return null
    return <ShotLifecycleActionsMenu shot={shot} />
  }

  // -- Selection --
  const selectionEnabled = selectionMode && canBulkPull

  const visibleShotIds = useMemo(() => new Set(displayShots.map((s) => s.id)), [displayShots])

  useEffect(() => {
    if (!selectionEnabled) return
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev
      const next = new Set<string>()
      for (const id of prev) {
        if (visibleShotIds.has(id)) next.add(id)
      }
      return next.size === prev.size ? prev : next
    })
  }, [selectionEnabled, visibleShotIds])

  const toggleSelected = (shotId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(shotId)) next.delete(shotId)
      else next.add(shotId)
      return next
    })
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    setSelectionMode(false)
  }

  const selectedShots = useMemo(() => {
    if (!selectionEnabled || selectedIds.size === 0) return []
    return displayShots.filter((s) => selectedIds.has(s.id))
  }, [displayShots, selectedIds, selectionEnabled])

  // -- Loading / error states --
  const stuck = useStuckLoading(loading)

  if (loading) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Shots"
        />

        <div className="flex flex-wrap items-center gap-2">
          <Skeleton className="h-9 w-full sm:w-[260px]" />
          <Skeleton className="h-9 w-[160px]" />
          <Skeleton className="h-9 w-9" />
          <Skeleton className="h-9 w-[110px]" />
          <Skeleton className="h-9 w-[110px]" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <Skeleton key={idx} className="h-[170px] rounded-lg" />
          ))}
        </div>

        {stuck && (
          <div className="flex flex-col items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              This is taking longer than expected…
            </p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Reload
            </Button>
          </div>
        )}
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-8 text-center">
        {error.isMissingIndex ? (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-[var(--color-text-muted)]">
              {error.message}
            </p>
            {import.meta.env.DEV && error.indexUrl && (
              <a
                href={error.indexUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--color-text-subtle)] underline"
              >
                Create index in Firebase Console
              </a>
            )}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-error)]">{error.message}</p>
        )}
      </div>
    )
  }

  // -- Three-panel layout (desktop with selected shot) --
  if (threePanelActive) {
    return (
      <ErrorBoundary>
        <ThreePanelLayout
          selectedShotId={selectedShotId}
          shots={displayShots}
          allShots={shots}
          showCreate={showCreate}
          onDeselect={() => setSelectedShotId(null)}
          onSelectShot={setSelectedShotId}
          onShotCreated={(shotId, title) => {
            toast.success("Shot created", { description: title })
          }}
          lanes={lanes}
          laneById={laneById}
        />
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <PageHeader
        title="Shots"
        actions={
          <div className="flex items-center gap-2">
            {canExport && (
              <Button variant="outline" onClick={() => navigate(`/projects/${projectId}/export?preset=shot-list`)}>
                Export
              </Button>
            )}
            {canShare && (
              <Button variant="outline" onClick={() => setShareOpen(true)}>
                Share
              </Button>
            )}
            {canBulkPull && (
              <Button
                variant={selectionEnabled ? "default" : "outline"}
                onClick={() => {
                  if (selectionEnabled) {
                    clearSelection()
                  } else {
                    setSelectionMode(true)
                  }
                }}
              >
                {selectionEnabled ? "Done" : "Select"}
              </Button>
            )}
            {showCreate ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New Shot
              </Button>
            ) : null}
          </div>
        }
      />

      {/* Bulk action bar (desktop only) */}
      {selectionEnabled && (
        <BulkActionBar
          displayShots={displayShots}
          selectedIds={selectedIds}
          onSelectAll={() => setSelectedIds(new Set(displayShots.map(s => s.id)))}
          onDeselectAll={() => setSelectedIds(new Set())}
          clientId={clientId}
          user={user}
          role={role}
          onShareOpen={() => setShareOpen(true)}
          onGroupSceneOpen={() => setGroupSceneOpen(true)}
          onExportClick={() => navigate(`/projects/${projectId}/export?preset=shot-list`)}
          onCreatePullOpen={() => setCreatePullOpen(true)}
          onBulkDeleteOpen={() => setBulkDeleteOpen(true)}
          onClearSelection={clearSelection}
          canShare={canShare}
          canExport={canExport}
          locations={locationRecords}
          talent={talentRecords}
        />
      )}

      {/* Toolbar: search + sort + inline filters + view */}
      {shots.length > 0 && (
        <>
          <ShotListToolbar
            queryDraft={queryDraft}
            onQueryDraftChange={setQueryDraft}
            onClearQuery={clearQuery}
            sortKey={sortKey}
            onSortKeyChange={setSortKey}
            sortDir={sortDir}
            onSortDirToggle={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
            isCustomSort={isCustomSort}
            isMobile={isMobile}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            insights={insights}
            statusFilter={statusFilter}
            toggleStatus={toggleStatus}
            clearStatusFilter={clearStatusFilter}
            canReorder={canReorder}
            hasActiveFilters={hasActiveFilters}
            onRenumberOpen={() => setRenumberOpen(true)}
            extraFilterCount={extraFilterCount}
            onMoreFiltersOpen={() => setFiltersOpen(true)}
            groupKey={groupKey}
            onGroupKeyChange={setGroupKey}
            hasScenes={lanes.length > 0}
            displayCount={displayShots.length}
            totalCount={shots.length}
          />

          {/* Advanced filters sheet (tag, talent, location, product, date range, etc.) */}
          <ShotListFilterSheet
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            isMobile={isMobile}
            conditions={conditions}
            onAddCondition={addCondition}
            onUpdateCondition={updateCondition}
            onRemoveCondition={removeCondition}
            tagOptions={tagOptions}
            talentRecords={talentRecords}
            locationRecords={locationRecords}
            productFamilies={productFamilies}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            canRepair={canRepair}
            onRepairOpen={() => setRepairOpen(true)}
          />

          <KeyboardShortcutsDialog
            open={shortcutsOpen}
            onOpenChange={setShortcutsOpen}
          />

          {/* Active filter badges (removable chips) */}
          {activeFilterBadges.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              {activeFilterBadges.map((b) => (
                <Badge
                  key={b.key}
                  variant="secondary"
                  className="cursor-pointer"
                  onClick={b.onRemove}
                  title="Click to remove"
                >
                  {b.label} &times;
                </Badge>
              ))}
            </div>
          )}

          {isCustomSort && canReorder && (hasActiveFilters || hasActiveGrouping) && (
            <div className="mb-4 flex items-center gap-2 rounded-md bg-[var(--color-surface-subtle)] px-3 py-2 text-xs text-[var(--color-text-subtle)]">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                Reordering is disabled while{" "}
                {hasActiveFilters && hasActiveGrouping ? "search/filters or grouping are active." : hasActiveFilters ? "search/filters are active." : "grouping is active."}{" "}
                {hasActiveFilters && (
                  <button
                    className="underline hover:text-[var(--color-text)]"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </button>
                )}
                {hasActiveFilters && hasActiveGrouping ? " or " : null}
                {hasActiveGrouping && (
                  <button
                    className="underline hover:text-[var(--color-text)]"
                    onClick={() => setGroupKey("none")}
                  >
                    Clear grouping
                  </button>
                )}
              </span>
            </div>
          )}
        </>
      )}

      {/* Quick-add inline input */}
      {showCreate && shots.length > 0 && (
        <ShotQuickAdd
          shots={shots}
          onCreated={(shotId, title) => {
            const q = queryParam.trim().toLowerCase()
            const hiddenByQuery = q.length > 0 && !title.toLowerCase().includes(q)
            const hiddenByStatus = statusFilter.size > 0 && !statusFilter.has("todo")

            if (hiddenByStatus || hiddenByQuery) {
              toast("Shot created — may be hidden by current filters", {
                description: title,
                action: {
                  label: "Show shot",
                  onClick: () => {
                    clearFilters()
                    navigate(`/projects/${projectId}/shots/${shotId}`)
                  },
                },
              })
              return
            }

            toast.success("Shot created", {
              description: title,
              action: {
                label: "Open",
                onClick: () => navigate(`/projects/${projectId}/shots/${shotId}`),
              },
            })
          }}
        />
      )}

      {/* Sort override banner */}
      {!isCustomSort && shots.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-[var(--color-surface-subtle)] px-3 py-2 text-xs text-[var(--color-text-subtle)]">
          <Info className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            Sorted by {SORT_LABELS[sortKey]} — custom order is overridden.{" "}
            <button
              className="underline hover:text-[var(--color-text)]"
              onClick={() => setSortKey("custom")}
            >
              Restore custom order
            </button>
          </span>
        </div>
      )}

      {shots.length === 0 ? (
        <EmptyState
          icon={<Camera className="h-12 w-12" />}
          title="No shots yet"
          description="Create your first shot to start building your project."
          actionLabel={showCreate ? "Create Shot" : undefined}
          onAction={showCreate ? () => setCreateOpen(true) : undefined}
        />
      ) : displayShots.length === 0 ? (
        <EmptyState
          icon={<Camera className="h-12 w-12" />}
          title="No matching shots"
          description="Try adjusting your search, filters, or sort."
          actionLabel={hasActiveFilters ? "Clear filters" : undefined}
          onAction={hasActiveFilters ? clearFilters : undefined}
        />
      ) : isMobile ? (
        /* Mobile: card list with up/down controls when custom sort */
        <div className="grid gap-4">
          {displayShots.map((shot, index) => (
            <div key={shot.id} className="flex items-start gap-2">
              {isCustomSort && canReorder && !hasActiveFilters && (
                <ShotReorderControls
                  shot={shot}
                  shots={displayShots}
                  index={index}
                  onOptimisticReorder={setMobileOptimistic}
                  onReorderComplete={() => setMobileOptimistic(null)}
                />
              )}
              <div className="flex-1">
                <ShotCard
                  shot={shot}
                  onOpenShot={handleShotClick}
                  visibleFields={fields}
                  actionControl={renderLifecycleAction(shot)}
                  talentNameById={talentNameById}
                  locationNameById={locationNameById}
                  familyById={familyById}
                  skuById={skuById}
                  samplesByFamily={samplesByFamily}
                />
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === "table" ? (
          <ShotsTable
            clientId={clientId}
            projectId={projectId}
            shots={displayShots}
            talentNameById={talentNameById}
            locationNameById={locationNameById}
            showLifecycleActions={canManageLifecycle}
            renderLifecycleAction={renderLifecycleAction}
            selection={
              selectionEnabled
                ? { enabled: true, selectedIds, onToggle: toggleSelected, onToggleAll: (next) => setSelectedIds(next) }
                : undefined
            }
            onOpenShot={handleShotClick}
            familyById={familyById}
            skuById={skuById}
            samplesByFamily={samplesByFamily}
            reorderEnabled={isCustomSort && canReorder && !hasActiveFilters && !hasActiveGrouping}
            onReorder={(reordered, range) => {
              setMobileOptimistic(reordered)
              persistShotOrder(reordered, clientId!, range)
                .catch(() => toast.error("Failed to save shot order."))
                .finally(() => setMobileOptimistic(null))
            }}
            laneById={laneById}
            lanes={lanes}
            onAssignScene={(shotId, laneId) => {
              if (!clientId) return
              void assignShotsToLane({ shotIds: [shotId], laneId, projectId, clientId })
                .then(() => {
                  if (laneId) {
                    const laneName = laneNameById.get(laneId) ?? "scene"
                    toast.success(`Shot moved to ${laneName}`)
                  } else {
                    toast.success("Shot removed from scene")
                  }
                })
                .catch(() => toast.error("Failed to assign scene"))
            }}
            groups={hasActiveGrouping ? shotGroups : null}
            collapsedScenes={collapsedScenes}
            onToggleSceneCollapse={toggleSceneCollapse}
            canManageLanes={canManageLanes}
            onEditScene={canManageLanes ? (key) => setEditSceneId(key) : undefined}
            onDeleteScene={canManageLanes ? (key, name) => {
              setDeleteSceneTarget({ id: key, name })
            } : undefined}
            onUngroupScene={canManageLanes ? (key) => {
              if (clientId) {
                void ungroupAllShotsFromLane({ shots, laneId: key, projectId, clientId })
                  .then((n) => toast.success(`${n} shots ungrouped`))
                  .catch(() => toast.error("Failed to ungroup scene"))
              }
            } : undefined}
          />
      ) : (
        hasActiveGrouping && shotGroups ? (
          <div className="space-y-4">
            {shotGroups.map((group) => {
              const isScene = groupKey === "scene"
              const isCollapsed = collapsedScenes.has(group.key)
              const isUngrouped = group.key === "__ungrouped"
              const lane = isScene ? lanes.find((l) => l.id === group.key) : null

              return (
                <div key={group.key} className={isScene ? "rounded-md border border-[var(--color-border)] overflow-hidden" : "space-y-3"}>
                  {isScene ? (
                    <SceneHeader
                      name={group.label}
                      shotCount={group.shots.length}
                      color={lane?.color}
                      sceneNumber={lane?.sceneNumber}
                      direction={lane?.direction}
                      collapsed={isCollapsed}
                      onToggleCollapse={() => toggleSceneCollapse(group.key)}
                      canManageLanes={canManageLanes}
                      onEdit={canManageLanes ? () => setEditSceneId(group.key) : undefined}
                      onUngroupAll={canManageLanes ? () => {
                        if (clientId) {
                          void ungroupAllShotsFromLane({ shots, laneId: group.key, projectId, clientId })
                            .then((n) => toast.success(`${n} shots ungrouped`))
                            .catch(() => toast.error("Failed to ungroup scene"))
                        }
                      } : undefined}
                      onDelete={canManageLanes ? () => {
                        setDeleteSceneTarget({ id: group.key, name: group.label })
                      } : undefined}
                      isUngrouped={isUngrouped}
                    />
                  ) : (
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-2">
                      <div className="min-w-0 text-sm font-medium text-[var(--color-text)]">
                        <span className="truncate">{group.label}</span>
                      </div>
                      <span className="text-xs text-[var(--color-text-subtle)]">
                        {group.shots.length}
                      </span>
                    </div>
                  )}
                  {!(isScene && isCollapsed) && (
                    <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${isScene ? "p-3" : ""}`}>
                      {group.shots.map((shot) => (
                        <ShotCard
                          key={shot.id}
                          shot={shot}
                          selectable={selectionEnabled}
                          selected={selectionEnabled ? selectedIds.has(shot.id) : false}
                          onSelectedChange={() => toggleSelected(shot.id)}
                          onOpenShot={handleShotClick}
                          visibleFields={fields}
                          actionControl={renderLifecycleAction(shot)}
                          talentNameById={talentNameById}
                          locationNameById={locationNameById}
                          familyById={familyById}
                          skuById={skuById}
                          samplesByFamily={samplesByFamily}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          /* Desktop: draggable when custom sort, plain grid otherwise */
          <DraggableShotList
            shots={displayShots}
            disabled={!isCustomSort || !canReorder || hasActiveFilters || hasActiveGrouping}
            visibleFields={fields}
            actionControl={renderLifecycleAction}
            onOpenShot={handleShotClick}
            talentNameById={talentNameById}
            locationNameById={locationNameById}
            familyById={familyById}
            skuById={skuById}
            samplesByFamily={samplesByFamily}
            selection={
              selectionEnabled
                ? { enabled: true, selectedIds, onToggle: toggleSelected }
                : undefined
            }
          />
        )
      )}

      {showCreate && (
        <CreateShotDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          shots={shots}
          onCreated={(shotId, title) => {
            const q = queryParam.trim().toLowerCase()
            const hiddenByQuery = q.length > 0 && !title.toLowerCase().includes(q)
            const hiddenByStatus = statusFilter.size > 0 && !statusFilter.has("todo")
            const maybeHiddenByOtherFilters =
              talentParam.trim().length > 0 ||
              locationParam.trim().length > 0 ||
              tagFilter.size > 0

            if (hiddenByStatus || hiddenByQuery || maybeHiddenByOtherFilters) {
              toast("Shot created — may be hidden by current filters", {
                description: title,
                action: {
                  label: "Show shot",
                  onClick: () => {
                    clearFilters()
                    navigate(`/projects/${projectId}/shots/${shotId}`)
                  },
                },
              })
              return
            }

            toast.success("Shot created", {
              description: title,
              action: {
                label: "Open",
                onClick: () => navigate(`/projects/${projectId}/shots/${shotId}`),
              },
            })
          }}
        />
      )}

      <CreatePullFromShotsDialog
        open={createPullOpen}
        onOpenChange={setCreatePullOpen}
        shots={selectedShots}
        onCreated={(pullId) => {
          clearSelection()
          navigate(`/projects/${projectId}/pulls/${pullId}`)
        }}
      />

      <ConfirmDialog
        open={repairOpen}
        onOpenChange={(next) => {
          if (!repairing) setRepairOpen(next)
        }}
        title="Repair missing shot dates?"
        description="This updates older shots missing list-required fields so they reappear in the shot list. Safe: sets date to empty (null) and deleted to false only when missing."
        confirmLabel={repairing ? "Repairing…" : "Repair"}
        destructive={false}
        closeOnConfirm={false}
        confirmDisabled={repairing}
        cancelDisabled={repairing}
        onConfirm={() => {
          if (!clientId) {
            toast.error("Repair failed", { description: "Missing clientId." })
            return
          }
          setRepairing(true)
          void backfillMissingShotDates({
            clientId,
            projectId,
            updatedBy: user?.uid ?? null,
          })
            .then(({ scanned, updated }) => {
              toast.success("Repair complete", {
                description:
                  updated > 0
                    ? `Updated ${updated} of ${scanned} shots.`
                    : `No shots needed repair (${scanned} scanned).`,
              })
            })
            .catch((err) => {
              toast.error("Repair failed", {
                description: err instanceof Error ? err.message : "Unknown error",
              })
            })
            .finally(() => {
              setRepairing(false)
              setRepairOpen(false)
            })
        }}
      />

      <BulkDeleteShotsDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        selectedIds={selectedIds}
        clientId={clientId}
        user={user}
        onDeleted={clearSelection}
      />

      <RenumberShotsDialog
        open={renumberOpen}
        onOpenChange={setRenumberOpen}
        shots={displayShots}
        clientId={clientId}
        sortKey={sortKey}
        sortDir={sortDir}
        totalShotCount={shots.length}
        allShots={shots}
        lanes={lanes}
        groupKey={groupKey}
      />

      {canShare && (
        <ShotsShareDialog
          open={shareOpen}
          onOpenChange={setShareOpen}
          clientId={clientId}
          projectId={projectId}
          projectName={projectName || "Project"}
          user={user}
          selectedShotIds={selectedShots.map((s) => s.id)}
        />
      )}

      <ConfirmDialog
        open={deleteSceneTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteSceneTarget(null) }}
        title={`Delete scene "${deleteSceneTarget?.name ?? ""}"?`}
        description="All shots in this scene will be ungrouped. This cannot be undone."
        confirmLabel="Delete Scene"
        destructive
        onConfirm={() => {
          if (clientId && deleteSceneTarget) {
            void ungroupAllShotsFromLane({ shots, laneId: deleteSceneTarget.id, projectId, clientId })
              .then(() => deleteLane({ laneId: deleteSceneTarget.id, projectId, clientId }))
              .then(() => toast.success(`Scene "${deleteSceneTarget.name}" deleted`))
            setDeleteSceneTarget(null)
          }
        }}
      />

      <GroupIntoSceneDialog
        open={groupSceneOpen}
        onOpenChange={setGroupSceneOpen}
        selectedShotIds={Array.from(selectedIds)}
        existingLanes={lanes.map((l) => ({
          id: l.id,
          name: l.name,
          color: l.color,
          shotCount: displayShots.filter((s) => s.laneId === l.id).length,
        }))}
        onCreateAndAssign={async (name, color) => {
          if (!clientId) return
          const laneId = await createLane({ name, projectId, clientId, sortOrder: lanes.length, color, user, existingLanes: lanes })
          await assignShotsToLane({ shotIds: Array.from(selectedIds), laneId, projectId, clientId })
          toast.success(`Scene "${name}" created with ${selectedIds.size} shots`)
          clearSelection()
          setGroupKey("scene")
        }}
        onAssignToExisting={async (laneId) => {
          if (!clientId) return
          await assignShotsToLane({ shotIds: Array.from(selectedIds), laneId, projectId, clientId })
          const laneName = laneNameById.get(laneId) ?? "scene"
          toast.success(`${selectedIds.size} shots added to "${laneName}"`)
          clearSelection()
          setGroupKey("scene")
        }}
      />

      <SceneDetailSheet
        open={editSceneId !== null}
        onOpenChange={(open) => { if (!open) setEditSceneId(null) }}
        lane={editSceneId ? laneById.get(editSceneId) ?? null : null}
        projectId={projectId}
        clientId={clientId}
        shotCount={editSceneShotCount}
        siblingLanes={lanes}
      />

    </ErrorBoundary>
  )
}
