/**
 * DEV-ONLY: Q2-1 shot import tool.
 * Creates 38 shots (39 rows minus the existing row 2) in project "Q2-26 No. 1".
 * This file is temporary and should be removed after the import is complete.
 */
import { useState } from "react"
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore"
import { useAuth } from "@/app/providers/AuthProvider"
import { db } from "@/shared/lib/firebase"
import {
  productFamiliesPath,
  productFamilySkusPath,
  shotsPath,
} from "@/shared/lib/paths"
import { createShotVersionSnapshot } from "@/features/shots/lib/shotVersioning"
import { Button } from "@/ui/button"
import { Badge } from "@/ui/badge"
import type { ProductAssignment, ShotTag } from "@/shared/types"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ID = "CvNSDKCdjKtr3SGALQD7"
const SHOT_DATE = new Date("2026-02-20T00:00:00")

// ---------------------------------------------------------------------------
// Tag definitions (from defaultTags.ts)
// ---------------------------------------------------------------------------

const TAG_PRIORITY_HIGH: ShotTag = {
  id: "default-priority-high",
  label: "High Priority",
  color: "red",
  category: "priority",
}
const TAG_PRIORITY_LOW: ShotTag = {
  id: "default-priority-low",
  label: "Low Priority",
  color: "green",
  category: "priority",
}
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
// Row data
// ---------------------------------------------------------------------------

interface ImportShotRow {
  readonly row: number
  readonly title: string
  readonly shotNumber: string
  readonly color: string
  readonly gender: "men" | "women"
  readonly priority: "high" | "low" | null
  readonly styleNumber: string
  readonly skip?: boolean
}

