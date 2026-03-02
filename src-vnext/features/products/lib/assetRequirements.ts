import type { ProductAssetType, ProductAssetFlag, ProductAssetRequirements, ProductSku } from "@/shared/types"
import type { Timestamp } from "firebase/firestore"

export const ASSET_TYPES: ReadonlyArray<{ readonly key: ProductAssetType; readonly label: string }> = [
  { key: "ecomm", label: "E-commerce" },
  { key: "campaign", label: "Campaign" },
  { key: "video", label: "Video" },
  { key: "ai_generated", label: "AI-generated" },
] as const

export const ASSET_FLAG_OPTIONS: ReadonlyArray<{ readonly value: ProductAssetFlag; readonly label: string }> = [
  { value: "needed", label: "Needed" },
  { value: "in_progress", label: "In progress" },
  { value: "delivered", label: "Delivered" },
  { value: "not_needed", label: "Not needed" },
] as const

const VALID_FLAGS = new Set<string>(["needed", "in_progress", "delivered", "not_needed"])

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
  for (const key of ASSET_TYPES) {
    if (isRequirementActionable(reqs[key.key])) count += 1
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
  if (!launchDate) return "—"
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(launchDate.toDate())
  } catch {
    return "—"
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
    for (const { key } of ASSET_TYPES) {
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
