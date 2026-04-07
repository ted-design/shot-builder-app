import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import {
  productFamiliesPath,
  productFamilyCommentsPath,
  productFamilyDocumentsPath,
  productFamilySamplesPath,
  productFamilySkusPath,
  pullsPath,
  shotRequestsPath,
  shotsPath,
} from "@/shared/lib/paths"
import { countActiveRequirements, resolveEarliestLaunchDate } from "@/features/products/lib/assetRequirements"
import { createProductVersionSnapshot } from "@/features/products/lib/productVersioning"
import type { MergePlan } from "./productDedup"
import type {
  AuthUser,
  ProductFamily,
  ProductSku,
} from "@/shared/types"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum operations per Firestore WriteBatch (limit is 500; 250 for safety). */
const BATCH_CHUNK_SIZE = 250

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface MergeResult {
  readonly skusCreated: number
  readonly skusMerged: number
  readonly samplesTransferred: number
  readonly commentsTransferred: number
  readonly documentsTransferred: number
  readonly shotsUpdated: number
  readonly pullsUpdated: number
  readonly requestsUpdated: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function chunkArray<T>(arr: readonly T[], size: number): readonly (readonly T[])[] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size))
  }
  return chunks
}

function buildCollectionRef(pathSegments: string[]) {
  return collection(db, pathSegments[0]!, ...pathSegments.slice(1))
}

function buildDocRef(pathSegments: string[], docId: string) {
  return doc(db, pathSegments[0]!, ...pathSegments.slice(1), docId)
}

// ---------------------------------------------------------------------------
// Step 1: Transfer new SKUs from loser to winner
// ---------------------------------------------------------------------------

async function transferNewSkus(args: {
  readonly newSkus: ReadonlyArray<ProductSku>
  readonly winnerId: string
  readonly clientId: string
  readonly mergedBy: string
}): Promise<number> {
  const { newSkus, winnerId, clientId, mergedBy } = args
  if (newSkus.length === 0) return 0

  const winnerSkuPath = productFamilySkusPath(winnerId, clientId)
  const winnerSkuCol = buildCollectionRef(winnerSkuPath)
  const chunks = chunkArray(newSkus, BATCH_CHUNK_SIZE)

  for (const chunk of chunks) {
    const batch = writeBatch(db)
    for (const sku of chunk) {
      const newRef = doc(winnerSkuCol)
      batch.set(newRef, {
        colorName: sku.colorName ?? sku.name,
        name: sku.name,
        skuCode: sku.skuCode ?? null,
        sizes: sku.sizes ? [...sku.sizes] : [],
        status: sku.status ?? "active",
        archived: sku.archived ?? false,
        imagePath: sku.imagePath ?? null,
        colorKey: sku.colorKey ?? null,
        hexColor: sku.hexColor ?? null,
        colourHex: sku.colourHex ?? null,
        assetRequirements: sku.assetRequirements ?? null,
        launchDate: sku.launchDate ?? null,
        deleted: false,
        deletedAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: mergedBy,
        updatedBy: mergedBy,
      })
    }
    await batch.commit()
  }

  return newSkus.length
}

// ---------------------------------------------------------------------------
// Step 2: Transfer samples from loser to winner
// ---------------------------------------------------------------------------

async function transferSamples(args: {
  readonly loserId: string
  readonly winnerId: string
  readonly clientId: string
  readonly matchedSkuMap: ReadonlyMap<string, string>
  readonly mergedBy: string
}): Promise<number> {
  const { loserId, winnerId, clientId, matchedSkuMap, mergedBy } = args

  const loserSamplesPath = productFamilySamplesPath(loserId, clientId)
  const snap = await getDocs(buildCollectionRef(loserSamplesPath))
  if (snap.empty) return 0

  const winnerSamplesPath = productFamilySamplesPath(winnerId, clientId)
  const winnerSamplesCol = buildCollectionRef(winnerSamplesPath)
  const docs = snap.docs.filter((d) => d.data().deleted !== true)
  const chunks = chunkArray(docs, BATCH_CHUNK_SIZE)
  let transferred = 0

  for (const chunk of chunks) {
    const batch = writeBatch(db)
    for (const sampleDoc of chunk) {
      const data = sampleDoc.data()
      const scopeSkuId = data.scopeSkuId as string | null | undefined
      const remappedSkuId = scopeSkuId && matchedSkuMap.has(scopeSkuId)
        ? matchedSkuMap.get(scopeSkuId)!
        : scopeSkuId ?? null

      const newRef = doc(winnerSamplesCol)
      batch.set(newRef, {
        ...data,
        scopeSkuId: remappedSkuId,
        updatedAt: serverTimestamp(),
        updatedBy: mergedBy,
      })
      transferred += 1
    }
    await batch.commit()
  }

  return transferred
}

