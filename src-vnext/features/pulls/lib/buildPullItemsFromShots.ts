import type { PullItem, PullItemSize, Shot } from "@/shared/types"
import { extractShotAssignedProducts } from "@/shared/lib/shotProducts"

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2)
}

type SkuSizesByKey = ReadonlyMap<string, readonly string[]>

function skuKey(familyId: string, skuId: string): string {
  return `${familyId}::${skuId}`
}

export function buildPullItemsFromShots({
  shots,
  skuSizesByKey,
}: {
  readonly shots: readonly Shot[]
  readonly skuSizesByKey?: SkuSizesByKey
}): PullItem[] {
  const itemMap = new Map<string, PullItem & { sizes: PullItemSize[] }>()

  for (const shot of shots) {
    for (const product of extractShotAssignedProducts(shot)) {
      const familyId = product.familyId
      if (!familyId) continue

      const colourId = product.colourId ?? null
      const key = `${familyId}::${colourId ?? ""}`

      const familyName = product.familyName ?? undefined
      const colourName = product.colourName ?? undefined

      const sizeScope = product.sizeScope ?? "pending"
      const baseQty = Number.isFinite(product.quantity) ? (product.quantity as number) : 1
      const qty = baseQty > 0 ? baseQty : 1

      let sizes: string[] = []
      if (sizeScope === "all") {
        if (product.skuId) {
          const fromSku = skuSizesByKey?.get(skuKey(familyId, product.skuId)) ?? []
          sizes = fromSku.filter((s) => typeof s === "string" && s.trim().length > 0) as string[]
        }
        if (sizes.length === 0) sizes = ["All Sizes"]
      } else if (sizeScope === "single") {
        sizes = [product.size?.trim() || "One Size"]
      } else {
        sizes = ["One Size"]
      }

      const existing = itemMap.get(key)
      const item: PullItem & { sizes: PullItemSize[] } =
        existing ??
        ({
          id: generateId(),
          familyId,
          familyName,
          colourId,
          colourName,
          sizes: [],
          fulfillmentStatus: "pending",
          notes: null,
        } satisfies PullItem & { sizes: PullItemSize[] })

      for (const size of sizes) {
        const idx = item.sizes.findIndex((s) => s.size === size)
        if (idx === -1) {
          item.sizes.push({
            size,
            quantity: qty,
            fulfilled: 0,
            status: "pending",
          })
        } else {
          const current = item.sizes[idx]!
          item.sizes[idx] = {
            ...current,
            quantity: (current.quantity ?? 0) + qty,
          }
        }
      }

      itemMap.set(key, item)
    }
  }

  const items = [...itemMap.values()]

  items.sort((a, b) => {
    const aName = (a.familyName ?? a.familyId).toString()
    const bName = (b.familyName ?? b.familyId).toString()
    const byFamily = aName.localeCompare(bName)
    if (byFamily !== 0) return byFamily
    return (a.colourName ?? "").toString().localeCompare((b.colourName ?? "").toString())
  })

  return items
}