const Q2_SHOT_ROWS: ReadonlyArray<ImportShotRow> = [
  // Rows 2-5: Men's Merino Knit Short Sleeve Polo (M-TP-PL-1087)
  {
    row: 2,
    title: "Merino Knit Short Sleeve Polo",
    shotNumber: "M_MerinoKnitShortSleevePolo_Black",
    color: "Black",
    gender: "men",
    priority: "high",
    styleNumber: "M-TP-PL-1087",
    skip: true,
  },
  {
    row: 3,
    title: "Merino Knit Short Sleeve Polo",
    shotNumber: "M_MerinoKnitShortSleevePolo_Tan",
    color: "Tan",
    gender: "men",
    priority: "high",
    styleNumber: "M-TP-PL-1087",
  },
  {
    row: 4,
    title: "Merino Knit Short Sleeve Polo",
    shotNumber: "M_MerinoKnitShortSleevePolo_HeatherAzure",
    color: "Heather Azure",
    gender: "men",
    priority: "high",
    styleNumber: "M-TP-PL-1087",
  },
  {
    row: 5,
    title: "Merino Knit Short Sleeve Polo",
    shotNumber: "M_MerinoKnitShortSleevePolo_Ivory",
    color: "Ivory",
    gender: "men",
    priority: "high",
    styleNumber: "M-TP-PL-1087",
  },

  // Rows 6-7: Women's Fine Knit Merino Dress (W-DR-DR-1084)
  {
    row: 6,
    title: "Fine Knit Merino Dress",
    shotNumber: "W_FineKnitMerinoDress_Black",
    color: "Black",
    gender: "women",
    priority: "high",
    styleNumber: "W-DR-DR-1084",
  },
  {
    row: 7,
    title: "Fine Knit Merino Dress",
    shotNumber: "W_FineKnitMerinoDress_Tan",
    color: "Tan",
    gender: "women",
    priority: "high",
    styleNumber: "W-DR-DR-1084",
  },

  // Rows 8-10: Women's Fine Knit Merino Cardigan (W-TP-SW-1082)
  {
    row: 8,
    title: "Fine Knit Merino Cardigan",
    shotNumber: "W_FineKnitMerinoCardigan_Black",
    color: "Black",
    gender: "women",
    priority: "high",
    styleNumber: "W-TP-SW-1082",
  },
  {
    row: 9,
    title: "Fine Knit Merino Cardigan",
    shotNumber: "W_FineKnitMerinoCardigan_HeatherAzure",
    color: "Heather Azure",
    gender: "women",
    priority: "high",
    styleNumber: "W-TP-SW-1082",
  },
  {
    row: 10,
    title: "Fine Knit Merino Cardigan",
    shotNumber: "W_FineKnitMerinoCardigan_Ivory",
    color: "Ivory",
    gender: "women",
    priority: "high",
    styleNumber: "W-TP-SW-1082",
  },

  // Rows 11-14: Women's Long Sleeve Fine Knit Polo (W-TP-PL-1078)
  {
    row: 11,
    title: "Long Sleeve Fine Knit Polo",
    shotNumber: "W_LongSleeveFineKnitPolo_Black",
    color: "Black",
    gender: "women",
    priority: "high",
    styleNumber: "W-TP-PL-1078",
  },
  {
    row: 12,
    title: "Long Sleeve Fine Knit Polo",
    shotNumber: "W_LongSleeveFineKnitPolo_Tan",
    color: "Tan",
    gender: "women",
    priority: "high",
    styleNumber: "W-TP-PL-1078",
  },
  {
    row: 13,
    title: "Long Sleeve Fine Knit Polo",
    shotNumber: "W_LongSleeveFineKnitPolo_HeatherAzure",
    color: "Heather Azure",
    gender: "women",
    priority: "high",
    styleNumber: "W-TP-PL-1078",
  },
  {
    row: 14,
    title: "Long Sleeve Fine Knit Polo",
    shotNumber: "W_LongSleeveFineKnitPolo_Ivory",
    color: "Ivory",
    gender: "women",
    priority: "high",
    styleNumber: "W-TP-PL-1078",
  },

  // Rows 15-18: Women's Merino Knit T-Shirt (W-TP-TS-1081)
  {
    row: 15,
    title: "Merino Knit T-Shirt",
    shotNumber: "W_MerinoKnitTShirt_Black",
    color: "Black",
    gender: "women",
    priority: "high",
    styleNumber: "W-TP-TS-1081",
  },
  {
    row: 16,
    title: "Merino Knit T-Shirt",
    shotNumber: "W_MerinoKnitTShirt_Ivory",
    color: "Ivory",
    gender: "women",
    priority: "high",
    styleNumber: "W-TP-TS-1081",
  },
  {
    row: 17,
    title: "Merino Knit T-Shirt",
    shotNumber: "W_MerinoKnitTShirt_Tan",
    color: "Tan",
    gender: "women",
    priority: "high",
    styleNumber: "W-TP-TS-1081",
  },
  {
    row: 18,
    title: "Merino Knit T-Shirt",
    shotNumber: "W_MerinoKnitTShirt_HeatherAzure",
    color: "Heather Azure",
    gender: "women",
    priority: "high",
    styleNumber: "W-TP-TS-1081",
  },

  // Rows 19-21: Women's Merino Scoop Bralette (W-IN-BR-1026)
  {
    row: 19,
    title: "Merino Scoop Bralette",
    shotNumber: "W_MerinoScoopBralette_Black",
    color: "Black",
    gender: "women",
    priority: "high",
    styleNumber: "W-IN-BR-1026",
  },
  {
    row: 20,
    title: "Merino Scoop Bralette",
    shotNumber: "W_MerinoScoopBralette_Sand",
    color: "Sand",
    gender: "women",
    priority: "high",
    styleNumber: "W-IN-BR-1026",
  },
  {
    row: 21,
    title: "Merino Scoop Bralette",
    shotNumber: "W_MerinoScoopBralette_SailBlue",
    color: "Sail Blue",
    gender: "women",
    priority: "high",
    styleNumber: "W-IN-BR-1026",
  },

  // Rows 22-24: Women's Merino High Waist Bikini (W-IN-UW-1025)
  {
    row: 22,
    title: "Merino High Waist Bikini",
    shotNumber: "W_MerinoHighWaistBikini_Black",
    color: "Black",
    gender: "women",
    priority: "high",
    styleNumber: "W-IN-UW-1025",
  },
  {
    row: 23,
    title: "Merino High Waist Bikini",
    shotNumber: "W_MerinoHighWaistBikini_Sand",
    color: "Sand",
    gender: "women",
    priority: "high",
    styleNumber: "W-IN-UW-1025",
  },
  {
    row: 24,
    title: "Merino High Waist Bikini",
    shotNumber: "W_MerinoHighWaistBikini_SailBlue",
    color: "Sail Blue",
    gender: "women",
    priority: "high",
    styleNumber: "W-IN-UW-1025",
  },

  // Rows 25-27: Men's Merino Travel Pants (M-BT-PN-1032)
  {
    row: 25,
    title: "Merino Travel Pants",
    shotNumber: "M_MerinoTravelPants_Navy",
    color: "Navy",
    gender: "men",
    priority: "low",
    styleNumber: "M-BT-PN-1032",
  },
  {
    row: 26,
    title: "Merino Travel Pants",
    shotNumber: "M_MerinoTravelPants_Sand",
    color: "Sand",
    gender: "men",
    priority: "low",
    styleNumber: "M-BT-PN-1032",
  },
  {
    row: 27,
    title: "Merino Travel Pants",
    shotNumber: "M_MerinoTravelPants_Charcoal",
    color: "Charcoal",
    gender: "men",
    priority: "low",
    styleNumber: "M-BT-PN-1032",
  },

  // Rows 28-30: Men's Merino Travel Shorts (M-BT-SH-1172) -- no priority
  {
    row: 28,
    title: "Merino Travel Shorts",
    shotNumber: "M_MerinoTravelShorts_Charcoal",
    color: "Charcoal",
    gender: "men",
    priority: null,
    styleNumber: "M-BT-SH-1172",
  },
  {
    row: 29,
    title: "Merino Travel Shorts",
    shotNumber: "M_MerinoTravelShorts_DesertKhaki",
    color: "Desert Khaki",
    gender: "men",
    priority: null,
    styleNumber: "M-BT-SH-1172",
  },
  {
    row: 30,
    title: "Merino Travel Shorts",
    shotNumber: "M_MerinoTravelShorts_Navy",
    color: "Navy",
    gender: "men",
    priority: null,
    styleNumber: "M-BT-SH-1172",
  },

  // Rows 31-32: Men's Slim Merino Travel Pant (M-BT-PN-1038) -- no priority
  {
    row: 31,
    title: "Slim Merino Travel Pant",
    shotNumber: "M_SlimMerinoTravelPant_Black",
    color: "Black",
    gender: "men",
    priority: null,
    styleNumber: "M-BT-PN-1038",
  },
  {
    row: 32,
    title: "Slim Merino Travel Pant",
    shotNumber: "M_SlimMerinoTravelPant_Charcoal",
    color: "Charcoal",
    gender: "men",
    priority: null,
    styleNumber: "M-BT-PN-1038",
  },

  // Rows 33-34: Women's Merino Knit Hoodie (W-TP-HD-1067)
  {
    row: 33,
    title: "Merino Knit Hoodie",
    shotNumber: "W_MerinoKnitHoodie_Black",
    color: "Black",
    gender: "women",
    priority: "low",
    styleNumber: "W-TP-HD-1067",
  },
  {
    row: 34,
    title: "Merino Knit Hoodie",
    shotNumber: "W_MerinoKnitHoodie_HeatherGrey",
    color: "Heather Grey",
    gender: "women",
    priority: "low",
    styleNumber: "W-TP-HD-1067",
  },

  // Rows 35-36: Men's Merino Knit Pullover Hoodie (M-TP-HD-1074)
  {
    row: 35,
    title: "Merino Knit Pullover Hoodie",
    shotNumber: "M_MerinoKnitPulloverHoodie_Black",
    color: "Black",
    gender: "men",
    priority: "low",
    styleNumber: "M-TP-HD-1074",
  },
  {
    row: 36,
    title: "Merino Knit Pullover Hoodie",
    shotNumber: "M_MerinoKnitPulloverHoodie_HeatherGrey",
    color: "Heather Grey",
    gender: "men",
    priority: "low",
    styleNumber: "M-TP-HD-1074",
  },

  // Rows 37-38: Women's Merino Sweater Pant (W-BT-PN-1068)
  {
    row: 37,
    title: "Merino Sweater Pant",
    shotNumber: "W_MerinoSweaterPant_Black",
    color: "Black",
    gender: "women",
    priority: "low",
    styleNumber: "W-BT-PN-1068",
  },
  {
    row: 38,
    title: "Merino Sweater Pant",
    shotNumber: "W_MerinoSweaterPant_HeatherGrey",
    color: "Heather Grey",
    gender: "women",
    priority: "low",
    styleNumber: "W-BT-PN-1068",
  },

  // Rows 39-40: Men's Active Merino T-Shirt (no style #)
  {
    row: 39,
    title: "Active Merino T-Shirt",
    shotNumber: "M_ActiveMerinoTShirt_Ivory",
    color: "Ivory",
    gender: "men",
    priority: "high",
    styleNumber: "",
  },
  {
    row: 40,
    title: "Active Merino T-Shirt",
    shotNumber: "M_ActiveMerinoTShirt_RoyalBlue",
    color: "Royal Blue",
    gender: "men",
    priority: "high",
    styleNumber: "",
  },
]

