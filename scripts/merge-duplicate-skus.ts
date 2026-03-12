/**
 * Merge duplicate SKUs created by line sheet import.
 *
 * Legacy SKUs use simple color names ("Black") while imported ones use vendor-coded
 * names ("Black (0101)"). This script merges data into the legacy SKU (preserving
 * its doc ID for existing project references) and deletes the duplicates.
 *
 * USAGE:
 *   # Dry run (default — no writes):
 *   npx tsx scripts/merge-duplicate-skus.ts --clientId=unbound-merino
 *
 *   # Write mode (mutates Firestore):
 *   npx tsx scripts/merge-duplicate-skus.ts --clientId=unbound-merino --write
 */

import { getApp, getApps, initializeApp, applicationDefault } from "firebase-admin/app"
import { FieldValue, getFirestore } from "firebase-admin/firestore"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CliArgs {
  readonly clientId: string | null
  readonly write: boolean
}

interface SkuDoc {
  readonly id: string
  readonly colorName: string
  readonly name: string
  readonly sizes: readonly string[]
  readonly createdBy: string | undefined
  readonly styleNumber: string | undefined
  readonly previousStyleNumber: string | undefined
  readonly vendor: string | undefined
  readonly fabricContent: string | undefined
  readonly skuCode: string | undefined
  readonly importSource: string | undefined
  readonly [key: string]: unknown
}

interface DuplicateGroup {
  readonly baseColor: string
  readonly skus: readonly SkuDoc[]
}

interface MergeAction {
  readonly group: DuplicateGroup
  readonly keeper: SkuDoc
  readonly toDelete: readonly SkuDoc[]
  readonly mergedSizes: readonly string[]
  readonly skipped: boolean
  readonly skipReason?: string
}

interface MergeSummary {
  familiesProcessed: number
  groupsMerged: number
  skusDeleted: number
  skusUpdated: number
  groupsSkipped: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IMPORT_CREATORS = new Set(["import-line-sheet", "reimport-inseam-fix"])
const THROTTLE_MS = 100
const MERGE_FIELDS = [
  "styleNumber",
  "previousStyleNumber",
  "vendor",
  "fabricContent",
  "skuCode",
  "importSource",
] as const

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
// CLI parsing
// ---------------------------------------------------------------------------

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  let clientId: string | null = null
  let write = false

  for (const arg of args) {
    if (arg.startsWith("--clientId=")) {
      clientId = arg.split("=")[1]
    } else if (arg === "--write") {
      write = true
    }
  }

  return { clientId, write }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip vendor code suffix: "Black (0101)" → "Black" */
function stripVendorCode(colorName: string): string {
  return colorName.replace(/\s+\([^)]+\)$/, "").trim()
}

function isImportCreated(createdBy: string | undefined): boolean {
  return createdBy !== undefined && IMPORT_CREATORS.has(createdBy)
}

/** Union sizes from multiple SKUs, using the longest array as the base order. */
function unionSizes(skus: readonly SkuDoc[]): readonly string[] {
  const longest = skus.reduce(
    (best, sku) => (sku.sizes.length > best.sizes.length ? sku : best),
    skus[0],
  )
  const seen = new Set<string>(longest.sizes)
  const result = [...longest.sizes]

  for (const sku of skus) {
    for (const size of sku.sizes) {
      if (!seen.has(size)) {
        seen.add(size)
        result.push(size)
      }
    }
  }

  return result
}

/** Pick the keeper SKU for a duplicate group. */
function pickKeeper(skus: readonly SkuDoc[]): { keeper: SkuDoc; skipped: boolean; skipReason?: string } {
  const legacySkus = skus.filter((s) => !isImportCreated(s.createdBy))
  const importSkus = skus.filter((s) => isImportCreated(s.createdBy))

  // All legacy — skip this group
  if (importSkus.length === 0) {
    return {
      keeper: legacySkus[0],
      skipped: true,
      skipReason: "all legacy, not from import",
    }
  }

  // Has a legacy SKU — it's the keeper
  if (legacySkus.length > 0) {
    return { keeper: legacySkus[0], skipped: false }
  }

  // All imported — keep the first one
  return { keeper: importSkus[0], skipped: false }
}