// ---------------------------------------------------------------------------
// Step 3: Transfer comments from loser to winner
// ---------------------------------------------------------------------------

async function transferComments(args: {
  readonly loserId: string
  readonly winnerId: string
  readonly clientId: string
  readonly mergedBy: string
}): Promise<number> {
  const { loserId, winnerId, clientId, mergedBy } = args

  const loserCommentsPath = productFamilyCommentsPath(loserId, clientId)
  const snap = await getDocs(buildCollectionRef(loserCommentsPath))
  if (snap.empty) return 0

  const winnerCommentsPath = productFamilyCommentsPath(winnerId, clientId)
  const winnerCommentsCol = buildCollectionRef(winnerCommentsPath)
  const docs = snap.docs.filter((d) => d.data().deleted !== true)
  const chunks = chunkArray(docs, BATCH_CHUNK_SIZE)
  let transferred = 0

  for (const chunk of chunks) {
    const batch = writeBatch(db)
    for (const commentDoc of chunk) {
      const newRef = doc(winnerCommentsCol)
      batch.set(newRef, {
        ...commentDoc.data(),
        updatedAt: serverTimestamp(),
        updatedBy: mergedBy,
      })
      transferred += 1
    }
    await batch.commit()
  }

  return transferred
}

// ---------------------------------------------------------------------------
// Step 4: Transfer documents from loser to winner
// ---------------------------------------------------------------------------

async function transferDocuments(args: {
  readonly loserId: string
  readonly winnerId: string
  readonly clientId: string
  readonly mergedBy: string
}): Promise<number> {
  const { loserId, winnerId, clientId, mergedBy } = args

  const loserDocsPath = productFamilyDocumentsPath(loserId, clientId)
  const snap = await getDocs(buildCollectionRef(loserDocsPath))
  if (snap.empty) return 0

  const winnerDocsPath = productFamilyDocumentsPath(winnerId, clientId)
  const winnerDocsCol = buildCollectionRef(winnerDocsPath)
  const docs = snap.docs.filter((d) => d.data().deleted !== true)
  const chunks = chunkArray(docs, BATCH_CHUNK_SIZE)
  let transferred = 0

  for (const chunk of chunks) {
    const batch = writeBatch(db)
    for (const docSnap of chunk) {
      const newRef = doc(winnerDocsCol)
      batch.set(newRef, {
        ...docSnap.data(),
        updatedAt: serverTimestamp(),
        updatedBy: mergedBy,
      })
      transferred += 1
    }
    await batch.commit()
  }

  return transferred
}

// ---------------------------------------------------------------------------
// Step 5: Update shot references
// ---------------------------------------------------------------------------