// ---------------------------------------------------------------------------
// Firestore helpers
// ---------------------------------------------------------------------------

/** Recursively strip `undefined` values so Firestore doesn't reject the write. */
function stripUndefined(obj: unknown): unknown {
  if (obj === null || obj === undefined) return null
  if (Array.isArray(obj)) return obj.map(stripUndefined)
  if (typeof obj === "object" && Object.getPrototypeOf(obj) === Object.prototype) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v)
      }
    }
    return out
  }
  return obj
}

// ---------------------------------------------------------------------------
// Tag builder
// ---------------------------------------------------------------------------

function buildTags(row: ImportShotRow): ReadonlyArray<ShotTag> {
  const tags: ShotTag[] = []

  if (row.priority === "high") tags.push(TAG_PRIORITY_HIGH)
  if (row.priority === "low") tags.push(TAG_PRIORITY_LOW)

  tags.push(row.gender === "men" ? TAG_GENDER_MEN : TAG_GENDER_WOMEN)
  tags.push(TAG_MEDIA_PHOTO)

  return tags
}

// ---------------------------------------------------------------------------
// Firestore lookups
// ---------------------------------------------------------------------------

interface FamilyInfo {
  readonly id: string
  readonly styleName: string
  readonly thumbnailImagePath?: string
}

