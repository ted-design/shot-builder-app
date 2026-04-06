/**
 * Migration: Deduplicate tag entries on shot documents
 *
 * PURPOSE:
 * Tags such as "Men" and "Women" were historically created with multiple
 * document IDs because the GENDER_TAG_MAP default IDs were not enforced
 * consistently. A single shot can end up with both:
 *   { id: "abc123", label: "Men", ... }
 *   { id: "default-gender-men", label: "Men", ... }
 *
 * This migration scans every non-deleted shot, groups its tags by
 * normalized label (trim + collapse whitespace + lowercase), and for each
 * group that contains more than one entry keeps exactly one — preferring
 * the canonical default ID over any auto-generated ID.
 *
 * USAGE:
 *   # Dry run (default — no writes):
 *   npx tsx scripts/migrations/2026-04-deduplicate-shot-tags.ts --clientId=unbound-merino
 *
 *   # Actually perform writes:
 *   npx tsx scripts/migrations/2026-04-deduplicate-shot-tags.ts --clientId=unbound-merino --write
 *
 * ARGUMENTS:
 *   --clientId=<id>  (REQUIRED) Client/tenant ID
 *   --write          Actually perform writes (default: dry-run)
 */

import { getApp, getApps, initializeApp, applicationDefault } from "firebase-admin/app"
import { getFirestore } from "firebase-admin/firestore"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** IDs that should be preferred when deduplicating within a label group. */
const DEFAULT_TAG_IDS = new Set([
  "default-gender-men",
  "default-gender-women",
  "default-gender-unisex",
  "default-priority-high",
  "default-priority-medium",
  "default-priority-low",
  "default-media-photo",
  "default-media-video",
])

/** Maximum Firestore writes per batch (Firestore limit is 500; use 250 for safety). */
const BATCH_SIZE = 250

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TagEntry {
  id: string
  label: string
  color?: string
  category?: string
  [key: string]: unknown
}

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
// Tag helpers
// ---------------------------------------------------------------------------

/** Normalize a label for grouping: trim, collapse whitespace, lowercase. */
function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase()
}

/**
 * Given a group of tags that share the same normalized label, return the
 * single canonical entry to keep:
 *   1. The entry whose id is in DEFAULT_TAG_IDS (first found).
 *   2. Otherwise the first entry in the array (original insertion order).
 */
function pickCanonical(group: TagEntry[]): TagEntry {
  const defaultEntry = group.find((t) => DEFAULT_TAG_IDS.has(t.id))
  return defaultEntry ?? group[0]
}

/**
 * Deduplicate a tags array.
 * Returns null when no change is needed (all labels are already unique).
 */
function deduplicateTags(tags: TagEntry[]): TagEntry[] | null {
  // Group by normalized label, preserving order of first appearance.
  const groups = new Map<string, TagEntry[]>()
  for (const tag of tags) {
    if (typeof tag.label !== "string" || tag.label.trim() === "") {
      // Tags without a usable label are kept as-is under a unique key.
      const key = `__unlabeled_${tag.id ?? Math.random()}`
      groups.set(key, [tag])
      continue
    }
    const key = normalizeLabel(tag.label)
    const existing = groups.get(key)
    if (existing) {
      existing.push(tag)
    } else {
      groups.set(key, [tag])
    }
  }

  // Check whether any group has duplicates.
  let hasDuplicates = false
  for (const group of groups.values()) {
    if (group.length > 1) {
      hasDuplicates = true
      break
    }
  }

  if (!hasDuplicates) return null

  // Build deduplicated array in original label order.
  const result: TagEntry[] = []
  for (const group of groups.values()) {
    result.push(pickCanonical(group))
  }
  return result
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { clientId, write } = parseArgs()

  if (!clientId) {
    console.error("ERROR: --clientId is required")
    console.error(
      "Usage: npx tsx scripts/migrations/2026-04-deduplicate-shot-tags.ts --clientId=<id> [--write]"
    )
    process.exit(1)
  }

  console.log(`\n--- Deduplicate Shot Tags ---`)
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

  // Fetch all shots (all statuses — deleted filter applied client-side).
  const shotsSnap = await db.collection(`clients/${clientId}/shots`).get()
  console.log(`Found ${shotsSnap.size} shot documents (pre-filter)`)

  let totalChecked = 0
  let totalSkipped = 0
  let totalWithDuplicates = 0
  let totalDuplicatesRemoved = 0

  // Track which tags were kept per label for the summary report.
  const keptTagReport = new Map<string, string>() // normalized label → kept id

  let batch = db.batch()
  let batchCount = 0

  for (const shotDoc of shotsSnap.docs) {
    const data = shotDoc.data()

    // Client-side deleted filter (see CLAUDE.md — never use where("deleted","==",false)).
    if (data.deleted === true) {
      totalSkipped += 1
      continue
    }

    totalChecked += 1

    const tags: unknown = data.tags
    if (!Array.isArray(tags) || tags.length === 0) continue

    const tagEntries = tags as TagEntry[]
    const deduplicated = deduplicateTags(tagEntries)

    if (deduplicated === null) continue

    const removedCount = tagEntries.length - deduplicated.length
    totalWithDuplicates += 1
    totalDuplicatesRemoved += removedCount

    // Build a human-readable diff for logging.
    const removedIds = new Set(tagEntries.map((t) => t.id))
    for (const kept of deduplicated) {
      removedIds.delete(kept.id)
      const key = typeof kept.label === "string" ? normalizeLabel(kept.label) : kept.id
      keptTagReport.set(key, kept.id)
    }

    console.log(
      `  Shot ${shotDoc.id}: removed ${removedCount} duplicate(s) — ` +
        `kept [${deduplicated.map((t) => `${t.label}(${t.id})`).join(", ")}] — ` +
        `removed ids [${[...removedIds].join(", ")}]`
    )

    if (write) {
      batch.update(shotDoc.ref, { tags: deduplicated })
      batchCount += 1

      if (batchCount >= BATCH_SIZE) {
        await batch.commit()
        console.log(`  [committed batch of ${batchCount}]`)
        batch = db.batch()
        batchCount = 0
      }
    }
  }

  // Commit any remaining writes.
  if (write && batchCount > 0) {
    await batch.commit()
    console.log(`  [committed final batch of ${batchCount}]`)
  }

  // Summary
  console.log("")
  console.log(`--- Summary ---`)
  console.log(`Total shots checked:       ${totalChecked}`)
  console.log(`Shots skipped (deleted):   ${totalSkipped}`)
  console.log(`Shots with duplicates:     ${totalWithDuplicates}`)
  console.log(`Total duplicates removed:  ${totalDuplicatesRemoved}`)

  if (keptTagReport.size > 0) {
    console.log("")
    console.log(`Canonical tag IDs kept per label:`)
    for (const [label, id] of keptTagReport) {
      console.log(`  "${label}" → ${id}`)
    }
  }

  console.log("")
  if (!write) {
    console.log("This was a DRY RUN. Add --write to apply changes.")
  } else {
    console.log("Done. All changes written to Firestore.")
  }
}

main().catch((err) => {
  console.error("Migration failed:", err)
  process.exit(1)
})
