/**
 * Fix bad inseam SKUs created by import-line-sheet
 *
 * The import script incorrectly created separate SKU documents per inseam
 * (e.g., "Black / 30"" and "Black / 32""). The correct pattern is ONE SKU
 * per colorway with composite sizes (e.g., "Black" with sizes ["S/30", "M/32"]).
 *
 * This script identifies and deletes the bad inseam SKUs, then updates
 * parent family documents with corrected counts and color names.
 *
 * USAGE:
 *   # Dry run (default — no writes):
 *   npx tsx scripts/fix-inseam-skus.ts --clientId=unbound-merino
 *
 *   # Write mode (mutates Firestore):
 *   npx tsx scripts/fix-inseam-skus.ts --clientId=unbound-merino --write
 *
 * ARGUMENTS:
 *   --clientId=<id>  (REQUIRED) Client/tenant ID to target
 *   --write          Actually perform deletes (default: dry-run)
 */

import { getApp, getApps, initializeApp, applicationDefault } from "firebase-admin/app"
import { FieldValue, getFirestore } from "firebase-admin/firestore"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CliArgs {
  readonly clientId: string
  readonly write: boolean
}

interface FamilyDoc {
  readonly id: string
  readonly styleName: string
  readonly deleted?: boolean
}

interface SkuDoc {
  readonly id: string
  readonly name: string
  readonly skuCode: string
  readonly colorName: string
  readonly sizes: ReadonlyArray<string>
  readonly createdBy: string
  readonly deleted?: boolean
}

interface BadSkuEntry {
  readonly familyId: string
  readonly familyName: string
  readonly sku: SkuDoc
}

interface FamilyFixResult {
  readonly familyId: string
  readonly familyName: string
  readonly deletedCount: number
  readonly remainingSkuCount: number
  readonly remainingActiveCount: number
  readonly remainingColorNames: ReadonlyArray<string>
}

// ---------------------------------------------------------------------------
// Firebase Admin
// ---------------------------------------------------------------------------

const FIREBASE_PROJECT_ID = process.env.GCLOUD_PROJECT ?? "um-shotbuilder"

function ensureApp() {
  if (getApps().length) return getApp()
  return initializeApp({
    credential: applicationDefault(),
    projectId: FIREBASE_PROJECT_ID,
  })
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function printUsageAndExit(): never {
  console.info(`
Usage:
  npx tsx scripts/fix-inseam-skus.ts --clientId=<id> [--write]

Arguments:
  --clientId=<id>  (REQUIRED) Client/tenant ID
  --write          Actually perform deletes (default: dry-run)
`)
  process.exit(1)
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  let clientId: string | null = null
  let write = false

  for (const arg of args) {
    if (arg.startsWith("--clientId=")) {
      clientId = arg.slice("--clientId=".length).trim()
    } else if (arg === "--write") {
      write = true
    }
  }

  if (!clientId) {
    console.error("[fix-inseam] ERROR: --clientId is required")
    printUsageAndExit()
  }

  if (!/^[a-z0-9][-a-z0-9]*$/.test(clientId)) {
    console.error("[fix-inseam] ERROR: clientId must be lowercase alphanumeric with hyphens")
    printUsageAndExit()
  }

  return { clientId, write }
}

// ---------------------------------------------------------------------------
// Detection patterns
// ---------------------------------------------------------------------------

const BAD_NAME_PATTERN = /\/ \d+"/
const BAD_SKU_CODE_PATTERN = /-\d+in$/

function isBadInseamSku(sku: SkuDoc): boolean {
  if (sku.deleted === true) return false
  if (sku.createdBy !== "import-line-sheet") return false
  return BAD_NAME_PATTERN.test(sku.name) || BAD_SKU_CODE_PATTERN.test(sku.skuCode)
}

// ---------------------------------------------------------------------------
// Phase 1: Find bad SKUs
// ---------------------------------------------------------------------------

async function fetchAllFamilies(
  db: FirebaseFirestore.Firestore,
  clientId: string,
): Promise<ReadonlyArray<FamilyDoc>> {
  const snap = await db
    .collection("clients")
    .doc(clientId)
    .collection("productFamilies")
    .get()

  return snap.docs
    .map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        styleName: data.styleName ?? "(unnamed)",
        deleted: data.deleted,
      }
    })
    .filter((f) => f.deleted !== true)
}

async function fetchAllSkus(
  db: FirebaseFirestore.Firestore,
  clientId: string,
  familyId: string,
): Promise<ReadonlyArray<SkuDoc>> {
  const snap = await db
    .collection("clients")
    .doc(clientId)
    .collection("productFamilies")
    .doc(familyId)
    .collection("skus")
    .get()

  return snap.docs.map((doc) => {
    const data = doc.data()
    return {
      id: doc.id,
      name: data.name ?? "",
      skuCode: data.skuCode ?? "",
      colorName: data.colorName ?? "",
      sizes: data.sizes ?? [],
      createdBy: data.createdBy ?? "",
      deleted: data.deleted,
    }
  })
}

