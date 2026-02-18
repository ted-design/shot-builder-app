/**
 * DEV-ONLY: Q1 Hub Shoot — photo deliverables import tool.
 * Creates 17 photo shots from slide 10 of the Q1 Hub Shoot deck
 * into project "Q1-26 Hub Shoot" (D0EN5sUwvkzG8gfWmtdY).
 * This file is temporary and should be removed after the import is complete.
 */
import { useState } from "react"
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore"
import { useAuth } from "@/app/providers/AuthProvider"
import { db } from "@/shared/lib/firebase"
import { productFamiliesPath, shotsPath } from "@/shared/lib/paths"
import { createShotVersionSnapshot } from "@/features/shots/lib/shotVersioning"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import type { ProductAssignment, ShotTag } from "@/shared/types"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ID = "D0EN5sUwvkzG8gfWmtdY"

// ---------------------------------------------------------------------------
// Tag definitions
// ---------------------------------------------------------------------------

const TAG_GENDER_MEN: ShotTag = {
  id: "default-gender-men",
  label: "Men",
  color: "blue",
  category: "gender",
}
const TAG_GENDER_WOMEN: ShotTag = {
  id: "default-gender-women",
  label: "Women",
  color: "pink",
  category: "gender",
}
const TAG_MEDIA_PHOTO: ShotTag = {
  id: "default-media-photo",
  label: "Photo",
  color: "emerald",
  category: "media",
}

// ---------------------------------------------------------------------------
// Product reference keys — each is matched by name search against families
// ---------------------------------------------------------------------------

type ProductRefKey =
  | "W_TRENCH_COAT_LONG"
  | "W_SHORT_TRENCH_COAT"
  | "W_POPLIN_SHIRT"
  | "W_EASY_TRAVEL_PANTS"
  | "W_RIBBED_LONG_SLEEVE"
  | "W_TRANSIT_SWEATPANTS"
  | "W_FINE_KNIT_DRESS"
  | "W_TRAVEL_PANTS"
  | "W_LS_FINE_KNIT_POLO"
  | "W_BERMUDA_SHORTS"
  | "W_LOUNGE_HOODIE"
  | "M_OVERCOAT"
  | "M_POPLIN_SHIRT"
  | "M_TRAVEL_PANTS"
  | "M_PULL_ON_PANTS"
  | "M_FINE_KNIT_POLO"
  | "M_COMPACT_TRAVEL_HOODIE"
  | "M_PIQUE_BUTTON_UP"
  | "M_TRAVEL_SHORTS"

interface ProductRefDef {
  readonly key: ProductRefKey
  readonly label: string
  readonly searchTerms: ReadonlyArray<string>
  readonly genderHint?: "men" | "women"
}

const PRODUCT_REFS: ReadonlyArray<ProductRefDef> = [
  { key: "W_TRENCH_COAT_LONG", label: "Women's Trench Coat (Long)", searchTerms: ["Trench Coat"], genderHint: "women" },
  { key: "W_SHORT_TRENCH_COAT", label: "Women's Short Trench Coat", searchTerms: ["Short Trench"], genderHint: "women" },
  { key: "W_POPLIN_SHIRT", label: "Women's Poplin Shirt", searchTerms: ["Poplin"], genderHint: "women" },
  { key: "W_EASY_TRAVEL_PANTS", label: "Women's Easy Travel Pants", searchTerms: ["Easy", "Travel Pant"], genderHint: "women" },
  { key: "W_RIBBED_LONG_SLEEVE", label: "Women's Ribbed Long Sleeve", searchTerms: ["Ribbed"], genderHint: "women" },
  { key: "W_TRANSIT_SWEATPANTS", label: "Women's Transit Sweatpants", searchTerms: ["Transit"], genderHint: "women" },
  { key: "W_FINE_KNIT_DRESS", label: "Women's Fine Knit Dress", searchTerms: ["Fine Knit", "Dress"], genderHint: "women" },
  { key: "W_TRAVEL_PANTS", label: "Women's Travel Pants", searchTerms: ["Travel Pant"], genderHint: "women" },
  { key: "W_LS_FINE_KNIT_POLO", label: "Women's LS Fine Knit Polo", searchTerms: ["Fine Knit Polo"], genderHint: "women" },
  { key: "W_BERMUDA_SHORTS", label: "Women's Bermuda Shorts", searchTerms: ["Bermuda"], genderHint: "women" },
  { key: "W_LOUNGE_HOODIE", label: "Women's Lounge Hoodie", searchTerms: ["Lounge Hoodie"], genderHint: "women" },
  { key: "M_OVERCOAT", label: "Men's Overcoat", searchTerms: ["Overcoat"], genderHint: "men" },
  { key: "M_POPLIN_SHIRT", label: "Men's Poplin Shirt", searchTerms: ["Poplin"], genderHint: "men" },
  { key: "M_TRAVEL_PANTS", label: "Men's Travel Pants", searchTerms: ["Travel Pant"], genderHint: "men" },
  { key: "M_PULL_ON_PANTS", label: "Men's Pull-on Pants", searchTerms: ["Pull-On"], genderHint: "men" },
  { key: "M_FINE_KNIT_POLO", label: "Men's Fine Knit Polo", searchTerms: ["Fine Knit Polo"], genderHint: "men" },
  { key: "M_COMPACT_TRAVEL_HOODIE", label: "Men's Compact Travel Hoodie", searchTerms: ["Compact Travel Hoodie"], genderHint: "men" },
  { key: "M_PIQUE_BUTTON_UP", label: "Men's Pique Button Up", searchTerms: ["Pique", "Button"], genderHint: "men" },
  { key: "M_TRAVEL_SHORTS", label: "Men's Travel Shorts", searchTerms: ["Travel Short"], genderHint: "men" },
]

