import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { useIsMobile } from "@/shared/hooks/useMediaQuery"
import type { Shot, ShotFirestoreStatus, ProductFamily, ProductSku, Lane } from "@/shared/types"
import {
  type SortKey,
  type SortDir,
  type ViewMode,
  type MissingKey,
  type GroupKey,
  type ShotsListFields,
  type ShotGroup,
  DEFAULT_FIELDS,
  STATUS_LABELS,
  filterByQuery,
  sortShots,
  computeInsights,
  groupShots,
} from "@/features/shots/lib/shotListFilters"
import { deserializeFilters, serializeFilters, migrateLegacyParams } from "@/features/shots/lib/filterSerializer"
import { applyFilterConditions } from "@/features/shots/lib/filterEngine"
import type { FilterCondition } from "@/features/shots/lib/filterConditions"
import { OPERATOR_LABELS } from "@/features/shots/lib/filterConditions"

// ---------------------------------------------------------------------------
// Constants (badge label lookups)
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<string, string> = {
  status: "Status",
  tag: "Tag",
  talent: "Talent",
  location: "Location",
  product: "Product",
  missing: "Missing",
  launchDate: "Launch Date",
  hasRequirements: "Has Requirements",
  hasHeroImage: "Has Hero Image",
}

const MISSING_LABELS: Record<string, string> = {
  products: "Products",
  talent: "Talent",
  location: "Location",
  image: "Hero Image",
}

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
  readonly productParam: string
  readonly statusFilter: ReadonlySet<ShotFirestoreStatus>
  readonly missingFilter: ReadonlySet<MissingKey>
  readonly tagFilter: ReadonlySet<string>
  // Condition-based filtering
  readonly conditions: readonly FilterCondition[]
  readonly addCondition: (condition: Omit<FilterCondition, "id">) => void
  readonly removeCondition: (conditionId: string) => void
  readonly updateCondition: (conditionId: string, updates: Partial<Omit<FilterCondition, "id">>) => void
  // Query draft (debounced)
  readonly queryDraft: string
  readonly setQueryDraft: (value: string) => void
  // Setters
  readonly setSortKey: (key: SortKey) => void
  readonly setSortDir: (dir: SortDir) => void
  readonly setViewMode: (mode: ViewMode) => void
  readonly setGroupKey: (key: GroupKey) => void
  readonly toggleStatus: (status: ShotFirestoreStatus) => void
  readonly clearStatusFilter: () => void
  readonly toggleMissing: (key: MissingKey) => void
  readonly toggleTag: (tagId: string) => void
  readonly setTalentFilter: (talentId: string) => void
  readonly setLocationFilter: (locationId: string) => void
  readonly setProductFilter: (productFamilyId: string) => void
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
  readonly reorderOptimistic: ReadonlyArray<Shot> | null
  readonly clientId: string | null | undefined
  readonly projectId: string
  readonly talentNameById: ReadonlyMap<string, string>
  readonly locationNameById: ReadonlyMap<string, string>
  readonly productNameById: ReadonlyMap<string, string>
  readonly familyById?: ReadonlyMap<string, ProductFamily>
  readonly skuById?: ReadonlyMap<string, ProductSku>
  readonly laneNameById?: ReadonlyMap<string, string>
  readonly laneOrder?: ReadonlyMap<string, number>
  readonly laneById?: ReadonlyMap<string, Lane>
}): ShotListState {
  const { shots, reorderOptimistic, clientId, projectId, talentNameById, locationNameById, productNameById, familyById, skuById, laneNameById, laneOrder, laneById } = params

  const isMobile = useIsMobile()
  const [searchParams, setSearchParams] = useSearchParams()

  // -- URL params --
  const sortKey = (searchParams.get("sort") as SortKey) || "custom"
  const sortDir =
    (searchParams.get("dir") as SortDir) ||
    (sortKey === "created" || sortKey === "updated" ? "desc" : "asc")
  const queryParam = searchParams.get("q") ?? ""
  const viewParam = searchParams.get("view") ?? null
  const groupParam = (searchParams.get("group") as GroupKey) || null

  // -- Condition-based filters (from URL `filters` param) --
  const conditions = useMemo(
    () => deserializeFilters(searchParams.get("filters")),
    [searchParams],
  )

  // -- Legacy migration: convert old flat params to conditions on mount --
  const migrationDone = useRef(false)
  useEffect(() => {
    if (migrationDone.current) return
    migrationDone.current = true
    const migrated = migrateLegacyParams(searchParams)
    if (migrated) {
      const p = new URLSearchParams(searchParams)
      for (const k of ["status", "missing", "talent", "location", "tag", "product"]) p.delete(k)
      p.set("filters", serializeFilters(migrated))
      setSearchParams(p, { replace: true })
    }
  }, [searchParams, setSearchParams])

  // -- Derive backward-compatible filter values from conditions --
  const statusFilter = useMemo((): ReadonlySet<ShotFirestoreStatus> => {
    const cond = conditions.find((c) => c.field === "status" && c.operator === "in")
    const values = (cond?.value as readonly string[] | undefined) ?? []
    const set = new Set<ShotFirestoreStatus>()
    for (const v of values) {
      if (v === "todo" || v === "in_progress" || v === "complete" || v === "on_hold") set.add(v)
    }
    return set
  }, [conditions])

  const missingFilter = useMemo((): ReadonlySet<MissingKey> => {
    const cond = conditions.find((c) => c.field === "missing" && c.operator === "in")
    const values = (cond?.value as readonly string[] | undefined) ?? []
    const set = new Set<MissingKey>()
    for (const v of values) {
      if (v === "products" || v === "talent" || v === "location" || v === "image") set.add(v)
    }
    return set
  }, [conditions])

  const tagFilter = useMemo((): ReadonlySet<string> => {
    const cond = conditions.find((c) => c.field === "tag" && c.operator === "in")
    return new Set((cond?.value as readonly string[] | undefined) ?? [])
  }, [conditions])

  const talentParam = useMemo((): string => {
    const cond = conditions.find((c) => c.field === "talent" && c.operator === "in")
    const values = (cond?.value as readonly string[] | undefined) ?? []
    return values[0] ?? ""
  }, [conditions])

  const locationParam = useMemo((): string => {
    const cond = conditions.find((c) => c.field === "location" && c.operator === "in")
    const values = (cond?.value as readonly string[] | undefined) ?? []
    return values[0] ?? ""
  }, [conditions])

  const productParam = useMemo((): string => {
    const cond = conditions.find((c) => c.field === "product" && c.operator === "in")
    const values = (cond?.value as readonly string[] | undefined) ?? []
    return values[0] ?? ""
  }, [conditions])

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
    if (!storageKeyBase) return "card"
    try {
      const raw = window.localStorage.getItem(`${storageKeyBase}:view:v1`)
      // Backward compat: "gallery" and "visual" both migrate to "card"
      if (raw === "gallery" || raw === "visual") return "card"
      return raw === "table" ? "table" : "card"
    } catch {
      return "card"
    }
  }, [storageKeyBase])

  // -- Derived view/group --
  const viewMode: ViewMode = isMobile
    ? "card"
    : viewParam === "table"
      ? "table"
      // Backward compat: "gallery" and "visual" URL params map to "card"
      : viewParam === "card" || viewParam === "gallery" || viewParam === "visual"
        ? "card"
        : storedDefaultView

  const groupKey: GroupKey = isMobile
    ? "none"
    : groupParam === "status" || groupParam === "date" || groupParam === "talent" || groupParam === "location" || groupParam === "scene"
      ? groupParam
      : "none"

  const isCustomSort = sortKey === "custom"

  // -- Setters (URL params) --
  const setSortKey = useCallback((key: SortKey) => {
    const next = new URLSearchParams(searchParams)
    if (key === "custom") { next.delete("sort"); next.delete("dir") }
    else {
      next.set("sort", key)
      if (!next.get("dir")) next.set("dir", key === "created" || key === "updated" ? "desc" : "asc")
    }
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const setSortDir = useCallback((dir: SortDir) => {
    if (sortKey === "custom") return
    const next = new URLSearchParams(searchParams)
    next.set("dir", dir)
    setSearchParams(next, { replace: true })
  }, [sortKey, searchParams, setSearchParams])

  const setViewMode = useCallback((mode: ViewMode) => {
    const next = new URLSearchParams(searchParams)
    next.set("view", mode)
    setSearchParams(next, { replace: true })
    if (storageKeyBase) {
      try { window.localStorage.setItem(`${storageKeyBase}:view:v1`, mode) } catch { /* ignore */ }
    }
  }, [searchParams, setSearchParams, storageKeyBase])

  const setGroupKey = useCallback((key: GroupKey) => {
    const next = new URLSearchParams(searchParams)
    if (key === "none") next.delete("group")
    else next.set("group", key)
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  const clearQuery = useCallback(() => {
    const next = new URLSearchParams(searchParams)
    next.delete("q")
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  // -- Condition mutators --
  const writeConditions = useCallback((next: readonly FilterCondition[]) => {
    const p = new URLSearchParams(searchParams)
    const serialized = serializeFilters(next)
    if (serialized) p.set("filters", serialized)
    else p.delete("filters")
    setSearchParams(p, { replace: true })
  }, [searchParams, setSearchParams])

  const addCondition = useCallback((condition: Omit<FilterCondition, "id">) => {
    writeConditions([...conditions, { ...condition, id: crypto.randomUUID() }])
  }, [conditions, writeConditions])

  const removeCondition = useCallback((conditionId: string) => {
    writeConditions(conditions.filter((c) => c.id !== conditionId))
  }, [conditions, writeConditions])

  const updateCondition = useCallback((conditionId: string, updates: Partial<Omit<FilterCondition, "id">>) => {
    writeConditions(conditions.map((c) =>
      c.id === conditionId ? { ...c, ...updates } : c,
    ))
  }, [conditions, writeConditions])

  // -- Convenience toggle/set callbacks (manipulate conditions under the hood) --
  const toggleStatus = useCallback((status: ShotFirestoreStatus) => {
    const existing = conditions.find((c) => c.field === "status" && c.operator === "in")
    if (existing) {
      const currentValues = (existing.value as readonly string[]) ?? []
      const newValues = currentValues.includes(status)
        ? currentValues.filter((v) => v !== status)
        : [...currentValues, status]
      if (newValues.length === 0) {
        removeCondition(existing.id)
      } else {
        updateCondition(existing.id, { value: newValues })
      }
    } else {
      addCondition({ field: "status", operator: "in", value: [status] })
    }
  }, [conditions, addCondition, removeCondition, updateCondition])

  const clearStatusFilter = useCallback(() => {
    const existing = conditions.find((c) => c.field === "status" && c.operator === "in")
    if (existing) removeCondition(existing.id)
  }, [conditions, removeCondition])

  const toggleMissing = useCallback((key: MissingKey) => {
    const existing = conditions.find((c) => c.field === "missing" && c.operator === "in")
    if (existing) {
      const currentValues = (existing.value as readonly string[]) ?? []
      const newValues = currentValues.includes(key)
        ? currentValues.filter((v) => v !== key)
        : [...currentValues, key]
      if (newValues.length === 0) {
        removeCondition(existing.id)
      } else {
        updateCondition(existing.id, { value: newValues })
      }
    } else {
      addCondition({ field: "missing", operator: "in", value: [key] })
    }
  }, [conditions, addCondition, removeCondition, updateCondition])

  const toggleTag = useCallback((tagId: string) => {
    const id = tagId.trim()
    if (!id) return
    const existing = conditions.find((c) => c.field === "tag" && c.operator === "in")
    if (existing) {
      const currentValues = (existing.value as readonly string[]) ?? []
      const newValues = currentValues.includes(id)
        ? currentValues.filter((v) => v !== id)
        : [...currentValues, id]
      if (newValues.length === 0) {
        removeCondition(existing.id)
      } else {
        updateCondition(existing.id, { value: newValues })
      }
    } else {
      addCondition({ field: "tag", operator: "in", value: [id] })
    }
  }, [conditions, addCondition, removeCondition, updateCondition])

  const setTalentFilter = useCallback((talentId: string) => {
    const id = talentId.trim()
    const existing = conditions.find((c) => c.field === "talent" && c.operator === "in")
    if (!id) {
      if (existing) removeCondition(existing.id)
    } else if (existing) {
      updateCondition(existing.id, { value: [id] })
    } else {
      addCondition({ field: "talent", operator: "in", value: [id] })
    }
  }, [conditions, addCondition, removeCondition, updateCondition])

  const setLocationFilter = useCallback((locationId: string) => {
    const id = locationId.trim()
    const existing = conditions.find((c) => c.field === "location" && c.operator === "in")
    if (!id) {
      if (existing) removeCondition(existing.id)
    } else if (existing) {
      updateCondition(existing.id, { value: [id] })
    } else {
      addCondition({ field: "location", operator: "in", value: [id] })
    }
  }, [conditions, addCondition, removeCondition, updateCondition])

  const setProductFilter = useCallback((productFamilyId: string) => {
    const id = productFamilyId.trim()
    const existing = conditions.find((c) => c.field === "product" && c.operator === "in")
    if (!id) {
      if (existing) removeCondition(existing.id)
    } else if (existing) {
      updateCondition(existing.id, { value: [id] })
    } else {
      addCondition({ field: "product", operator: "in", value: [id] })
    }
  }, [conditions, addCondition, removeCondition, updateCondition])

  const clearFilters = useCallback(() => {
    const p = new URLSearchParams(searchParams)
    p.delete("filters")
    p.delete("q")
    // Also clear legacy params if any remain
    for (const k of ["status", "missing", "talent", "location", "tag", "product"]) p.delete(k)
    setSearchParams(p, { replace: true })
  }, [searchParams, setSearchParams])

  // -- Computed --
  const displayShots = useMemo(() => {
    const base = reorderOptimistic ?? shots
    // Defense-in-depth: exclude soft-deleted shots even if the Firestore query leaks them
    const alive = base.filter((s) => s.deleted !== true)

    // Apply condition-based filters
    const ctx = { familyById: familyById ?? new Map(), skuById: skuById ?? undefined }
    const filtered = applyFilterConditions(alive, conditions, ctx)

    // Apply text query (separate from conditions)
    const queried = filterByQuery(filtered, queryParam)

    // Sort
    return sortShots(queried, sortKey, sortDir, familyById, skuById)
  }, [shots, reorderOptimistic, conditions, queryParam, sortKey, sortDir, familyById, skuById])

  const hasActiveFilters = conditions.length > 0 || queryParam.trim().length > 0

  const hasActiveGrouping = groupKey !== "none"

  const insights = useMemo(() => computeInsights(displayShots), [displayShots])

  const shotGroups = useMemo(
    () => groupShots(displayShots, groupKey, { talentNameById, locationNameById, laneNameById, laneOrder, laneById }),
    [displayShots, groupKey, locationNameById, talentNameById, laneNameById, laneOrder, laneById],
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

  // -- Name lookup for badge labels --
  const resolveName = useCallback((field: string, id: string): string => {
    switch (field) {
      case "talent": return talentNameById.get(id) ?? id
      case "location": return locationNameById.get(id) ?? id
      case "product": return productNameById.get(id) ?? id
      case "tag": return tagLabelById.get(id) ?? id
      case "status": return STATUS_LABELS[id as ShotFirestoreStatus] ?? id.replace("_", " ")
      case "missing": return MISSING_LABELS[id] ?? id
      default: return id
    }
  }, [talentNameById, locationNameById, productNameById, tagLabelById])

  const activeFilterBadges = useMemo((): ReadonlyArray<FilterBadge> => {
    const badges: FilterBadge[] = []

    // Query badge (not condition-based)
    if (queryParam.trim()) {
      badges.push({
        key: "q",
        label: `Search: ${queryParam.trim()}`,
        onRemove: clearQuery,
      })
    }

    // One badge per condition
    for (const cond of conditions) {
      const fieldLabel = FIELD_LABELS[cond.field] ?? cond.field
      const operatorLabel = OPERATOR_LABELS[cond.operator] ?? cond.operator

      let valueLabel: string
      if (cond.value === null) {
        valueLabel = ""
      } else if (typeof cond.value === "boolean") {
        valueLabel = cond.value ? "Yes" : "No"
      } else if (Array.isArray(cond.value)) {
        const names = (cond.value as readonly string[]).map((v) => resolveName(cond.field, v))
        valueLabel = names.length <= 2 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2}`
      } else if (typeof cond.value === "object" && "from" in cond.value) {
        valueLabel = `${cond.value.from} to ${cond.value.to}`
      } else {
        valueLabel = String(cond.value)
      }

      const label = cond.operator === "empty"
        ? `${fieldLabel} ${operatorLabel}`
        : `${fieldLabel} ${operatorLabel} ${valueLabel}`

      const condId = cond.id
      badges.push({
        key: condId,
        label,
        onRemove: () => removeCondition(condId),
      })
    }

    return badges
  }, [queryParam, conditions, clearQuery, removeCondition, resolveName])

  return {
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
  }
}
