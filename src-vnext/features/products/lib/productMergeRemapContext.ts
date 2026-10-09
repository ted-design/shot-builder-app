import { collection, getDocs } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { productFamilySkusPath } from "@/shared/lib/paths"
import { resolveStoragePath } from "@/shared/lib/resolveStoragePath"
import type { ProductSku } from "@/shared/types"
import type { MergePlan } from "./productDedup"
import type { MergeRemapContext, WinnerSkuInfo } from "./productMergeRemap"

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined
}

/** Download URL for a stored image, or null when it can't be resolved (same as the assignment picker). */
async function toDownloadUrl(path: string | null): Promise<string | null> {
  return path ? resolveStoragePath(path).catch(() => null) : null
}

/** The names a loser SKU gets when transferNewSkus copies it into the winner. */
export function transferredSkuNames(sku: Pick<ProductSku, "name" | "colorName" | "skuCode">): { name: string; colorName: string } {
  const name = sku.name ?? sku.colorName ?? sku.skuCode ?? "Untitled"
  return { name, colorName: sku.colorName ?? name }
}

/** Everything the colourway remap needs except the ids Step 1 mints for transferred SKUs. */
export interface MergeRemapPrep {
  readonly base: Omit<MergeRemapContext, "skuMap" | "winnerSkus">
  /** Winner SKU docs before the transfer (soft-deleted included, for the carried-id collision check). */
  readonly winnerSkus: ReadonlyMap<string, WinnerSkuInfo>
  /** Loser SKU id -> what transferNewSkus writes for it. */
  readonly transferred: ReadonlyMap<string, WinnerSkuInfo>
}

/**
 * Reads what the colourway remap (merge steps 5–6) needs BEFORE any merge write,
 * so a failed read leaves nothing half-merged: the winner's SKUs, and download
 * URLs for the photos the remap writes onto assignments (the shape the
 * assignment picker writes).
 */
export async function prepareMergeRemap(args: {
  readonly loserId: string
  readonly winnerId: string
  readonly plan: MergePlan
  readonly clientId: string
}): Promise<MergeRemapPrep> {
  const { loserId, winnerId, plan, clientId } = args
  const path = productFamilySkusPath(winnerId, clientId)
  const snap = await getDocs(collection(db, path[0]!, ...path.slice(1)))
  const targets = new Set(plan.matchedSkus.map((match) => match.winnerId))

  const existing = await Promise.all(snap.docs.map(async (d) => {
    const data = d.data() as Record<string, unknown>
    const imagePath = text(data.imagePath) ?? null
    const imageUrl = targets.has(d.id) ? await toDownloadUrl(imagePath) : null
    return [d.id, { name: text(data.name), colorName: text(data.colorName), imagePath, imageUrl }] as const
  }))
  const transferred = await Promise.all(plan.newSkus.map(async (sku) => {
    const imagePath = text(sku.imagePath) ?? null
    return [sku.id, { ...transferredSkuNames(sku), imagePath, imageUrl: await toDownloadUrl(imagePath) }] as const
  }))

  return {
    base: {
      loserId,
      winnerId,
      winnerName: plan.winner.styleName,
      winnerImageUrl: await toDownloadUrl(text(plan.winner.headerImagePath) ?? text(plan.winner.thumbnailImagePath) ?? null),
      winnerStyleNumber: text(plan.winner.styleNumber) ?? null,
      winnerGender: text(plan.winner.gender) ?? null,
    },
    winnerSkus: new Map(existing),
    transferred: new Map(transferred),
  }
}

/** After Step 1: `skuMap` holds matched + transferred ids; the transferred SKUs join the winner's under their new ids. */
export function completeMergeRemap(prep: MergeRemapPrep, skuMap: ReadonlyMap<string, string>): MergeRemapContext {
  const minted = [...prep.transferred].flatMap(([loserSkuId, info]) => {
    const newId = skuMap.get(loserSkuId)
    return newId ? [[newId, info] as const] : []
  })
  return { ...prep.base, skuMap, winnerSkus: new Map([...prep.winnerSkus, ...minted]) }
}