// ---------------------------------------------------------------------------
// Shot data — 17 rows from slide 10 (photo deliverables)
// ---------------------------------------------------------------------------

interface ImportShot {
  readonly title: string
  readonly shotNumber: string
  readonly description: string
  readonly notes: string | null
  readonly gender: "men" | "women" | null
  readonly productKeys: ReadonlyArray<ProductRefKey>
}

const Q1_HUB_SHOTS: ReadonlyArray<ImportShot> = [
  // Row 1: W-Trench coat (long) | W-Poplin + Easy Travel pants | Business Travel
  {
    title: "Women's Trench Coat (Long) — Business Travel",
    shotNumber: "Q1H_W_TrenchCoatLong_BusinessTravel",
    description: "Styled for Business Travel",
    notes: "Shoot w/o trench coat to capture Poplin shirt + Easy Travel Pants",
    gender: "women",
    productKeys: ["W_TRENCH_COAT_LONG", "W_POPLIN_SHIRT", "W_EASY_TRAVEL_PANTS"],
  },
  // Row 2: W-Trench coat (long) | W-Ribbed LS + Transit Sweatpants | Casual Travel
  {
    title: "Women's Trench Coat (Long) — Casual Travel",
    shotNumber: "Q1H_W_TrenchCoatLong_CasualTravel",
    description: "Styled for Casual Travel",
    notes: "Shoot w/o trench coat to capture long-sleeve",
    gender: "women",
    productKeys: ["W_TRENCH_COAT_LONG", "W_RIBBED_LONG_SLEEVE", "W_TRANSIT_SWEATPANTS"],
  },
  // Row 3: W-Fine Knit dress | Add Trench Coat (long) on top as alt | Smart Casual Travel
  {
    title: "Women's Fine Knit Dress — Smart Casual Travel",
    shotNumber: "Q1H_W_FineKnitDress_SmartCasualTravel",
    description: "Styled for Smart Casual Travel",
    notes: "Add Trench Coat (long) on top as an alt shot",
    gender: "women",
    productKeys: ["W_FINE_KNIT_DRESS", "W_TRENCH_COAT_LONG"],
  },
  // Row 4: W–Short trench coat | W-Travel Pants | leisure travel
  {
    title: "Women's Short Trench Coat — Leisure Travel",
    shotNumber: "Q1H_W_ShortTrenchCoat_LeisureTravel",
    description: "Styled for leisure travel",
    notes: null,
    gender: "women",
    productKeys: ["W_SHORT_TRENCH_COAT", "W_TRAVEL_PANTS"],
  },
  // Row 5: W–Short trench coat | W-Poplin + Easy Travel pants | city/work
  {
    title: "Women's Short Trench Coat — City/Work",
    shotNumber: "Q1H_W_ShortTrenchCoat_CityWork",
    description: "Styled for the city/work",
    notes: null,
    gender: "women",
    productKeys: ["W_SHORT_TRENCH_COAT", "W_POPLIN_SHIRT", "W_EASY_TRAVEL_PANTS"],
  },
  // Row 6: M-Overcoat | M-Poplin + Travel Pants (updated Relaxed) | Business Travel
  {
    title: "Men's Overcoat — Business Travel",
    shotNumber: "Q1H_M_Overcoat_BusinessTravel",
    description: "Styled for Business Travel",
    notes: "Shoot w/o overcoat to capture Poplin + Travel Pants",
    gender: "men",
    productKeys: ["M_OVERCOAT", "M_POPLIN_SHIRT", "M_TRAVEL_PANTS"],
  },
  // Row 7: M-Overcoat | M-Pull on pants | Casual Travel
  {
    title: "Men's Overcoat — Casual Travel",
    shotNumber: "Q1H_M_Overcoat_CasualTravel",
    description: "Styled for Casual Travel",
    notes: "Shoot w/o overcoat to capture Pull-on Pants",
    gender: "men",
    productKeys: ["M_OVERCOAT", "M_PULL_ON_PANTS"],
  },
  // Row 8: M-Fine Knit Polo | Add OverCoat on top as alt | Smart Casual Travel
  {
    title: "Men's Fine Knit Polo — Smart Casual Travel",
    shotNumber: "Q1H_M_FineKnitPolo_SmartCasualTravel",
    description: "Styled for Smart Casual Travel",
    notes: "Add Overcoat on top as an alt shot. Shoot full-length + zoom in on top and bottom",
    gender: "men",
    productKeys: ["M_FINE_KNIT_POLO", "M_OVERCOAT"],
  },
  // Row 9: W-Poplin | W-Easy Travel Pants | city/work
  {
    title: "Women's Poplin — City/Work",
    shotNumber: "Q1H_W_Poplin_CityWork",
    description: "Styled for the city/work",
    notes: null,
    gender: "women",
    productKeys: ["W_POPLIN_SHIRT", "W_EASY_TRAVEL_PANTS"],
  },
  // Row 10: M-Poplin | M-Travel Pants | city/work
  {
    title: "Men's Poplin — City/Work",
    shotNumber: "Q1H_M_Poplin_CityWork",
    description: "Styled for the city/work",
    notes: null,
    gender: "men",
    productKeys: ["M_POPLIN_SHIRT", "M_TRAVEL_PANTS"],
  },
  // Row 11: W-Long Sleeve Fine Knit Polo | W-Pants TBD | leisure travel
  {
    title: "Women's LS Fine Knit Polo — Leisure Travel",
    shotNumber: "Q1H_W_LSFineKnitPolo_LeisureTravel",
    description: "Styled for leisure travel",
    notes: "Shoot full-length + zoom in on top and bottom",
    gender: "women",
    productKeys: ["W_LS_FINE_KNIT_POLO"],
  },
  // Row 12: M-Core Compact Travel Hoodie
  {
    title: "Men's Compact Travel Hoodie",
    shotNumber: "Q1H_M_CompactTravelHoodie",
    description: "Core Product",
    notes: null,
    gender: "men",
    productKeys: ["M_COMPACT_TRAVEL_HOODIE"],
  },
  // Row 13: W-Core Lounge Hoodie
  {
    title: "Women's Lounge Hoodie",
    shotNumber: "Q1H_W_LoungeHoodie",
    description: "Core Product",
    notes: null,
    gender: "women",
    productKeys: ["W_LOUNGE_HOODIE"],
  },
  // Row 14: M–Pique Button Up | M-Travel Shorts
  {
    title: "Men's Pique Button Up + Travel Shorts",
    shotNumber: "Q1H_M_PiqueButtonUp_TravelShorts",
    description: "",
    notes: "Shoot full-length + zoom in on top and bottom",
    gender: "men",
    productKeys: ["M_PIQUE_BUTTON_UP", "M_TRAVEL_SHORTS"],
  },
  // Row 15: Women's Bermuda Shorts
  {
    title: "Women's Bermuda Shorts",
    shotNumber: "Q1H_W_BermudaShorts",
    description: "",
    notes: null,
    gender: "women",
    productKeys: ["W_BERMUDA_SHORTS"],
  },
  // Row 16: STILL LIFE: Folded Stack – Fine Knit (M+W Combo)
  {
    title: "Still Life: Folded Stack — Fine Knit (M+W)",
    shotNumber: "Q1H_StillLife_FineKnit_MW",
    description: "Fine Knit M+W Combo",
    notes: null,
    gender: null,
    productKeys: ["W_LS_FINE_KNIT_POLO", "M_FINE_KNIT_POLO"],
  },
  // Row 17: STILL LIFE: Folded Stack – Poplin shirts (M+W Combo)
  {
    title: "Still Life: Folded Stack — Poplin Shirts (M+W)",
    shotNumber: "Q1H_StillLife_Poplin_MW",
    description: "Poplin Shirts M+W Combo",
    notes: null,
    gender: null,
    productKeys: ["M_POPLIN_SHIRT", "W_POPLIN_SHIRT"],
  },
]

