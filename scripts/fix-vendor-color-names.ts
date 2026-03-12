/**
 * Strip vendor codes and descriptive parentheticals from SKU color names.
 *
 * Examples:
 *   "Earth (778Y - 0502/0357)" → "Earth"
 *   "Heather Camel (0390)"     → "Heather Camel"
 *   "Ivory (w/ Navy contrast) (shown in red)" → "Ivory"
 *   "Amber + Camel (028 + 059)" → "Amber + Camel"
 *
 * Also soft-deletes the single orphaned family with 0 active SKUs.
 *
 * USAGE:
 *   # Dry run (default — no writes):
 *   npx tsx scripts/fix-vendor-color-names.ts
 *
 *   # Write mode (mutates Firestore):
 *   npx tsx scripts/fix-vendor-color-names.ts --write
 */

import { getApp, getApps, initializeApp, applicationDefault } from "firebase-admin/app"
import { FieldValue, getFirestore } from "firebase-admin/firestore"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SkuRename {
  readonly familyId: string
  readonly familyName: string
  readonly skuId: string
  readonly oldColorName: string
  readonly newColorName: string
  readonly oldName: string
  readonly newName: string
}

interface OrphanFamily {
  readonly id: string
  readonly name: string
  readonly gender: string
  readonly createdBy: string | undefined
}

interface Summary {
  skusRenamed: number
  familiesAggregateUpdated: number
  orphansSoftDeleted: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLIENT_ID = "unbound-merino"
const THROTTLE_MS = 50

// ---------------------------------------------------------------------------
// Firebase init
// ---------------------------------------------------------------------------

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

/**
 * Strip ALL parenthetical groups from a color name.
 * Applies repeatedly to handle nested/multiple groups:
 *   "Ivory (w/ Navy contrast) (shown in red)" → "Ivory"
 *   "Earth (778Y - 0502/0357)" → "Earth"
 *
 * Skips if stripping would produce an empty string.
 */
function stripAllParens(value: string): string {
  let result = value
  // Repeatedly remove trailing paren groups
  let prev = ""
  while (prev !== result) {
    prev = result
    result = result.replace(/\s*\([^)]*\)\s*$/, "").trim()
  }
  // Also remove mid-string paren groups (e.g., "Color (code) extra")
  result = result.replace(/\s*\([^)]*\)/g, "").trim()
  // Clean up leading punctuation left after stripping (e.g., ": Salt and Pepper")
  result = result.replace(/^[:\s]+/, "").trim()
  return result || value // Keep original if stripping yields empty
}

/** Check if a string contains any parenthesized text */
function hasParens(value: string): boolean {
  return /\([^)]*\)/.test(value)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

async function findSkusToRename(
  db: FirebaseFirestore.Firestore,
): Promise<{ renames: readonly SkuRename[]; affectedFamilyIds: ReadonlySet<string> }> {
  const familiesSnap = await db
    .collection(`clients/${CLIENT_ID}/productFamilies`)
    .get()

  const renames: SkuRename[] = []
  const affectedFamilyIds = new Set<string>()

  for (const familyDoc of familiesSnap.docs) {
    const familyData = familyDoc.data()
    if (familyData.deleted === true) continue

    const familyName = familyData.name ?? "(no name)"
    const skusSnap = await db
      .collection(`clients/${CLIENT_ID}/productFamilies/${familyDoc.id}/skus`)
      .get()

    for (const skuDoc of skusSnap.docs) {
      const skuData = skuDoc.data()
      if (skuData.deleted === true) continue

      const colorName: string = skuData.colorName ?? ""
      const name: string = skuData.name ?? ""

      if (!hasParens(colorName) && !hasParens(name)) continue

      const newColorName = hasParens(colorName) ? stripAllParens(colorName) : colorName
      const newName = hasParens(name) ? stripAllParens(name) : name

      // Only add if something actually changed
      if (newColorName !== colorName || newName !== name) {
        renames.push({
          familyId: familyDoc.id,
          familyName,
          skuId: skuDoc.id,
          oldColorName: colorName,
          newColorName,
          oldName: name,
          newName,
        })
        affectedFamilyIds.add(familyDoc.id)
      }
    }
  }

  return { renames, affectedFamilyIds }
}

async function findOrphanedFamilies(
  db: FirebaseFirestore.Firestore,
): Promise<readonly OrphanFamily[]> {
  const familiesSnap = await db
    .collection(`clients/${CLIENT_ID}/productFamilies`)
    .get()

  const orphans: OrphanFamily[] = []

  for (const familyDoc of familiesSnap.docs) {
    const familyData = familyDoc.data()
    if (familyData.deleted === true) continue

    const skusSnap = await db
      .collection(`clients/${CLIENT_ID}/productFamilies/${familyDoc.id}/skus`)
      .get()

    const activeSkus = skusSnap.docs.filter((s) => s.data().deleted !== true)

    if (activeSkus.length === 0) {
      orphans.push({
        id: familyDoc.id,
        name: familyData.name ?? "(no name)",
        gender: familyData.gender ?? "(no gender)",
        createdBy: familyData.createdBy,
      })
    }
  }

  return orphans
}

