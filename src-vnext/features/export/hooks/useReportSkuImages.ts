import { useEffect, useMemo, useState } from "react"
import { collection, getDocs } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { productFamilySkusPath } from "@/shared/lib/paths"
import { colourwaySkuKey } from "@/shared/lib/colourwayImage"
import type { Shot } from "@/shared/types"

/** `colourwaySkuKey(familyId, skuId)` → the SKU's live `imagePath`, or null when it has none. */
export type SkuImagePaths = ReadonlyMap<string, string | null>

export function familyIdsInUse(shots: ReadonlyArray<Shot>): string[] {
  const ids = new Set<string>()
  for (const shot of shots) {
    if (shot.deleted) continue
    for (const p of shot.products) if (p.familyId) ids.add(p.familyId)
    for (const look of shot.looks ?? []) {
      for (const p of look.products) if (p.familyId) ids.add(p.familyId)
    }
  }
  return [...ids].sort()
}

export async function loadSkuImagePaths(
  familyIds: readonly string[],
  clientId: string,
): Promise<SkuImagePaths> {
  const results = await Promise.allSettled(
    familyIds.map(async (familyId) => {
      const path = productFamilySkusPath(familyId, clientId)
      const snap = await getDocs(collection(db, path[0]!, ...path.slice(1)))
      return snap.docs.map((doc) => {
        const imagePath = (doc.data() as Record<string, unknown>)["imagePath"]
        const path = typeof imagePath === "string" && imagePath.trim().length > 0 ? imagePath : null
        return [colourwaySkuKey(familyId, doc.id), path] as const
      })
    }),
  )
  // A family whose read fails is absent: its assignments fall back to the photo
  // frozen on the assignment. Log it so a silent fallback is traceable.
  results.forEach((r, i) => {
    if (r.status === "rejected") console.error("[useReportSkuImages] SKU read failed", familyIds[i], r.reason)
  })
  return new Map(results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])))
}

/**
 * Live colourway photos for every product family on the report's shots, so the
 * report shows a colourway's current photo (or none) instead of the image
 * frozen on the assignment at pick time. One-time `getDocs` per family (no
 * subscriptions), bounded by the families in the project (~20-80). Waits for
 * `enabled` (the shots' own load) so it never fetches for an empty shot list.
 */
export function useReportSkuImages(
  shots: ReadonlyArray<Shot>,
  clientId: string | null | undefined,
  enabled: boolean,
): {
  readonly skuImagePaths: SkuImagePaths | null
  /** False until the first load settles. A later refetch keeps the previous paths. */
  readonly ready: boolean
} {
  const familyIds = useMemo(() => familyIdsInUse(shots), [shots])
  const requestKey = `${clientId ?? ""}|${familyIds.join(",")}`
  // undefined = not loaded yet; null = load failed (frozen-field fallback).
  const [paths, setPaths] = useState<SkuImagePaths | null | undefined>(undefined)

  useEffect(() => {
    if (!enabled) return
    if (!clientId || familyIds.length === 0) {
      setPaths(new Map())
      return
    }
    let cancelled = false
    loadSkuImagePaths(familyIds, clientId)
      .then((next) => {
        if (!cancelled) setPaths(next)
      })
      .catch(() => {
        // Keep an earlier good load; only a first-load failure falls back to frozen fields.
        if (!cancelled) setPaths((prev) => prev ?? null)
      })
    return () => {
      cancelled = true
    }
    // familyIds is derived from requestKey; keying on the string avoids refetching per render.
  }, [requestKey, enabled])

  return { skuImagePaths: paths ?? null, ready: paths !== undefined }
}
