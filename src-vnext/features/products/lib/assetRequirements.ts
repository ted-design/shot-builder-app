import type { ProductAssetFlag, ProductAssetRequirements, ProductSku } from "@/shared/types"
import type { Timestamp } from "firebase/firestore"

export interface AssetTypeEntry {
  readonly key: string
  readonly label: string
  readonly group: "photography" | "motion" | "other"
}

export const ASSET_TYPES: ReadonlyArray<AssetTypeEntry> = [
  { key: "ecomm_on_figure", label: "E-commerce (on-figure)", group: "photography" },
  { key: "lifestyle", label: "Lifestyle / Campaign", group: "photography" },
  { key: "off_figure_pinup", label: "Off-figure (pinups / flatlays)", group: "photography" },
  { key: "off_figure_detail", label: "Off-figure (fabric / detail)", group: "photography" },
  { key: "video", label: "Video", group: "motion" },
  { key: "other", label: "Other (specify)", group: "other" },
]

export const LEGACY_ASSET_TYPES: ReadonlyArray<{ readonly key: string; readonly label: string }> = [
  { key: "ecomm", label: "E-commerce (legacy)" },
  { key: "campaign", label: "Campaign (legacy)" },
  { key: "ai_generated", label: "AI-generated (legacy)" },
]

export const ASSET_FLAG_OPTIONS: ReadonlyArray<{ readonly value: ProductAssetFlag; readonly label: string }> = [
  { value: "needed", label: "Needed" },
  { value: "in_progress", label: "In progress" },
  { value: "delivered", label: "Delivered" },
  { value: "ai_generated", label: "AI Generated" },
  { value: "not_needed", label: "Not needed" },
]

const VALID_FLAGS = new Set<string>(["needed", "in_progress", "delivered", "not_needed", "ai_generated"])

export function normalizeAssetFlag(value: unknown): ProductAssetFlag | undefined {
  if (typeof value !== "string") return undefined
  return VALID_FLAGS.has(value) ? (value as ProductAssetFlag) : undefined
}

export function isRequirementActionable(flag: ProductAssetFlag | undefined | null): boolean {
  return flag === "needed" || flag === "in_progress"
}

export function countActiveRequirements(reqs: ProductAssetRequirements | null | undefined): number {
  if (!reqs) return 0
  let count = 0
  for (const key of Object.keys(reqs)) {
    if (key === "other_label") continue
    const flag = reqs[key]
    if (typeof flag === "string" && isRequirementActionable(flag as ProductAssetFlag)) {
      count += 1
    }
  }
  return count
}

export type LaunchDeadlineWarning = "overdue" | "soon" | "ok" | "none"

export function getLaunchDeadlineWarning(
  launchDate: Timestamp | null | undefined,
  soonDays = 14,
): LaunchDeadlineWarning {
  if (!launchDate) return "none"
  try {
    const launchMs = launchDate.toDate().getTime()
    const now = Date.now()
    if (launchMs < now) return "overdue"
    if (launchMs - now <= soonDays * 24 * 60 * 60 * 1000) return "soon"
    return "ok"
  } catch {
    return "none"
  }
}

export function formatLaunchDate(launchDate: Timestamp | null | undefined): string {
  if (!launchDate) return "\u2014"
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(launchDate.toDate())
  } catch {
    return "\u2014"
  }
}

export interface SkuAssetSummary {
  readonly total: number
  readonly needed: number
  readonly inProgress: number
  readonly delivered: number
}

export function summarizeSkuAssetFlags(skus: ReadonlyArray<ProductSku>): SkuAssetSummary {
  let total = 0
  let needed = 0
  let inProgress = 0
  let delivered = 0

  for (const sku of skus) {
    if (!sku.assetRequirements) continue
    for (const key of Object.keys(sku.assetRequirements)) {
      if (key === "other_label") continue
      const flag = sku.assetRequirements[key]
      if (!flag || flag === "not_needed") continue
      total += 1
      if (flag === "needed") needed += 1
      if (flag === "in_progress") inProgress += 1
      if (flag === "delivered") delivered += 1
    }
  }

  return { total, needed, inProgress, delivered }
}

export function resolveSkuLaunchDate(
  sku: ProductSku,
  familyLaunchDate: Timestamp | null | undefined,
): Timestamp | null {
  return sku.launchDate ?? familyLaunchDate ?? null
}

export function resolveEarliestLaunchDate(
  familyLaunchDate: Timestamp | null | undefined,
  skus: ReadonlyArray<ProductSku>,
): Timestamp | null {
  const candidates: Timestamp[] = []
  if (familyLaunchDate) candidates.push(familyLaunchDate)
  for (const sku of skus) {
    if (sku.launchDate) candidates.push(sku.launchDate)
  }
  if (candidates.length === 0) return null
  return candidates.reduce((earliest, ts) => {
    try {
      return ts.toDate().getTime() < earliest.toDate().getTime() ? ts : earliest
    } catch {
      return earliest
    }
  })
}
