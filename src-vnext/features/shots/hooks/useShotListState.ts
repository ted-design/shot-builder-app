import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import type { Shot, ShotFirestoreStatus } from "@/shared/types"
import {
  type SortKey,
  type SortDir,
  type ViewMode,
  type MissingKey,
  type GroupKey,
  type ShotsListFields,
  type ShotGroup,
  DEFAULT_FIELDS,
  parseCsv,
  applyFiltersAndSort,
  computeInsights,
  groupShots,
} from "@/features/shots/lib/shotListFilters"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FilterBadge = {
  readonly key: string
  readonly label: string
  readonly onRemove: () => void
}

export type ShotListState = {
  // Filter / sort / view state
  readonly sortKey: SortKey
  readonly sortDir: SortDir
  readonly viewMode: ViewMode
  readonly groupKey: GroupKey
  readonly isCustomSort: boolean
  readonly queryParam: string
  readonly talentParam: string
  readonly locationParam: string
  readonly statusFilter: ReadonlySet<ShotFirestoreStatus>
  readonly missingFilter: ReadonlySet<MissingKey>
  readonly tagFilter: ReadonlySet<string>
  // Query draft (debounced)
  readonly queryDraft: string
  readonly setQueryDraft: (value: string) => void
  // Setters
  readonly setSortKey: (key: SortKey) => void
  readonly setSortDir: (dir: SortDir) => void
  readonly setViewMode: (mode: ViewMode) => void
  readonly setGroupKey: (key: GroupKey) => void
  readonly toggleStatus: (status: ShotFirestoreStatus) => void
  readonly toggleMissing: (key: MissingKey) => void
  readonly toggleTag: (tagId: string) => void
  readonly setTalentFilter: (talentId: string) => void
  readonly setLocationFilter: (locationId: string) => void
  readonly clearFilters: () => void
  readonly clearQuery: () => void
  // Display fields
  readonly fields: ShotsListFields
  readonly setFields: (fields: ShotsListFields) => void
  // Computed
  readonly displayShots: ReadonlyArray<Shot>
  readonly insights: ReturnType<typeof computeInsights>
  readonly hasActiveFilters: boolean
  readonly hasActiveGrouping: boolean
  readonly shotGroups: ReadonlyArray<ShotGroup> | null
  readonly activeFilterBadges: ReadonlyArray<FilterBadge>
  readonly tagOptions: ReadonlyArray<{ readonly id: string; readonly label: string }>
  // Persistence key
  readonly storageKeyBase: string | null
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useShotListState(params: {
  readonly shots: ReadonlyArray<Shot>
  readonly mobileOptimistic: ReadonlyArray<Shot> | null
  readonly clientId: string | null | undefined
  readonly projectId: string
  readonly talentNameById: ReadonlyMap<string, string>
  readonly locationNameById: ReadonlyMap<string, string>
}): ShotListState {
  const { shots, mobileOptimistic, clientId, projectId, talentNameById, locationNameById } = params

  const isMobile = useIsMobile()
  const [searchParams, setSearchParams] = useSearchParams()

  // -- URL params --
  const sortKey = (searchParams.get("sort") as SortKey) || "custom"
  const sortDir =
    (searchParams.get("dir") as SortDir) ||
    (sortKey === "created" || sortKey === "updated" ? "desc" : "asc")
  const queryParam = searchParams.get("q") ?? ""
  const talentParam = searchParams.get("talent") ?? ""
  const locationParam = searchParams.get("location") ?? ""
  const viewParam = (searchParams.get("view") as ViewMode) || null
  const groupParam = (searchParams.get("group") as GroupKey) || null

  // -- Parsed filter sets --
  const statusFilter = useMemo(() => {
    const values = parseCsv(searchParams.get("status"))
    const set = new Set<ShotFirestoreStatus>()
    for (const v of values) {
      if (v === "todo" || v === "in_progress" || v === "complete" || v === "on_hold") set.add(v)
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

  const tagFilter = useMemo(() => new Set(parseCsv(searchParams.get("tag"))), [searchParams])

  // -- Query draft with debounce --
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

  // -- localStorage persistence --
  const storageKeyBase = clientId && projectId ? `sb:shots:list:${clientId}:${projectId}` : null

  const [fields, setFields] = useState<ShotsListFields>(() => {
    if (!storageKeyBase) return DEFAULT_FIELDS
    try {
      const raw = window.localStorage.getItem(`${storageKeyBase}:fields:v1`)
      if (!raw) return DEFAULT_FIELDS
      return { ...DEFAULT_FIELDS, ...JSON.parse(raw) as Partial<ShotsListFields> }
    } catch {
      return DEFAULT_FIELDS
    }
  })

  // Rehydrate fields when project/client changes
  useEffect(() => {
    if (!storageKeyBase) return
    try {
      const raw = window.localStorage.getItem(`${storageKeyBase}:fields:v1`)
      if (raw) {
        setFields({ ...DEFAULT_FIELDS, ...JSON.parse(raw) as Partial<ShotsListFields> })
      } else {
        setFields(DEFAULT_FIELDS)
      }
    } catch {
      setFields(DEFAULT_FIELDS)
    }
  }, [storageKeyBase])

  // Persist fields to localStorage on change
  useEffect(() => {
    if (!storageKeyBase) return
    try { window.localStorage.setItem(`${storageKeyBase}:fields:v1`, JSON.stringify(fields)) } catch { /* ignore */ }
  }, [fields, storageKeyBase])

  const storedDefaultView = useMemo((): ViewMode => {
    if (!storageKeyBase) return "gallery"
    try {
      const raw = window.localStorage.getItem(`${storageKeyBase}:view:v1`)
      return raw === "table" || raw === "gallery" || raw === "visual" || raw === "board" ? raw : "gallery"
    } catch {
      return "gallery"
    }
  }, [storageKeyBase])

  // -- Derived view/group --
  const viewMode: ViewMode = isMobile
    ? "gallery"
    : viewParam === "table" || viewParam === "gallery" || viewParam === "visual" || viewParam === "board"
      ? viewParam
      : storedDefaultView

  const groupKey: GroupKey = isMobile
    ? "none"
    : groupParam === "status" || groupParam === "date" || groupParam === "talent" || groupParam === "location"
      ? groupParam
      : "none"

  const isCustomSort = sortKey === "custom"

  // -- Setters (URL params) --
  const setSortKey = (key: SortKey) => {
    const next = new URLSearchParams(searchParams)
    if (key === "custom") { next.delete("sort"); next.delete("dir") }
    else {
      next.set("sort", key)
      if (!next.get("dir")) next.set("dir", key === "created" || key === "updated" ? "desc" : "asc")
    }
    setSearchParams(next, { replace: true })
  }

  const setSortDir = (dir: SortDir) => {
    if (sortKey === "custom") return
    const next = new URLSearchParams(searchParams)
    next.set("dir", dir)
    setSearchParams(next, { replace: true })
  }

  const setViewMode = (mode: ViewMode) => {
    const next = new URLSearchParams(searchParams)
    next.set("view", mode)
    setSearchParams(next, { replace: true })
    if (storageKeyBase) {
      try { window.localStorage.setItem(`${storageKeyBase}:view:v1`, mode) } catch { /* ignore */ }
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
    const p = new URLSearchParams(searchParams)
    if (next.size === 0) p.delete("tag")
    else p.set("tag", Array.from(next).join(","))
    setSearchParams(p, { replace: true })
  }

  const toggleStatus = (status: ShotFirestoreStatus) => {
    const next = new Set(statusFilter)
    if (next.has(status)) next.delete(status)
    else next.add(status)
    const p = new URLSearchParams(searchParams)
    if (next.size === 0) p.delete("status")
    else p.set("status", Array.from(next).join(","))
    setSearchParams(p, { replace: true })
  }

  const toggleMissing = (key: MissingKey) => {
    const next = new Set(missingFilter)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    const p = new URLSearchParams(searchParams)
    if (next.size === 0) p.delete("missing")
    else p.set("missing", Array.from(next).join(","))
    setSearchParams(p, { replace: true })
  }

  const clearFilters = () => {
    const next = new URLSearchParams(searchParams)
    for (const k of ["q", "status", "missing", "talent", "location", "tag"]) next.delete(k)
    setSearchParams(next, { replace: true })
  }

  // -- Computed --
  const displayShots = useMemo(() => {
    const base = mobileOptimistic ?? shots
    return applyFiltersAndSort(base, {
      statusFilter, missingFilter, talentId: talentParam,
      locationId: locationParam, tagFilter, query: queryParam, sortKey, sortDir,
    })
  }, [shots, mobileOptimistic, sortKey, sortDir, statusFilter, missingFilter, talentParam, locationParam, tagFilter, queryParam])

  const hasActiveFilters =
    queryParam.trim().length > 0 || statusFilter.size > 0 || missingFilter.size > 0 ||
    talentParam.trim().length > 0 || locationParam.trim().length > 0 || tagFilter.size > 0

  const hasActiveGrouping = groupKey !== "none"

  const insights = useMemo(() => computeInsights(displayShots), [displayShots])

  const shotGroups = useMemo(
    () => groupShots(displayShots, groupKey, { talentNameById, locationNameById }),
    [displayShots, groupKey, locationNameById, talentNameById],
  )

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

  const activeFilterBadges = useMemo((): ReadonlyArray<FilterBadge> => {
    const badges: FilterBadge[] = []
    if (queryParam.trim()) {
      badges.push({
        key: "q",
        label: `Search: ${queryParam.trim()}`,
        onRemove: () => { const n = new URLSearchParams(searchParams); n.delete("q"); setSearchParams(n, { replace: true }) },
      })
    }
    if (talentParam.trim()) {
      const id = talentParam.trim()
      badges.push({
        key: `talent:${id}`,
        label: `Talent: ${talentNameById.get(id) ?? id}`,
        onRemove: () => { const n = new URLSearchParams(searchParams); n.delete("talent"); setSearchParams(n, { replace: true }) },
      })
    }
    if (locationParam.trim()) {
      const id = locationParam.trim()
      badges.push({
        key: `location:${id}`,
        label: `Location: ${locationNameById.get(id) ?? id}`,
        onRemove: () => { const n = new URLSearchParams(searchParams); n.delete("location"); setSearchParams(n, { replace: true }) },
      })
    }
    for (const id of tagFilter) {
      badges.push({ key: `tag:${id}`, label: `Tag: ${tagLabelById.get(id) ?? id}`, onRemove: () => toggleTag(id) })
    }
    for (const s of statusFilter) {
      badges.push({ key: `status:${s}`, label: `Status: ${s.replace("_", " ")}`, onRemove: () => toggleStatus(s) })
    }
    for (const m of missingFilter) {
      badges.push({ key: `missing:${m}`, label: `Missing: ${m}`, onRemove: () => toggleMissing(m) })
    }
    return badges
  }, [locationNameById, locationParam, missingFilter, queryParam, searchParams, setSearchParams, statusFilter, tagFilter, tagLabelById, talentNameById, talentParam])

  return {
    sortKey, sortDir, viewMode, groupKey, isCustomSort,
    queryParam, talentParam, locationParam,
    statusFilter, missingFilter, tagFilter,
    queryDraft, setQueryDraft,
    setSortKey, setSortDir, setViewMode, setGroupKey,
    toggleStatus, toggleMissing, toggleTag,
    setTalentFilter, setLocationFilter,
    clearFilters, clearQuery,
    fields, setFields,
    displayShots, insights, hasActiveFilters, hasActiveGrouping,
    shotGroups, activeFilterBadges, tagOptions,
    storageKeyBase,
  }
}
