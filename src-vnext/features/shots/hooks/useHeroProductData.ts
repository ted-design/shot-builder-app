import { useEffect, useMemo, useState } from "react"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { productFamilySkusPath, productFamilySamplesPath } from "@/shared/lib/paths"
import { resolveHeroFamilyIds } from "@/features/shots/lib/shotProductReadiness"
import type { Shot, ProductSku, ProductSample } from "@/shared/types"

// ---------------------------------------------------------------------------
// SKU mapper (minimal — matches usePickerData.mapSku pattern)
// ---------------------------------------------------------------------------

function mapSkuDoc(id: string, data: Record<string, unknown>): ProductSku {
  return {
    id,
    name: (typeof data["name"] === "string" ? data["name"] : "") as string,
    colorName: typeof data["colorName"] === "string" ? data["colorName"] : undefined,
    skuCode: typeof data["skuCode"] === "string" ? data["skuCode"] : undefined,
    hexColor: typeof data["hexColor"] === "string" ? data["hexColor"] : undefined,
    colourHex: typeof data["colourHex"] === "string" ? data["colourHex"] : undefined,
    assetRequirements: (data["assetRequirements"] as ProductSku["assetRequirements"]) ?? null,
    launchDate: (data["launchDate"] as ProductSku["launchDate"]) ?? null,
    deleted: data["deleted"] === true,
  }
}

function mapSampleDoc(id: string, data: Record<string, unknown>): ProductSample {
  return {
    id,
    type: (typeof data["type"] === "string" ? data["type"] : "shoot") as ProductSample["type"],
    status: (typeof data["status"] === "string" ? data["status"] : "requested") as ProductSample["status"],
    sizeRun: Array.isArray(data["sizeRun"]) ? (data["sizeRun"] as string[]) : [],
    scopeSkuId: typeof data["scopeSkuId"] === "string" ? data["scopeSkuId"] : null,
    eta: (data["eta"] as ProductSample["eta"]) ?? null,
    arrivedAt: (data["arrivedAt"] as ProductSample["arrivedAt"]) ?? null,
    deleted: data["deleted"] === true,
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface HeroProductData {
  readonly skuById: ReadonlyMap<string, ProductSku>
  readonly samplesByFamily: ReadonlyMap<string, ReadonlyArray<ProductSample>>
  readonly loading: boolean
}

/**
 * Batch-loads SKU documents and sample documents for hero product families
 * referenced by the given shots. Uses one-time `getDocs` reads (not subscriptions)
 * to avoid fan-out. Bounded by the number of unique hero families (~15-40 per project).
 */
export function useHeroProductData(
  shots: ReadonlyArray<Shot>,
  clientId: string | null | undefined,
): HeroProductData {
  const [skuById, setSkuById] = useState<ReadonlyMap<string, ProductSku>>(new Map())
  const [samplesByFamily, setSamplesByFamily] = useState<ReadonlyMap<string, ReadonlyArray<ProductSample>>>(new Map())
  const [loading, setLoading] = useState(false)

  const heroFamilyIds = useMemo(() => {
    const ids = new Set<string>()
    for (const shot of shots) {
      for (const id of resolveHeroFamilyIds(shot)) ids.add(id)
    }
    return [...ids]
  }, [shots])

  const familyIdsKey = heroFamilyIds.join(",")

  useEffect(() => {
    if (!clientId || heroFamilyIds.length === 0) {
      setSkuById(new Map())
      setSamplesByFamily(new Map())
      return
    }

    let cancelled = false
    setLoading(true)

    const loadAll = async () => {
      const skuMap = new Map<string, ProductSku>()
      const samplesMap = new Map<string, ProductSample[]>()

      await Promise.all(
        heroFamilyIds.map(async (familyId) => {
          const [skuSnap, sampleSnap] = await Promise.all([
            getDocs(collection(db, ...productFamilySkusPath(familyId, clientId))),
            getDocs(collection(db, ...productFamilySamplesPath(familyId, clientId))),
          ])

          for (const doc of skuSnap.docs) {
            const sku = mapSkuDoc(doc.id, doc.data() as Record<string, unknown>)
            if (sku.deleted !== true) skuMap.set(sku.id, sku)
          }

          const samples: ProductSample[] = []
          for (const doc of sampleSnap.docs) {
            const sample = mapSampleDoc(doc.id, doc.data() as Record<string, unknown>)
            if (sample.deleted !== true) samples.push(sample)
          }
          if (samples.length > 0) samplesMap.set(familyId, samples)
        }),
      )

      if (!cancelled) {
        setSkuById(skuMap)
        setSamplesByFamily(samplesMap)
        setLoading(false)
      }
    }

    loadAll().catch((err) => {
      if (!cancelled) {
        console.error("Failed to load hero product data:", err)
        setLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [clientId, familyIdsKey])

  return { skuById, samplesByFamily, loading }
}
