/**
 * Read-only audit of Firestore data quality after Line Sheet Product Import.
 *
 * Checks:
 *   1. Orphaned families (ProductFamily docs with 0 active SKUs)
 *   2. Vendor-coded color names on SKUs (e.g., "Earth (778Y - 0502/0357)")
 *   3. Collision check — would stripping vendor codes create duplicates?
 *   4. Summary stats
 *
 * USAGE:
 *   npx tsx scripts/audit-data-quality.ts
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
// Types
// ---------------------------------------------------------------------------

interface FamilyInfo {
  readonly id: string
  readonly name: string
  readonly gender: string
  readonly createdBy: string | undefined
  readonly deleted: boolean
  readonly activeSkuCount: number
}

interface SkuInfo {
  readonly id: string
  readonly colorName: string
  readonly sizes: readonly string[]
  readonly createdBy: string | undefined
  readonly familyId: string
  readonly familyName: string
}

interface VendorCodeHit {
  readonly familyId: string
  readonly familyName: string
  readonly skuId: string
  readonly currentColorName: string
  readonly strippedColorName: string
}

interface CollisionHit {
  readonly familyId: string
  readonly familyName: string
  readonly strippedName: string
  readonly collidingSkus: readonly { id: string; colorName: string }[]
}

interface OrphanInfo {
  readonly family: FamilyInfo
  readonly matchingFamily: FamilyInfo | undefined
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip vendor code suffix: "Black (0101)" → "Black" */
function stripVendorCode(colorName: string): string {
  return colorName.replace(/\s*\([^)]*\)$/, "").trim()
}

