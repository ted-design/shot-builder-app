import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { PageHeader } from "@/shared/components/PageHeader"
import { EmptyState } from "@/shared/components/EmptyState"
import { ErrorBoundary } from "@/shared/components/ErrorBoundary"
import { useShots } from "@/features/shots/hooks/useShots"
import { ShotCard } from "@/features/shots/components/ShotCard"
import { DraggableShotList } from "@/features/shots/components/DraggableShotList"
import { ShotVisualCard } from "@/features/shots/components/ShotVisualCard"
import { ShotReorderControls } from "@/features/shots/components/ShotReorderControls"
import { CreateShotDialog } from "@/features/shots/components/CreateShotDialog"
import { CreatePullFromShotsDialog } from "@/features/pulls/components/CreatePullFromShotsDialog"
import { ShotLifecycleActionsMenu } from "@/features/shots/components/ShotLifecycleActionsMenu"
import { ShotListToolbar } from "@/features/shots/components/ShotListToolbar"
import { ShotListFilterSheet } from "@/features/shots/components/ShotListFilterSheet"
import { ShotListDisplaySheet } from "@/features/shots/components/ShotListDisplaySheet"
import { ShotQuickAdd } from "@/features/shots/components/ShotQuickAdd"
import { ShotsTable } from "@/features/shots/components/ShotsTable"
import { ShotBoardView } from "@/features/shots/components/ShotBoardView"
import { updateShotWithVersion } from "@/features/shots/lib/updateShotWithVersion"
import { useShotListState } from "@/features/shots/hooks/useShotListState"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { canGeneratePulls, canManageShots } from "@/shared/lib/rbac"
import { useProjects } from "@/features/projects/hooks/useProjects"
import { useIsMobile, useIsDesktop } from "@/shared/hooks/useMediaQuery"
import { useKeyboardShortcuts } from "@/shared/hooks/useKeyboardShortcuts"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { Camera, Plus, Info, BarChart3 } from "lucide-react"
import type { Shot, ShotFirestoreStatus } from "@/shared/types"
import { SORT_LABELS, STATUS_LABELS } from "@/features/shots/lib/shotListFilters"
import { toast } from "sonner"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { backfillMissingShotDates } from "@/features/shots/lib/backfillShotDates"
import { useLocations, useTalent, useProductFamilies } from "@/features/shots/hooks/usePickerData"
import { KeyboardShortcutsDialog } from "@/features/shots/components/KeyboardShortcutsDialog"
import { ShotsShareDialog } from "@/features/shots/components/ShotsShareDialog"
import { ShotsPdfExportDialog } from "@/features/shots/components/ShotsPdfExportDialog"
import { Skeleton } from "@/ui/skeleton"
import { useStuckLoading } from "@/shared/hooks/useStuckLoading"
import { ThreePanelLayout } from "@/features/shots/components/ThreePanelLayout"

