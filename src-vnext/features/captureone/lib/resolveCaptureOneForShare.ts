// Resolves per-shot Capture One hero filenames for denormalization into a
// captureOneShares document. Run at share-create (and refresh) time while the
// caller is authenticated, so productFamilies reads succeed under normal rules.
// The public digi-tech page then renders the stored payload with no Firestore reads.

import { collection, doc, getDoc, getDocs, query, where } from "firebase/firestore"
import { db } from "@/shared/lib/firebase"
import { shotsPath, projectPath, productFamiliesPath } from "@/shared/lib/paths"
import { buildHeroFilename, type HeroFilename } from "@/features/captureone/lib/captureOneFilename"
import { lookHeroAssignments } from "@/features/shots/lib/lookHeroes"
import { normalizeProducts } from "@/features/shots/lib/mapShot"
import type { ProductAssignment, ShotLook } from "@/shared/types"

export interface ResolvedCaptureOneShot {
  readonly id: string
  readonly shotNumber: string | null
  readonly title: string
  readonly filenames: readonly HeroFilename[]
}

export interface ResolvedCaptureOnePayload {
  readonly projectName: string
  readonly shots: readonly ResolvedCaptureOneShot[]
}

function docRef(path: string[], ...extra: string[]) {
  const segments = [...path, ...extra]
  return doc(db, segments[0]!, ...segments.slice(1))
}

function colRef(path: string[]) {
  return collection(db, path[0]!, ...path.slice(1))
}

function normaliseString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Hero product assignments across all looks of a shot (isHero-first, legacy fallback).
 * Reads RAW Firestore shots, so products are run through normalizeProducts first
 * (legacy productId->familyId, productName->familyName) before hero resolution.
 * No dedup here — buildShotFilenames dedupes by the final filename, which is the
 * identity that actually matters (distinct colourways must not collapse).
 */
export function shotHeroAssignments(data: Record<string, unknown>): ProductAssignment[] {
  const rawLooks = Array.isArray(data.looks) ? (data.looks as Record<string, unknown>[]) : []
  const sources: ShotLook[] =
    rawLooks.length > 0
      ? rawLooks.map((l) => ({
          id: typeof l.id === "string" ? l.id : "_",
          products: normalizeProducts(l.products),
          heroProductId: typeof l.heroProductId === "string" ? l.heroProductId : undefined,
        }))
      : Array.isArray(data.products)
        ? [{ id: "_", products: normalizeProducts(data.products) }]
        : []

  return sources.flatMap((look) => lookHeroAssignments(look))
}

export async function resolveCaptureOneForShare(
  clientId: string,
  projectId: string,
  shotIds: readonly string[] | null,
): Promise<ResolvedCaptureOnePayload> {
  const projectSnap = await getDoc(docRef(projectPath(projectId, clientId)))
  const projectName = projectSnap.exists()
    ? (normaliseString((projectSnap.data() as Record<string, unknown>).name) ?? "Project")
    : "Project"

  type ShotDoc = { id: string; data: Record<string, unknown> }
  let shotDocs: ShotDoc[] = []
  const validShotIds = shotIds
    ? shotIds.filter((id) => typeof id === "string" && id.trim().length > 0)
    : null

  if (validShotIds && validShotIds.length > 0) {
    const refs = validShotIds.map((sid) => docRef(shotsPath(clientId), sid))
    const snaps = await Promise.all(refs.map((r) => getDoc(r)))
    shotDocs = snaps
      .filter((s) => s.exists())
      .map((s) => ({ id: s.id, data: (s.data() ?? {}) as Record<string, unknown> }))
  } else {
    const snaps = await getDocs(query(colRef(shotsPath(clientId)), where("projectId", "==", projectId)))
    shotDocs = snaps.docs.map((d) => ({ id: d.id, data: (d.data() ?? {}) as Record<string, unknown> }))
  }

  const shotsRaw = shotDocs
    .filter((d) => d.data.projectId === projectId && d.data.deleted !== true)
    .sort((a, b) => {
      const aNum = a.data.shotNumber != null ? String(a.data.shotNumber) : ""
      const bNum = b.data.shotNumber != null ? String(b.data.shotNumber) : ""
      return aNum.localeCompare(bNum, undefined, { numeric: true })
    })

  // Batch-read hero product families for gender.
  const familyIdSet = new Set<string>()
  const heroesByShot = new Map<string, ProductAssignment[]>()
  for (const s of shotsRaw) {
    const heroes = shotHeroAssignments(s.data)
    heroesByShot.set(s.id, heroes)
    for (const p of heroes) {
      if (p.familyId) familyIdSet.add(p.familyId)
    }
  }

  const genderByFamily = new Map<string, string | null>()
  if (familyIdSet.size > 0) {
    const refs = Array.from(familyIdSet).map((fid) => docRef(productFamiliesPath(clientId), fid))
    const snaps = await Promise.all(refs.map((r) => getDoc(r)))
    for (const snap of snaps) {
      if (!snap.exists()) continue
      genderByFamily.set(snap.id, normaliseString((snap.data() as Record<string, unknown>).gender))
    }
  }

  const shots: ResolvedCaptureOneShot[] = shotsRaw.map((s) => ({
    id: s.id,
    shotNumber: normaliseString(s.data.shotNumber),
    title: normaliseString(s.data.title) ?? normaliseString(s.data.name) ?? "Untitled Shot",
    filenames: buildShotFilenames(heroesByShot.get(s.id) ?? [], genderByFamily),
  }))

  return { projectName, shots }
}

/** Build deduped Capture One filenames for a shot's hero products, prefix from each family's gender. */
export function buildShotFilenames(
  heroes: ReadonlyArray<ProductAssignment>,
  genderByFamily: ReadonlyMap<string, string | null>,
): HeroFilename[] {
  const filenames: HeroFilename[] = []
  const seenNames = new Set<string>()
  for (const p of heroes) {
    const productName = normaliseString(p.familyName) ?? normaliseString(p.skuName)
    if (!productName) continue // a nameless hero can't produce a usable filename — skip, don't emit "U_"
    const file = buildHeroFilename({
      gender: p.familyId ? genderByFamily.get(p.familyId) ?? null : null,
      productName,
      colorway: normaliseString(p.colourName),
    })
    if (seenNames.has(file.name)) continue
    seenNames.add(file.name)
    filenames.push(file)
  }
  return filenames
}
