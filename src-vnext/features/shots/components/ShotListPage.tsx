import { useEffect, useMemo, useState, type ReactNode } from "react"
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
import { ShotLifecycleActionsMenu } from "@/features/shots/components/ShotLifecycleActionsMenu"
import { useAuth } from "@/app/providers/AuthProvider"
import { useProjectScope } from "@/app/providers/ProjectScopeProvider"
import { canGeneratePulls, canManageShots } from "@/shared/lib/rbac"
import { useProjects } from "@/features/projects/hooks/useProjects"
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
import { formatDateOnly } from "@/features/shots/lib/dateOnly"
import { Camera, Plus, Info, LayoutGrid, Table2, SlidersHorizontal, Eye, ArrowUpDown, Image as ImageIcon, BarChart3, Search, X, Link2, Globe, Video, FileText } from "lucide-react"
import { extractShotAssignedProducts } from "@/shared/lib/shotProducts"
import { useStorageUrl } from "@/shared/hooks/useStorageUrl"
import { textPreview } from "@/shared/lib/textPreview"
import type { Shot, ShotFirestoreStatus, ShotReferenceLinkType } from "@/shared/types"
import { toast } from "sonner"
import { TagBadge } from "@/shared/components/TagBadge"
import { ConfirmDialog } from "@/shared/components/ConfirmDialog"
import { backfillMissingShotDates } from "@/features/shots/lib/backfillShotDates"
import { useLocations, useTalent } from "@/features/shots/hooks/usePickerData"
import { getShotNotesPreview, getShotPrimaryLookProductLabels, resolveIdsToNames } from "@/features/shots/lib/shotListSummaries"
import { ShotsShareDialog } from "@/features/shots/components/ShotsShareDialog"
import { ShotsPdfExportDialog } from "@/features/shots/components/ShotsPdfExportDialog"
import { Skeleton } from "@/ui/skeleton"
import { useStuckLoading } from "@/shared/hooks/useStuckLoading"
import { Separator } from "@/ui/separator"
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/ui/sheet"
import { NotesPreviewText } from "@/features/shots/components/NotesPreviewText"

type SortKey = "custom" | "name" | "date" | "status" | "created" | "updated"
type SortDir = "asc" | "desc"
type ViewMode = "gallery" | "visual" | "table"
type MissingKey = "products" | "talent" | "location" | "image"
type GroupKey = "none" | "status" | "date" | "talent" | "location"

