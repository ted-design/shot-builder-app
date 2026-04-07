import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotsPath } from "@/shared/lib/paths"
import { computeMaxShotNumber, formatShotNumber } from "./shotNumbering"
import type { Shot, ShotTag } from "@/shared/types"

/** Maximum documents per Firestore WriteBatch (limit is 500; 250 for safety). */
const BATCH_CHUNK_SIZE = 250

/** Hard cap on single bulk-create operation to prevent accidental runaway writes. */
const MAX_BULK_ITEMS = 500

export interface BulkShotItem {
  readonly familyId: string
  readonly familyName: string
  readonly skuId?: string
  readonly skuName?: string
  readonly colourId?: string
  readonly colourName?: string
  readonly thumbUrl?: string
  readonly gender?: string | null
}

export interface BulkCreateShotsInput {
  readonly clientId: string
  readonly projectId: string
  readonly items: readonly BulkShotItem[]
  readonly createdBy: string
}

export interface BulkCreateShotsResult {
  readonly created: number
}

function buildShotTitle(item: BulkShotItem): string {
  return item.familyName
}

function buildShotDescription(item: BulkShotItem): string {
  return item.skuName ?? ""
}

/** Map raw gender values to tag labels. Returns null for unrecognized
 *  values (e.g. "Kids", "Boys") — those intentionally get no tag. */
function normalizeGenderLabel(gender: string): string | null {
  switch (gender.toLowerCase()) {
    case "men":
    case "male":
      return "Men"
    case "women":
    case "female":
      return "Women"
    case "unisex":
      return "Unisex"
    default:
      return null
  }
}

const GENDER_TAG_MAP: Record<string, ShotTag> = {
  Men: { id: "default-gender-men", label: "Men", color: "blue", category: "gender" },
  Women: { id: "default-gender-women", label: "Women", color: "pink", category: "gender" },
  Unisex: { id: "default-gender-unisex", label: "Unisex", color: "purple", category: "gender" },
}

function buildGenderTag(item: BulkShotItem): ShotTag | null {
  if (!item.gender) return null
  const label = normalizeGenderLabel(item.gender)
  if (!label) return null
  return GENDER_TAG_MAP[label] ?? null
}

function buildProductAssignment(item: BulkShotItem): Record<string, unknown> {
  const base: Record<string, unknown> = {
    familyId: item.familyId,
    familyName: item.familyName,
  }
  if (item.skuId) {
    base["skuId"] = item.skuId
    base["skuName"] = item.skuName ?? item.skuId
    base["colourId"] = item.colourId ?? item.skuId
    base["colourName"] = item.colourName ?? item.skuName ?? item.skuId
  }
  if (item.thumbUrl) {
    base["thumbUrl"] = item.thumbUrl
  }
  return base
}

async function fetchMaxShotNumber(
  clientId: string,
  projectId: string,
): Promise<number> {
  const path = shotsPath(clientId)
  const ref = collection(db, path[0]!, ...path.slice(1))
  const snap = await getDocs(query(ref, where("projectId", "==", projectId)))
  const activeShots = snap.docs.filter((d) => d.data().deleted !== true)
  const shots = activeShots.map((d) => ({
    shotNumber: (d.data()["shotNumber"] as string | undefined) ?? undefined,
  })) as Pick<Shot, "shotNumber">[]
  return computeMaxShotNumber(shots as Shot[])
}

function chunkArray<T>(arr: readonly T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size) as T[])
  }
  return chunks
}

/**
 * Creates multiple shot documents in a single project from a list of product items.
 *
 * Batches writes into chunks of 250 to stay within Firestore's 500-op limit.
 * Shot numbering continues from the highest existing shot number in the project.
 * Version snapshots are skipped for bulk creates.
 */
export async function bulkCreateShotsFromProducts(
  input: BulkCreateShotsInput,
): Promise<BulkCreateShotsResult> {
  const { clientId, projectId, items, createdBy } = input

  if (items.length === 0) {
    return { created: 0 }
  }

  if (items.length > MAX_BULK_ITEMS) {
    throw new Error(`Cannot create more than ${MAX_BULK_ITEMS} shots at once.`)
  }

  const maxExisting = await fetchMaxShotNumber(clientId, projectId)
  const startingNumber = maxExisting + 1
  const now = Date.now()

  const path = shotsPath(clientId)
  const colRef = collection(db, path[0]!, ...path.slice(1))

  const chunks = chunkArray(items, BATCH_CHUNK_SIZE)
  let created = 0

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex]!
    const batch = writeBatch(db)

    for (let i = 0; i < chunk.length; i++) {
      const item = chunk[i]!
      const globalIndex = chunkIndex * BATCH_CHUNK_SIZE + i
      const shotNum = startingNumber + globalIndex
      const docRef = doc(colRef)
      const assignment = buildProductAssignment(item)
      const defaultLook = {
        id: crypto.randomUUID(),
        label: "Look 1",
        order: 0,
        products: [assignment],
        heroProductId: assignment.familyId,
      }

      const genderTag = buildGenderTag(item)
      const tags: ShotTag[] = genderTag ? [genderTag] : []

      batch.set(docRef, {
        title: buildShotTitle(item),
        description: buildShotDescription(item),
        projectId,
        clientId,
        status: "todo",
        products: [assignment],
        looks: [defaultLook],
        talent: [],
        tags,
        sortOrder: now + globalIndex,
        shotNumber: formatShotNumber(shotNum),
        date: null,
        deleted: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy,
      })

      created++
    }

    await batch.commit()
  }

  return { created }
}
