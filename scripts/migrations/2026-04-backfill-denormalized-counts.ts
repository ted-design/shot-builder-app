/**
 * Migration: Backfill denormalized counts on ProductFamily documents
 *
 * PURPOSE:
 * ProductFamily documents have four denormalized fields that were defined
 * in TypeScript types but never written by vNext code:
 *   - sampleCount: total non-deleted samples
 *   - samplesArrivedCount: samples with status "arrived"
 *   - earliestSampleEta: earliest ETA among pending samples
 *   - activeRequirementCount: count of SKUs with "needed"/"in_progress" asset flags
 *
 * This migration reads all SKUs and samples for each family and computes
 * the correct values.
 *
 * USAGE:
 *   # Dry run (default):
 *   npx tsx scripts/migrations/2026-04-backfill-denormalized-counts.ts --clientId=unbound-merino
 *
 *   # Actually perform writes:
 *   npx tsx scripts/migrations/2026-04-backfill-denormalized-counts.ts --clientId=unbound-merino --write
 *
 * ARGUMENTS:
 *   --clientId=<id>  (REQUIRED) Client/tenant ID
 *   --write          Actually perform writes (default: dry-run)
 */

import { getApp, getApps, initializeApp, applicationDefault } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(): { clientId: string | null; write: boolean } {
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

  return { clientId, write }
}

// ---------------------------------------------------------------------------
// Asset requirement counting (mirrors assetRequirements.ts)
// ---------------------------------------------------------------------------

const ACTIVE_FLAGS = new Set(["needed", "in_progress"])

function countActiveRequirements(reqs: Record<string, unknown> | null | undefined): number {
  if (!reqs || typeof reqs !== "object") return 0
  let count = 0
  for (const [key, value] of Object.entries(reqs)) {
    if (key === "other_label") continue
    if (typeof value === "string" && ACTIVE_FLAGS.has(value)) count += 1
  }
  return count
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { clientId, write } = parseArgs()

  if (!clientId) {
    console.error("ERROR: --clientId is required")
    console.error("Usage: npx tsx scripts/migrations/2026-04-backfill-denormalized-counts.ts --clientId=<id> [--write]")
    process.exit(1)
  }

  console.log(`\n--- Backfill Denormalized Counts ---`)
  console.log(`Client: ${clientId}`)
  console.log(`Mode:   ${write ? "WRITE" : "DRY RUN"}`)
  console.log("")

  // Init Firebase Admin
  if (!getApps().length) {
    initializeApp({
      credential: applicationDefault(),
      projectId: "um-shotbuilder",
    })
  }
  const db = getFirestore(getApp())

  // Read all families
  const familiesSnap = await db.collection(`clients/${clientId}/productFamilies`).get()
  console.log(`Found ${familiesSnap.size} product families`)

  let updated = 0
  let skipped = 0
  const BATCH_SIZE = 200
  let batch = db.batch()
  let batchCount = 0

  for (const famDoc of familiesSnap.docs) {
    const famData = famDoc.data()
    if (famData.deleted === true) {
      skipped += 1
      continue
    }

    // Read SKUs
    const skusSnap = await db.collection(`clients/${clientId}/productFamilies/${famDoc.id}/skus`).get()
    let activeReqCount = 0
    for (const skuDoc of skusSnap.docs) {
      const skuData = skuDoc.data()
      if (skuData.deleted === true) continue
      activeReqCount += countActiveRequirements(skuData.assetRequirements)
    }

    // Read samples
    const samplesSnap = await db.collection(`clients/${clientId}/productFamilies/${famDoc.id}/samples`).get()
    let sampleCount = 0
    let samplesArrivedCount = 0
    let earliestEtaMs = Number.MAX_SAFE_INTEGER
    let earliestEta: FirebaseFirestore.Timestamp | null = null

    for (const sampleDoc of samplesSnap.docs) {
      const sampleData = sampleDoc.data()
      if (sampleData.deleted === true) continue
      sampleCount += 1
      if (sampleData.status === "arrived") samplesArrivedCount += 1
      if (sampleData.eta && sampleData.status !== "arrived") {
        try {
          const etaMs = sampleData.eta.toDate().getTime()
          if (etaMs < earliestEtaMs) {
            earliestEtaMs = etaMs
            earliestEta = sampleData.eta
          }
        } catch {
          // Skip invalid timestamps
        }
      }
    }

    const updateData: Record<string, unknown> = {
      sampleCount,
      samplesArrivedCount,
      earliestSampleEta: earliestEta,
      activeRequirementCount: activeReqCount,
    }

    const styleName = famData.styleName ?? famDoc.id
    console.log(
      `  ${styleName}: samples=${sampleCount} arrived=${samplesArrivedCount} ` +
      `eta=${earliestEta ? earliestEta.toDate().toISOString().slice(0, 10) : "none"} ` +
      `activeReqs=${activeReqCount}`
    )

    if (write) {
      batch.update(famDoc.ref, updateData)
      batchCount += 1

      if (batchCount >= BATCH_SIZE) {
        await batch.commit()
        console.log(`  [committed batch of ${batchCount}]`)
        batch = db.batch()
        batchCount = 0
      }
    }

    updated += 1
  }

  // Commit remaining
  if (write && batchCount > 0) {
    await batch.commit()
    console.log(`  [committed final batch of ${batchCount}]`)
  }

  console.log("")
  console.log(`Done. ${updated} updated, ${skipped} skipped (deleted).`)
  if (!write) {
    console.log("This was a DRY RUN. Add --write to apply changes.")
  }
}

main().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
