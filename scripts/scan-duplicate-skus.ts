/**
 * Read-only scan: detect duplicate SKUs where a legacy colorway (e.g. "Black")
 * coexists with an imported colorway that has a vendor code suffix (e.g. "Black (0101)").
 *
 * USAGE:
 *   npx tsx scripts/scan-duplicate-skus.ts
 */

import { getApp, getApps, initializeApp, applicationDefault } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

// ---------------------------------------------------------------------------
// Firebase init
// ---------------------------------------------------------------------------

const CLIENT_ID = "unbound-merino"

function initFirebase(): void {
  if (getApps().length === 0) {
    initializeApp({
      credential: applicationDefault(),
      projectId: "um-shotbuilder",
    })
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip vendor code suffix: "Black (0101)" → "Black" */
function stripVendorCode(colorName: string): string {
  return colorName.replace(/\s+\([^)]+\)$/, "").trim()
}

interface SkuInfo {
  readonly id: string
  readonly colorName: string
  readonly sizes: readonly string[]
  readonly createdBy: string | undefined
}

interface DuplicateGroup {
  readonly baseColor: string
  readonly skus: readonly SkuInfo[]
}

interface FamilyResult {
  readonly familyId: string
  readonly familyName: string
  readonly duplicateGroups: readonly DuplicateGroup[]
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  initFirebase()
  const db = getFirestore(getApp())

  // 1. Fetch all families
  const familiesSnap = await db
    .collection(`clients/${CLIENT_ID}/productFamilies`)
    .get()

  const families = familiesSnap.docs.filter((doc) => {
    const data = doc.data()
    return data.deleted !== true
  })

  console.info(`Found ${families.length} active product families\n`)

  const results: FamilyResult[] = []
  let totalDuplicateGroups = 0
  let totalDuplicateSkus = 0

  // 2. For each family, fetch SKUs and detect duplicates
  for (const familyDoc of families) {
    const familyData = familyDoc.data()
    const familyName = familyData.name ?? familyDoc.id

    const skusSnap = await db
      .collection(`clients/${CLIENT_ID}/productFamilies/${familyDoc.id}/skus`)
      .get()

    const skus: SkuInfo[] = skusSnap.docs
      .filter((doc) => {
        const data = doc.data()
        return data.deleted !== true
      })
      .map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          colorName: data.colorName ?? "(no colorName)",
          sizes: data.sizes ?? [],
          createdBy: data.createdBy,
        }
      })

    // Group by stripped base color
    const groups = new Map<string, SkuInfo[]>()
    for (const sku of skus) {
      const baseColor = stripVendorCode(sku.colorName)
      const existing = groups.get(baseColor)
      if (existing) {
        existing.push(sku)
      } else {
        groups.set(baseColor, [sku])
      }
    }

    // Find groups with 2+ SKUs (duplicates)
    const duplicateGroups: DuplicateGroup[] = []
    for (const [baseColor, groupSkus] of groups) {
      if (groupSkus.length >= 2) {
        duplicateGroups.push({ baseColor, skus: groupSkus })
      }
    }

    if (duplicateGroups.length > 0) {
      results.push({
        familyId: familyDoc.id,
        familyName,
        duplicateGroups,
      })
      totalDuplicateGroups += duplicateGroups.length
      for (const g of duplicateGroups) {
        totalDuplicateSkus += g.skus.length
      }
    }
  }

  // 3. Print report
  console.info("=".repeat(80))
  console.info("DUPLICATE SKU SCAN REPORT")
  console.info("=".repeat(80))

  if (results.length === 0) {
    console.info("\nNo duplicate colorways found.")
    return
  }

  for (const family of results) {
    console.info(`\n${"─".repeat(70)}`)
    console.info(`Family: ${family.familyName}`)
    console.info(`ID:     ${family.familyId}`)
    console.info(`${"─".repeat(70)}`)

    for (const group of family.duplicateGroups) {
      console.info(`\n  Base color: "${group.baseColor}"`)
      for (const sku of group.skus) {
        const sizesStr = Array.isArray(sku.sizes) ? sku.sizes.join(", ") : "(none)"
        console.info(`    • "${sku.colorName}"`)
        console.info(`      ID: ${sku.id}`)
        console.info(`      Sizes: ${sizesStr}`)
        console.info(`      CreatedBy: ${sku.createdBy ?? "(unknown)"}`)
      }
    }
  }

  console.info(`\n${"=".repeat(80)}`)
  console.info("SUMMARY")
  console.info(`  Families with duplicates: ${results.length}`)
  console.info(`  Total duplicate groups:   ${totalDuplicateGroups}`)
  console.info(`  Total duplicate SKUs:     ${totalDuplicateSkus}`)
  console.info("=".repeat(80))
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
