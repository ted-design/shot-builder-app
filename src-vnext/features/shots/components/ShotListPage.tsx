import { useEffect, useMemo, useState } from "react"
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
import { ShotStatusSelect } from "@/features/shots/components/ShotStatusSelect"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { canGeneratePulls, canManageShots } from "@/shared/lib/rbac"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import { Checkbox } from "@/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select"
import { Input } from "@/ui/input"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/ui/dropdown-menu"
import { formatDateOnly } from "@/features/shots/lib/dateOnly"
import { Camera, Plus, Info, LayoutGrid, Table2, SlidersHorizontal, Eye, ArrowUpDown, Image as ImageIcon } from "lucide-react"
import { extractShotAssignedProducts } from "@/shared/lib/shotProducts"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { textPreview } from "@/shared/lib/textPreview"
import type { Shot, ShotFirestoreStatus } from "@/shared/types"
import { toast } from "sonner"
import { TagBadge } from "@/shared/components/TagBadge"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { backfillMissingShotDates } from "@/features/shots/lib/backfillShotDates"
import { useLocations, useTalent } from "@/features/shots/hooks/usePickerData"
import { getShotPrimaryLookProductLabels, resolveIdsToNames } from "@/features/shots/lib/shotListSummaries"
import { ShotsShareDialog } from "@/features/shots/components/ShotsShareDialog"
import { ShotsPdfExportDialog } from "@/features/shots/components/ShotsPdfExportDialog"
import { Skeleton } from "@/ui/skeleton"
import { useStuckLoading } from "@/shared/hooks/useStuckLoading"

type SortKey = "custom" | "name" | "date" | "status" | "created" | "updated"
type SortDir = "asc" | "desc"
type ViewMode = "gallery" | "visual" | "table"
type MissingKey = "products" | "talent" | "location" | "image"

type ShotsListFields = {
  readonly heroThumb: boolean
  readonly shotNumber: boolean
  readonly description: boolean
  readonly readiness: boolean
  readonly tags: boolean
  readonly date: boolean
  readonly location: boolean
  readonly products: boolean
  readonly talent: boolean
  readonly updated: boolean
}

const SORT_LABELS: Record<SortKey, string> = {
  custom: "Custom Order",
  name: "Name",
  date: "Date",
  status: "Status",
  created: "Created",
  updated: "Updated",
}

const STATUS_ORDER: Record<ShotFirestoreStatus, number> = {
  todo: 0,
  in_progress: 1,
  on_hold: 2,
  complete: 3,
}

function sortShots(
  shots: ReadonlyArray<Shot>,
  key: SortKey,
  dir: SortDir,
): ReadonlyArray<Shot> {
  if (key === "custom") return shots
  const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true })
  const sorted = [...shots]
  const dirMul = dir === "asc" ? 1 : -1

  const byNumber = (a: number, b: number) => (a - b) * dirMul
  const byString = (a: string, b: string) => collator.compare(a, b) * dirMul

  const compare = (a: Shot, b: Shot) => {
    switch (key) {
      case "name":
        return byString(a.title ?? "", b.title ?? "")
      case "date": {
        const aHas = !!a.date
        const bHas = !!b.date
        if (!aHas && !bHas) return byString(a.title ?? "", b.title ?? "")
        if (!aHas) return 1
        if (!bHas) return -1
        const aMs = a.date!.toMillis()
        const bMs = b.date!.toMillis()
        return byNumber(aMs, bMs)
      }
      case "status": {
        const aRank = STATUS_ORDER[a.status] ?? 0
        const bRank = STATUS_ORDER[b.status] ?? 0
        return byNumber(aRank, bRank) || byString(a.title ?? "", b.title ?? "")
      }
      case "created": {
        const aMs = a.createdAt?.toMillis() ?? 0
        const bMs = b.createdAt?.toMillis() ?? 0
        return byNumber(aMs, bMs)
      }
      case "updated": {
        const aMs = a.updatedAt?.toMillis() ?? 0
        const bMs = b.updatedAt?.toMillis() ?? 0
        return byNumber(aMs, bMs)
      }
      default:
        return 0
    }
  }

  sorted.sort((a, b) => compare(a, b))
  return sorted
}

function filterByStatus(
  shots: ReadonlyArray<Shot>,
  statuses: ReadonlySet<ShotFirestoreStatus>,
): ReadonlyArray<Shot> {
  if (statuses.size === 0) return shots
  return shots.filter((s) => statuses.has(s.status))
}

