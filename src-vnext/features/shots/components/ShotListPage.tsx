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
import { ShotQuickAdd } from "@/features/shots/components/ShotQuickAdd"
import { ShootShotList } from "@/features/shots/components/ShootShotList"
import { ShotsTable, REORDER_SHOT_LIMIT } from "@/features/shots/components/ShotsTable"
import { resolveReorderDisabledReason } from "@/features/shots/components/DisabledDragHandle"
import { useShotListState } from "@/features/shots/hooks/useShotListState"
import { useResolvedSurface } from "@/features/shots/hooks/useResolvedSurface"
import type { SurfaceDevice } from "@/features/shots/lib/resolveSurface"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { useEffectiveRole } from "@/shared/hooks/useEffectiveRole"
import { EffectiveRoleChip } from "@/shared/components/EffectiveRoleChip"
import { canEditScene, canGeneratePulls, canManageShots } from "@/shared/lib/rbac"
import { shotWriteErrorDescription } from "@/features/shots/lib/shotWriteError"
import { isFeatureEnabled } from "@/shared/lib/flags"
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
import { ShotMergeWizard } from "@/features/shots/components/ShotMergeWizard"
import { createLane, assignShotsToLane, ungroupAllShotsFromLane, deleteLane } from "@/features/shots/lib/laneActions"
import { writeShotListNavOrder } from "@/features/shots/lib/shotListNavOrder"
import { Skeleton } from "@/ui/skeleton"
import { useStuckLoading } from "@/shared/hooks/useStuckLoading"

