/**
 * Re-import inseam products with correct composite sizes
 *
 * Reads products-consolidated-v2.json, filters to products with _inseams,
 * matches each to an existing Firestore family, and creates SKUs with
 * composite sizes (e.g., "S/30", "M/32") instead of separate per-inseam SKUs.
 *
 * Run AFTER fix-inseam-skus.ts has deleted the incorrectly expanded SKUs.
 *
 * USAGE:
 *   # Dry run (default — no writes):
 *   npx tsx scripts/reimport-inseam-products.ts --clientId=unbound-merino
 *
 *   # Write mode (mutates Firestore):
 *   npx tsx scripts/reimport-inseam-products.ts --clientId=unbound-merino --write
 *
 *   # Custom JSON path:
 *   npx tsx scripts/reimport-inseam-products.ts --clientId=unbound-merino --json=./data/extracted/custom.json
 *
 * ARGUMENTS:
 *   --clientId=<id>  (REQUIRED) Client/tenant ID to target
 *   --write          Actually perform writes (default: dry-run)
 *   --json=<path>    Path to consolidated JSON (default: ./data/extracted/products-consolidated-v2.json)
 */

import { resolve } from "node:path"
import { existsSync, readFileSync } from "node:fs"
import { getApp, getApps, initializeApp, applicationDefault } from "firebase-admin/app"
import { FieldValue, getFirestore } from "firebase-admin/firestore"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CliArgs {
  readonly clientId: string | null
  readonly write: boolean
  readonly jsonPath: string
}

interface JsonColorway {
  readonly colorName: string
  readonly sizes: ReadonlyArray<string>
  readonly sizeNote: string
}

interface JsonStyleGroup {
  readonly styleNumber: string
  readonly previousStyleNumber: string | null
  readonly vendor: string
  readonly variant: string | null
  readonly fabricCode: string | null
  readonly fabricContent: string
  readonly colorways: ReadonlyArray<JsonColorway>
}

interface JsonProduct {
  readonly productName: string
  readonly gender: string
  readonly category: string
  readonly subcategory: string
  readonly badge: string | null
  readonly retailPrice: string
  readonly quarters: ReadonlyArray<string>
  readonly styleGroups: ReadonlyArray<JsonStyleGroup>
  readonly _flags: ReadonlyArray<string>
  readonly _sourcePages: Record<string, unknown>
  readonly _months: Record<string, unknown>
  readonly _notes: string | null
  readonly _inseams: ReadonlyArray<string> | null
  readonly _rawSizeRange: string
}

interface JsonRoot {
  readonly _schemaVersion: number
  readonly _totalProducts: number
  readonly _totalColorways: number
  readonly products: ReadonlyArray<JsonProduct>
}

interface ExistingFamily {
  readonly id: string
  readonly styleName: string
  readonly styleNumber?: string
  readonly previousStyleNumber?: string
  readonly gender?: string
  readonly normalizedName: string
  readonly styleNumbers?: ReadonlyArray<string>
}

interface ExistingSku {
  readonly id: string
  readonly colorName?: string
  readonly skuCode?: string
  readonly sizes?: ReadonlyArray<string>
}