/** Check if colorName contains parenthesized text */
function hasVendorCode(colorName: string): boolean {
  return /\([^)]*\)/.test(colorName)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  initFirebase()
  const db = getFirestore(getApp())

  console.info("=".repeat(80))
  console.info("DATA QUALITY AUDIT — Line Sheet Product Import")
  console.info(`Client: ${CLIENT_ID}`)
  console.info(`Date: ${new Date().toISOString()}`)
  console.info("=".repeat(80))

  // -----------------------------------------------------------------------
  // 1. Fetch all families
  // -----------------------------------------------------------------------
  const familiesSnap = await db
    .collection(`clients/${CLIENT_ID}/productFamilies`)
    .get()

  const allFamilies: FamilyInfo[] = []
  const allSkus: SkuInfo[] = []

  for (const doc of familiesSnap.docs) {
    const data = doc.data()
    const isDeleted = data.deleted === true

    // Fetch SKUs for every family (even deleted ones, for completeness)
    const skusSnap = await db
      .collection(`clients/${CLIENT_ID}/productFamilies/${doc.id}/skus`)
      .get()

    const activeSkus = skusSnap.docs.filter((s) => s.data().deleted !== true)

    const familyInfo: FamilyInfo = {
      id: doc.id,
      name: data.name ?? "(no name)",
      gender: data.gender ?? "(no gender)",
      createdBy: data.createdBy,
      deleted: isDeleted,
      activeSkuCount: activeSkus.length,
    }
    allFamilies.push(familyInfo)

    // Collect active SKUs for non-deleted families
    if (!isDeleted) {
      for (const skuDoc of activeSkus) {
        const skuData = skuDoc.data()
        allSkus.push({
          id: skuDoc.id,
          colorName: skuData.colorName ?? "(no colorName)",
          sizes: skuData.sizes ?? [],
          createdBy: skuData.createdBy,
          familyId: doc.id,
          familyName: data.name ?? "(no name)",
        })
      }
    }
  }

  const activeFamilies = allFamilies.filter((f) => !f.deleted)
  const deletedFamilies = allFamilies.filter((f) => f.deleted)

  console.info(`\nTotal family docs: ${allFamilies.length}`)
  console.info(`  Active (not deleted): ${activeFamilies.length}`)
  console.info(`  Deleted: ${deletedFamilies.length}`)
  console.info(`Total active SKUs (across active families): ${allSkus.length}`)

  // -----------------------------------------------------------------------
  // 2. Orphan Scan — active families with 0 active SKUs
  // -----------------------------------------------------------------------
  console.info(`\n${"=".repeat(80)}`)
  console.info("SECTION 1: ORPHANED FAMILIES (0 active SKUs)")
  console.info("=".repeat(80))

  const orphanedFamilies = activeFamilies.filter((f) => f.activeSkuCount === 0)

  // Build a lookup by name+gender for finding matching "real" families
  const familyByNameGender = new Map<string, FamilyInfo[]>()
  for (const f of activeFamilies) {
    const key = `${f.name.toLowerCase()}|${f.gender.toLowerCase()}`
    const existing = familyByNameGender.get(key)
    if (existing) {
      existing.push(f)
    } else {
      familyByNameGender.set(key, [f])
    }
  }

  const orphanResults: OrphanInfo[] = []

  for (const orphan of orphanedFamilies) {
    const key = `${orphan.name.toLowerCase()}|${orphan.gender.toLowerCase()}`
    const candidates = familyByNameGender.get(key) ?? []
    const matchingFamily = candidates.find(
      (c) => c.id !== orphan.id && c.activeSkuCount > 0,
    )
    orphanResults.push({ family: orphan, matchingFamily })
  }

  if (orphanResults.length === 0) {
    console.info("\nNo orphaned families found.")
  } else {
    console.info(`\nFound ${orphanResults.length} orphaned families:\n`)

    for (const { family, matchingFamily } of orphanResults) {
      console.info(`  ${"─".repeat(60)}`)
      console.info(`  Name:      ${family.name}`)
      console.info(`  Gender:    ${family.gender}`)
      console.info(`  Family ID: ${family.id}`)
      console.info(`  CreatedBy: ${family.createdBy ?? "(unknown)"}`)

      if (matchingFamily) {
        console.info(`  MATCH:     "${matchingFamily.name}" (${matchingFamily.id}) — ${matchingFamily.activeSkuCount} active SKUs`)
      } else {
        console.info(`  MATCH:     (none — no other family with same name+gender has SKUs)`)
      }
    }
  }

  // -----------------------------------------------------------------------
  // 3. Vendor Code Scan — SKUs with parenthesized text in colorName
  // -----------------------------------------------------------------------
  console.info(`\n${"=".repeat(80)}`)
  console.info("SECTION 2: VENDOR-CODED COLOR NAMES")
  console.info("=".repeat(80))

  const vendorCodeHits: VendorCodeHit[] = []

  for (const sku of allSkus) {
    if (hasVendorCode(sku.colorName)) {
      vendorCodeHits.push({
        familyId: sku.familyId,
        familyName: sku.familyName,
        skuId: sku.id,
        currentColorName: sku.colorName,
        strippedColorName: stripVendorCode(sku.colorName),
      })
    }
  }

  if (vendorCodeHits.length === 0) {
    console.info("\nNo vendor-coded color names found.")
  } else {
    console.info(`\nFound ${vendorCodeHits.length} SKUs with vendor-coded color names:\n`)

    // Group by family for readability
    const byFamily = new Map<string, VendorCodeHit[]>()
    for (const hit of vendorCodeHits) {
      const existing = byFamily.get(hit.familyId)
      if (existing) {
        existing.push(hit)
      } else {
        byFamily.set(hit.familyId, [hit])
      }
    }

    for (const [familyId, hits] of byFamily) {
      const familyName = hits[0].familyName
      console.info(`  ${"─".repeat(60)}`)
      console.info(`  Family: ${familyName} (${familyId})`)
      for (const hit of hits) {
        console.info(`    • "${hit.currentColorName}" → "${hit.strippedColorName}"  [SKU: ${hit.skuId}]`)
      }
    }
  }

  // -----------------------------------------------------------------------
  // 4. Collision Check — would stripping vendor codes create duplicates?
  // -----------------------------------------------------------------------
  console.info(`\n${"=".repeat(80)}`)
  console.info("SECTION 3: POST-STRIP COLLISION CHECK")
  console.info("=".repeat(80))

  const collisions: CollisionHit[] = []

  // Group all active SKUs by family, then by stripped color name
  const skusByFamily = new Map<string, SkuInfo[]>()
  for (const sku of allSkus) {
    const existing = skusByFamily.get(sku.familyId)
    if (existing) {
      existing.push(sku)
    } else {
      skusByFamily.set(sku.familyId, [sku])
    }
  }

  for (const [familyId, familySkus] of skusByFamily) {
    const byStrippedName = new Map<string, { id: string; colorName: string }[]>()

    for (const sku of familySkus) {
      const stripped = stripVendorCode(sku.colorName)
      const entry = { id: sku.id, colorName: sku.colorName }
      const existing = byStrippedName.get(stripped)
      if (existing) {
        existing.push(entry)
      } else {
        byStrippedName.set(stripped, [entry])
      }
    }

    for (const [strippedName, skus] of byStrippedName) {
      if (skus.length >= 2) {
        // Only flag if at least one has a vendor code (otherwise it's a pre-existing dup)
        const hasAnyVendorCode = skus.some((s) => hasVendorCode(s.colorName))
        if (hasAnyVendorCode) {
          collisions.push({
            familyId,
            familyName: familySkus[0].familyName,
            strippedName,
            collidingSkus: skus,
          })
        }
      }
    }
  }

  if (collisions.length === 0) {
    console.info("\nNo collisions detected. Safe to strip all vendor codes.")
  } else {
    console.info(`\nFound ${collisions.length} collision groups:\n`)

    for (const collision of collisions) {
      console.info(`  ${"─".repeat(60)}`)
      console.info(`  Family: ${collision.familyName} (${collision.familyId})`)
      console.info(`  Stripped name: "${collision.strippedName}"`)
      for (const sku of collision.collidingSkus) {
        console.info(`    • "${sku.colorName}" [SKU: ${sku.id}]`)
      }
    }
  }

  // -----------------------------------------------------------------------
  // 5. Summary
  // -----------------------------------------------------------------------
  console.info(`\n${"=".repeat(80)}`)
  console.info("SUMMARY")
  console.info("=".repeat(80))

  const familiesWithSkus = activeFamilies.filter((f) => f.activeSkuCount > 0)

  console.info(`\n  Families:`)
  console.info(`    Total family docs:           ${allFamilies.length}`)
  console.info(`    Active families:             ${activeFamilies.length}`)
  console.info(`    Deleted families:            ${deletedFamilies.length}`)
  console.info(`    Families with SKUs:          ${familiesWithSkus.length}`)
  console.info(`    Families with 0 SKUs:        ${orphanedFamilies.length}`)

  console.info(`\n  SKUs:`)
  console.info(`    Total active SKUs:           ${allSkus.length}`)
  console.info(`    SKUs with vendor codes:      ${vendorCodeHits.length}`)
  console.info(`    Collision groups:            ${collisions.length}`)

  if (orphanResults.length > 0) {
    const withMatch = orphanResults.filter((o) => o.matchingFamily !== undefined)
    const withoutMatch = orphanResults.filter((o) => o.matchingFamily === undefined)
    console.info(`\n  Orphan Details:`)
    console.info(`    Orphans with matching family:  ${withMatch.length}`)
    console.info(`    Orphans with NO match:         ${withoutMatch.length}`)

    if (withoutMatch.length > 0) {
      console.info(`\n  Orphans without match (may need manual review):`)
      for (const { family } of withoutMatch) {
        console.info(`    • "${family.name}" (${family.gender}) — ${family.id}, createdBy: ${family.createdBy ?? "(unknown)"}`)
      }
    }
  }

  console.info(`\n${"=".repeat(80)}`)
  console.info("AUDIT COMPLETE — No data was modified.")
  console.info("=".repeat(80))
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
