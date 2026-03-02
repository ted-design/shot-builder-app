import type { ProductFamily, ProductSample, ProductSku } from "@/shared/types"
import type { Timestamp } from "firebase/firestore"
import { countActiveRequirements } from "./assetRequirements"

export interface ShootReadinessItem {
  readonly familyId: string
  readonly familyName: string
  readonly launchDate: Timestamp
  readonly totalSkus: number
  readonly skusWithFlags: number
  readonly samplesArrived: number
  readonly samplesTotal: number
  readonly readinessPct: number
}

export function computeShootReadiness(
  families: ReadonlyArray<ProductFamily>,
  skusByFamily: ReadonlyMap<string, ReadonlyArray<ProductSku>>,
  samplesByFamily: ReadonlyMap<string, ReadonlyArray<ProductSample>>,
): ReadonlyArray<ShootReadinessItem> {
  const items: ShootReadinessItem[] = []

  for (const family of families) {
    if (!family.launchDate) continue

    const skus = skusByFamily.get(family.id) ?? []
    const samples = samplesByFamily.get(family.id) ?? []
    const activeSkus = skus.filter((s) => s.deleted !== true)
    const activeSamples = samples.filter((s) => s.deleted !== true)

    const skusWithFlags = activeSkus.filter(
      (sku) => countActiveRequirements(sku.assetRequirements) > 0,
    ).length

    const samplesArrived = activeSamples.filter((s) => s.status === "arrived").length
    const samplesTotal = activeSamples.length

    const readinessPct =
      samplesTotal > 0 ? Math.round((samplesArrived / samplesTotal) * 100) : 0

    items.push({
      familyId: family.id,
      familyName: family.styleName,
      launchDate: family.launchDate,
      totalSkus: activeSkus.length,
      skusWithFlags,
      samplesArrived,
      samplesTotal,
      readinessPct,
    })
  }

  return items
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

function safeTimestampMs(ts: Timestamp): number {
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