function filterByQuery(
  shots: ReadonlyArray<Shot>,
  query: string,
): ReadonlyArray<Shot> {
  const q = query.trim().toLowerCase()
  if (!q) return shots
  return shots.filter((s) => {
    const title = (s.title ?? "").toLowerCase()
    const shotNumber = (s.shotNumber ?? "").toLowerCase()
    const description = (s.description ?? "").toLowerCase()
    return title.includes(q) || shotNumber.includes(q) || description.includes(q)
  })
}

function filterByMissing(
  shots: ReadonlyArray<Shot>,
  missing: ReadonlySet<MissingKey>,
): ReadonlyArray<Shot> {
  if (missing.size === 0) return shots
  return shots.filter((s) => {
    for (const key of missing) {
      switch (key) {
        case "products":
          if (extractShotAssignedProducts(s).length > 0) return false
          break
        case "talent":
          if ((s.talentIds ?? s.talent).some((t) => typeof t === "string" && t.trim().length > 0)) return false
          break
        case "location":
          if (s.locationId) return false
          break
        case "image":
          if (s.heroImage?.downloadURL || s.heroImage?.path) return false
          break
        default:
          break
      }
    }
    return true
  })
}

function parseCsv(value: string | null): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
}

function formatUpdatedAt(shot: Shot): string {
  try {
    const ms = shot.updatedAt?.toMillis?.() ?? null
    if (!ms) return "—"
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit" }).format(new Date(ms))
  } catch {
    return "—"
  }
}