interface ReimportStats {
  scanned: number
  matched: number
  unmatched: number
  skusCreated: number
  familiesPatched: number
  errors: number
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
  npx tsx scripts/reimport-inseam-products.ts --clientId=<id> [--write] [--json=<path>]

Arguments:
  --clientId=<id>  (REQUIRED) Client/tenant ID
  --write          Actually perform writes (default: dry-run)
  --json=<path>    Path to consolidated JSON
                   (default: ./data/extracted/products-consolidated-v2.json)
`)
  process.exit(1)
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  let clientId: string | null = null
  let write = false
  let jsonPath = resolve(process.cwd(), "data/extracted/products-consolidated-v2.json")

  for (const arg of args) {
    if (arg.startsWith("--clientId=")) {
      clientId = arg.slice("--clientId=".length).trim()
    } else if (arg === "--write") {
      write = true
    } else if (arg.startsWith("--json=")) {
      jsonPath = resolve(process.cwd(), arg.slice("--json=".length).trim())
    }
  }

  if (!clientId) {
    console.error("[reimport] ERROR: --clientId is required")
    printUsageAndExit()
  }

  if (!/^[a-z0-9][-a-z0-9]*$/.test(clientId)) {
    console.error("[reimport] ERROR: clientId must be lowercase alphanumeric with hyphens")
    printUsageAndExit()
  }

  if (!existsSync(jsonPath)) {
    console.error("[reimport] ERROR: JSON file not found: %s", jsonPath)
    process.exit(1)
  }

  return { clientId, write, jsonPath }
}

// ---------------------------------------------------------------------------
// Text normalization
// ---------------------------------------------------------------------------

function normalizeForMatch(name: string): string {
  return name
    .toLowerCase()
    .replace(/women'?s\s+/gi, "")
    .replace(/men'?s\s+/gi, "")
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function stripGenderPrefix(name: string): string {
  return name
    .replace(/^Women'?s\s+/i, "")
    .replace(/^Men'?s\s+/i, "")
    .trim()
}

// ---------------------------------------------------------------------------
// Size helpers
// ---------------------------------------------------------------------------

/** Build composite sizes from sizes × inseams.
 *  E.g., sizes ["S","M","L"] × inseams ["30","32"] → ["S/30","S/32","M/30","M/32","L/30","L/32"]
 */
function buildCompositeSizes(
  sizes: ReadonlyArray<string>,
  inseams: ReadonlyArray<string>,
): ReadonlyArray<string> {
  return sizes.flatMap((size) =>
    inseams.map((inseam) => `${size}/${inseam}`),
  )
}

/** Build a unique SKU code from components. */
function buildSkuCode(styleNumber: string, colorName: string): string {
  return `${styleNumber}-${colorName}`
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9\-()#]/g, "")
}

// ---------------------------------------------------------------------------
// Firestore helpers
// ---------------------------------------------------------------------------

async function fetchExistingFamilies(
  db: FirebaseFirestore.Firestore,
  clientId: string,
): Promise<ReadonlyArray<ExistingFamily>> {
  const snap = await db
    .collection("clients")
    .doc(clientId)
    .collection("productFamilies")
    .get()

  return snap.docs
    .filter((doc) => doc.data().deleted !== true)
    .map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        styleName: data.styleName ?? "",
        styleNumber: data.styleNumber,
        previousStyleNumber: data.previousStyleNumber,
        gender: data.gender,
        normalizedName: normalizeForMatch(data.styleName ?? ""),
        styleNumbers: data.styleNumbers,
      }
    })
}

async function fetchExistingSkus(
  db: FirebaseFirestore.Firestore,
  clientId: string,
  familyId: string,
): Promise<ReadonlyArray<ExistingSku>> {
  const snap = await db
    .collection("clients")
    .doc(clientId)
    .collection("productFamilies")
    .doc(familyId)
    .collection("skus")
    .get()

  return snap.docs
    .filter((doc) => doc.data().deleted !== true)
    .map((doc) => {
      const data = doc.data()
      return {
        id: doc.id,
        colorName: data.colorName,
        skuCode: data.skuCode,
        sizes: data.sizes,
      }
    })
}

// ---------------------------------------------------------------------------
// Matching (same 3-tier logic as import-line-sheet.ts)
// ---------------------------------------------------------------------------

function matchFamily(
  product: JsonProduct,
  existing: ReadonlyArray<ExistingFamily>,
): { family: ExistingFamily; matchedBy: string } | null {
  const allStyleNumbers = product.styleGroups.map((sg) => sg.styleNumber)
  const allPreviousStyleNumbers = product.styleGroups
    .map((sg) => sg.previousStyleNumber)
    .filter((s): s is string => s !== null)

  // Tier 1: exact style number match
  for (const sn of allStyleNumbers) {
    const match = existing.find(
      (f) =>
        f.styleNumber === sn ||
        (f.styleNumbers && f.styleNumbers.includes(sn)),
    )
    if (match) return { family: match, matchedBy: `styleNumber(${sn})` }
  }

  // Tier 2: previous style number match
  for (const psn of allPreviousStyleNumbers) {
    const match = existing.find(
      (f) =>
        f.styleNumber === psn ||
        (f.styleNumbers && f.styleNumbers.includes(psn)),
    )
    if (match) return { family: match, matchedBy: `previousStyleNumber(${psn})` }
  }

  // Tier 3: fuzzy name match (same gender + normalized name)
  const normalizedName = normalizeForMatch(product.productName)
  const match = existing.find(
    (f) =>
      f.normalizedName === normalizedName &&
      (f.gender === product.gender || !f.gender),
  )
  if (match) return { family: match, matchedBy: `fuzzyName` }

  return null
}

// ---------------------------------------------------------------------------
// SKU data builder
// ---------------------------------------------------------------------------

function buildSkuData(
  styleGroup: JsonStyleGroup,
  colorway: JsonColorway,
  compositeSizes: ReadonlyArray<string>,
  userId: string,
) {
  return {
    name: colorway.colorName,
    colorName: colorway.colorName,
    skuCode: buildSkuCode(styleGroup.styleNumber, colorway.colorName),
    sizes: compositeSizes,
    status: "active",
    archived: false,
    deleted: false,
    styleNumber: styleGroup.styleNumber,
    previousStyleNumber: styleGroup.previousStyleNumber ?? null,
    vendor: styleGroup.vendor,
    fabricContent: styleGroup.fabricContent,
    importSource: "line-sheet-2026-inseam-fix",
    createdBy: userId,
    updatedBy: userId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }
}

// ---------------------------------------------------------------------------
// Process a single product
// ---------------------------------------------------------------------------

async function processProduct(
  db: FirebaseFirestore.Firestore,
  clientId: string,
  product: JsonProduct,
  family: ExistingFamily,
  dryRun: boolean,
  stats: ReimportStats,
): Promise<void> {
  const userId = "reimport-inseam-fix"
  const name = stripGenderPrefix(product.productName)
  const inseams = product._inseams!
  const prefix = dryRun ? "[DRY RUN]" : "[WRITE]"

  const existingSkus = await fetchExistingSkus(db, clientId, family.id)
  const existingColorNames = new Set(
    existingSkus.map((s) => s.colorName).filter(Boolean),
  )

  const familiesRef = db
    .collection("clients")
    .doc(clientId)
    .collection("productFamilies")

  // Collect new SKUs to create (colorways not already present)
  const skuEntries: Array<{ sg: JsonStyleGroup; cw: JsonColorway; sizes: ReadonlyArray<string> }> = []
  for (const sg of product.styleGroups) {
    for (const cw of sg.colorways) {
      if (existingColorNames.has(cw.colorName)) continue
      const compositeSizes = buildCompositeSizes(cw.sizes, inseams)
      skuEntries.push({ sg, cw, sizes: compositeSizes })
    }
  }

  if (skuEntries.length === 0) {
    console.info(
      "%s SKIP   %s  all colorways already exist (family=%s)",
      prefix, name.padEnd(40), family.id,
    )
    return
  }

  console.info(
    "%s CREATE %s  family=%s  newSkus=%d  inseams=%s",
    prefix, name.padEnd(40), family.id, skuEntries.length, inseams.join(","),
  )
  for (const entry of skuEntries) {
    console.info(
      "         → %s  sizes=[%s]  (%d composite sizes)",
      entry.cw.colorName.padEnd(20),
      entry.sizes.slice(0, 4).join(", ") + (entry.sizes.length > 4 ? ", ..." : ""),
      entry.sizes.length,
    )
  }

  if (!dryRun) {
    const familyRef = familiesRef.doc(family.id)
    const skusRef = familyRef.collection("skus")

    for (const entry of skuEntries) {
      await skusRef.add(buildSkuData(entry.sg, entry.cw, entry.sizes, userId))
    }

    // Patch family-level sizes, sizeOptions, skuCount, colorNames
    const allCompositeSizes = [
      ...new Set([
        ...existingSkus.flatMap((s) => s.sizes ?? []),
        ...skuEntries.flatMap((e) => e.sizes),
      ]),
    ]
    const allColorNames = [
      ...new Set([
        ...existingSkus.map((s) => s.colorName).filter(Boolean),
        ...skuEntries.map((e) => e.cw.colorName),
      ]),
    ]
    const totalSkuCount = existingSkus.length + skuEntries.length

    await familyRef.update({
      sizes: allCompositeSizes,
      sizeOptions: allCompositeSizes,
      colorNames: allColorNames,
      skuCount: totalSkuCount,
      activeSkuCount: totalSkuCount,
      updatedBy: userId,
      updatedAt: FieldValue.serverTimestamp(),
    })

    // Throttle to avoid Firestore rate limits
    await new Promise((r) => setTimeout(r, 100))
  }

  stats.skusCreated += skuEntries.length
  stats.familiesPatched += 1
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

;(async () => {
  try {
    const args = parseArgs()
    const dryRun = !args.write

    console.info("[reimport] Inseam Product Re-import (Composite Sizes Fix)")
    console.info("[reimport] Mode: %s", dryRun ? "DRY RUN" : "WRITE")
    console.info("[reimport] Client: %s", args.clientId)
    console.info("[reimport] JSON: %s", args.jsonPath)
    console.info("")

    // Parse JSON and filter to inseam products
    const raw = readFileSync(args.jsonPath, "utf-8")
    const data: JsonRoot = JSON.parse(raw)
    const inseamProducts = data.products.filter(
      (p) => p._inseams && p._inseams.length > 0,
    )

    console.info(
      "[reimport] Found %d inseam products (out of %d total)",
      inseamProducts.length,
      data._totalProducts,
    )

    if (inseamProducts.length === 0) {
      console.info("[reimport] Nothing to do.")
      return
    }

    // Initialize Firebase
    ensureApp()
    const db = getFirestore()

    // Fetch existing families
    console.info("[reimport] Fetching existing product families...")
    const existingFamilies = await fetchExistingFamilies(db, args.clientId!)
    console.info(
      "[reimport] Found %d existing families in Firestore",
      existingFamilies.length,
    )
    console.info("")

    // Match each inseam product to a family
    const stats: ReimportStats = {
      scanned: inseamProducts.length,
      matched: 0,
      unmatched: 0,
      skusCreated: 0,
      familiesPatched: 0,
      errors: 0,
    }

    for (const product of inseamProducts) {
      const name = stripGenderPrefix(product.productName)
      const match = matchFamily(product, existingFamilies)

      if (!match) {
        console.info(
          "[reimport] UNMATCHED  %s  (no family found — skipping)",
          name.padEnd(40),
        )
        stats.unmatched += 1
        continue
      }

      stats.matched += 1
      try {
        await processProduct(db, args.clientId!, product, match.family, dryRun, stats)
      } catch (err) {
        stats.errors += 1
        console.error("  ERROR processing %s: %s", name, err)
      }
    }

    // Print summary
    console.info("")
    console.info("[reimport] ─── Summary ───")
    console.info("  Scanned:          %d inseam products", stats.scanned)
    console.info("  Matched:          %d", stats.matched)
    console.info("  Unmatched:        %d", stats.unmatched)
    console.info("  Families patched: %d", stats.familiesPatched)
    console.info("  SKUs created:     %d", stats.skusCreated)
    console.info("  Errors:           %d", stats.errors)

    if (dryRun && stats.skusCreated > 0) {
      console.info("")
      console.info("[reimport] To apply these changes, run with --write:")
      console.info(
        "  npx tsx scripts/reimport-inseam-products.ts --clientId=%s --write",
        args.clientId,
      )
    }
  } catch (error) {
    console.error("[reimport] Fatal error:", error)
    process.exitCode = 1
  }
})()
