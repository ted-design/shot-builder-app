import type { ProductFamily, ProductSample, ProductSku } from "@/shared/types"
import type { Timestamp } from "firebase/firestore"
import { countActiveRequirements } from "./assetRequirements"

export interface ShootWindow {
  readonly suggestedStart: Date | null
  readonly suggestedEnd: Date | null
  readonly confidence: "high" | "medium" | "low"
  readonly constraints: ReadonlyArray<string>
  readonly tier: "full" | "request_only" | "samples_only"
}

export interface ShootReadinessItem {
  readonly familyId: string
  readonly familyName: string
  readonly gender?: string | null
  readonly launchDate: Timestamp | null
  readonly totalSkus: number
  readonly skusWithFlags: number
  readonly samplesArrived: number
  readonly samplesTotal: number
  readonly readinessPct: number
  readonly shootWindow: ShootWindow | null
  readonly requestDeadline?: string | null
  readonly earliestSampleEta?: Timestamp | null
}

const DAY_MS = 24 * 60 * 60 * 1000
const SHOOT_LEAD_DAYS = 14
const HIGH_CONFIDENCE_WINDOW_DAYS = 14

export function computeSuggestedShootWindow(args: {
  readonly launchDate: Timestamp | null | undefined
  readonly requestDeadline: string | null | undefined
  readonly samplesArrived: number
  readonly samplesTotal: number
  readonly earliestSampleEta: Timestamp | null | undefined
}): ShootWindow | null {
  const { launchDate, requestDeadline, samplesArrived, samplesTotal, earliestSampleEta } = args

  const hasLaunchDate = !!launchDate
  const hasDeadline = !!requestDeadline
  const hasSamples = samplesTotal > 0

  if (!hasLaunchDate && !hasDeadline && !hasSamples) return null

  const now = Date.now()
  const constraints: string[] = []

  // Determine tier
  let tier: ShootWindow["tier"] = "full"
  if (!hasLaunchDate && !hasSamples) tier = "request_only"
  else if (!hasLaunchDate && !hasDeadline) tier = "samples_only"

  // Compute latest shoot date (end of window)
  let latestShootMs: number | null = null

  if (hasLaunchDate) {
    try {
      const launchMs = launchDate!.toDate().getTime()
      latestShootMs = launchMs - SHOOT_LEAD_DAYS * DAY_MS
      constraints.push("Launch date requires shoot completion 14 days before")
    } catch {
      // Invalid timestamp, skip
    }
  }

  if (hasDeadline) {
    try {
      const deadlineMs = new Date(requestDeadline!).getTime()
      if (Number.isFinite(deadlineMs)) {
        if (latestShootMs === null || deadlineMs < latestShootMs) {
          latestShootMs = deadlineMs
          constraints.push("Shot request deadline is tighter constraint")
        }
      }
    } catch {
      // Invalid date string, skip
    }
  }

  // Compute earliest shoot date (start of window)
  let earliestShootMs = now
  const allSamplesArrived = hasSamples && samplesArrived >= samplesTotal

  if (allSamplesArrived) {
    earliestShootMs = now
    constraints.push("All samples arrived")
  } else if (earliestSampleEta) {
    try {
      const etaMs = earliestSampleEta.toDate().getTime()
      earliestShootMs = Math.max(now, etaMs)
      constraints.push("Waiting on sample arrival")
    } catch {
      // Invalid timestamp
    }
  } else if (hasSamples && samplesArrived < samplesTotal) {
    constraints.push("Samples pending with no ETA")
  }

  // Compute confidence
  let confidence: ShootWindow["confidence"] = "medium"

  if (allSamplesArrived && latestShootMs !== null) {
    const windowDays = (latestShootMs - earliestShootMs) / DAY_MS
    if (windowDays >= HIGH_CONFIDENCE_WINDOW_DAYS) {
      confidence = "high"
    } else if (windowDays > 0) {
      confidence = "medium"
    } else {
      confidence = "low"
      constraints.push("Window is overdue or too tight")
    }
  } else if (!hasSamples && latestShootMs !== null && latestShootMs > now) {
    confidence = "medium"
  } else if (latestShootMs !== null && latestShootMs <= now) {
    confidence = "low"
    constraints.push("Deadline has passed")
  } else if (latestShootMs === null) {
    confidence = "low"
  }

  return {
    suggestedStart: new Date(earliestShootMs),
    suggestedEnd: latestShootMs !== null ? new Date(latestShootMs) : null,
    confidence,
    constraints,
    tier,
  }
}