// ---------------------------------------------------------------------------
// Firestore helpers
// ---------------------------------------------------------------------------

/** Strip `undefined` values from objects (Firestore rejects them). */
function stripUndefined(obj: unknown): unknown {
  if (obj === null || obj === undefined) return null
  if (Array.isArray(obj)) return obj.map(stripUndefined)
  if (typeof obj === "object" && Object.getPrototypeOf(obj) === Object.prototype) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v !== undefined) out[k] = stripUndefined(v)
    }
    return out
  }
  return obj
}

function buildTags(shot: ImportShot): ReadonlyArray<ShotTag> {
  const tags: ShotTag[] = []
  if (shot.gender === "men") tags.push(TAG_GENDER_MEN)
  if (shot.gender === "women") tags.push(TAG_GENDER_WOMEN)
  tags.push(TAG_MEDIA_PHOTO)
  return tags
}

// ---------------------------------------------------------------------------
// Product family matching
// ---------------------------------------------------------------------------

interface FamilyInfo {
  readonly id: string
  readonly styleName: string
  readonly gender: string
  readonly thumbnailImagePath?: string
}

async function loadFamilies(clientId: string): Promise<ReadonlyArray<FamilyInfo>> {
  const basePath = productFamiliesPath(clientId)
  const colRef = collection(db, basePath[0]!, ...basePath.slice(1))
  const snap = await getDocs(query(colRef, where("deleted", "==", false)))
  const families: FamilyInfo[] = []
  snap.forEach((docSnap) => {
    const d = docSnap.data()
    families.push({
      id: docSnap.id,
      styleName: (d.styleName as string) ?? "",
      gender: (d.gender as string) ?? "",
      thumbnailImagePath: (d.thumbnailImagePath as string) ?? undefined,
    })
  })
  return families
}