async function findBadSkus(
  db: FirebaseFirestore.Firestore,
  clientId: string,
): Promise<ReadonlyArray<BadSkuEntry>> {
  const families = await fetchAllFamilies(db, clientId)
  console.info("[fix-inseam] Scanning %d families...", families.length)

  const badEntries: Array<BadSkuEntry> = []

  for (const family of families) {
    const skus = await fetchAllSkus(db, clientId, family.id)
    const badSkus = skus.filter(isBadInseamSku)

    for (const sku of badSkus) {
      badEntries.push({
        familyId: family.id,
        familyName: family.styleName,
        sku,
      })
    }
  }

  return badEntries
}

function printReport(badEntries: ReadonlyArray<BadSkuEntry>): void {
  if (badEntries.length === 0) {
    console.info("[fix-inseam] No bad inseam SKUs found.")
    return
  }

  // Group by family
  const byFamily = new Map<string, ReadonlyArray<BadSkuEntry>>()
  for (const entry of badEntries) {
    const existing = byFamily.get(entry.familyId) ?? []
    byFamily.set(entry.familyId, [...existing, entry])
  }

  console.info("")
  console.info("[fix-inseam] ─── Bad Inseam SKUs ───")
  console.info("  Families affected: %d", byFamily.size)
  console.info("  Total bad SKUs:    %d", badEntries.length)
  console.info("")

  for (const [familyId, entries] of byFamily) {
    const familyName = entries[0].familyName
    console.info("  %s (id=%s)  bad SKUs: %d", familyName.padEnd(40), familyId, entries.length)
    for (const entry of entries) {
      console.info(
        "    - %s  code=%s  sizes=[%s]",
        entry.sku.name.padEnd(30),
        entry.sku.skuCode,
        entry.sku.sizes.join(", "),
      )
    }
  }
  console.info("")
}

// ---------------------------------------------------------------------------
// Phase 2: Delete bad SKUs and update families
// ---------------------------------------------------------------------------

function groupByFamily(
  entries: ReadonlyArray<BadSkuEntry>,
): ReadonlyArray<{ readonly familyId: string; readonly familyName: string; readonly skuIds: ReadonlyArray<string> }> {
  const map = new Map<string, { familyName: string; skuIds: Array<string> }>()

  for (const entry of entries) {
    const existing = map.get(entry.familyId)
    if (existing) {
      existing.skuIds.push(entry.sku.id)
    } else {
      map.set(entry.familyId, {
        familyName: entry.familyName,
        skuIds: [entry.sku.id],
      })
    }
  }

  return Array.from(map.entries()).map(([familyId, data]) => ({
    familyId,
    familyName: data.familyName,
    skuIds: data.skuIds,
  }))
}

async function deleteSkusForFamily(
  db: FirebaseFirestore.Firestore,
  clientId: string,
  familyId: string,
  skuIdsToDelete: ReadonlyArray<string>,
): Promise<void> {
  const skusRef = db
    .collection("clients")
    .doc(clientId)
    .collection("productFamilies")
    .doc(familyId)
    .collection("skus")

  for (const skuId of skuIdsToDelete) {
    await skusRef.doc(skuId).delete()
  }
}

function computeFamilyPatch(
  remainingSkus: ReadonlyArray<SkuDoc>,
): { readonly skuCount: number; readonly activeSkuCount: number; readonly colorNames: ReadonlyArray<string> } {
  const activeSkus = remainingSkus.filter((s) => s.deleted !== true)
  const colorNames = [...new Set(activeSkus.map((s) => s.colorName).filter(Boolean))]

  return {
    skuCount: remainingSkus.length,
    activeSkuCount: activeSkus.length,
    colorNames,
  }
}

async function updateFamilyAggregates(
  db: FirebaseFirestore.Firestore,
  clientId: string,
  familyId: string,
  remainingSkus: ReadonlyArray<SkuDoc>,
): Promise<void> {
  const patch = computeFamilyPatch(remainingSkus)

  await db
    .collection("clients")
    .doc(clientId)
    .collection("productFamilies")
    .doc(familyId)
    .update({
      skuCount: patch.skuCount,
      activeSkuCount: patch.activeSkuCount,
      colorNames: patch.colorNames,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: "fix-inseam-skus",
    })
}