async function updateShotReferences(args: {
  readonly affectedShotIds: ReadonlyArray<string>
  readonly loserId: string
  readonly winnerId: string
  readonly winnerName: string
  readonly clientId: string
  readonly mergedBy: string
}): Promise<number> {
  const { affectedShotIds, loserId, winnerId, winnerName, clientId, mergedBy } = args
  if (affectedShotIds.length === 0) return 0

  const shotBasePath = shotsPath(clientId)
  const chunks = chunkArray(affectedShotIds, BATCH_CHUNK_SIZE)
  let updated = 0

  for (const chunk of chunks) {
    const batch = writeBatch(db)

    const shotSnaps = await Promise.all(
      chunk.map((shotId) => getDoc(buildDocRef(shotBasePath, shotId)))
    )
    for (const shotSnap of shotSnaps) {
      if (!shotSnap.exists()) continue

      const shotData = shotSnap.data()
      let changed = false

      // Replace in top-level products array + deduplicate by familyId
      const products = (shotData.products ?? []) as Record<string, unknown>[]
      const mappedProducts = products.map((p) => {
        if (p.familyId === loserId) {
          changed = true
          return { ...p, familyId: winnerId, familyName: winnerName }
        }
        return p
      })
      const seenFamilyIds = new Set<string>()
      const newProducts = mappedProducts.filter((p) => {
        const fid = p.familyId as string
        if (seenFamilyIds.has(fid)) return false
        seenFamilyIds.add(fid)
        return true
      })

      // Replace in looks + deduplicate per-look products
      const looks = (shotData.looks ?? []) as Record<string, unknown>[]
      const newLooks = looks.map((look) => {
        const lookProducts = (look.products ?? []) as Record<string, unknown>[]
        const mappedLookProducts = lookProducts.map((p) => {
          if (p.familyId === loserId) {
            changed = true
            return { ...p, familyId: winnerId, familyName: winnerName }
          }
          return p
        })
        const seenLook = new Set<string>()
        const replacedProducts = mappedLookProducts.filter((p) => {
          const fid = p.familyId as string
          if (seenLook.has(fid)) return false
          seenLook.add(fid)
          return true
        })

        const heroProductId = look.heroProductId as string | null | undefined
        const newHeroProductId = heroProductId === loserId ? winnerId : heroProductId

        if (newHeroProductId !== heroProductId) changed = true

        return { ...look, products: replacedProducts, heroProductId: newHeroProductId }
      })

      if (changed) {
        batch.update(shotSnap.ref, {
          products: newProducts,
          looks: newLooks,
          updatedAt: serverTimestamp(),
        })
        updated += 1
      }
    }

    await batch.commit()
  }

  return updated
}

// ---------------------------------------------------------------------------
// Step 6: Update pull references
// ---------------------------------------------------------------------------

async function updatePullReferences(args: {
  readonly affectedProjectIds: ReadonlyArray<string>
  readonly loserId: string
  readonly winnerId: string
  readonly winnerName: string
  readonly clientId: string
}): Promise<number> {
  const { affectedProjectIds, loserId, winnerId, winnerName, clientId } = args
  if (affectedProjectIds.length === 0) return 0

  let updated = 0

  for (const projectId of affectedProjectIds) {
    const pullBasePath = pullsPath(projectId, clientId)
    const pullCol = buildCollectionRef(pullBasePath)
    const pullSnap = await getDocs(pullCol)
    if (pullSnap.empty) continue

    const pullsToUpdate = pullSnap.docs.filter((d) => {
      const items = (d.data().items ?? []) as Record<string, unknown>[]
      return items.some((item) => item.familyId === loserId)
    })

    if (pullsToUpdate.length === 0) continue

    const chunks = chunkArray(pullsToUpdate, BATCH_CHUNK_SIZE)
    for (const chunk of chunks) {
      const batch = writeBatch(db)
      for (const pullDoc of chunk) {
        const data = pullDoc.data()
        const items = (data.items ?? []) as Record<string, unknown>[]
        const newItems = items.map((item) => {
          if (item.familyId === loserId) {
            return { ...item, familyId: winnerId, familyName: winnerName }
          }
          return item
        })

        batch.update(pullDoc.ref, {
          items: newItems,
          updatedAt: serverTimestamp(),
        })
        updated += 1
      }
      await batch.commit()
    }
  }

  return updated
}

// ---------------------------------------------------------------------------
// Step 7: Update shot request references
// ---------------------------------------------------------------------------

async function updateRequestReferences(args: {
  readonly loserId: string
  readonly winnerId: string
  readonly clientId: string
}): Promise<number> {
  const { loserId, winnerId, clientId } = args

  const requestPath = shotRequestsPath(clientId)
  const requestsCol = collection(db, requestPath[0]!, ...requestPath.slice(1))
  const q = query(requestsCol, where("relatedFamilyIds", "array-contains", loserId))
  const snap = await getDocs(q)
  if (snap.empty) return 0

  const chunks = chunkArray(snap.docs, BATCH_CHUNK_SIZE)
  let updated = 0

  for (const chunk of chunks) {
    const batch = writeBatch(db)
    for (const reqDoc of chunk) {
      const data = reqDoc.data()
      const familyIds = (data.relatedFamilyIds ?? []) as string[]
      const newFamilyIds = Array.from(
        new Set(familyIds.map((id) => (id === loserId ? winnerId : id))),
      )

      batch.update(reqDoc.ref, {
        relatedFamilyIds: newFamilyIds,
        updatedAt: serverTimestamp(),
      })
      updated += 1
    }
    await batch.commit()
  }

  return updated
}