export default function ShotListPage() {
  const { data: shots, loading, error } = useShots()
  const { role, clientId, user } = useAuth()
  const { projectId, projectName } = useProjectScope()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { data: talentRecords } = useTalent()
  const { data: locationRecords } = useLocations()
  const [searchParams, setSearchParams] = useSearchParams()
  const [createOpen, setCreateOpen] = useState(false)
  const [mobileOptimistic, setMobileOptimistic] = useState<ReadonlyArray<Shot> | null>(null)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  const [createPullOpen, setCreatePullOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)

  const showCreate = canManageShots(role)
  const canReorder = canManageShots(role)
  const canBulkPull = canGeneratePulls(role) && !isMobile
  const canRepair = (role === "admin" || role === "producer") && !isMobile
  const canShare = role === "admin" || role === "producer"
  const canExport = !isMobile

  const [repairOpen, setRepairOpen] = useState(false)
  const [repairing, setRepairing] = useState(false)

  const sortKey = (searchParams.get("sort") as SortKey) || "custom"
  const sortDir =
    (searchParams.get("dir") as SortDir) ||
    (sortKey === "created" || sortKey === "updated" ? "desc" : "asc")
  const queryParam = searchParams.get("q") ?? ""
  const viewParam = (searchParams.get("view") as ViewMode) || null

  const statusFilter = useMemo(() => {
    const values = parseCsv(searchParams.get("status"))
    const set = new Set<ShotFirestoreStatus>()
    for (const v of values) {
      if (v === "todo" || v === "in_progress" || v === "complete" || v === "on_hold") {
        set.add(v)
      }
    }
    return set
  }, [searchParams])

  const missingFilter = useMemo(() => {
    const values = parseCsv(searchParams.get("missing"))
    const set = new Set<MissingKey>()
    for (const v of values) {
      if (v === "products" || v === "talent" || v === "location" || v === "image") set.add(v)
    }
    return set
  }, [searchParams])

  const [queryDraft, setQueryDraft] = useState(queryParam)
  useEffect(() => setQueryDraft(queryParam), [queryParam])

  useEffect(() => {
    if (queryDraft === queryParam) return
    const t = window.setTimeout(() => {
      const next = new URLSearchParams(searchParams)
      const q = queryDraft.trim()
      if (!q) next.delete("q")
      else next.set("q", q)
      setSearchParams(next, { replace: true })
    }, 250)
    return () => window.clearTimeout(t)
  }, [queryDraft, queryParam, searchParams, setSearchParams])

  const storageKeyBase = clientId && projectId
    ? `sb:shots:list:${clientId}:${projectId}`
    : null

  const [fields, setFields] = useState<ShotsListFields>(() => {
    const defaults: ShotsListFields = {
      heroThumb: true,
      shotNumber: true,
      description: true,
      readiness: true,
      tags: true,
      date: true,
      location: true,
      products: true,
      talent: true,
      updated: false,
    }

    if (!storageKeyBase) return defaults
    try {
      const raw = window.localStorage.getItem(`${storageKeyBase}:fields:v1`)
      if (!raw) return defaults
      const parsed = JSON.parse(raw) as Partial<ShotsListFields>
      return { ...defaults, ...parsed }
    } catch {
      return defaults
    }
  })

  useEffect(() => {
    if (!storageKeyBase) return
    try {
      window.localStorage.setItem(`${storageKeyBase}:fields:v1`, JSON.stringify(fields))
    } catch {
      // ignore
    }
  }, [fields, storageKeyBase])

  const storedDefaultView = useMemo((): ViewMode => {
    if (!storageKeyBase) return "gallery"
    try {
      const raw = window.localStorage.getItem(`${storageKeyBase}:view:v1`)
      return raw === "table" || raw === "gallery" || raw === "visual" ? raw : "gallery"
    } catch {
      return "gallery"
    }
  }, [storageKeyBase])

  const viewMode: ViewMode = isMobile
    ? "gallery"
    : viewParam === "table" || viewParam === "gallery" || viewParam === "visual"
      ? viewParam
      : storedDefaultView

  const isCustomSort = sortKey === "custom"

  const setSortKey = (key: SortKey) => {
    const next = new URLSearchParams(searchParams)
    if (key === "custom") {
      next.delete("sort")
      next.delete("dir")
    } else {
      next.set("sort", key)
      if (!next.get("dir")) {
        next.set("dir", key === "created" || key === "updated" ? "desc" : "asc")
      }
    }
    setSearchParams(next, { replace: true })
  }

  const setSortDir = (dir: SortDir) => {
    const next = new URLSearchParams(searchParams)
    if (sortKey === "custom") return
    next.set("dir", dir)
    setSearchParams(next, { replace: true })
  }

  const setViewMode = (mode: ViewMode) => {
    const next = new URLSearchParams(searchParams)
    if (mode === "gallery") {
      next.delete("view")
    } else {
      next.set("view", mode)
    }
    setSearchParams(next, { replace: true })
    if (storageKeyBase) {
      try {
        window.localStorage.setItem(`${storageKeyBase}:view:v1`, mode)
      } catch {
        // ignore
      }
    }
  }

  const toggleStatus = (status: ShotFirestoreStatus) => {
    const next = new Set(statusFilter)
    if (next.has(status)) next.delete(status)
    else next.add(status)

    const params = new URLSearchParams(searchParams)
    if (next.size === 0) params.delete("status")
    else params.set("status", Array.from(next).join(","))
    setSearchParams(params, { replace: true })
  }

  const toggleMissing = (key: MissingKey) => {
    const next = new Set(missingFilter)
    if (next.has(key)) next.delete(key)
    else next.add(key)

    const params = new URLSearchParams(searchParams)
    if (next.size === 0) params.delete("missing")
    else params.set("missing", Array.from(next).join(","))
    setSearchParams(params, { replace: true })
  }

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams)
    next.delete("q")
    next.delete("status")
    next.delete("missing")
    setSearchParams(next, { replace: true })
  }

  const displayShots = useMemo(() => {
    const base = mobileOptimistic ?? shots
    const filteredByStatus = filterByStatus(base, statusFilter)
    const filteredByMissing = filterByMissing(filteredByStatus, missingFilter)
    const filteredByQuery = filterByQuery(filteredByMissing, queryParam)
    return sortShots(filteredByQuery, sortKey, sortDir)
  }, [shots, mobileOptimistic, sortKey, sortDir, statusFilter, missingFilter, queryParam])

  const hasActiveFilters =
    queryParam.trim().length > 0 ||
    statusFilter.size > 0 ||
    missingFilter.size > 0

  const talentNameById = useMemo(() => {
    return new Map(talentRecords.map((t) => [t.id, t.name]))
  }, [talentRecords])

  const locationNameById = useMemo(() => {
    return new Map(locationRecords.map((l) => [l.id, l.name]))
  }, [locationRecords])

  const selectionEnabled = selectionMode && canBulkPull

  const visibleShotIds = useMemo(() => {
    return new Set(displayShots.map((s) => s.id))
  }, [displayShots])

  // Selection is view-scoped: changing filters/search prunes selection to visible shots.
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
    if (!selectionEnabled) return []
    if (selectedIds.size === 0) return []
    return displayShots.filter((s) => selectedIds.has(s.id))
  }, [displayShots, selectedIds, selectionEnabled])

  const activeFilterBadges = useMemo(() => {
    const badges: Array<{ readonly key: string; readonly label: string; readonly onRemove: () => void }> = []
    if (queryParam.trim()) {
      badges.push({
        key: "q",
        label: `Search: ${queryParam.trim()}`,
        onRemove: () => {
          const next = new URLSearchParams(searchParams)
          next.delete("q")
          setSearchParams(next, { replace: true })
        },
      })
    }
    for (const s of statusFilter) {
      badges.push({
        key: `status:${s}`,
        label: `Status: ${s.replace("_", " ")}`,
        onRemove: () => toggleStatus(s),
      })
    }
    for (const m of missingFilter) {
      badges.push({
        key: `missing:${m}`,
        label: `Missing: ${m}`,
        onRemove: () => toggleMissing(m),
      })
    }
    return badges
  }, [missingFilter, queryParam, searchParams, setSearchParams, statusFilter])

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
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Input
              value={queryDraft}
              onChange={(e) => setQueryDraft(e.target.value)}
              placeholder="Search shots…"
              className="w-full sm:w-[260px]"
            />

            <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {SORT_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              disabled={isCustomSort}
              title="Toggle sort direction"
              onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Filters
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Status</DropdownMenuLabel>
                {(["todo", "in_progress", "on_hold", "complete"] as const).map((s) => (
                  <DropdownMenuCheckboxItem
                    key={s}
                    checked={statusFilter.has(s)}
                    onCheckedChange={() => toggleStatus(s)}
                  >
                    {s.replace("_", " ")}
                  </DropdownMenuCheckboxItem>
                ))}

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Missing</DropdownMenuLabel>
                {(["products", "talent", "location", "image"] as const).map((k) => (
                  <DropdownMenuCheckboxItem
                    key={k}
                    checked={missingFilter.has(k)}
                    onCheckedChange={() => toggleMissing(k)}
                  >
                    {k === "image" ? "Hero image" : k}
                  </DropdownMenuCheckboxItem>
                ))}

                <DropdownMenuSeparator />
                <Button
                  variant="ghost"
                  className="h-8 w-full justify-start px-2 text-sm"
                  onClick={clearFilters}
                  disabled={activeFilterBadges.length === 0}
                >
                  Clear filters
                </Button>

                {canRepair && (
                  <>
                    <DropdownMenuSeparator />
                    <Button
                      variant="ghost"
                      className="h-8 w-full justify-start px-2 text-sm"
                      onClick={() => setRepairOpen(true)}
                    >
                      Repair missing shot dates
                    </Button>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <Eye className="h-4 w-4" />
                  Fields
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <DropdownMenuLabel>Cards</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={fields.heroThumb}
                  onCheckedChange={() => setFields({ ...fields, heroThumb: !fields.heroThumb })}
                >
                  Hero thumbnail
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={fields.shotNumber}
                  onCheckedChange={() => setFields({ ...fields, shotNumber: !fields.shotNumber })}
                >
                  Shot number
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={fields.description}
                  onCheckedChange={() => setFields({ ...fields, description: !fields.description })}
                >
                  Description preview
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={fields.readiness}
                  onCheckedChange={() => setFields({ ...fields, readiness: !fields.readiness })}
                >
                  Readiness indicators
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={fields.tags}
                  onCheckedChange={() => setFields({ ...fields, tags: !fields.tags })}
                >
                  Tags
                </DropdownMenuCheckboxItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Details</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={fields.location}
                  onCheckedChange={() => setFields({ ...fields, location: !fields.location })}
                >
                  Location
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={fields.products}
                  onCheckedChange={() => setFields({ ...fields, products: !fields.products })}
                >
                  Products
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={fields.talent}
                  onCheckedChange={() => setFields({ ...fields, talent: !fields.talent })}
                >
                  Talent
                </DropdownMenuCheckboxItem>

                <DropdownMenuSeparator />
                <DropdownMenuLabel>Table</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={fields.date}
                  onCheckedChange={() => setFields({ ...fields, date: !fields.date })}
                >
                  Date
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={fields.updated}
                  onCheckedChange={() => setFields({ ...fields, updated: !fields.updated })}
                >
                  Updated
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {!isMobile && (
              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant={viewMode === "gallery" ? "default" : "outline"}
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setViewMode("gallery")}
                  aria-label="Gallery view"
                  title="Gallery view"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "visual" ? "default" : "outline"}
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setViewMode("visual")}
                  aria-label="Visual view"
                  title="Visual view"
                >
                  <ImageIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "table" ? "default" : "outline"}
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setViewMode("table")}
                  aria-label="Table view"
                  title="Table view"
                >
                  <Table2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

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

          {isCustomSort && canReorder && hasActiveFilters && (
            <div className="mb-4 flex items-center gap-2 rounded-md bg-[var(--color-surface-subtle)] px-3 py-2 text-xs text-[var(--color-text-subtle)]">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                Reordering is disabled while search/filters are active.{" "}
                <button
                  className="underline hover:text-[var(--color-text)]"
                  onClick={clearFilters}
                >
                  Clear filters
                </button>
              </span>
            </div>
          )}
        </>
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
                  visibleFields={fields}
                  talentNameById={talentNameById}
                  locationNameById={locationNameById}
                />
              </div>
            </div>
          ))}
        </div>
      ) : viewMode === "table" ? (
        <>
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
            selection={
              selectionEnabled
                ? { enabled: true, selectedIds, onToggle: toggleSelected, onToggleAll: (next) => setSelectedIds(next) }
                : undefined
            }
            onOpenShot={(shotId) => navigate(`/projects/${projectId}/shots/${shotId}`)}
          />
        </>
      ) : viewMode === "visual" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {displayShots.map((shot) => (
            <ShotVisualCard
              key={shot.id}
              shot={shot}
              selectable={selectionEnabled}
              selected={selectionEnabled ? selectedIds.has(shot.id) : false}
              onSelectedChange={() => toggleSelected(shot.id)}
              showShotNumber={fields.shotNumber}
              showTags={fields.tags}
            />
          ))}
        </div>
      ) : (
        /* Desktop: draggable when custom sort, plain grid otherwise */
        <DraggableShotList
          shots={displayShots}
          disabled={!isCustomSort || !canReorder || hasActiveFilters}
          visibleFields={fields}
          talentNameById={talentNameById}
          locationNameById={locationNameById}
          selection={
            selectionEnabled
              ? { enabled: true, selectedIds, onToggle: toggleSelected }
              : undefined
          }
        />
      )}

      {showCreate && (
        <CreateShotDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(shotId, title) => {
            const hiddenByStatus = statusFilter.size > 0 && !statusFilter.has("todo")
            const q = queryParam.trim().toLowerCase()
            const hiddenByQuery = q.length > 0 && !title.toLowerCase().includes(q)

            if (hiddenByStatus || hiddenByQuery) {
              toast("Shot created but hidden by filters", {
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

function ShotsTable({
  shots,
  fields,
  talentNameById,
  locationNameById,
  selection,
  onOpenShot,
}: {
  readonly shots: ReadonlyArray<Shot>
  readonly fields: ShotsListFields
  readonly talentNameById?: ReadonlyMap<string, string> | null
  readonly locationNameById?: ReadonlyMap<string, string> | null
  readonly selection?: {
    readonly enabled: boolean
    readonly selectedIds: ReadonlySet<string>
    readonly onToggle: (shotId: string) => void
    readonly onToggleAll: (next: ReadonlySet<string>) => void
  }
  readonly onOpenShot: (shotId: string) => void
}) {
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
            {fields.location && <th className="min-w-[160px] px-3 py-2 text-left font-medium">Location</th>}
            {fields.products && <th className="min-w-[280px] px-3 py-2 text-left font-medium">Products</th>}
            {fields.talent && <th className="min-w-[220px] px-3 py-2 text-left font-medium">Talent</th>}
            {fields.tags && <th className="min-w-[180px] px-3 py-2 text-left font-medium">Tags</th>}
            {fields.updated && <th className="w-28 px-3 py-2 text-left font-medium">Updated</th>}
            <th className="w-28 px-3 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {shots.map((shot) => {
            const title = shot.title || "Untitled Shot"
            const productLabels = getShotPrimaryLookProductLabels(shot)

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
                key={shot.id}
                className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-subtle)]"
                onClick={() => onOpenShot(shot.id)}
                role="row"
              >
                {selectionEnabled && (
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selection!.selectedIds.has(shot.id)}
                      onCheckedChange={(v) => {
                        if (v === "indeterminate") return
                        selection!.onToggle(shot.id)
                      }}
                      aria-label={selection!.selectedIds.has(shot.id) ? "Deselect shot" : "Select shot"}
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
                          <span className="text-[10px] text-[var(--color-text-subtle)]">
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
          })}
        </tbody>
      </table>
    </div>
  )
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