/** Build the merge update data for the keeper. */
function buildKeeperUpdate(
  keeper: SkuDoc,
  mergedSizes: readonly string[],
  importDonor: SkuDoc | undefined,
): Record<string, unknown> {
  const update: Record<string, unknown> = {
    sizes: [...mergedSizes],
    updatedBy: "merge-duplicate-skus",
    updatedAt: FieldValue.serverTimestamp(),
  }

  if (importDonor) {
    for (const field of MERGE_FIELDS) {
      const keeperVal = keeper[field]
      const donorVal = importDonor[field]
      if (
        (keeperVal === undefined || keeperVal === null || keeperVal === "") &&
        donorVal !== undefined &&
        donorVal !== null &&
        donorVal !== ""
      ) {
        update[field] = donorVal
      }
    }
  }

  return update
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

function buildMergeActions(skus: readonly SkuDoc[]): readonly MergeAction[] {
  const groups = new Map<string, SkuDoc[]>()

  for (const sku of skus) {
    const baseColor = stripVendorCode(sku.colorName)
    const existing = groups.get(baseColor)
    if (existing) {
      existing.push(sku)
    } else {
      groups.set(baseColor, [sku])
    }
  }

  const actions: MergeAction[] = []

  for (const [baseColor, groupSkus] of groups) {
    if (groupSkus.length < 2) continue

    const { keeper, skipped, skipReason } = pickKeeper(groupSkus)
    const toDelete = groupSkus.filter((s) => s.id !== keeper.id)
    const mergedSizes = unionSizes(groupSkus)

    actions.push({
      group: { baseColor, skus: groupSkus },
      keeper,
      toDelete,
      mergedSizes,
      skipped,
      skipReason,
    })
  }

  return actions
}

function logDryRunAction(action: MergeAction): void {
  if (action.skipped) {
    console.info(
      `  SKIP "${action.group.baseColor}" group (${action.group.skus.length} SKUs — ${action.skipReason})`,
    )
    return
  }

  const totalSkus = action.group.skus.length
  const keeperSizeCount = action.keeper.sizes.length
  const mergedSizeCount = action.mergedSizes.length
  const sizeLabel =
    mergedSizeCount > keeperSizeCount
      ? `${keeperSizeCount} → ${mergedSizeCount} (merged)`
      : `${keeperSizeCount} (unchanged)`

  console.info(
    `  MERGE "${action.group.baseColor}" group (${totalSkus} SKUs → 1):`,
  )
  console.info(
    `    ${"KEEP".padEnd(7)} ${action.keeper.colorName.padEnd(25)} id=${action.keeper.id}  sizes: ${sizeLabel}`,
  )

  for (const sku of action.toDelete) {
    console.info(
      `    ${"DELETE".padEnd(7)} ${sku.colorName.padEnd(25)} id=${sku.id}`,
    )
  }
}

/** Fetch all non-deleted SKUs for a family as SkuDoc objects. */
async function fetchFamilySkus(
  db: FirebaseFirestore.Firestore,
  clientId: string,
  familyId: string,
): Promise<readonly SkuDoc[]> {
  const snap = await db
    .collection(`clients/${clientId}/productFamilies/${familyId}/skus`)
    .get()

  return snap.docs
    .filter((doc) => doc.data().deleted !== true)
    .map((doc) => {
      const data = doc.data()
      return {
        ...data,
        id: doc.id,
        colorName: data.colorName ?? "(no colorName)",
        name: data.name ?? "",
        sizes: data.sizes ?? [],
        createdBy: data.createdBy,
        styleNumber: data.styleNumber,
        previousStyleNumber: data.previousStyleNumber,
        vendor: data.vendor,
        fabricContent: data.fabricContent,
        skuCode: data.skuCode,
        importSource: data.importSource,
      } as SkuDoc
    })
}

/** Build family aggregate update from remaining SKUs. */
function buildFamilyAggregate(skus: readonly SkuDoc[]): Record<string, unknown> {
  const allSizes = new Set<string>()
  const colorNames: string[] = []

  for (const sku of skus) {
    colorNames.push(sku.colorName)
    for (const size of sku.sizes) {
      allSizes.add(size)
    }
  }

  const sizesArray = [...allSizes]

  return {
    skuCount: skus.length,
    activeSkuCount: skus.length,
    colorNames,
    sizes: sizesArray,
    sizeOptions: sizesArray,
    updatedBy: "merge-duplicate-skus",
    updatedAt: FieldValue.serverTimestamp(),
  }
}

async function executeMerge(
  db: FirebaseFirestore.Firestore,
  clientId: string,
  familyId: string,
  actions: readonly MergeAction[],
): Promise<{ merged: number; deleted: number; updated: number }> {
  let merged = 0
  let deleted = 0
  let updated = 0
  const skusPath = `clients/${clientId}/productFamilies/${familyId}/skus`

  for (const action of actions) {
    if (action.skipped) continue

    // Find first import SKU as donor for missing fields
    const importDonor = action.group.skus.find((s) =>
      isImportCreated(s.createdBy) && s.id !== action.keeper.id,
    )

    // Update keeper
    const keeperUpdate = buildKeeperUpdate(action.keeper, action.mergedSizes, importDonor)
    await db.doc(`${skusPath}/${action.keeper.id}`).update(keeperUpdate)
    updated += 1

    // Delete non-keepers
    for (const sku of action.toDelete) {
      await db.doc(`${skusPath}/${sku.id}`).delete()
      deleted += 1
    }

    merged += 1
  }

  // Re-fetch remaining SKUs and update family aggregate
  const remainingSkus = await fetchFamilySkus(db, clientId, familyId)
  const familyUpdate = buildFamilyAggregate(remainingSkus)
  await db.doc(`clients/${clientId}/productFamilies/${familyId}`).update(familyUpdate)

  return { merged, deleted, updated }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const { clientId, write } = parseArgs()

  if (!clientId) {
    console.error("Usage: npx tsx scripts/merge-duplicate-skus.ts --clientId=<id> [--write]")
    process.exit(1)
  }

  initFirebase()
  const db = getFirestore(getApp())
  const mode = write ? "WRITE" : "DRY RUN"

  console.info(`\nMode: ${mode}`)
  console.info(`Client: ${clientId}\n`)

  // Fetch all families
  const familiesSnap = await db
    .collection(`clients/${clientId}/productFamilies`)
    .get()

  const families = familiesSnap.docs.filter((doc) => doc.data().deleted !== true)

  console.info(`Found ${families.length} active product families\n`)

  const summary: MergeSummary = {
    familiesProcessed: 0,
    groupsMerged: 0,
    skusDeleted: 0,
    skusUpdated: 0,
    groupsSkipped: 0,
  }

  for (const familyDoc of families) {
    const familyData = familyDoc.data()
    const familyName = familyData.name ?? familyDoc.id

    const skus = await fetchFamilySkus(db, clientId, familyDoc.id)
    const actions = buildMergeActions(skus)

    if (actions.length === 0) continue

    summary.familiesProcessed += 1
    console.info(`[${mode}] Family: ${familyName} (${familyDoc.id})`)

    for (const action of actions) {
      logDryRunAction(action)

      if (action.skipped) {
        summary.groupsSkipped += 1
      }
    }

    if (write) {
      const result = await executeMerge(db, clientId, familyDoc.id, actions)
      summary.groupsMerged += result.merged
      summary.skusDeleted += result.deleted
      summary.skusUpdated += result.updated
      await sleep(THROTTLE_MS)
    } else {
      const activeActions = actions.filter((a) => !a.skipped)
      summary.groupsMerged += activeActions.length
      for (const a of activeActions) {
        summary.skusDeleted += a.toDelete.length
        summary.skusUpdated += 1
      }
    }

    console.info("")
  }

  // Print summary
  console.info("=".repeat(60))
  console.info("SUMMARY")
  console.info("=".repeat(60))
  console.info(`  Families processed:       ${summary.familiesProcessed}`)
  console.info(`  Groups merged:            ${summary.groupsMerged}`)
  console.info(`  SKUs deleted:             ${summary.skusDeleted}`)
  console.info(`  SKUs updated (keepers):   ${summary.skusUpdated}`)
  console.info(`  Groups skipped (legacy):  ${summary.groupsSkipped}`)
  console.info("=".repeat(60))
}

main().catch((err) => {
  console.error("Fatal error:", err)
  process.exit(1)
})
