import type { ShootReadinessItem } from "@/features/products/lib/shootReadiness"

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

export type ReadinessSort = "urgency" | "name" | "launchDate"

export function sortItems(
  items: ReadonlyArray<ShootReadinessItem>,
  sort: ReadinessSort,
): ReadonlyArray<ShootReadinessItem> {
  const sorted = [...items]
  switch (sort) {
    case "name":
      sorted.sort((a, b) =>
        a.familyName.localeCompare(b.familyName, undefined, {
          sensitivity: "base",
          numeric: true,
        }),
      )
      break
    case "launchDate":
      sorted.sort((a, b) => {
        const aMs = safeTimestampMs(a.launchDate)
        const bMs = safeTimestampMs(b.launchDate)
        return aMs - bMs
      })
      break
    case "urgency":
    default:
      // Already sorted by urgency from the hook
      break
  }
  return sorted
}

export function safeTimestampMs(
  ts: import("firebase/firestore").Timestamp | null | undefined,
): number {
  if (!ts) return Number.MAX_SAFE_INTEGER
  try {
    return ts.toDate().getTime()
  } catch {
    return Number.MAX_SAFE_INTEGER
  }
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export type SampleFilter = "all" | "awaiting" | "arrived" | "none"

export interface ReadinessFilterState {
  readonly query: string
  readonly requireShootRequirements: boolean
  readonly sampleFilter: SampleFilter
}

export function filterReadinessItems(
  items: ReadonlyArray<ShootReadinessItem>,
  filters: ReadinessFilterState,
): ReadonlyArray<ShootReadinessItem> {
  return items.filter((item) => {
    // Search filter
    if (filters.query.trim().length > 0) {
      const q = filters.query.trim().toLowerCase()
      if (!item.familyName.toLowerCase().includes(q)) return false
    }

    // Shoot requirements filter
    if (filters.requireShootRequirements && item.skusWithFlags <= 0) {
      return false
    }

    // Sample status filter
    switch (filters.sampleFilter) {
      case "awaiting":
        if (item.samplesTotal <= 0 || item.samplesArrived >= item.samplesTotal) return false
        break
      case "arrived":
        if (item.samplesTotal <= 0 || item.samplesArrived < item.samplesTotal) return false
        break
      case "none":
        if (item.samplesTotal > 0) return false
        break
      case "all":
      default:
        break
    }

    return true
  })
}