interface SkuInfo {
  readonly id: string
  readonly colorName: string
  readonly imagePath?: string
}

async function loadFamilyLookup(
  clientId: string,
): Promise<{
  readonly byStyleNumber: ReadonlyMap<string, FamilyInfo>
  readonly byNameFragment: ReadonlyArray<FamilyInfo>
}> {
  const basePath = productFamiliesPath(clientId)
  const colRef = collection(db, basePath[0]!, ...basePath.slice(1))
  const snap = await getDocs(query(colRef, where("deleted", "==", false)))

  const byStyleNumber = new Map<string, FamilyInfo>()
  const byNameFragment: FamilyInfo[] = []

  snap.forEach((docSnap) => {
    const d = docSnap.data()
    const info: FamilyInfo = {
      id: docSnap.id,
      styleName: (d.styleName as string) ?? "",
      thumbnailImagePath: (d.thumbnailImagePath as string) ?? undefined,
    }
    const sn = (d.styleNumber as string) ?? ""
    if (sn.trim().length > 0) {
      byStyleNumber.set(sn.trim().toUpperCase(), info)
    }
    byNameFragment.push(info)
  })

  return { byStyleNumber, byNameFragment }
}

async function loadSkuLookup(
  clientId: string,
  familyId: string,
): Promise<ReadonlyMap<string, SkuInfo>> {
  const basePath = productFamilySkusPath(familyId, clientId)
  const colRef = collection(db, basePath[0]!, ...basePath.slice(1))
  const snap = await getDocs(query(colRef, where("deleted", "==", false)))

  const map = new Map<string, SkuInfo>()
  snap.forEach((docSnap) => {
    const d = docSnap.data()
    const colorName = (d.colorName as string) ?? (d.name as string) ?? ""
    if (colorName.trim().length > 0) {
      map.set(colorName.trim().toLowerCase(), {
        id: docSnap.id,
        colorName,
        imagePath: (d.imagePath as string) ?? undefined,
      })
    }
  })
  return map
}

