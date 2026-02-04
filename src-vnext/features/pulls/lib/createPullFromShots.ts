import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { productFamilySkusPath, pullsPath } from "@/shared/lib/paths"
import { buildPullItemsFromShots } from "@/features/pulls/lib/buildPullItemsFromShots"
import { extractShotAssignedProducts } from "@/shared/lib/shotProducts"
import type { Shot } from "@/shared/types"

function collRef(segments: string[]) {
  return collection(db, segments[0]!, ...segments.slice(1))
}

function skuDocRef(clientId: string, familyId: string, skuId: string) {
  const segments = productFamilySkusPath(familyId, clientId)
  return doc(db, segments[0]!, ...segments.slice(1), skuId)
}

export async function createPullFromShots({
  clientId,
  projectId,
  name,
  shots,
}: {
  readonly clientId: string
  readonly projectId: string
  readonly name: string | null
  readonly shots: readonly Shot[]
}): Promise<string> {
  const skuKeys = new Set<string>()
  for (const shot of shots) {
    for (const p of extractShotAssignedProducts(shot)) {
      if (p.sizeScope !== "all") continue
      if (!p.familyId || !p.skuId) continue
      skuKeys.add(`${p.familyId}::${p.skuId}`)
    }
  }

  const skuSizesByKey = new Map<string, readonly string[]>()
  await Promise.all(
    [...skuKeys].map(async (key) => {
      const [familyId, skuId] = key.split("::")
      if (!familyId || !skuId) return
      try {
        const snap = await getDoc(skuDocRef(clientId, familyId, skuId))
        if (!snap.exists()) return
        const data = snap.data() as Record<string, unknown>
        const sizesRaw = data["sizes"]
        const sizes = Array.isArray(sizesRaw)
          ? sizesRaw.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
          : []
        if (sizes.length > 0) skuSizesByKey.set(key, sizes)
      } catch {
        // best-effort; fallback will produce an "All Sizes" line
      }
    }),
  )

  const items = buildPullItemsFromShots({ shots, skuSizesByKey })
  const shotIds = shots.map((s) => s.id)

  const path = pullsPath(projectId, clientId)
  const docRef = await addDoc(collRef(path), {
    name: name?.trim() || null,
    title: null,
    projectId,
    clientId,
    shotIds,
    items,
    status: "draft",
    shareEnabled: false,
    shareAllowResponses: false,
    shareToken: null,
    shareExpireAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return docRef.id
}