async function updateFamilyAggregate(
  db: FirebaseFirestore.Firestore,
  familyId: string,
): Promise<void> {
  const skusSnap = await db
    .collection(`clients/${CLIENT_ID}/productFamilies/${familyId}/skus`)
    .get()

  const activeSkus = skusSnap.docs.filter((s) => s.data().deleted !== true)
  const allSizes = new Set<string>()
  const colorNames: string[] = []

  for (const skuDoc of activeSkus) {
    const data = skuDoc.data()
    colorNames.push(data.colorName ?? "")
    for (const size of data.sizes ?? []) {
      allSizes.add(size)
    }
  }

  const sizesArray = [...allSizes]

  await db.doc(`clients/${CLIENT_ID}/productFamilies/${familyId}`).update({
    skuCount: activeSkus.length,
    activeSkuCount: activeSkus.length,
    colorNames,
    sizes: sizesArray,
    sizeOptions: sizesArray,
    updatedBy: "fix-vendor-color-names",
    updatedAt: FieldValue.serverTimestamp(),
  })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const write = process.argv.includes("--write")
  const mode = write ? "WRITE" : "DRY RUN"

  initFirebase()
  const db = getFirestore(getApp())

  console.info(`\nMode: ${mode}`)
  console.info(`Client: ${CLIENT_ID}\n`)

  // -------------------------------------------------------------------------
  // Phase 1: Strip vendor codes / parentheticals from SKU color names
  // -------------------------------------------------------------------------
  console.info("=".repeat(70))
  console.info("PHASE 1: STRIP PARENTHETICALS FROM SKU COLOR NAMES")
  console.info("=".repeat(70))

  const { renames, affectedFamilyIds } = await findSkusToRename(db)

  if (renames.length === 0) {
    console.info("\nNo SKUs need renaming.")
  } else {
    // Group by family for readability
    const byFamily = new Map<string, SkuRename[]>()
    for (const r of renames) {
      const existing = byFamily.get(r.familyId)
      if (existing) {
        existing.push(r)
      } else {
        byFamily.set(r.familyId, [r])
      }
    }

    console.info(`\n${renames.length} SKUs across ${byFamily.size} families:\n`)

    for (const [familyId, familyRenames] of byFamily) {
      console.info(`  Family: ${familyRenames[0].familyName} (${familyId})`)
      for (const r of familyRenames) {
        const colorChange = r.oldColorName !== r.newColorName
          ? `"${r.oldColorName}" → "${r.newColorName}"`
          : "(colorName unchanged)"
        const nameChange = r.oldName !== r.newName
          ? ` | name: "${r.oldName}" → "${r.newName}"`
          : ""
        console.info(`    • ${colorChange}${nameChange}  [${r.skuId}]`)
      }
      console.info("")
    }
  }

  // -------------------------------------------------------------------------
  // Phase 2: Soft-delete orphaned families
  // -------------------------------------------------------------------------
  console.info("=".repeat(70))
  console.info("PHASE 2: SOFT-DELETE ORPHANED FAMILIES (0 ACTIVE SKUs)")
  console.info("=".repeat(70))

  const orphans = await findOrphanedFamilies(db)

  if (orphans.length === 0) {
    console.info("\nNo orphaned families found.")
  } else {
    console.info(`\n${orphans.length} orphaned families:\n`)
    for (const o of orphans) {
      console.info(`  • "${o.name}" (${o.gender}) — ${o.id}, createdBy: ${o.createdBy ?? "(unknown)"}`)
    }
  }

  // -------------------------------------------------------------------------
  // Execute writes
  // -------------------------------------------------------------------------
  const summary: Summary = {
    skusRenamed: 0,
    familiesAggregateUpdated: 0,
    orphansSoftDeleted: 0,
  }

  if (write) {
    console.info(`\n${"─".repeat(70)}`)
    console.info("EXECUTING WRITES...")
    console.info("─".repeat(70))

    // Rename SKUs
    for (const r of renames) {
      const skuPath = `clients/${CLIENT_ID}/productFamilies/${r.familyId}/skus/${r.skuId}`
      const update: Record<string, unknown> = {
        updatedBy: "fix-vendor-color-names",
        updatedAt: FieldValue.serverTimestamp(),
      }
      if (r.oldColorName !== r.newColorName) {
        update.colorName = r.newColorName
      }
      if (r.oldName !== r.newName) {
        update.name = r.newName
      }
      await db.doc(skuPath).update(update)
      summary.skusRenamed += 1

      if (summary.skusRenamed % 20 === 0) {
        console.info(`  Renamed ${summary.skusRenamed}/${renames.length} SKUs...`)
        await sleep(THROTTLE_MS)
      }
    }
    console.info(`  Renamed ${summary.skusRenamed} SKUs`)

    // Update family aggregates
    for (const familyId of affectedFamilyIds) {
      await updateFamilyAggregate(db, familyId)
      summary.familiesAggregateUpdated += 1
      await sleep(THROTTLE_MS)
    }
    console.info(`  Updated ${summary.familiesAggregateUpdated} family aggregates`)

    // Soft-delete orphans
    for (const o of orphans) {
      await db.doc(`clients/${CLIENT_ID}/productFamilies/${o.id}`).update({
        deleted: true,
        deletedBy: "fix-vendor-color-names",
        deletedAt: FieldValue.serverTimestamp(),
      })
      summary.orphansSoftDeleted += 1
    }
    console.info(`  Soft-deleted ${summary.orphansSoftDeleted} orphaned families`)
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.info(`\n${"=".repeat(70)}`)
  console.info("SUMMARY")
  console.info("=".repeat(70))
  console.info(`  Mode:                      ${mode}`)
  console.info(`  SKUs to rename:            ${renames.length}`)
  console.info(`  Families to update:        ${affectedFamilyIds.size}`)
  console.info(`  Orphans to soft-delete:    ${orphans.length}`)

  if (write) {
    console.info(`  SKUs renamed:              ${summary.skusRenamed}`)
    console.info(`  Family aggregates updated: ${summary.familiesAggregateUpdated}`)
    console.info(`  Orphans soft-deleted:      ${summary.orphansSoftDeleted}`)
  }

  console.info("=".repeat(70))
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