type ShotsListFields = {
  readonly heroThumb: boolean
  readonly shotNumber: boolean
  readonly description: boolean
  readonly notes: boolean
  readonly readiness: boolean
  readonly tags: boolean
  readonly date: boolean
  readonly location: boolean
  readonly products: boolean
  readonly links: boolean
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

const STATUS_LABELS: Record<ShotFirestoreStatus, string> = {
  todo: "To do",
  in_progress: "In progress",
  on_hold: "On hold",
  complete: "Complete",
}

const REFERENCE_LINK_PREVIEW_LIMIT = 2

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

function filterByTalent(
  shots: ReadonlyArray<Shot>,
  talentId: string,
): ReadonlyArray<Shot> {
  const id = talentId.trim()
  if (!id) return shots
  return shots.filter((s) => (s.talentIds ?? s.talent).some((t) => t === id))
}

function filterByLocation(
  shots: ReadonlyArray<Shot>,
  locationId: string,
): ReadonlyArray<Shot> {
  const id = locationId.trim()
  if (!id) return shots
  return shots.filter((s) => s.locationId === id)
}

function filterByTag(
  shots: ReadonlyArray<Shot>,
  tagIds: ReadonlySet<string>,
): ReadonlyArray<Shot> {
  if (tagIds.size === 0) return shots
  return shots.filter((s) => (s.tags ?? []).some((t) => tagIds.has(t.id)))
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
  const { data: projects } = useProjects()
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
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [displayOpen, setDisplayOpen] = useState(false)

  const showCreate = canManageShots(role)
  const canReorder = canManageShots(role)
  const canBulkPull = canGeneratePulls(role) && !isMobile
  const canRepair = (role === "admin" || role === "producer") && !isMobile
  const canShare = role === "admin" || role === "producer"
  const canExport = !isMobile
  const canManageLifecycle = (role === "admin" || role === "producer") && !isMobile

  const [repairOpen, setRepairOpen] = useState(false)
  const [repairing, setRepairing] = useState(false)

  const sortKey = (searchParams.get("sort") as SortKey) || "custom"
  const sortDir =
    (searchParams.get("dir") as SortDir) ||
    (sortKey === "created" || sortKey === "updated" ? "desc" : "asc")
  const queryParam = searchParams.get("q") ?? ""
  const talentParam = searchParams.get("talent") ?? ""
  const locationParam = searchParams.get("location") ?? ""
  const viewParam = (searchParams.get("view") as ViewMode) || null
  const groupParam = (searchParams.get("group") as GroupKey) || null

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

  const tagFilter = useMemo(() => {
    const values = parseCsv(searchParams.get("tag"))
    return new Set(values)
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
      notes: false,
      readiness: true,
      tags: true,
      date: true,
      location: true,
      products: true,
      links: false,
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

  const groupKey: GroupKey = isMobile
    ? "none"
    : groupParam === "status" || groupParam === "date" || groupParam === "talent" || groupParam === "location"
      ? groupParam
      : "none"

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

  const setGroupKey = (key: GroupKey) => {
    const next = new URLSearchParams(searchParams)
    if (key === "none") next.delete("group")
    else next.set("group", key)
    setSearchParams(next, { replace: true })
  }

  const clearQuery = () => {
    const next = new URLSearchParams(searchParams)
    next.delete("q")
    setSearchParams(next, { replace: true })
  }

  const setTalentFilter = (talentId: string) => {
    const next = new URLSearchParams(searchParams)
    const id = talentId.trim()
    if (!id) next.delete("talent")
    else next.set("talent", id)
    setSearchParams(next, { replace: true })
  }

  const setLocationFilter = (locationId: string) => {
    const next = new URLSearchParams(searchParams)
    const id = locationId.trim()
    if (!id) next.delete("location")
    else next.set("location", id)
    setSearchParams(next, { replace: true })
  }

  const toggleTag = (tagId: string) => {
    const id = tagId.trim()
    if (!id) return
    const next = new Set(tagFilter)
    if (next.has(id)) next.delete(id)
    else next.add(id)

    const params = new URLSearchParams(searchParams)
    if (next.size === 0) params.delete("tag")
    else params.set("tag", Array.from(next).join(","))
    setSearchParams(params, { replace: true })
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
    next.delete("talent")
    next.delete("location")
    next.delete("tag")
    setSearchParams(next, { replace: true })
  }

  const displayShots = useMemo(() => {
    const base = mobileOptimistic ?? shots
    const filteredByStatus = filterByStatus(base, statusFilter)
    const filteredByMissing = filterByMissing(filteredByStatus, missingFilter)
    const filteredByTalent = filterByTalent(filteredByMissing, talentParam)
    const filteredByLocation = filterByLocation(filteredByTalent, locationParam)
    const filteredByTag = filterByTag(filteredByLocation, tagFilter)
    const filteredByQuery = filterByQuery(filteredByTag, queryParam)
    return sortShots(filteredByQuery, sortKey, sortDir)
  }, [
    shots,
    mobileOptimistic,
    sortKey,
    sortDir,
    statusFilter,
    missingFilter,
    talentParam,
    locationParam,
    tagFilter,
    queryParam,
  ])

  const hasActiveFilters =
    queryParam.trim().length > 0 ||
    statusFilter.size > 0 ||
    missingFilter.size > 0 ||
    talentParam.trim().length > 0 ||
    locationParam.trim().length > 0 ||
    tagFilter.size > 0

  const hasActiveGrouping = groupKey !== "none"

  const insights = useMemo(() => {
    const statusCounts: Record<ShotFirestoreStatus, number> = {
      todo: 0,
      in_progress: 0,
      on_hold: 0,
      complete: 0,
    }
    const missingCounts: Record<MissingKey, number> = {
      products: 0,
      talent: 0,
      location: 0,
      image: 0,
    }

    for (const shot of displayShots) {
      statusCounts[shot.status] = (statusCounts[shot.status] ?? 0) + 1

      if (extractShotAssignedProducts(shot).length === 0) missingCounts.products += 1
      if ((shot.talentIds ?? shot.talent).filter((t) => typeof t === "string" && t.trim().length > 0).length === 0) {
        missingCounts.talent += 1
      }
      if (!shot.locationId) missingCounts.location += 1
      if (!shot.heroImage?.downloadURL && !shot.heroImage?.path) missingCounts.image += 1
    }

    return { statusCounts, missingCounts }
  }, [displayShots])

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

  const talentNameById = useMemo(() => {
    return new Map(talentRecords.map((t) => [t.id, t.name]))
  }, [talentRecords])

  const locationNameById = useMemo(() => {
    return new Map(locationRecords.map((l) => [l.id, l.name]))
  }, [locationRecords])

  const tagLabelById = useMemo(() => {
    const map = new Map<string, string>()
    for (const shot of shots) {
      for (const tag of shot.tags ?? []) {
        if (!map.has(tag.id)) map.set(tag.id, tag.label)
      }
    }
    return map
  }, [shots])

  const tagOptions = useMemo(() => {
    const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true })
    return Array.from(tagLabelById.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => collator.compare(a.label, b.label))
  }, [tagLabelById])

  const shotGroups = useMemo(() => {
    if (groupKey === "none") return null

    const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true })

    type ShotGroup = { readonly key: string; readonly label: string; readonly shots: ReadonlyArray<Shot> }

    if (groupKey === "status") {
      const groups: ShotGroup[] = []
      for (const s of ["todo", "in_progress", "on_hold", "complete"] as const) {
        const list = displayShots.filter((shot) => shot.status === s)
        if (list.length === 0) continue
        groups.push({ key: s, label: STATUS_LABELS[s], shots: list })
      }
      return groups
    }

    if (groupKey === "date") {
      const NO_DATE = "__none"
      const byKey = new Map<string, Shot[]>()
      for (const shot of displayShots) {
        const key = shot.date ? formatDateOnly(shot.date) : NO_DATE
        const existing = byKey.get(key)
        if (existing) existing.push(shot)
        else byKey.set(key, [shot])
      }

      const keys = Array.from(byKey.keys()).sort((a, b) => {
        if (a === NO_DATE) return 1
        if (b === NO_DATE) return -1
        return collator.compare(a, b)
      })

      return keys.map((key) => ({
        key,
        label: key === NO_DATE ? "No date" : key,
        shots: byKey.get(key)!,
      }))
    }

    if (groupKey === "talent") {
      const NONE = "__none"
      const MULTI = "__multiple"
      const byKey = new Map<string, { readonly label: string; readonly shots: Shot[] }>()

      for (const shot of displayShots) {
        const ids = (shot.talentIds ?? shot.talent).filter(
          (t): t is string => typeof t === "string" && t.trim().length > 0,
        )

        const key =
          ids.length === 0
            ? NONE
            : ids.length === 1
              ? ids[0]!
              : MULTI

        const label =
          key === NONE
            ? "Unassigned"
            : key === MULTI
              ? "Multiple"
              : talentNameById.get(key) ?? key

        const existing = byKey.get(key)
        if (existing) existing.shots.push(shot)
        else byKey.set(key, { label, shots: [shot] })
      }

      const groups = Array.from(byKey.entries()).map(([key, value]) => ({
        key,
        label: value.label,
        shots: value.shots,
      }))

      groups.sort((a, b) => {
        const rank = (key: string) => (key === NONE ? 0 : key === MULTI ? 2 : 1)
        const ar = rank(a.key)
        const br = rank(b.key)
        if (ar !== br) return ar - br
        if (ar === 1) return collator.compare(a.label, b.label)
        return 0
      })

      return groups
    }

    if (groupKey === "location") {
      const NONE = "__none"
      const byKey = new Map<string, { readonly label: string; readonly shots: Shot[] }>()

      for (const shot of displayShots) {
        const key = shot.locationId ?? NONE
        const label =
          key === NONE
            ? "Unassigned"
            : locationNameById.get(key) ?? shot.locationName ?? key

        const existing = byKey.get(key)
        if (existing) existing.shots.push(shot)
        else byKey.set(key, { label, shots: [shot] })
      }

      const groups = Array.from(byKey.entries()).map(([key, value]) => ({
        key,
        label: value.label,
        shots: value.shots,
      }))

      groups.sort((a, b) => {
        const rank = (key: string) => (key === NONE ? 0 : 1)
        const ar = rank(a.key)
        const br = rank(b.key)
        if (ar !== br) return ar - br
        return collator.compare(a.label, b.label)
      })

      return groups
    }

    return null
  }, [displayShots, groupKey, locationNameById, talentNameById])

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
    if (talentParam.trim()) {
      const id = talentParam.trim()
      badges.push({
        key: `talent:${id}`,
        label: `Talent: ${talentNameById.get(id) ?? id}`,
        onRemove: () => {
          const next = new URLSearchParams(searchParams)
          next.delete("talent")
          setSearchParams(next, { replace: true })
        },
      })
    }
    if (locationParam.trim()) {
      const id = locationParam.trim()
      badges.push({
        key: `location:${id}`,
        label: `Location: ${locationNameById.get(id) ?? id}`,
        onRemove: () => {
          const next = new URLSearchParams(searchParams)
          next.delete("location")
          setSearchParams(next, { replace: true })
        },
      })
    }
    for (const id of tagFilter) {
      badges.push({
        key: `tag:${id}`,
        label: `Tag: ${tagLabelById.get(id) ?? id}`,
        onRemove: () => toggleTag(id),
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
  }, [
    locationNameById,
    locationParam,
    missingFilter,
    queryParam,
    searchParams,
    setSearchParams,
    statusFilter,
    tagFilter,
    tagLabelById,
    talentNameById,
    talentParam,
  ])

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
            <div className="relative w-full sm:w-[260px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-subtle)]" />
              <Input
                value={queryDraft}
                onChange={(e) => setQueryDraft(e.target.value)}
                placeholder="Search shots…"
                className="pl-9 pr-9"
              />
              {queryDraft.trim().length > 0 && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)]"
                  onClick={() => {
                    setQueryDraft("")
                    clearQuery()
                  }}
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Clear search</span>
                </button>
              )}
            </div>

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

            {!isMobile && (
              <Select value={groupKey} onValueChange={(v) => setGroupKey(v as GroupKey)}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Group by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No grouping</SelectItem>
                  <SelectItem value="status">By status</SelectItem>
                  <SelectItem value="date">By date</SelectItem>
                  <SelectItem value="talent">By talent</SelectItem>
                  <SelectItem value="location">By location</SelectItem>
                </SelectContent>
              </Select>
            )}

            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setFiltersOpen(true)}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterBadges.length > 0 && (
                <span className="ml-1 rounded-full bg-[var(--color-surface-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-text-subtle)]">
                  {activeFilterBadges.length}
                </span>
              )}
            </Button>

            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setDisplayOpen(true)}
            >
              <Eye className="h-4 w-4" />
              Display
            </Button>

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

          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetContent side={isMobile ? "bottom" : "right"} className="sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                    Status
                  </div>
                  <div className="space-y-2">
                    {(["todo", "in_progress", "on_hold", "complete"] as const).map((s) => (
                      <label key={s} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={statusFilter.has(s)}
                          onCheckedChange={(v) => {
                            if (v === "indeterminate") return
                            toggleStatus(s)
                          }}
                        />
                        <span>{STATUS_LABELS[s]}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                    Missing
                  </div>
                  <div className="space-y-2">
                    {(["products", "talent", "location", "image"] as const).map((k) => (
                      <label key={k} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={missingFilter.has(k)}
                          onCheckedChange={(v) => {
                            if (v === "indeterminate") return
                            toggleMissing(k)
                          }}
                        />
                        <span>{k === "image" ? "Hero image" : k}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                      Talent
                    </div>
                    <Select
                      value={talentParam.trim() ? talentParam.trim() : "__any__"}
                      onValueChange={(v) => setTalentFilter(v === "__any__" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any__">Any</SelectItem>
                        {talentRecords.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                      Location
                    </div>
                    <Select
                      value={locationParam.trim() ? locationParam.trim() : "__any__"}
                      onValueChange={(v) => setLocationFilter(v === "__any__" ? "" : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Any" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__any__">Any</SelectItem>
                        {locationRecords.map((l) => (
                          <SelectItem key={l.id} value={l.id}>
                            {l.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                    Tag
                  </div>
                  <div className="max-h-44 space-y-2 overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2">
                    {tagOptions.length === 0 ? (
                      <p className="text-xs text-[var(--color-text-subtle)]">No tags available</p>
                    ) : (
                      tagOptions.map((tag) => (
                        <label key={tag.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={tagFilter.has(tag.id)}
                            onCheckedChange={(v) => {
                              if (v === "indeterminate") return
                              toggleTag(tag.id)
                            }}
                          />
                          <span>{tag.label}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearFilters}
                    disabled={!hasActiveFilters}
                  >
                    Clear filters
                  </Button>
                  {canRepair && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFiltersOpen(false)
                        setRepairOpen(true)
                      }}
                    >
                      Repair missing shot dates
                    </Button>
                  )}
                  <SheetClose asChild>
                    <Button size="sm">Done</Button>
                  </SheetClose>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Sheet open={displayOpen} onOpenChange={setDisplayOpen}>
            <SheetContent side={isMobile ? "bottom" : "right"} className="sm:max-w-md">
              <SheetHeader>
                <SheetTitle>Display</SheetTitle>
              </SheetHeader>

              <div className="mt-4 space-y-4">
                {viewMode !== "table" && (
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                      Presets
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setFields({
                            ...fields,
                            heroThumb: true,
                            shotNumber: true,
                            description: false,
                            notes: false,
                            readiness: true,
                            tags: true,
                            location: false,
                            products: false,
                            links: false,
                            talent: false,
                          })
                        }
                      >
                        Storyboard
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setFields({
                            ...fields,
                            heroThumb: true,
                            shotNumber: true,
                            description: true,
                            notes: true,
                            readiness: true,
                            tags: true,
                            location: true,
                            products: true,
                            links: true,
                            talent: true,
                          })
                        }
                      >
                        Prep
                      </Button>
                    </div>
                  </div>
                )}

                {viewMode === "visual" ? (
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                      Visual View
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={fields.shotNumber}
                          onCheckedChange={(v) => {
                            if (v === "indeterminate") return
                            setFields({ ...fields, shotNumber: !fields.shotNumber })
                          }}
                        />
                        <span>Shot number</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={fields.tags}
                          onCheckedChange={(v) => {
                            if (v === "indeterminate") return
                            setFields({ ...fields, tags: !fields.tags })
                          }}
                        />
                        <span>Tags</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={fields.notes}
                          onCheckedChange={(v) => {
                            if (v === "indeterminate") return
                            setFields({ ...fields, notes: !fields.notes })
                          }}
                        />
                        <span>Notes</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={fields.links}
                          onCheckedChange={(v) => {
                            if (v === "indeterminate") return
                            setFields({ ...fields, links: !fields.links })
                          }}
                        />
                        <span>Reference links</span>
                      </label>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        Visual view always shows the hero image.
                      </p>
                    </div>
                  </div>
                ) : viewMode === "table" ? (
                  <div className="space-y-2">
                    <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                      Table Columns
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={fields.heroThumb}
                          onCheckedChange={(v) => {
                            if (v === "indeterminate") return
                            setFields({ ...fields, heroThumb: !fields.heroThumb })
                          }}
                        />
                        <span>Hero thumbnail</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={fields.shotNumber}
                          onCheckedChange={(v) => {
                            if (v === "indeterminate") return
                            setFields({ ...fields, shotNumber: !fields.shotNumber })
                          }}
                        />
                        <span>Shot number</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={fields.description}
                          onCheckedChange={(v) => {
                            if (v === "indeterminate") return
                            setFields({ ...fields, description: !fields.description })
                          }}
                        />
                        <span>Description preview</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={fields.notes}
                          onCheckedChange={(v) => {
                            if (v === "indeterminate") return
                            setFields({ ...fields, notes: !fields.notes })
                          }}
                        />
                        <span>Notes preview</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={fields.date}
                          onCheckedChange={(v) => {
                            if (v === "indeterminate") return
                            setFields({ ...fields, date: !fields.date })
                          }}
                        />
                        <span>Date</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={fields.location}
                          onCheckedChange={(v) => {
                            if (v === "indeterminate") return
                            setFields({ ...fields, location: !fields.location })
                          }}
                        />
                        <span>Location</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={fields.products}
                          onCheckedChange={(v) => {
                            if (v === "indeterminate") return
                            setFields({ ...fields, products: !fields.products })
                          }}
                        />
                        <span>Products</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={fields.links}
                          onCheckedChange={(v) => {
                            if (v === "indeterminate") return
                            setFields({ ...fields, links: !fields.links })
                          }}
                        />
                        <span>Reference links</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={fields.talent}
                          onCheckedChange={(v) => {
                            if (v === "indeterminate") return
                            setFields({ ...fields, talent: !fields.talent })
                          }}
                        />
                        <span>Talent</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={fields.tags}
                          onCheckedChange={(v) => {
                            if (v === "indeterminate") return
                            setFields({ ...fields, tags: !fields.tags })
                          }}
                        />
                        <span>Tags</span>
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={fields.updated}
                          onCheckedChange={(v) => {
                            if (v === "indeterminate") return
                            setFields({ ...fields, updated: !fields.updated })
                          }}
                        />
                        <span>Updated</span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                        Cards
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={fields.heroThumb}
                            onCheckedChange={(v) => {
                              if (v === "indeterminate") return
                              setFields({ ...fields, heroThumb: !fields.heroThumb })
                            }}
                          />
                          <span>Hero thumbnail</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={fields.shotNumber}
                            onCheckedChange={(v) => {
                              if (v === "indeterminate") return
                              setFields({ ...fields, shotNumber: !fields.shotNumber })
                            }}
                          />
                          <span>Shot number</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={fields.description}
                            onCheckedChange={(v) => {
                              if (v === "indeterminate") return
                              setFields({ ...fields, description: !fields.description })
                            }}
                          />
                          <span>Description preview</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={fields.notes}
                            onCheckedChange={(v) => {
                              if (v === "indeterminate") return
                              setFields({ ...fields, notes: !fields.notes })
                            }}
                          />
                          <span>Notes preview</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={fields.readiness}
                            onCheckedChange={(v) => {
                              if (v === "indeterminate") return
                              setFields({ ...fields, readiness: !fields.readiness })
                            }}
                          />
                          <span>Readiness indicators</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={fields.tags}
                            onCheckedChange={(v) => {
                              if (v === "indeterminate") return
                              setFields({ ...fields, tags: !fields.tags })
                            }}
                          />
                          <span>Tags</span>
                        </label>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
                        Details
                      </div>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={fields.location}
                            onCheckedChange={(v) => {
                              if (v === "indeterminate") return
                              setFields({ ...fields, location: !fields.location })
                            }}
                          />
                          <span>Location</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={fields.products}
                            onCheckedChange={(v) => {
                              if (v === "indeterminate") return
                              setFields({ ...fields, products: !fields.products })
                            }}
                          />
                          <span>Products</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={fields.links}
                            onCheckedChange={(v) => {
                              if (v === "indeterminate") return
                              setFields({ ...fields, links: !fields.links })
                            }}
                          />
                          <span>Reference links</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={fields.talent}
                            onCheckedChange={(v) => {
                              if (v === "indeterminate") return
                              setFields({ ...fields, talent: !fields.talent })
                            }}
                          />
                          <span>Talent</span>
                        </label>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <SheetClose asChild>
                    <Button size="sm">Done</Button>
                  </SheetClose>
                </div>
              </div>
            </SheetContent>
          </Sheet>

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
                <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
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
                <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-subtle)]">
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
                  actionControl={renderLifecycleAction(shot)}
                  talentNameById={talentNameById}
                  locationNameById={locationNameById}
                />
              </div>
            </div>
          ))}
        </div>
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
            onOpenShot={(shotId) => navigate(`/projects/${projectId}/shots/${shotId}`)}
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

function ShotsTable({
  shots,
  fields,
  talentNameById,
  locationNameById,
  showLifecycleActions = false,
  renderLifecycleAction,
  selection,
  onOpenShot,
}: {
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
          {shots.map((shot) => {
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
                          <span className="text-[10px] text-[var(--color-text-subtle)]">
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
