/**
 * One-time fixup: normalize talent agency names to canonical values.
 *
 * Pass 1 — DUMP (dry-run, no mapping): print every distinct agency + count so
 * the canonical map can be curated by hand from real data:
 *   npx tsx scripts/normalize-agency-names.ts --clientId=unbound-merino
 *
 * Pass 2 — PREVIEW (dry-run, with mapping): show the planned renames:
 *   npx tsx scripts/normalize-agency-names.ts --clientId=unbound-merino --mapping=agency-map.json
 *
 * Pass 3 — WRITE: apply the reviewed mapping:
 *   npx tsx scripts/normalize-agency-names.ts --clientId=unbound-merino --mapping=agency-map.json --write
 *
 * The mapping JSON is a flat object of { "<existing variant>": "<canonical>" }.
 * Match is on the trimmed, whitespace-collapsed value; unmapped agencies are
 * left untouched (and reported). Map a variant to "" to clear the field.
 *
 * Run this BEFORE the AgencyCombobox flag flips: the agency filter is
 * exact-equality (talentFilters.ts matchesAgency), so variants only collapse
 * in the filter once the stored data is normalized.
 */

import { readFileSync } from "node:fs"
import { getApp, getApps, initializeApp, applicationDefault } from "firebase-admin/app"
import { FieldValue, getFirestore } from "firebase-admin/firestore"

const PROJECT_ID = process.env.GCLOUD_PROJECT ?? "um-shotbuilder"

function ensureApp() {
  if (getApps().length) return getApp()
  return initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID })
}

/** Trim + collapse internal whitespace — the key both the dump and the mapping match on. */
function normalizeKey(value: string): string {
  return value.trim().replace(/\s+/g, " ")
}

function parseArgs(): { clientId: string | null; mappingPath: string | null; write: boolean } {
  const args = process.argv.slice(2)
  let clientId: string | null = null
  let mappingPath: string | null = null
  let write = false
  for (const arg of args) {
    if (arg.startsWith("--clientId=")) clientId = arg.slice("--clientId=".length).trim()
    else if (arg.startsWith("--mapping=")) mappingPath = arg.slice("--mapping=".length).trim()
    else if (arg === "--write") write = true
  }
  return { clientId, mappingPath, write }
}

/** Load + validate the reviewed { variant -> canonical } mapping, keyed on normalizeKey. */
function loadMapping(path: string): Record<string, string> {
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("Mapping file must be a JSON object of { variant: canonical }")
  }
  const out: Record<string, string> = {}
  for (const [variant, canonical] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof canonical !== "string") {
      throw new Error(`Mapping value for "${variant}" must be a string`)
    }
    const key = normalizeKey(variant)
    // Two keys differing only by whitespace collapse to the same normalized key;
    // a silent last-write-wins would misroute records. Stop on a real conflict.
    if (key in out && out[key] !== canonical) {
      throw new Error(
        `Conflicting mapping: "${variant}" normalizes to "${key}" but maps to "${canonical}" ` +
          `while an earlier entry maps it to "${out[key]}"`,
      )
    }
    out[key] = canonical
  }
  return out
}

;(async () => {
  const { clientId, mappingPath, write } = parseArgs()
  if (!clientId) {
    console.error("ERROR: --clientId is required")
    process.exit(1)
  }
  if (write && !mappingPath) {
    console.error("ERROR: --write requires --mapping=<path to reviewed JSON>")
    process.exit(1)
  }

  const dryRun = !write
  const prefix = dryRun ? "[DRY RUN]" : "[WRITE]"
  const mapping = mappingPath ? loadMapping(mappingPath) : null

  console.info("")
  console.info("=".repeat(60))
  console.info("FIXUP: Normalize talent agency names")
  console.info("Mode: %s%s", dryRun ? "DRY RUN" : "WRITE", mapping ? "" : " (dump only — no mapping)")
  console.info("=".repeat(60))
  console.info("")

  const app = ensureApp()
  const db = getFirestore(app)
  db.settings({ ignoreUndefinedProperties: true })

  const snapshot = await db.collection(`clients/${clientId}/talent`).get()
  console.info("Loaded %d talent records", snapshot.size)
  console.info("")

  // --- Always: dump distinct agencies + counts (the curation input). ---
  const counts = new Map<string, number>()
  for (const doc of snapshot.docs) {
    const agency = typeof doc.data().agency === "string" ? (doc.data().agency as string) : ""
    if (!agency.trim()) continue
    counts.set(agency, (counts.get(agency) ?? 0) + 1)
  }

  const distinct = Array.from(counts.entries()).sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )
  console.info("Distinct agencies (%d):", distinct.length)
  for (const [agency, count] of distinct) {
    console.info('  %s  "%s"', String(count).padStart(5), agency)
  }
  console.info("")

  if (!mapping) {
    console.info("No --mapping supplied. Curate a { variant: canonical } JSON from the")
    console.info("list above, then re-run with --mapping=<file> to preview renames.")
    return
  }

  // --- With mapping: preview / apply renames. ---
  let changed = 0
  let unchanged = 0
  const unmapped = new Set<string>()

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const raw = typeof data.agency === "string" ? data.agency : ""
    if (!raw.trim()) continue

    const canonical = mapping[normalizeKey(raw)]
    if (canonical === undefined) {
      unmapped.add(raw)
      continue
    }

    // Normalize the canonical the same way as the key so a sloppy value can't
    // reintroduce a near-duplicate the exact-equality filter won't merge.
    const next = normalizeKey(canonical) || null
    if (next === raw) {
      unchanged += 1
      continue
    }

    console.info(
      '%s %s (id: %s) "%s" → %s',
      prefix,
      data.name,
      doc.id,
      raw,
      next === null ? "(cleared)" : `"${next}"`,
    )

    if (!dryRun) {
      await doc.ref.update({
        agency: next,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: "system:fixup",
      })
      await new Promise((r) => setTimeout(r, 50))
    }

    changed += 1
  }

  console.info("")
  console.info("=".repeat(60))
  console.info("Changed: %d  |  Already canonical: %d  |  Unmapped: %d", changed, unchanged, unmapped.size)
  console.info("=".repeat(60))

  if (unmapped.size > 0) {
    console.info("")
    console.info("Agencies with NO mapping entry (left untouched):")
    for (const agency of Array.from(unmapped).sort()) {
      console.info('  - "%s"', agency)
    }
  }

  if (dryRun && changed > 0) {
    console.info("")
    console.info(
      "To apply: npx tsx scripts/normalize-agency-names.ts --clientId=%s --mapping=%s --write",
      clientId,
      mappingPath,
    )
  }
})()