function matchProductRef(
  ref: ProductRefDef,
  families: ReadonlyArray<FamilyInfo>,
): FamilyInfo | null {
  const nameLC = (term: string) => term.toLowerCase()

  // Filter by gender hint — check the gender field first, then name with careful matching
  const genderFiltered = ref.genderHint
    ? families.filter((f) => {
        if (f.gender === ref.genderHint) return true
        const nameLC = f.styleName.toLowerCase()
        // "men's" must NOT match inside "women's"
        if (ref.genderHint === "men") return nameLC.includes("men's") && !nameLC.includes("women's")
        return nameLC.includes("women's")
      })
    : families

  // For multi-term search, ALL terms must match
  for (const family of genderFiltered) {
    const fName = nameLC(family.styleName)
    const allMatch = ref.searchTerms.every((term) => fName.includes(nameLC(term)))
    if (allMatch) return family
  }

  // Fallback: try without gender filter
  for (const family of families) {
    const fName = nameLC(family.styleName)
    const allMatch = ref.searchTerms.every((term) => fName.includes(nameLC(term)))
    if (allMatch) return family
  }

  return null
}

async function loadExistingShotNumbers(clientId: string): Promise<Set<string>> {
  const basePath = shotsPath(clientId)
  const colRef = collection(db, basePath[0]!, ...basePath.slice(1))
  const snap = await getDocs(
    query(colRef, where("projectId", "==", PROJECT_ID), where("deleted", "==", false)),
  )
  const existing = new Set<string>()
  snap.forEach((docSnap) => {
    const sn = docSnap.data().shotNumber
    if (typeof sn === "string" && sn.trim().length > 0) existing.add(sn.trim())
  })
  return existing
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type LogEntry = {
  readonly text: string
  readonly variant: "info" | "success" | "error" | "skip"
}

type PreloadState = {
  readonly existingShotNumbers: Set<string>
  readonly families: ReadonlyArray<FamilyInfo>
  readonly productMatches: ReadonlyMap<ProductRefKey, FamilyInfo | null>
}

export default function DevImportQ1HubShots() {
  const { clientId, user } = useAuth()
  const [preload, setPreload] = useState<PreloadState | null>(null)
  const [checking, setChecking] = useState(false)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [log, setLog] = useState<ReadonlyArray<LogEntry>>([])

  const addLog = (entry: LogEntry) => setLog((prev) => [...prev, entry])

  const preloadData = async () => {
    if (!clientId) return
    setChecking(true)
    try {
      addLog({ text: "Loading product families...", variant: "info" })
      const families = await loadFamilies(clientId)
      addLog({ text: `Found ${families.length} product families.`, variant: "info" })
      addLog({ text: "--- All families ---", variant: "info" })
      for (const f of [...families].sort((a, b) => a.styleName.localeCompare(b.styleName))) {
        addLog({ text: `  [${f.gender || "?"}] ${f.styleName} (${f.id})`, variant: "info" })
      }
      addLog({ text: "--- Matching product references ---", variant: "info" })
      const productMatches = new Map<ProductRefKey, FamilyInfo | null>()
      for (const ref of PRODUCT_REFS) {
        const match = matchProductRef(ref, families)
        productMatches.set(ref.key, match)
        if (match) {
          addLog({ text: `  ${ref.label} -> ${match.styleName} (${match.id})`, variant: "success" })
        } else {
          addLog({ text: `  ${ref.label} -> NOT FOUND`, variant: "error" })
        }
      }

      addLog({ text: "Checking existing shots in project...", variant: "info" })
      const existingShotNumbers = await loadExistingShotNumbers(clientId)
      addLog({ text: `Found ${existingShotNumbers.size} existing shots.`, variant: "info" })

      setPreload({ existingShotNumbers, families, productMatches })
      addLog({ text: "Preload complete. Ready to import.", variant: "success" })
    } catch (err) {
      addLog({
        text: `Error: ${err instanceof Error ? err.message : String(err)}`,
        variant: "error",
      })
    } finally {
      setChecking(false)
    }
  }

  const buildProductAssignments = (
    shot: ImportShot,
  ): ReadonlyArray<ProductAssignment> => {
    if (!preload) return []
    const assignments: ProductAssignment[] = []
    for (const key of shot.productKeys) {
      const family = preload.productMatches.get(key)
      if (family) {
        assignments.push({
          familyId: family.id,
          familyName: family.styleName,
          sizeScope: "pending",
          quantity: 1,
          thumbUrl: family.thumbnailImagePath,
          familyImageUrl: family.thumbnailImagePath,
        })
      }
    }
    return assignments
  }

  const runImport = async () => {
    if (!clientId || !user?.uid || !preload) return
    setRunning(true)

    const userId = user.uid
    const baseTime = Date.now()
    let created = 0
    let skipped = 0
    let errors = 0

    for (let i = 0; i < Q1_HUB_SHOTS.length; i++) {
      const shot = Q1_HUB_SHOTS[i]!

      if (preload.existingShotNumbers.has(shot.shotNumber)) {
        addLog({ text: `SKIP: "${shot.title}" — already exists.`, variant: "skip" })
        skipped += 1
        continue
      }

      try {
        const products = buildProductAssignments(shot)
        const tags = buildTags(shot)
        const looks = products.length > 0
          ? [{ id: "primary", label: "Primary", order: 0, products: [...products] }]
          : [{ id: "primary", label: "Primary", order: 0, products: [] as ProductAssignment[] }]

        const shotData = {
          title: shot.title,
          description: shot.description || null,
          projectId: PROJECT_ID,
          clientId,
          status: "todo",
          talent: [],
          products: [...products],
          sortOrder: baseTime + i,
          shotNumber: shot.shotNumber,
          tags,
          looks,
          referenceLinks: [],
          deleted: false,
          notes: shot.notes,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: userId,
        }

        const cleanData = stripUndefined(shotData) as Record<string, unknown>
        cleanData.createdAt = serverTimestamp()
        cleanData.updatedAt = serverTimestamp()

        const basePath = shotsPath(clientId)
        const colRef = collection(db, basePath[0]!, ...basePath.slice(1))
        const docRef = await addDoc(colRef, cleanData)

        try {
          await createShotVersionSnapshot({
            clientId,
            shotId: docRef.id,
            previousShot: null,
            patch: shotData,
            user: {
              uid: user.uid,
              email: user.email ?? null,
              displayName: user.displayName ?? null,
              photoURL: user.photoURL ?? null,
            },
            changeType: "create",
          })
        } catch {
          // Best-effort version snapshot
        }

        const productNote = products.length > 0
          ? products.map((p) => p.familyName).join(", ")
          : "No products matched"

        addLog({
          text: `CREATED: "${shot.title}" -> ${docRef.id} | Products: ${productNote}`,
          variant: "success",
        })
        created += 1
      } catch (err) {
        addLog({
          text: `ERROR: "${shot.title}" — ${err instanceof Error ? err.message : String(err)}`,
          variant: "error",
        })
        errors += 1
      }
    }

    addLog({
      text: `\nDone. Created: ${created}, Skipped: ${skipped}, Errors: ${errors}`,
      variant: created > 0 ? "success" : "info",
    })
    setDone(true)
    setRunning(false)
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-xl font-bold text-[var(--color-text)]">
          Q1 Hub Shoot — Photo Deliverables Import
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Import 17 photo shots from Slide 10 into project Q1-26 Hub Shoot.
          Dev-only tool — remove after use.
        </p>
      </div>

      {/* Preview table */}
      <div className="mb-6 overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
              <th className="px-3 py-2 text-left text-xs font-semibold">#</th>
              <th className="px-3 py-2 text-left text-xs font-semibold">Title</th>
              <th className="px-3 py-2 text-left text-xs font-semibold">Description</th>
              <th className="px-3 py-2 text-left text-xs font-semibold">Gender</th>
              <th className="px-3 py-2 text-left text-xs font-semibold">Products</th>
              <th className="px-3 py-2 text-left text-xs font-semibold">Notes</th>
              <th className="px-3 py-2 text-left text-xs font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {Q1_HUB_SHOTS.map((shot, i) => {
              const isDupe = preload?.existingShotNumbers.has(shot.shotNumber) ?? false
              return (
                <tr key={shot.shotNumber} className="border-b border-[var(--color-border)] last:border-b-0">
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">{i + 1}</td>
                  <td className="px-3 py-2 font-medium text-[var(--color-text)]">{shot.title}</td>
                  <td className="px-3 py-2 text-xs text-[var(--color-text-muted)]">{shot.description || "—"}</td>
                  <td className="px-3 py-2 text-xs text-[var(--color-text-muted)]">
                    {shot.gender === "men" ? "Men" : shot.gender === "women" ? "Women" : "M+W"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-0.5">
                      {shot.productKeys.map((key) => {
                        const ref = PRODUCT_REFS.find((r) => r.key === key)
                        const match = preload?.productMatches.get(key)
                        return (
                          <span
                            key={key}
                            className={`text-xs ${
                              !preload
                                ? "text-[var(--color-text-subtle)]"
                                : match
                                  ? "text-green-600"
                                  : "text-red-600"
                            }`}
                          >
                            {match ? match.styleName : ref?.label ?? key}
                          </span>
                        )
                      })}
                    </div>
                  </td>
                  <td className="max-w-[200px] px-3 py-2 text-xs text-[var(--color-text-muted)]">
                    {shot.notes ? (
                      <span className="line-clamp-2">{shot.notes}</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isDupe ? (
                      <Badge variant="outline" className="text-xs text-amber-600">Exists</Badge>
                    ) : preload ? (
                      <Badge variant="outline" className="text-xs text-green-600">New</Badge>
                    ) : (
                      <span className="text-xs text-[var(--color-text-subtle)]">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      <div className="mb-6 flex items-center gap-3">
        <Button onClick={preloadData} disabled={checking || running || !clientId} variant="outline">
          {checking ? "Loading..." : "Load & Check"}
        </Button>
        <Button onClick={runImport} disabled={running || done || !clientId || !preload}>
          {running ? "Importing..." : done ? "Done" : "Run Import"}
        </Button>
        {!preload && (
          <span className="text-xs text-[var(--color-text-muted)]">
            Load data first to preview product matches and detect duplicates.
          </span>
        )}
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h3 className="mb-2 text-sm font-semibold text-[var(--color-text)]">Import Log</h3>
          <div className="flex max-h-96 flex-col gap-1 overflow-y-auto font-mono text-xs">
            {log.map((entry, i) => (
              <div
                key={i}
                className={
                  entry.variant === "error"
                    ? "text-red-600"
                    : entry.variant === "success"
                      ? "text-green-600"
                      : entry.variant === "skip"
                        ? "text-amber-600"
                        : "text-[var(--color-text-muted)]"
                }
              >
                {entry.text}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