export default function ShotListPage() {
  const { data: shots, loading, error } = useShots()
  const { data: projects } = useProjects()
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
  const [mobileOptimistic, setMobileOptimistic] = useState<ReadonlyArray<Shot> | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [createPullOpen, setCreatePullOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [displayOpen, setDisplayOpen] = useState(false)
  const [repairOpen, setRepairOpen] = useState(false)
  const [repairing, setRepairing] = useState(false)

  // -- Role-based flags --
  const showCreate = canManageShots(role)
  const canReorder = canManageShots(role)
  const canBulkPull = canGeneratePulls(role) && !isMobile
  const canRepair = (role === "admin" || role === "producer") && !isMobile
  const canShare = role === "admin" || role === "producer"
  const canExport = !isMobile
  const canManageLifecycle = (role === "admin" || role === "producer") && !isMobile

  // -- Lookup maps (computed from picker data, passed to list state hook) --
  const talentNameById = useMemo(() => new Map(talentRecords.map((t) => [t.id, t.name])), [talentRecords])
  const locationNameById = useMemo(() => new Map(locationRecords.map((l) => [l.id, l.name])), [locationRecords])
  const productNameById = useMemo(() => new Map(productFamilies.map((p) => [p.id, p.styleName])), [productFamilies])

  // -- All filter / sort / view state --
  const {
    sortKey, sortDir, viewMode, groupKey, isCustomSort,
    queryParam, talentParam, locationParam, productParam,
    statusFilter, missingFilter, tagFilter,
    queryDraft, setQueryDraft,
    setSortKey, setSortDir, setViewMode, setGroupKey,
    toggleStatus, toggleMissing, toggleTag,
    setTalentFilter, setLocationFilter, setProductFilter,
    clearFilters, clearQuery,
    fields, setFields,
    displayShots, insights, hasActiveFilters, hasActiveGrouping,
    shotGroups, activeFilterBadges, tagOptions,
    storageKeyBase,
  } = useShotListState({
    shots, mobileOptimistic, clientId, projectId, talentNameById, locationNameById, productNameById,
  })

  // -- Keyboard shortcuts: 1-4 switch view mode (disabled when three-panel active) --
  useKeyboardShortcuts([
    { key: "1", handler: () => setViewMode("gallery") },
    { key: "2", handler: () => setViewMode("visual") },
    { key: "3", handler: () => setViewMode("table") },
    { key: "4", handler: () => setViewMode("board") },
    { key: "?", shift: true, handler: () => setShortcutsOpen(true) },
  ], { enabled: !threePanelActive })

  // -- Existing shot titles (duplicate detection for create dialog) --
  const existingShotTitles = useMemo(() => {
    return new Set(
      shots
        .map((entry) => entry.title?.trim())
        .filter((entry): entry is string => !!entry && entry.length > 0),
    )
  }, [shots])

  const renderLifecycleAction = (shot: Shot) => {
    if (!canManageLifecycle) return null
    return (
      <ShotLifecycleActionsMenu
        shot={shot}
        projects={projects}
        existingTitles={existingShotTitles}
      />
    )
  }

  // -- Board status change handler --
  const handleBoardStatusChange = (shotId: string, newStatus: ShotFirestoreStatus, shot: Shot) => {
    if (!clientId) return
    void updateShotWithVersion({
      clientId,
      shotId,
      patch: { status: newStatus },
      shot,
      user,
      source: "ShotBoardView",
    }).catch(() => {
      toast.error("Failed to update status")
    })
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
          breadcrumbs={[
            { label: "Projects", to: "/projects" },
            { label: projectName || "Project" },
          ]}
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
        />
      </ErrorBoundary>
    )
  }

  return (
    <ErrorBoundary>
      <PageHeader
        title="Shots"
        breadcrumbs={[
          { label: "Projects", to: "/projects" },
          { label: projectName || "Project" },
        ]}
        actions={
          <div className="flex items-center gap-2">
            {canExport && (
              <Button variant="outline" onClick={() => setExportOpen(true)}>
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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
          <div className="text-xs text-[var(--color-text-muted)]">
            {selectedIds.size} selected
          </div>
          <div className="flex items-center gap-2">
            {canShare && (
              <Button
                variant="outline"
                size="sm"
                disabled={selectedIds.size === 0}
                onClick={() => setShareOpen(true)}
              >
                Share link
              </Button>
            )}
            {canExport && (
              <Button
                variant="outline"
                size="sm"
                disabled={selectedIds.size === 0}
                onClick={() => setExportOpen(true)}
              >
                Export PDF
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
            <Button
              size="sm"
              disabled={selectedIds.size === 0}
              onClick={() => setCreatePullOpen(true)}
            >
              Create pull sheet
            </Button>
          </div>
        </div>
      )}

      {/* Toolbar: search + sort + filters + view */}
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
            groupKey={groupKey}
            onGroupKeyChange={setGroupKey}
            isMobile={isMobile}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            activeFilterCount={activeFilterBadges.length}
            onFiltersOpen={() => setFiltersOpen(true)}
            onDisplayOpen={() => setDisplayOpen(true)}
          />

          <ShotListFilterSheet
            open={filtersOpen}
            onOpenChange={setFiltersOpen}
            isMobile={isMobile}
            statusFilter={statusFilter}
            onToggleStatus={toggleStatus}
            missingFilter={missingFilter}
            onToggleMissing={toggleMissing}
            talentParam={talentParam}
            onTalentChange={setTalentFilter}
            talentRecords={talentRecords}
            locationParam={locationParam}
            onLocationChange={setLocationFilter}
            locationRecords={locationRecords}
            productParam={productParam}
            onProductChange={setProductFilter}
            productFamilies={productFamilies}
            tagFilter={tagFilter}
            onToggleTag={toggleTag}
            tagOptions={tagOptions}
            hasActiveFilters={hasActiveFilters}
            onClearFilters={clearFilters}
            canRepair={canRepair}
            onRepairOpen={() => setRepairOpen(true)}
          />

          <KeyboardShortcutsDialog
            open={shortcutsOpen}
            onOpenChange={setShortcutsOpen}
          />

          <ShotListDisplaySheet
            open={displayOpen}
            onOpenChange={setDisplayOpen}
            isMobile={isMobile}
            viewMode={viewMode}
            fields={fields}
            onFieldsChange={setFields}
          />

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

          {displayShots.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                <BarChart3 className="h-3.5 w-3.5" />
                <span>
                  Showing {displayShots.length} of {shots.length}
                </span>
              </div>

              <div className="h-4 w-px bg-[var(--color-border)]" />

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-2xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                  Status
                </span>
                {(["todo", "in_progress", "on_hold", "complete"] as const).map((s) => {
                  const count = insights.statusCounts[s] ?? 0
                  const active = statusFilter.has(s)
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => toggleStatus(s)}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition-colors ${
                        active
                          ? "border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text)]"
                          : "border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]"
                      }`}
                      aria-pressed={active}
                      title="Click to filter"
                    >
                      <span>{STATUS_LABELS[s]}</span>
                      <span className="text-[var(--color-text-subtle)]">{count}</span>
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-2xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                  Missing
                </span>
                {(["products", "talent", "location", "image"] as const).map((k) => {
                  const count = insights.missingCounts[k] ?? 0
                  const active = missingFilter.has(k)
                  const label =
                    k === "products"
                      ? "Products"
                      : k === "talent"
                        ? "Talent"
                        : k === "location"
                          ? "Location"
                          : "Image"
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggleMissing(k)}
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs transition-colors ${
                        active
                          ? "border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-text)]"
                          : "border-[var(--color-border)] bg-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]"
                      }`}
                      aria-pressed={active}
                      title="Click to filter"
                    >
                      <span>{label}</span>
                      <span className="text-[var(--color-text-subtle)]">{count}</span>
                    </button>
                  )
                })}
              </div>
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
                />
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === "board" ? (
        <>
          {hasActiveGrouping && (
            <div className="mb-3 flex items-center gap-2 rounded-md bg-[var(--color-surface-subtle)] px-3 py-2 text-xs text-[var(--color-text-subtle)]">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                Grouping is not available in Board view.{" "}
                <button
                  className="underline hover:text-[var(--color-text)]"
                  onClick={() => setGroupKey("none")}
                >
                  Clear grouping
                </button>
              </span>
            </div>
          )}
          {isCustomSort && canReorder && (
            <div className="mb-3 flex items-center gap-2 rounded-md bg-[var(--color-surface-subtle)] px-3 py-2 text-xs text-[var(--color-text-subtle)]">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                Reordering is available in Gallery view.{" "}
                <button
                  className="underline hover:text-[var(--color-text)]"
                  onClick={() => setViewMode("gallery")}
                >
                  Switch to gallery
                </button>
              </span>
            </div>
          )}
          <ShotBoardView
            shots={displayShots}
            onStatusChange={handleBoardStatusChange}
            onOpenShot={handleShotClick}
          />
        </>
      ) : viewMode === "table" ? (
        <>
          {hasActiveGrouping && (
            <div className="mb-3 flex items-center gap-2 rounded-md bg-[var(--color-surface-subtle)] px-3 py-2 text-xs text-[var(--color-text-subtle)]">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                Grouping is available in Gallery or Visual view.{" "}
                <button
                  className="underline hover:text-[var(--color-text)]"
                  onClick={() => setViewMode("gallery")}
                >
                  Switch to gallery
                </button>
              </span>
            </div>
          )}
          {isCustomSort && canReorder && (
            <div className="mb-3 flex items-center gap-2 rounded-md bg-[var(--color-surface-subtle)] px-3 py-2 text-xs text-[var(--color-text-subtle)]">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                Reordering is available in Gallery view.{" "}
                <button
                  className="underline hover:text-[var(--color-text)]"
                  onClick={() => setViewMode("gallery")}
                >
                  Switch to gallery
                </button>
              </span>
            </div>
          )}
          <ShotsTable
            shots={displayShots}
            fields={fields}
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
          />
        </>
      ) : viewMode === "visual" ? (
        <>
          {isCustomSort && canReorder && !hasActiveFilters && !hasActiveGrouping && (
            <div className="mb-3 flex items-center gap-2 rounded-md bg-[var(--color-surface-subtle)] px-3 py-2 text-xs text-[var(--color-text-subtle)]">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                Reordering is available in Gallery view.{" "}
                <button
                  className="underline hover:text-[var(--color-text)]"
                  onClick={() => setViewMode("gallery")}
                >
                  Switch to gallery
                </button>
              </span>
            </div>
          )}

          {hasActiveGrouping && shotGroups ? (
            <div className="space-y-8">
              {shotGroups.map((group) => (
                <div key={group.key} className="space-y-3">
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-2">
                    <div className="min-w-0 text-sm font-medium text-[var(--color-text)]">
                      <span className="truncate">{group.label}</span>
                    </div>
                    <span className="text-xs text-[var(--color-text-subtle)]">
                      {group.shots.length}
                    </span>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.shots.map((shot) => (
                      <ShotVisualCard
                        key={shot.id}
                        shot={shot}
                        selectable={selectionEnabled}
                        selected={selectionEnabled ? selectedIds.has(shot.id) : false}
                        onSelectedChange={() => toggleSelected(shot.id)}
                        onOpenShot={handleShotClick}
                        actionControl={renderLifecycleAction(shot)}
                        showShotNumber={fields.shotNumber}
                        showTags={fields.tags}
                        showReadiness={fields.readiness}
                        showNotes={fields.notes}
                        showLinks={fields.links}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displayShots.map((shot) => (
                <ShotVisualCard
                  key={shot.id}
                  shot={shot}
                  selectable={selectionEnabled}
                  selected={selectionEnabled ? selectedIds.has(shot.id) : false}
                  onSelectedChange={() => toggleSelected(shot.id)}
                  onOpenShot={handleShotClick}
                  actionControl={renderLifecycleAction(shot)}
                  showShotNumber={fields.shotNumber}
                  showTags={fields.tags}
                  showReadiness={fields.readiness}
                  showNotes={fields.notes}
                  showLinks={fields.links}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        hasActiveGrouping && shotGroups ? (
          <div className="space-y-8">
            {shotGroups.map((group) => (
              <div key={group.key} className="space-y-3">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-2">
                  <div className="min-w-0 text-sm font-medium text-[var(--color-text)]">
                    <span className="truncate">{group.label}</span>
                  </div>
                  <span className="text-xs text-[var(--color-text-subtle)]">
                    {group.shots.length}
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                    />
                  ))}
                </div>
              </div>
            ))}
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

      {canExport && (
        <ShotsPdfExportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          projectName={projectName || "Project"}
          shotsAll={displayShots}
          shotsSelected={selectedShots}
          talentNameById={talentNameById}
          locationNameById={locationNameById}
          storageKeyBase={storageKeyBase}
        />
      )}
    </ErrorBoundary>
  )
}