// ---------------------------------------------------------------------------
// Step 8: Recompute winner aggregates
// ---------------------------------------------------------------------------

async function recomputeWinnerAggregates(args: {
  readonly winnerId: string
  readonly clientId: string
  readonly mergedBy: string
  readonly loserShotIds: ReadonlyArray<string>
}): Promise<void> {
  const { winnerId, clientId, mergedBy, loserShotIds } = args

  // Fetch all winner SKUs (after transfer)
  const skuPath = productFamilySkusPath(winnerId, clientId)
  const skuSnap = await getDocs(buildCollectionRef(skuPath))
  const allSkus = skuSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }) as ProductSku)
    .filter((s) => s.deleted !== true)

  // Fetch all winner samples (after transfer)
  const samplesPath = productFamilySamplesPath(winnerId, clientId)
  const sampleSnap = await getDocs(buildCollectionRef(samplesPath))
  const allSamples = sampleSnap.docs
    .map((d) => d.data())
    .filter((s) => s.deleted !== true)

  // Fetch the current winner family
  const familyPath = productFamiliesPath(clientId)
  const familyRef = buildDocRef(familyPath, winnerId)
  const familySnap = await getDoc(familyRef)
  if (!familySnap.exists()) {
    throw new Error(`[recomputeWinnerAggregates] Winner family ${winnerId} not found.`)
  }
  const winnerData = familySnap.data() as ProductFamily

  // Compute SKU aggregates
  const skuCodes = Array.from(
    new Set(allSkus.map((s) => s.skuCode).filter((c): c is string => Boolean(c))),
  )
  const colorNames = Array.from(
    new Set(
      allSkus
        .map((s) => (s.colorName ?? s.name)?.trim())
        .filter((n): n is string => Boolean(n)),
    ),
  )
  const sizeOptions = Array.from(
    new Set(allSkus.flatMap((s) => (s.sizes ? [...s.sizes] : []))),
  )

  const activeSkuStatuses = new Set(["active", "phasing_out", "coming_soon"])
  const activeSkuCount = allSkus.filter(
    (s) => s.status && activeSkuStatuses.has(s.status.trim().toLowerCase()),
  ).length

  // Compute activeRequirementCount
  let activeReqCount = 0
  for (const sku of allSkus) {
    activeReqCount += countActiveRequirements(sku.assetRequirements)
  }

  // Compute sample aggregates
  let sampleCount = 0
  let samplesArrivedCount = 0
  let earliestSampleEta: Date | null = null
  for (const s of allSamples) {
    sampleCount += 1
    if (s.status === "arrived") samplesArrivedCount += 1
    if (s.eta && s.status !== "arrived") {
      try {
        const etaDate = typeof s.eta === "object" && s.eta !== null && "toDate" in s.eta
          ? (s.eta as { toDate: () => Date }).toDate()
          : s.eta instanceof Date ? s.eta : null
        if (etaDate) {
          if (!earliestSampleEta || etaDate.getTime() < earliestSampleEta.getTime()) {
            earliestSampleEta = etaDate
          }
        }
      } catch {
        // Skip invalid timestamps
      }
    }
  }

  // Compute earliestLaunchDate
  const earliestLaunchDate = resolveEarliestLaunchDate(
    winnerData.launchDate,
    allSkus,
  )

  // Merge shotIds (union of winner + loser)
  const existingShotIds = winnerData.shotIds ? [...winnerData.shotIds] : []
  const mergedShotIds = Array.from(new Set([...existingShotIds, ...loserShotIds]))

  await updateDoc(familyRef, {
    skuCount: allSkus.length,
    activeSkuCount,
    skuCodes,
    colorNames,
    sizeOptions,
    sampleCount,
    samplesArrivedCount,
    earliestSampleEta,
    activeRequirementCount: activeReqCount,
    earliestLaunchDate,
    shotIds: mergedShotIds,
    updatedAt: serverTimestamp(),
    updatedBy: mergedBy,
  })
}