async function loadExistingShotNumbers(
  clientId: string,
): Promise<Set<string>> {
  const basePath = shotsPath(clientId)
  const colRef = collection(db, basePath[0]!, ...basePath.slice(1))
  const snap = await getDocs(
    query(colRef, where("projectId", "==", PROJECT_ID), where("deleted", "==", false)),
  )
  const existing = new Set<string>()
  snap.forEach((docSnap) => {
    const sn = docSnap.data().shotNumber
    if (typeof sn === "string" && sn.trim().length > 0) {
      existing.add(sn.trim())
    }
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
  readonly familyByStyleNumber: ReadonlyMap<string, FamilyInfo>
  readonly familyByNameFragment: ReadonlyArray<FamilyInfo>
  readonly skusByFamilyId: ReadonlyMap<string, ReadonlyMap<string, SkuInfo>>
}

export default function DevImportQ2Shots() {
  const { clientId, user } = useAuth()
  const [preload, setPreload] = useState<PreloadState | null>(null)
  const [checking, setChecking] = useState(false)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(false)
  const [log, setLog] = useState<ReadonlyArray<LogEntry>>([])

  const addLog = (entry: LogEntry) =>
    setLog((prev) => [...prev, entry])

  const preloadData = async () => {
    if (!clientId) return
    setChecking(true)
    try {
      addLog({ text: "Loading product families...", variant: "info" })
      const { byStyleNumber, byNameFragment } = await loadFamilyLookup(clientId)
      addLog({
        text: `Found ${byStyleNumber.size} families with style numbers, ${byNameFragment.length} total.`,
        variant: "info",
      })

      addLog({ text: "Loading SKUs for matched families...", variant: "info" })
      const skusByFamilyId = new Map<string, ReadonlyMap<string, SkuInfo>>()

      // Collect unique family IDs we'll need
      const neededFamilyIds = new Set<string>()
      for (const row of Q2_SHOT_ROWS) {
        const snKey = row.styleNumber.trim().toUpperCase()
        if (snKey && byStyleNumber.has(snKey)) {
          neededFamilyIds.add(byStyleNumber.get(snKey)!.id)
        }
      }
      // Also try name-based match for rows without style numbers
      for (const row of Q2_SHOT_ROWS) {
        if (!row.styleNumber) {
          const match = byNameFragment.find((f) =>
            f.styleName.includes("Active Merino T-Shirt"),
          )
          if (match) neededFamilyIds.add(match.id)
        }
      }

      for (const familyId of neededFamilyIds) {
        const skus = await loadSkuLookup(clientId, familyId)
        skusByFamilyId.set(familyId, skus)
      }
      addLog({
        text: `Loaded SKUs for ${skusByFamilyId.size} families.`,
        variant: "info",
      })

      addLog({ text: "Checking existing shots in project...", variant: "info" })
      const existingShotNumbers = await loadExistingShotNumbers(clientId)
      addLog({
        text: `Found ${existingShotNumbers.size} existing shots in project.`,
        variant: "info",
      })

      setPreload({
        existingShotNumbers,
        familyByStyleNumber: byStyleNumber,
        familyByNameFragment: byNameFragment,
        skusByFamilyId,
      })
      addLog({ text: "Preload complete. Ready to import.", variant: "success" })
    } catch (err) {
      addLog({
        text: `Error during preload: ${err instanceof Error ? err.message : String(err)}`,
        variant: "error",
      })
    } finally {
      setChecking(false)
    }
  }

  const resolveFamily = (row: ImportShotRow): FamilyInfo | null => {
    if (!preload) return null
    const snKey = row.styleNumber.trim().toUpperCase()
    if (snKey) {
      return preload.familyByStyleNumber.get(snKey) ?? null
    }
    // Fallback: match by name fragment (for "Active Merino T-Shirt")
    return (
      preload.familyByNameFragment.find((f) =>
        f.styleName.includes("Active Merino T-Shirt"),
      ) ?? null
    )
  }

  const resolveSku = (
    familyId: string,
    colorName: string,
  ): SkuInfo | null => {
    if (!preload) return null
    const skuMap = preload.skusByFamilyId.get(familyId)
    if (!skuMap) return null
    return skuMap.get(colorName.trim().toLowerCase()) ?? null
  }

  const runImport = async () => {
    if (!clientId || !user?.uid || !preload) return
    setRunning(true)

    const userId = user.uid
    const baseTime = Date.now()
    let created = 0
    let skipped = 0
    let errors = 0

    for (let i = 0; i < Q2_SHOT_ROWS.length; i++) {
      const row = Q2_SHOT_ROWS[i]!

      // Skip row 2 (already exists via manual creation)
      if (row.skip) {
        addLog({
          text: `SKIP (hardcoded): Row ${row.row} "${row.title}" / ${row.color} -- marked as pre-existing.`,
          variant: "skip",
        })
        skipped += 1
        continue
      }

      // Duplicate check by shotNumber
      if (preload.existingShotNumbers.has(row.shotNumber)) {
        addLog({
          text: `SKIP (duplicate): Row ${row.row} "${row.shotNumber}" -- already exists.`,
          variant: "skip",
        })
        skipped += 1
        continue
      }

      try {
        // Resolve product family + SKU
        const family = resolveFamily(row)
        const sku = family ? resolveSku(family.id, row.color) : null

        const productAssignment: ProductAssignment | null = family
          ? {
              familyId: family.id,
              familyName: family.styleName,
              skuId: sku?.id,
              colourName: sku?.colorName ?? row.color,
              sizeScope: "pending",
              quantity: 1,
              thumbUrl: sku?.imagePath ?? family.thumbnailImagePath ?? undefined,
              skuImageUrl: sku?.imagePath ?? undefined,
              familyImageUrl: family.thumbnailImagePath ?? undefined,
            }
          : null

        const tags = buildTags(row)
        const products = productAssignment ? [productAssignment] : []
        const looks = productAssignment
          ? [
              {
                id: "primary",
                label: "Primary",
                order: 0,
                products: [productAssignment],
              },
            ]
          : [{ id: "primary", label: "Primary", order: 0, products: [] }]

        const shotData = {
          title: row.title,
          description: row.color,
          projectId: PROJECT_ID,
          clientId,
          status: "todo",
          talent: [],
          products,
          sortOrder: baseTime + i,
          shotNumber: row.shotNumber,
          date: Timestamp.fromDate(SHOT_DATE),
          tags,
          looks,
          referenceLinks: [],
          deleted: false,
          notes: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          createdBy: userId,
        }

        const cleanData = stripUndefined(shotData) as Record<string, unknown>
        // Re-apply serverTimestamp() since stripUndefined converts them
        cleanData.createdAt = serverTimestamp()
        cleanData.updatedAt = serverTimestamp()

        const basePath = shotsPath(clientId)
        const colRef = collection(db, basePath[0]!, ...basePath.slice(1))
        const docRef = await addDoc(colRef, cleanData)

        // Create version snapshot
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
          // Best-effort version snapshot -- don't fail the import
        }

        const productNote = family
          ? sku
            ? `${family.styleName} (${sku.colorName})`
            : `${family.styleName} (SKU not matched)`
          : "No product match"

        addLog({
          text: `CREATED: Row ${row.row} "${row.shotNumber}" -> ${docRef.id} | Product: ${productNote}`,
          variant: "success",
        })
        created += 1
      } catch (err) {
        addLog({
          text: `ERROR: Row ${row.row} "${row.shotNumber}" -- ${err instanceof Error ? err.message : String(err)}`,
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

  const priorityLabel: Record<string, string> = {
    high: "High",
    low: "Low",
  }
  const priorityColor: Record<string, string> = {
    high: "text-red-600",
    low: "text-green-600",
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-xl font-bold text-[var(--color-text)]">
          Q2-1 Shot Import
        </h1>
        <p className="text-sm text-[var(--color-text-muted)]">
          Import 38 shots (39 rows, row 2 pre-existing) into project Q2-26 No.
          1. This is a dev-only tool.
        </p>
      </div>

      {/* Preview table */}
      <div className="mb-6 overflow-x-auto rounded-lg border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-subtle)]">
              <th className="px-3 py-2 text-left text-xs font-semibold">Row</th>
              <th className="px-3 py-2 text-left text-xs font-semibold">
                Shot #
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold">
                Title
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold">
                Color
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold">
                Gender
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold">
                Priority
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold">
                Product Match
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {Q2_SHOT_ROWS.map((row) => {
              const isDupe =
                row.skip ||
                (preload?.existingShotNumbers.has(row.shotNumber) ?? false)
              const family = preload ? resolveFamily(row) : null
              const sku =
                preload && family
                  ? resolveSku(family.id, row.color)
                  : null

              return (
                <tr
                  key={row.shotNumber}
                  className="border-b border-[var(--color-border)] last:border-b-0"
                >
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">
                    {row.row}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-[var(--color-text)]">
                    {row.shotNumber}
                  </td>
                  <td className="px-3 py-2 font-medium text-[var(--color-text)]">
                    {row.title}
                  </td>
                  <td className="px-3 py-2 text-[var(--color-text)]">
                    {row.color}
                  </td>
                  <td className="px-3 py-2 text-[var(--color-text-muted)]">
                    {row.gender === "men" ? "Men" : "Women"}
                  </td>
                  <td className="px-3 py-2">
                    {row.priority ? (
                      <span
                        className={`text-xs font-medium ${priorityColor[row.priority] ?? ""}`}
                      >
                        {priorityLabel[row.priority]}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--color-text-subtle)]">
                        --
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {!preload ? (
                      <span className="text-xs text-[var(--color-text-subtle)]">
                        --
                      </span>
                    ) : family ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-green-600">
                          {family.styleName}
                        </span>
                        {sku ? (
                          <span className="text-xs text-green-600">
                            SKU: {sku.colorName}
                          </span>
                        ) : (
                          <span className="text-xs text-amber-600">
                            SKU not matched
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-red-600">
                        Family not found
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {isDupe ? (
                      <Badge
                        variant="outline"
                        className="text-xs text-amber-600"
                      >
                        Exists
                      </Badge>
                    ) : preload ? (
                      <Badge
                        variant="outline"
                        className="text-xs text-green-600"
                      >
                        New
                      </Badge>
                    ) : (
                      <span className="text-xs text-[var(--color-text-subtle)]">
                        --
                      </span>
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
        <Button
          onClick={preloadData}
          disabled={checking || running || !clientId}
          variant="outline"
        >
          {checking ? "Loading..." : "Load & Check"}
        </Button>
        <Button
          onClick={runImport}
          disabled={running || done || !clientId || !preload}
        >
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
          <h3 className="mb-2 text-sm font-semibold text-[var(--color-text)]">
            Import Log
          </h3>
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