export function computeShootReadiness(
  families: ReadonlyArray<ProductFamily>,
  skusByFamily: ReadonlyMap<string, ReadonlyArray<ProductSku>>,
  samplesByFamily: ReadonlyMap<string, ReadonlyArray<ProductSample>>,
  requestDeadlineByFamily?: ReadonlyMap<string, string | null>,
): ReadonlyArray<ShootReadinessItem> {
  const items: ShootReadinessItem[] = []

  for (const family of families) {
    const skus = skusByFamily.get(family.id) ?? []
    const samples = samplesByFamily.get(family.id) ?? []
    const activeSkus = skus.filter((s) => s.deleted !== true)
    const activeSamples = samples.filter((s) => s.deleted !== true)

    const hasLaunchDate = !!family.launchDate
    const hasSamples = activeSamples.length > 0
    const hasRequestDeadline = !!requestDeadlineByFamily?.get(family.id)

    // Skip families with no data at all
    if (!hasLaunchDate && !hasSamples && !hasRequestDeadline) continue

    const skusWithFlags = activeSkus.filter(
      (sku) => countActiveRequirements(sku.assetRequirements) > 0,
    ).length

    const samplesArrived = activeSamples.filter((s) => s.status === "arrived").length
    const samplesTotal = activeSamples.length

    const readinessPct =
      samplesTotal > 0 ? Math.round((samplesArrived / samplesTotal) * 100) : 0

    const requestDeadline = requestDeadlineByFamily?.get(family.id) ?? null

    const earliestSampleEta = resolveEarliestSampleEta(activeSamples)

    const shootWindow = computeSuggestedShootWindow({
      launchDate: family.launchDate,
      requestDeadline,
      samplesArrived,
      samplesTotal,
      earliestSampleEta,
    })

    items.push({
      familyId: family.id,
      familyName: family.styleName,
      launchDate: family.launchDate ?? null,
      totalSkus: activeSkus.length,
      skusWithFlags,
      samplesArrived,
      samplesTotal,
      readinessPct,
      shootWindow,
      requestDeadline,
    })
  }

  return items
}

function resolveEarliestSampleEta(
  samples: ReadonlyArray<ProductSample>,
): Timestamp | null {
  let earliest: Timestamp | null = null
  let earliestMs = Number.MAX_SAFE_INTEGER

  for (const sample of samples) {
    if (sample.status === "arrived" || !sample.eta) continue
    try {
      const ms = sample.eta.toDate().getTime()
      if (ms < earliestMs) {
        earliestMs = ms
        earliest = sample.eta
      }
    } catch {
      // Skip invalid timestamps
    }
  }

  return earliest
}

export function sortByUrgency(
  items: ReadonlyArray<ShootReadinessItem>,
): ReadonlyArray<ShootReadinessItem> {
  return [...items].sort((a, b) => {
    const aMs = safeTimestampMs(a.launchDate)
    const bMs = safeTimestampMs(b.launchDate)
    const dateCmp = aMs - bMs
    if (dateCmp !== 0) return dateCmp
    return a.readinessPct - b.readinessPct
  })
}

function safeTimestampMs(ts: Timestamp | null): number {
  if (!ts) return Number.MAX_SAFE_INTEGER
  try {
    return ts.toDate().getTime()
  } catch {
    return Number.MAX_SAFE_INTEGER
  }
}

export function isWithinDays(ts: Timestamp, days: number): boolean {
  try {
    const ms = ts.toDate().getTime()
    const now = Date.now()
    return ms > now && ms - now <= days * 24 * 60 * 60 * 1000
  } catch {
    return false
  }
}

export function isOverdue(ts: Timestamp): boolean {
  try {
    return ts.toDate().getTime() < Date.now()
  } catch {
    return false
  }
}