async function executeDeletions(
  db: FirebaseFirestore.Firestore,
  clientId: string,
  badEntries: ReadonlyArray<BadSkuEntry>,
): Promise<ReadonlyArray<FamilyFixResult>> {
  const groups = groupByFamily(badEntries)
  const results: Array<FamilyFixResult> = []

  for (const group of groups) {
    console.info(
      "[fix-inseam] Deleting %d SKUs from %s...",
      group.skuIds.length,
      group.familyName,
    )

    await deleteSkusForFamily(db, clientId, group.familyId, group.skuIds)

    // Re-fetch remaining SKUs to compute correct aggregates
    const remainingSkus = await fetchAllSkus(db, clientId, group.familyId)
    const activeRemaining = remainingSkus.filter((s) => s.deleted !== true)

    await updateFamilyAggregates(db, clientId, group.familyId, remainingSkus)

    const colorNames = [...new Set(activeRemaining.map((s) => s.colorName).filter(Boolean))]

    results.push({
      familyId: group.familyId,
      familyName: group.familyName,
      deletedCount: group.skuIds.length,
      remainingSkuCount: remainingSkus.length,
      remainingActiveCount: activeRemaining.length,
      remainingColorNames: colorNames,
    })

    // Throttle writes (100ms between families)
    await new Promise((r) => setTimeout(r, 100))
  }

  return results
}

// ---------------------------------------------------------------------------
// Phase 3: Verify
// ---------------------------------------------------------------------------

async function verifyResults(
  db: FirebaseFirestore.Firestore,
  clientId: string,
  affectedFamilyIds: ReadonlyArray<string>,
): Promise<void> {
  console.info("")
  console.info("[fix-inseam] ─── Verification ───")

  let remainingBadCount = 0

  for (const familyId of affectedFamilyIds) {
    const skus = await fetchAllSkus(db, clientId, familyId)
    const activeSkus = skus.filter((s) => s.deleted !== true)
    const stillBad = activeSkus.filter(isBadInseamSku)
    const colorNames = [...new Set(activeSkus.map((s) => s.colorName).filter(Boolean))]

    const familySnap = await db
      .collection("clients")
      .doc(clientId)
      .collection("productFamilies")
      .doc(familyId)
      .get()

    const familyName = familySnap.data()?.styleName ?? "(unnamed)"
    const flag = stillBad.length > 0 ? " ⚠ STILL HAS BAD SKUS" : ""

    console.info(
      "  %s  skus=%d  colors=[%s]%s",
      familyName.padEnd(40),
      activeSkus.length,
      colorNames.join(", "),
      flag,
    )

    remainingBadCount += stillBad.length
  }

  if (remainingBadCount > 0) {
    console.info("")
    console.info("[fix-inseam] WARNING: %d bad SKUs still remain!", remainingBadCount)
  } else {
    console.info("")
    console.info("[fix-inseam] All affected families verified clean.")
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

;(async () => {
  try {
    const args = parseArgs()
    const dryRun = !args.write

    console.info("[fix-inseam] Fix Bad Inseam SKUs")
    console.info("[fix-inseam] Mode: %s", dryRun ? "DRY RUN" : "WRITE")
    console.info("[fix-inseam] Client: %s", args.clientId)
    console.info("")

    // Initialize Firebase
    ensureApp()
    const db = getFirestore()

    // Phase 1: Find bad SKUs
    console.info("[fix-inseam] Phase 1: Scanning for bad inseam SKUs...")
    const badEntries = await findBadSkus(db, args.clientId)
    printReport(badEntries)

    if (badEntries.length === 0) {
      console.info("[fix-inseam] Nothing to do.")
      return
    }

    // Phase 2: Delete (only with --write)
    if (dryRun) {
      console.info("[fix-inseam] Dry run complete. To delete these SKUs, run with --write:")
      console.info("  npx tsx scripts/fix-inseam-skus.ts --clientId=%s --write", args.clientId)
      return
    }

    console.info("[fix-inseam] Phase 2: Deleting bad SKUs and updating families...")
    const results = await executeDeletions(db, args.clientId, badEntries)

    // Phase 3: Verify
    console.info("[fix-inseam] Phase 3: Verifying results...")
    const affectedFamilyIds = results.map((r) => r.familyId)
    await verifyResults(db, args.clientId, affectedFamilyIds)

    // Final summary
    const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0)
    console.info("")
    console.info("[fix-inseam] ─── Summary ───")
    console.info("  Families affected:  %d", results.length)
    console.info("  SKUs deleted:       %d", totalDeleted)
    console.info("  Families updated:   %d", results.length)
    console.info("")

    for (const result of results) {
      console.info(
        "  %s  deleted=%d  remaining=%d  colors=[%s]",
        result.familyName.padEnd(40),
        result.deletedCount,
        result.remainingActiveCount,
        result.remainingColorNames.join(", "),
      )
    }
  } catch (error) {
    console.error("[fix-inseam] Fatal error:", error)
    process.exitCode = 1
  }
})()
