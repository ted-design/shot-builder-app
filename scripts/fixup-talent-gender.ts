/**
 * One-time fixup: normalize gender values across all talent records.
 *
 * - "Men" / "male" → "men"
 * - "Women" / "Female" / "female" → "women"
 * - Missing → prompted in output for manual review
 *
 * USAGE:
 *   npx tsx scripts/fixup-talent-gender.ts --clientId=unbound-merino
 *   npx tsx scripts/fixup-talent-gender.ts --clientId=unbound-merino --write
 */

import { getApp, getApps, initializeApp, applicationDefault } from "firebase-admin/app"
import { FieldValue, getFirestore } from "firebase-admin/firestore"

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "um-shotbuilder"

function ensureApp() {
  if (getApps().length) return getApp()
  return initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID })
}

function normalizeGender(value: string | null | undefined): string | null {
  if (!value) return null
  const lower = value.trim().toLowerCase()
  if (lower === "men" || lower === "male" || lower === "m") return "men"
  if (lower === "women" || lower === "female" || lower === "f" || lower === "woman") return "women"
  return null
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
  console.info("FIXUP: Normalize gender values")
  console.info("Mode: %s", dryRun ? "DRY RUN" : "WRITE")
  console.info("=".repeat(60))
  console.info("")

  const app = ensureApp()
  const db = getFirestore(app)
  db.settings({ ignoreUndefinedProperties: true })

  const snapshot = await db.collection(`clients/${clientId}/talent`).get()
  console.info("Loaded %d talent records", snapshot.size)
  console.info("")

  let updated = 0
  let skipped = 0
  const missing: string[] = []

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const currentGender = typeof data.gender === "string" ? data.gender : null
    const normalized = normalizeGender(currentGender)

    if (!currentGender && !normalized) {
      missing.push(`${data.name} (id: ${doc.id})`)
      continue
    }

    if (currentGender === normalized) {
      skipped += 1
      continue
    }

    console.info(
      '%s %s (id: %s) "%s" → "%s"',
      prefix,
      data.name,
      doc.id,
      currentGender,
      normalized,
    )

    if (!dryRun && normalized) {
      await doc.ref.update({
        gender: normalized,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: "system:fixup",
      })
      await new Promise((r) => setTimeout(r, 50))
    }

    updated += 1
  }

  console.info("")
  console.info("=".repeat(60))
  console.info("Updated: %d  |  Skipped: %d  |  Missing: %d", updated, skipped, missing.length)
  console.info("=".repeat(60))

  if (missing.length > 0) {
    console.info("")
    console.info("Records with NO gender (need manual fix):")
    for (const name of missing) {
      console.info("  - %s", name)
    }
  }

  if (dryRun && updated > 0) {
    console.info("")
    console.info("To apply: npx tsx scripts/fixup-talent-gender.ts --clientId=%s --write", clientId)
  }
})()