// ---------------------------------------------------------------------------
// Helper: derive project IDs from shot IDs
// ---------------------------------------------------------------------------

async function getProjectIdsFromShots(
  shotIds: ReadonlyArray<string>,
  clientId: string,
): Promise<string[]> {
  const ids = new Set<string>()
  const shotCol = buildCollectionRef(shotsPath(clientId))
  const results = await Promise.all(
    shotIds.map((shotId) =>
      getDoc(doc(shotCol, shotId)).catch(() => null),
    ),
  )
  for (const shotDoc of results) {
    if (shotDoc?.exists()) {
      const data = shotDoc.data()
      if (data.projectId) ids.add(data.projectId as string)
    }
  }
  return [...ids]
}

// ---------------------------------------------------------------------------
// Step 9: Soft-delete the loser
// ---------------------------------------------------------------------------

async function softDeleteLoser(args: {
  readonly loserId: string
  readonly winnerId: string
  readonly clientId: string
  readonly mergedBy: string
}): Promise<void> {
  const { loserId, winnerId, clientId, mergedBy } = args
  const familyPath = productFamiliesPath(clientId)
  const loserRef = buildDocRef(familyPath, loserId)

  await updateDoc(loserRef, {
    deleted: true,
    deletedAt: serverTimestamp(),
    deletedBy: mergedBy,
    mergedIntoFamilyId: winnerId,
    updatedAt: serverTimestamp(),
    updatedBy: mergedBy,
  })
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export async function executeProductMerge(args: {
  readonly winnerId: string
  readonly loserId: string
  readonly clientId: string
  readonly mergedBy: string
  readonly plan: MergePlan
  readonly winnerFamily?: ProductFamily
  readonly user?: AuthUser
}): Promise<MergeResult> {
  const { winnerId, loserId, clientId, mergedBy, plan, winnerFamily, user } = args

  if (winnerId === loserId) {
    throw new Error("Cannot merge a product family into itself.")
  }

  // CRITICAL: Set mergeInProgress flag on loser for idempotency
  // If a previous merge attempt partially completed, this flag indicates work is in progress.
  const loserRef = buildDocRef(productFamiliesPath(clientId), loserId)
  const loserSnap = await getDoc(loserRef)
  if (loserSnap.exists()) {
    const loserData = loserSnap.data()
    if (loserData.mergeInProgress === winnerId) {
      throw new Error("A merge of this product is already in progress. Please wait or contact an admin to resolve.")
    }
    if (loserData.deleted === true) {
      throw new Error("The loser product has already been deleted (possibly merged previously).")
    }
  }
  await updateDoc(loserRef, { mergeInProgress: winnerId, updatedAt: serverTimestamp() })

  try {
    // Build the loserSkuId -> winnerSkuId map from matched SKUs
    const matchedSkuMap = new Map<string, string>()
    for (const match of plan.matchedSkus) {
      matchedSkuMap.set(match.loserId, match.winnerId)
    }

    // Pre-merge version snapshot on the winner (audit trail)
    if (winnerFamily && user) {
      void createProductVersionSnapshot({
        clientId,
        familyId: winnerId,
        previousFamily: winnerFamily,
        familyPatch: {},
        user,
        changeType: "update",
      }).catch((err) => {
        console.error("[executeProductMerge] Pre-merge version snapshot failed:", err)
      })
    }

    // Step 1: Transfer new SKUs
    const skusCreated = await transferNewSkus({
      newSkus: plan.newSkus,
      winnerId,
      clientId,
      mergedBy,
    }).catch((err) => {
      throw new Error(`[executeProductMerge] Step 1 (transferNewSkus) failed: ${err instanceof Error ? err.message : String(err)}`)
    })

    // Step 2: Transfer samples
    const samplesTransferred = await transferSamples({
      loserId,
      winnerId,
      clientId,
      matchedSkuMap,
      mergedBy,
    }).catch((err) => {
      throw new Error(`[executeProductMerge] Step 2 (transferSamples) failed after ${skusCreated} SKUs created: ${err instanceof Error ? err.message : String(err)}`)
    })

    // Step 3: Transfer comments
    const commentsTransferred = await transferComments({
      loserId,
      winnerId,
      clientId,
      mergedBy,
    }).catch((err) => {
      throw new Error(`[executeProductMerge] Step 3 (transferComments) failed after ${skusCreated} SKUs, ${samplesTransferred} samples: ${err instanceof Error ? err.message : String(err)}`)
    })

    // Step 4: Transfer documents
    const documentsTransferred = await transferDocuments({
      loserId,
      winnerId,
      clientId,
      mergedBy,
    }).catch((err) => {
      throw new Error(`[executeProductMerge] Step 4 (transferDocuments) failed after ${skusCreated} SKUs, ${samplesTransferred} samples, ${commentsTransferred} comments: ${err instanceof Error ? err.message : String(err)}`)
    })

    // Step 5: Update shot references
    const shotsUpdated = await updateShotReferences({
      affectedShotIds: plan.affectedShotIds,
      loserId,
      winnerId,
      winnerName: plan.winner.styleName,
      clientId,
      mergedBy,
    }).catch((err) => {
      throw new Error(`[executeProductMerge] Step 5 (updateShotReferences) failed: ${err instanceof Error ? err.message : String(err)}`)
    })

    // Step 6: Update pull references — derive project IDs from affected shots
    const affectedProjectIds = Array.from(new Set(
      plan.affectedShotIds.length > 0
        ? await getProjectIdsFromShots(plan.affectedShotIds, clientId)
        : [],
    ))
    const pullsUpdated = await updatePullReferences({
      affectedProjectIds,
      loserId,
      winnerId,
      winnerName: plan.winner.styleName,
      clientId,
    }).catch((err) => {
      throw new Error(`[executeProductMerge] Step 6 (updatePullReferences) failed: ${err instanceof Error ? err.message : String(err)}`)
    })

    // Step 7: Update shot request references
    const requestsUpdated = await updateRequestReferences({
      loserId,
      winnerId,
      clientId,
    }).catch((err) => {
      throw new Error(`[executeProductMerge] Step 7 (updateRequestReferences) failed: ${err instanceof Error ? err.message : String(err)}`)
    })

    // Step 8: Recompute winner aggregates
    const loserShotIds = plan.affectedShotIds
    await recomputeWinnerAggregates({
      winnerId,
      clientId,
      mergedBy,
      loserShotIds,
    }).catch((err) => {
      throw new Error(`[executeProductMerge] Step 8 (recomputeWinnerAggregates) failed: ${err instanceof Error ? err.message : String(err)}`)
    })

    // Step 9: Soft-delete the loser (LAST step)
    await softDeleteLoser({
      loserId,
      winnerId,
      clientId,
      mergedBy,
    }).catch((err) => {
      throw new Error(`[executeProductMerge] Step 9 (softDeleteLoser) failed: ${err instanceof Error ? err.message : String(err)}`)
    })

    // Post-merge version snapshot on the winner (audit trail)
    if (user) {
      const familyPath = productFamiliesPath(clientId)
      const familyRef = buildDocRef(familyPath, winnerId)
      const freshSnap = await getDoc(familyRef).catch(() => null)
      if (freshSnap?.exists() && winnerFamily) {
        void createProductVersionSnapshot({
          clientId,
          familyId: winnerId,
          previousFamily: winnerFamily,
          familyPatch: freshSnap.data() as Record<string, unknown>,
          user,
          changeType: "update",
        }).catch((err) => {
          console.error("[executeProductMerge] Post-merge version snapshot failed:", err)
        })
      }
    }

    return {
      skusCreated,
      skusMerged: plan.matchedSkus.length,
      samplesTransferred,
      commentsTransferred,
      documentsTransferred,
      shotsUpdated,
      pullsUpdated,
      requestsUpdated,
    }
  } catch (err) {
    // Clear mergeInProgress flag so the merge can be retried (with retry)
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await updateDoc(loserRef, { mergeInProgress: deleteField(), updatedAt: serverTimestamp() })
        break
      } catch (cleanupErr) {
        if (attempt === 2) {
          console.error("[executeProductMerge] Failed to clear mergeInProgress after 3 attempts. Manual Firestore fix needed for product:", loserId, cleanupErr)
        }
      }
    }
    throw err
  }
}
