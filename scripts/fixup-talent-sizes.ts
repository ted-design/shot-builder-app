/**
 * One-time fixup: move dress/suit from measurements to notes.
 *
 * For each talent doc that has measurements.dress or measurements.suit:
 *   - Appends "Wearing size X" to notes
 *   - Removes dress/suit from measurements
 *
 * USAGE:
 *   npx tsx scripts/fixup-talent-sizes.ts --clientId=unbound-merino
 *   npx tsx scripts/fixup-talent-sizes.ts --clientId=unbound-merino --write
 */

import { getApp, getApps, initializeApp, applicationDefault } from "firebase-admin/app"
import { FieldValue, getFirestore } from "firebase-admin/firestore"

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "um-shotbuilder"

function ensureApp() {
  if (getApps().length) return getApp()
  return initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID })
}

function parseArgs(): { clientId: string | null; write: boolean } {
  const args = process.argv.slice(2)
  let clientId: string | null = null
  let write = false
  for (const arg of args) {
    if (arg.startsWith("--clientId=")) clientId = arg.slice("--clientId=".length).trim()
    else if (arg === "--write") write = true
  }
  return { clientId, write }
}

;(async () => {
  const { clientId, write } = parseArgs()
  if (!clientId) {
    console.error("ERROR: --clientId is required")
    process.exit(1)
  }

  const dryRun = !write
  const prefix = dryRun ? "[DRY RUN]" : "[WRITE]"

  console.info("")
  console.info("=".repeat(60))
  console.info("FIXUP: Move dress/suit from measurements to notes")
  console.info("Mode: %s", dryRun ? "DRY RUN" : "WRITE")
  console.info("=".repeat(60))
  console.info("")

  const app = ensureApp()
  const db = getFirestore(app)
  db.settings({ ignoreUndefinedProperties: true })

  const snapshot = await db.collection(`clients/${clientId}/talent`).get()
  console.info("Loaded %d talent records", snapshot.size)

  let updated = 0
  let skipped = 0

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const measurements = (data.measurements as Record<string, unknown>) ?? {}
    const dressVal = measurements.dress
    const suitVal = measurements.suit

    if (dressVal === undefined && suitVal === undefined) {
      skipped += 1
      continue
    }

    // Build the note text
    const sizeParts: string[] = []
    if (dressVal !== undefined && dressVal !== null) {
      const label = String(dressVal).replace(/^WEARING SIZE\s*/i, "")
      sizeParts.push(`Wearing size ${label}`)
    }
    if (suitVal !== undefined && suitVal !== null) {
      const label = String(suitVal).replace(/^WEARING SIZE\s*/i, "")
      sizeParts.push(`Wearing size ${label}`)
    }
    const sizeNote = sizeParts.join("; ")

    // Append to existing notes
    const existingNotes = typeof data.notes === "string" ? data.notes.trim() : ""
    const newNotes = existingNotes ? `${existingNotes}\n${sizeNote}` : sizeNote

    // Remove dress/suit from measurements
    const cleanedMeasurements = { ...measurements }
    delete cleanedMeasurements.dress
    delete cleanedMeasurements.suit

    console.info(
      "%s %s (id: %s) → notes: %s",
      prefix,
      data.name,
      doc.id,
      JSON.stringify(sizeNote),
    )

    if (!dryRun) {
      await doc.ref.update({
        measurements: cleanedMeasurements,
        notes: newNotes,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: "system:fixup",
      })
      await new Promise((r) => setTimeout(r, 50))
    }

    updated += 1
  }

  console.info("")
  console.info("=".repeat(60))
  console.info("Updated: %d  |  Skipped: %d", updated, skipped)
  console.info("=".repeat(60))

  if (dryRun && updated > 0) {
    console.info("")
    console.info("To apply: npx tsx scripts/fixup-talent-sizes.ts --clientId=%s --write", clientId)
  }
})()