export default function ShotListPage() {
  const { data: shots, loading, error } = useShots()
  const { role: globalRole, clientId, user, loading: authLoading } = useAuth()
  // 5b effective role: the project members doc WINS over the global claim
  // (locked Q5/Q6) for the shots-surface write affordances below. `resolving`
  // is true only during the first uncached member read for this project.
  const { role, resolving: roleResolving } = useEffectiveRole()
  const { projectId, projectName } = useProjectScope()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const isDesktop = useIsDesktop()
  // 5e-I: resolved-surface affordances replace ONLY the device terms of the
  // flags below (resolveSurface output is presentation-only by law) — every
  // role/rbac term stays here. null while auth/role resolve.
  // 5e-II adds `surface` + `chrome`: the Shoot list shell mounts off the
  // RESOLVED surface (same fork idiom as ShotDetailPageUnified), and chrome
  // drives the toolbar/quick-add decisions below.
  const { surface, affordances, chrome } = useResolvedSurface()
  const { data: talentRecords } = useTalent()
  const { data: locationRecords } = useLocations()
  const { data: productFamilies } = useProductFamilies()

  // -- FAB integration: ?create=1 opens the dialog (consume effect lives
  // below the role-flags block — its gate reads showCreate) --
  const [searchParams, setSearchParamsFab] = useSearchParams()
  const [createOpen, setCreateOpen] = useState(false)

  // -- Dialog state --
  const [reorderOptimistic, setMobileOptimistic] = useState<ReadonlyArray<Shot> | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [createPullOpen, setCreatePullOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [repairOpen, setRepairOpen] = useState(false)
  const [repairing, setRepairing] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [renumberOpen, setRenumberOpen] = useState(false)
  const [groupSceneOpen, setGroupSceneOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  // Snapshot the two merge candidates at open time. Hosting the wizard on the
  // live `selectedShots` would unmount it mid-flow: a successful merge soft-
  // deletes the loser, which drops it out of `displayShots` → `selectedShots`
  // falls to 1 → the dialog unmounts before the Result step can render (and
  // leaves `mergeOpen` true, re-popping next time two shots are selected).
  const [mergeShots, setMergeShots] = useState<readonly [Shot, Shot] | null>(null)
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

  // -- Role-based flags (5b: effective role + resolving gate) --
  // Write affordances render NOTHING while the first member read is in
  // flight (roleResolving) — never the global-role guess (the surfaceContext
  // null-while-authLoading idiom). Backing rule for the shot writes:
  // hardened /shots (firestore.rules:435-472, ['producer','crew'] arms).
  const showCreate = !roleResolving && canManageShots(role)
  const canReorder = !roleResolving && canManageShots(role)
  const canBulkPull = !roleResolving && canGeneratePulls(role) && (affordances?.bulkPull ?? !isMobile)
  const canRepair = !roleResolving && (role === "admin" || role === "producer") && (affordances?.repair ?? !isMobile)
  // PINNED to the GLOBAL claim: /shotShares create requires a global producer
  // claim (firestore.rules:193-204) — the backend cannot see a project
  // promotion, so the UI must not advertise Share from the effective role.
  const canShare = globalRole === "admin" || globalRole === "producer"
  // NO role gate, by locked decision: export is device-only. The export
  // backend rules (exportTemplates firestore.rules:641-651, exportReports
  // :868-877) don't gate this affordance; the per-share export toggle is 5f.
  // Do not add an effective-role (or any role) source here.
  // 5e-I: now DESKTOP-keyed (affordances.export), matching the export route's
  // RequireDesktop (≥1024px) — the named tablet fix: today's 768-1023px Export
  // button dead-ends in RequireDesktop's toast+redirect. With no role term to
  // wait on, falling back to `isDesktop` while affordances resolve keeps
  // Export rendered immediately on desktop (no flash-of-missing) and hidden
  // on tablet/mobile throughout — same device keying, pinned in tests.
  const canExport = affordances?.export ?? isDesktop
  const canManageLifecycle = !roleResolving && (role === "admin" || role === "producer") && (affordances?.lifecycle ?? !isMobile)
  // Scene/lane writes (edit, delete, ungroup) consolidate on canEditScene
  // (rbac.ts), which mirrors the /lanes rule (firestore.rules:880-882,
  // :901-904 — already project-aware). Crew users see the scene grouping UI
  // read-only — no kebab menu, no edit sheet access from the table header.
  const canManageLanes = !roleResolving && canEditScene(role)

  // -- 5e-II Shoot shell (spec §PR partition 5e-II) --
  // Mount fork mirrors ShotDetailPageUnified's: structurally keyed off the
  // RESOLVED surface, never the flag alone (flag strategy law). surface is
  // null while auth/role resolve, so the shell never mounts off the
  // global-role guess. Flag OFF: isShootShell is always false — every render
  // below is byte-identical to 5e-I.
  const isShootShell = isFeatureEnabled("featureShootSurface") && surface === "shoot"
  // chrome.toolbar consumer: 'minimal' (shoot shell) drops the full
  // search/sort/filter toolbar block; flag-off resolves 'full' on every
  // surface (byte-identical). Falls back to 'full' while chrome resolves —
  // today's toolbar renders during the first member read too.
  const showFullToolbar = (chrome?.toolbar ?? "full") === "full"
  // chrome.quickAdd consumer (resolver doc: showCreate button + the FAB
  // ?create=1 consume path + the inline quick-add). True on every surface
  // today — wired so the shell owns its create affordance through chrome.
  // The ROLE term (showCreate / canManageShots) stays at this consumer.
  const quickAdd = chrome?.quickAdd ?? true

  // FAB ?create=1 consume path — GATED on showCreate (5e-II rules-honesty:
  // it previously opened CreateShotDialog with no role gate, an affordance
  // leak for viewers reaching the URL). Ungated visitors get the param
  // cleared without the dialog (existing param-cleanup idiom). The effect
  // waits out the first member read instead of consuming during it —
  // clearing on the roleResolving gap would silently swallow a legitimate
  // producer's FAB intent.
  useEffect(() => {
    if (searchParams.get("create") !== "1") return
    if (authLoading || roleResolving) return
    if (showCreate && quickAdd) {
      setCreateOpen(true)
    }
    setSearchParamsFab((prev) => {
      const next = new URLSearchParams(prev)
      next.delete("create")
      return next
    }, { replace: true })
  }, [searchParams, setSearchParamsFab, authLoading, roleResolving, showCreate, quickAdd])

  // -- Lookup maps (computed from picker data, passed to list state hook) --
  const talentNameById = useMemo(() => new Map(talentRecords.map((t) => [t.id, t.name])), [talentRecords])
  const locationNameById = useMemo(() => new Map(locationRecords.map((l) => [l.id, l.name])), [locationRecords])
  const productNameById = useMemo(() => new Map(productFamilies.map((p) => [p.id, p.styleName])), [productFamilies])
  const familyById = useMemo(() => new Map(productFamilies.map((p) => [p.id, p])), [productFamilies])
  const { skuById, samplesByFamily } = useHeroProductData(shots, clientId)
  const { data: lanes, laneNameById, laneById } = useLanes()
  const laneOrder = useMemo(() => new Map(lanes.map((l) => [l.id, l.sortOrder])), [lanes])

  // null until claims settle: AuthProvider falls back to 'viewer' while loading
  // (viewer-flash guard). 5b extends the same gate to the first uncached
  // member-doc read (roleResolving) so resolveSurface never consumes the
  // global-role guess; once settled, surfaceContext.role carries the
  // EFFECTIVE role — resolveSurface's input contract is byte-unchanged (the
  // opaque effectiveRole param is 5e's View-as interposition seam).
  const surfaceDevice: SurfaceDevice = isMobile ? "mobile" : isDesktop ? "desktop" : "tablet"
  const surfaceContext = useMemo(
    () => (authLoading || roleResolving ? null : { role, device: surfaceDevice }),
    [authLoading, roleResolving, role, surfaceDevice],
  )

  // -- All filter / sort / view state --
  const {
    sortKey, sortDir, viewMode, groupKey, isCustomSort,
    queryParam, talentParam, locationParam, productParam,
    statusFilter, missingFilter, tagFilter,
    conditions, addCondition, removeCondition, updateCondition,
    queryDraft, setQueryDraft,
    setSortKey, setSortDir, setViewMode, setGroupKey,
    toggleStatus, clearStatusFilter, toggleMissing, clearMissingFilter, toggleTag,
    setTalentFilter, setLocationFilter, setProductFilter,
    clearFilters, clearQuery,
    fields, setFields,
    displayShots, unfilteredSortedShots, insights, hasActiveFilters, hasActiveGrouping,
    shotGroups, activeFilterBadges, tagOptions,
    storageKeyBase,
  } = useShotListState({
    shots, reorderOptimistic, clientId, projectId, talentNameById, locationNameById, productNameById, familyById, skuById, laneNameById, laneOrder, laneById, surfaceContext,
  })

  // Shot clicks navigate to the unified editor route (Phase 5c retired the
  // ThreePanel selection fork), snapshotting the visible order so the
  // editor's [ / ] keys walk the list exactly as the user saw it.
  const handleShotClick = useCallback((shotId: string) => {
    if (clientId) {
      writeShotListNavOrder(clientId, projectId, displayShots.map((s) => s.id))
    }
    navigate(`/projects/${projectId}/shots/${shotId}`)
  }, [navigate, projectId, clientId, displayShots])

  // -- 5e-II Decision D: legacy projectId=='' shots are crew-uneditable at
  // the rules level (shotProjectRole's legacy arm admits only admin/global-
  // producer, firestore.rules:107-114; mapShot defaults missing projectId to
  // '') — the Shoot shell filters them out rather than advertise a
  // guaranteed permission-denied tap. Existing deep-links render read-only
  // in ShootShotDetail; the backfill migration is a later Ted-gated task.
  // Derived from the UNFILTERED order (Codex #442 P2): the shell renders no
  // filter controls, so a lingering deep-link filter (?status=…/?q=…) must
  // never silently subset the on-set list (locked Decision G: full list). --
  const shootShots = useMemo(
    () => unfilteredSortedShots.filter((s) => s.projectId !== ""),
    [unfilteredSortedShots],
  )
  const hiddenLegacyCount = unfilteredSortedShots.length - shootShots.length

  // Shell taps reuse the handleShotClick contract but snapshot the FILTERED
  // order — the detail shell's prev/next + [ / ] keys must never land on a
  // hidden legacy shot.
  const handleShootShotClick = useCallback((shotId: string) => {
    if (clientId) {
      writeShotListNavOrder(clientId, projectId, shootShots.map((s) => s.id))
    }
    navigate(`/projects/${projectId}/shots/${shotId}`)
  }, [navigate, projectId, clientId, shootShots])

  // -- Extra (advanced) filter count: conditions beyond status/missing inline filters --
  const extraFilterCount = useMemo(
    () => conditions.filter((c) => c.field !== "status" && c.field !== "missing").length,
    [conditions],
  )

  // -- Reorder-disabled reason (for the inline drag-handle explainer). Only
  // meaningful when the user otherwise HAS reorder permission (canReorder). When
  // null, reorder is live. Covers all four gate reasons including >REORDER_SHOT_LIMIT. --
  const reorderDisabledReason = useMemo(
    () =>
      canReorder
        ? resolveReorderDisabledReason({
            hasActiveFilters,
            hasActiveGrouping,
            isCustomSort,
            overLimit: displayShots.length > REORDER_SHOT_LIMIT,
          })
        : null,
    [canReorder, hasActiveFilters, hasActiveGrouping, isCustomSort, displayShots.length],
  )

  // -- Cmd+K scene navigation: ?scene=<laneId> switches to scene-grouped view
  // and auto-expands the matching scene header. Consumed once on mount and
  // then cleaned out of the URL so back-nav does not re-trigger. We write
  // `group=scene` and drop `scene` in a single setSearchParams call so both
  // updates survive (separate setters would race on the stale snapshot).
  useEffect(() => {
    const sceneParam = searchParams.get("scene")
    if (!sceneParam) return

    setCollapsedScenes((prev) => {
      if (!prev.has(sceneParam)) return prev
      const next = new Set(prev)
      next.delete(sceneParam)
      return next
    })

    setSearchParamsFab((prev) => {
      const next = new URLSearchParams(prev)
      next.delete("scene")
      next.set("group", "scene")
      return next
    }, { replace: true })
  }, [searchParams, setSearchParamsFab])

  // -- Keyboard shortcuts: 1-2 switch view mode. Inert on the Shoot shell
  // (chrome.viewSwitcher false — the shell has no card/table fork to switch;
  // a stored 'table' write here would leak into the user's plan-build view).
  // Guarded on isShootShell, not chrome.viewSwitcher: flag-off mobile has
  // viewSwitcher=false but these keys still work today (byte-identical law).
  useKeyboardShortcuts([
    { key: "1", handler: () => { if (!isShootShell) setViewMode("card") } },
    { key: "2", handler: () => { if (!isShootShell) setViewMode("table") } },
    { key: "?", shift: true, handler: () => setShortcutsOpen(true) },
  ])

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

  // Open the merge wizard on a snapshot of the current pair (see mergeShots).
  const openMerge = () => {
    if (selectedShots.length !== 2) return
    const [a, b] = selectedShots
    if (a && b) {
      // a && b is the type-narrowing guard (TS can't narrow a tuple from .length).
      setMergeShots([a, b])
      setMergeOpen(true)
    }
  }

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

  return (
    <ErrorBoundary>
      <PageHeader
        title="Shots"
        actions={
          <div className="flex items-center gap-2">
            <EffectiveRoleChip />
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
            {showCreate && quickAdd ? (
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
          onMergeOpen={openMerge}
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

      {/* Toolbar: search + sort + inline filters + view. chrome.toolbar
          drives the mount: 'minimal' (Shoot shell) drops the whole block —
          no ShotListToolbar, no view switcher, no filter/reorder banners. */}
      {showFullToolbar && shots.length > 0 && (
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
            missingFilter={missingFilter}
            toggleMissing={toggleMissing}
            clearMissingFilter={clearMissingFilter}
            canReorder={canReorder}
            hasActiveFilters={hasActiveFilters}
            onRenumberOpen={() => setRenumberOpen(true)}
            extraFilterCount={extraFilterCount}
            conditions={conditions}
            onAddCondition={addCondition}
            onUpdateCondition={updateCondition}
            onRemoveCondition={removeCondition}
            tagOptions={tagOptions}
            talentRecords={talentRecords}
            locationRecords={locationRecords}
            productFamilies={productFamilies}
            onClearFilters={clearFilters}
            canRepair={canRepair}
            onRepairOpen={() => setRepairOpen(true)}
            groupKey={groupKey}
            onGroupKeyChange={setGroupKey}
            hasScenes={lanes.length > 0}
            displayCount={displayShots.length}
            totalCount={shots.length}
          />

          <KeyboardShortcutsDialog
            open={shortcutsOpen}
            onOpenChange={setShortcutsOpen}
          />

          {/* Active filter pill row (removable chips) — only when filters are
              active. Leads with a "Filtered:" label and trails with "Clear all". */}
          {activeFilterBadges.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-1.5" data-testid="active-filter-pills">
              <span className="text-2xs font-semibold uppercase tracking-wide text-[var(--color-text-subtle)]">
                Filtered:
              </span>
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
              <button
                type="button"
                data-testid="active-filter-clear-all"
                className="ml-1 text-2xs text-[var(--color-text-subtle)] underline hover:text-[var(--color-text)] transition-colors"
                onClick={clearFilters}
              >
                Clear all
              </button>
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

          {/* Large-project reorder limit — the only reason not surfaced by a
              drag-handle tooltip (mobile) or the banners above. Shown in all
              views so the >REORDER_SHOT_LIMIT case always has a "why" + path. */}
          {reorderDisabledReason === "limit" && (
            <div className="mb-4 flex items-center gap-2 rounded-md bg-[var(--color-surface-subtle)] px-3 py-2 text-xs text-[var(--color-text-subtle)]">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                Reordering is disabled for large projects. Use Sort, then
                Renumber to set the order.
              </span>
            </div>
          )}
        </>
      )}

      {/* Quick-add inline input — the shell's create affordance too
          (chrome.quickAdd, spec §FAB ownership): the Shoot shell keeps this
          one minimal showCreate-gated input instead of growing its own. */}
      {showCreate && quickAdd && shots.length > 0 && (
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

      {/* Sort override banner — full-toolbar chrome only (the shell has no
          sort controls to restore from) */}
      {showFullToolbar && !isCustomSort && shots.length > 0 && (
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
      ) : isShootShell ? (
        /* 5e-II Shoot shell list — REPLACES the isMobile/card/table forks
           below (surface-keyed, not device-keyed: tablet/desktop crew get
           the same rows, Decision F). Full project list in display order
           (Decision G); legacy shots filtered with a quiet note (Decision D). */
        <ShootShotList
          shots={shootShots}
          hiddenLegacyCount={hiddenLegacyCount}
          talentNameById={talentNameById}
          onOpenShot={handleShootShotClick}
        />
      ) : isMobile ? (
        /* Mobile: card list with up/down controls when custom sort */
        <div className="grid gap-4">
          {displayShots.map((shot, index) => (
            <div key={shot.id} className="flex items-start gap-2">
              {isCustomSort && canReorder && !hasActiveFilters && displayShots.length <= REORDER_SHOT_LIMIT && (
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
            reorderDisabledReason={reorderDisabledReason}
            onReorder={(reordered, range) => {
              setMobileOptimistic(reordered)
              persistShotOrder(reordered, clientId!, range)
                .catch((err) =>
                  toast.error("Failed to save shot order.", {
                    description: shotWriteErrorDescription(err),
                  }),
                )
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
                .catch((err) =>
                  toast.error("Failed to assign scene", {
                    description: shotWriteErrorDescription(err),
                  }),
                )
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
                  .catch((err) =>
                    toast.error("Failed to ungroup scene", {
                      description: shotWriteErrorDescription(err),
                    }),
                  )
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
                            .catch((err) =>
                              toast.error("Failed to ungroup scene", {
                                description: shotWriteErrorDescription(err),
                              }),
                            )
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
            disabled={!isCustomSort || !canReorder || hasActiveFilters || hasActiveGrouping || displayShots.length > REORDER_SHOT_LIMIT}
            disabledReason={reorderDisabledReason}
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

      {mergeShots && (
        <ShotMergeWizard
          open={mergeOpen}
          onOpenChange={(o) => {
            setMergeOpen(o)
            if (!o) setMergeShots(null)
          }}
          clientId={clientId}
          user={user}
          shotA={mergeShots[0]}
          shotB={mergeShots[1]}
          projectId={projectId}
          onMerged={clearSelection}
        />
      )}

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
        canEditScene={canManageLanes}
      />

    </ErrorBoundary>
  )
}
