import type { Shot, ShotFirestoreStatus } from "@/shared/types"
import { extractShotAssignedProducts } from "@/shared/lib/shotProducts"
import { formatDateOnly } from "@/features/shots/lib/dateOnly"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SortKey = "custom" | "name" | "date" | "status" | "created" | "updated"
export type SortDir = "asc" | "desc"
export type ViewMode = "gallery" | "visual" | "table" | "board"
export type MissingKey = "products" | "talent" | "location" | "image"
export type GroupKey = "none" | "status" | "date" | "talent" | "location"

export type ShotsListFields = {
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

export const DEFAULT_FIELDS: ShotsListFields = {
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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const SORT_LABELS: Record<SortKey, string> = {
  custom: "Custom Order",
  name: "Name",
  date: "Date",
  status: "Status",
  created: "Created",
  updated: "Updated",
}

export const STATUS_ORDER: Record<ShotFirestoreStatus, number> = {
  todo: 0,
  in_progress: 1,
  on_hold: 2,
  complete: 3,
}

export const STATUS_LABELS: Record<ShotFirestoreStatus, string> = {
  todo: "Draft",
  in_progress: "In Progress",
  on_hold: "On Hold",
  complete: "Shot",
}

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

export function sortShots(
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

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export function filterByStatus(
  shots: ReadonlyArray<Shot>,
  statuses: ReadonlySet<ShotFirestoreStatus>,
): ReadonlyArray<Shot> {
  if (statuses.size === 0) return shots
  return shots.filter((s) => statuses.has(s.status))
}

export function filterByQuery(
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

export function filterByMissing(
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

export function filterByTalent(
  shots: ReadonlyArray<Shot>,
  talentId: string,
): ReadonlyArray<Shot> {
  const id = talentId.trim()
  if (!id) return shots
  return shots.filter((s) => (s.talentIds ?? s.talent).some((t) => t === id))
}

export function filterByLocation(
  shots: ReadonlyArray<Shot>,
  locationId: string,
): ReadonlyArray<Shot> {
  const id = locationId.trim()
  if (!id) return shots
  return shots.filter((s) => s.locationId === id)
}

export function filterByTag(
  shots: ReadonlyArray<Shot>,
  tagIds: ReadonlySet<string>,
): ReadonlyArray<Shot> {
  if (tagIds.size === 0) return shots
  return shots.filter((s) => (s.tags ?? []).some((t) => tagIds.has(t.id)))
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

export function parseCsv(value: string | null): string[] {
  if (!value) return []
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
}

export function formatUpdatedAt(shot: Shot): string {
  try {
    const ms = shot.updatedAt?.toMillis?.() ?? null
    if (!ms) return "\u2014"
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit" }).format(new Date(ms))
  } catch {
    return "\u2014"
  }
}

/**
 * Compute the full filter + sort pipeline.
 * Deterministic, pure function — safe to memoize.
 */
export function applyFiltersAndSort(
  shots: ReadonlyArray<Shot>,
  params: {
    readonly statusFilter: ReadonlySet<ShotFirestoreStatus>
    readonly missingFilter: ReadonlySet<MissingKey>
    readonly talentId: string
    readonly locationId: string
    readonly tagFilter: ReadonlySet<string>
    readonly query: string
    readonly sortKey: SortKey
    readonly sortDir: SortDir
  },
): ReadonlyArray<Shot> {
  const step1 = filterByStatus(shots, params.statusFilter)
  const step2 = filterByMissing(step1, params.missingFilter)
  const step3 = filterByTalent(step2, params.talentId)
  const step4 = filterByLocation(step3, params.locationId)
  const step5 = filterByTag(step4, params.tagFilter)
  const step6 = filterByQuery(step5, params.query)
  return sortShots(step6, params.sortKey, params.sortDir)
}

/**
 * Compute status and missing counts for insights bar.
 */
export function computeInsights(shots: ReadonlyArray<Shot>): {
  readonly statusCounts: Record<ShotFirestoreStatus, number>
  readonly missingCounts: Record<MissingKey, number>
} {
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

  for (const shot of shots) {
    statusCounts[shot.status] = (statusCounts[shot.status] ?? 0) + 1

    if (extractShotAssignedProducts(shot).length === 0) missingCounts.products += 1
    if ((shot.talentIds ?? shot.talent).filter((t) => typeof t === "string" && t.trim().length > 0).length === 0) {
      missingCounts.talent += 1
    }
    if (!shot.locationId) missingCounts.location += 1
    if (!shot.heroImage?.downloadURL && !shot.heroImage?.path) missingCounts.image += 1
  }

  return { statusCounts, missingCounts }
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

export type ShotGroup = {
  readonly key: string
  readonly label: string
  readonly shots: ReadonlyArray<Shot>
}

export function groupShots(
  shots: ReadonlyArray<Shot>,
  groupKey: GroupKey,
  lookups: {
    readonly talentNameById: ReadonlyMap<string, string>
    readonly locationNameById: ReadonlyMap<string, string>
  },
): ReadonlyArray<ShotGroup> | null {
  if (groupKey === "none") return null

  const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true })

  if (groupKey === "status") {
    const groups: ShotGroup[] = []
    for (const s of ["todo", "in_progress", "on_hold", "complete"] as const) {
      const list = shots.filter((shot) => shot.status === s)
      if (list.length === 0) continue
      groups.push({ key: s, label: STATUS_LABELS[s], shots: list })
    }
    return groups
  }

  if (groupKey === "date") {
    const NO_DATE = "__none"
    const byKey = new Map<string, Shot[]>()
    for (const shot of shots) {
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

    for (const shot of shots) {
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
            : lookups.talentNameById.get(key) ?? key

      const existing = byKey.get(key)
      if (existing) existing.shots.push(shot)
      else byKey.set(key, { label, shots: [shot] })
    }

    const groups = Array.from(byKey.entries()).map(([key, value]) => ({
      key,
      label: value.label,
      shots: value.shots as ReadonlyArray<Shot>,
    }))

    groups.sort((a, b) => {
      const rank = (k: string) => (k === NONE ? 0 : k === MULTI ? 2 : 1)
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

    for (const shot of shots) {
      const key = shot.locationId ?? NONE
      const label =
        key === NONE
          ? "Unassigned"
          : lookups.locationNameById.get(key) ?? shot.locationName ?? key

      const existing = byKey.get(key)
      if (existing) existing.shots.push(shot)
      else byKey.set(key, { label, shots: [shot] })
    }

    const groups = Array.from(byKey.entries()).map(([key, value]) => ({
      key,
      label: value.label,
      shots: value.shots as ReadonlyArray<Shot>,
    }))

    groups.sort((a, b) => {
      const rank = (k: string) => (k === NONE ? 0 : 1)
      const ar = rank(a.key)
      const br = rank(b.key)
      if (ar !== br) return ar - br
      return collator.compare(a.label, b.label)
    })

    return groups
  }

  return null
}
