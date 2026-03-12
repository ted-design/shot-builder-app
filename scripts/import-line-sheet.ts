/**
 * One-time line sheet product import from consolidated JSON
 *
 * Reads products-consolidated-v2.json and imports product families + SKUs
 * into Firestore. Supports 3-tier matching (style# → previous style# → fuzzy name)
 * to merge with existing products. Never deletes, never overwrites non-null with null.
 *
 * USAGE:
 *   # Dry run (default — no writes):
 *   npx tsx scripts/import-line-sheet.ts --clientId=unbound-merino
 *
 *   # Write mode (mutates Firestore):
 *   npx tsx scripts/import-line-sheet.ts --clientId=unbound-merino --write
 *
 *   # Custom JSON path:
 *   npx tsx scripts/import-line-sheet.ts --clientId=unbound-merino --json=./data/extracted/custom.json
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

interface ImportAction {
  readonly type: "CREATE" | "UPDATE" | "SKIP"
  readonly product: JsonProduct
  readonly matchedFamilyId?: string
  readonly matchedBy?: "styleNumber" | "previousStyleNumber" | "fuzzyName"
  readonly reason?: string
}

interface ImportStats {
  scanned: number
  created: number
  updated: number
  skipped: number
  errors: number
  skusCreated: number
  skusUpdated: number
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
  npx tsx scripts/import-line-sheet.ts --clientId=<id> [--write] [--json=<path>]

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
    console.error("[import] ERROR: --clientId is required")
    printUsageAndExit()
  }

  if (!/^[a-z0-9][-a-z0-9]*$/.test(clientId)) {
    console.error("[import] ERROR: clientId must be lowercase alphanumeric with hyphens")
    printUsageAndExit()
  }

  if (!existsSync(jsonPath)) {
    console.error("[import] ERROR: JSON file not found: %s", jsonPath)
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

/** Build composite sizes from sizes × inseams for a single colorway.
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
// Firestore matching
// ---------------------------------------------------------------------------

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

function matchFamily(
  product: JsonProduct,
  existing: ReadonlyArray<ExistingFamily>,
): { family: ExistingFamily; matchedBy: "styleNumber" | "previousStyleNumber" | "fuzzyName" } | null {
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
    if (match) return { family: match, matchedBy: "styleNumber" }
  }

  // Tier 2: previous style number match
  for (const psn of allPreviousStyleNumbers) {
    const match = existing.find(
      (f) =>
        f.styleNumber === psn ||
        (f.styleNumbers && f.styleNumbers.includes(psn)),
    )
    if (match) return { family: match, matchedBy: "previousStyleNumber" }
  }

  // Tier 3: fuzzy name match (same gender + normalized name)
  const normalizedName = normalizeForMatch(product.productName)
  const match = existing.find(
    (f) =>
      f.normalizedName === normalizedName &&
      (f.gender === product.gender || !f.gender),
  )
  if (match) return { family: match, matchedBy: "fuzzyName" }

  return null
}

// ---------------------------------------------------------------------------
// Action planning
// ---------------------------------------------------------------------------

function planActions(
  products: ReadonlyArray<JsonProduct>,
  existingFamilies: ReadonlyArray<ExistingFamily>,
): ReadonlyArray<ImportAction> {
  return products.map((product) => {
    const match = matchFamily(product, existingFamilies)
    if (match) {
      return {
        type: "UPDATE" as const,
        product,
        matchedFamilyId: match.family.id,
        matchedBy: match.matchedBy,
      }
    }
    return { type: "CREATE" as const, product }
  })
}

// ---------------------------------------------------------------------------
// Firestore write helpers
// ---------------------------------------------------------------------------

function buildFamilyData(product: JsonProduct, userId: string) {
  const allStyleNumbers = [
    ...new Set(product.styleGroups.map((sg) => sg.styleNumber)),
  ]
  const allVendors = [
    ...new Set(product.styleGroups.map((sg) => sg.vendor).filter(Boolean)),
  ]

  // Collect all unique sizes across all colorways (composite if inseams present)
  const hasInseams = product._inseams && product._inseams.length > 0
  const allSizes = [
    ...new Set(
      product.styleGroups.flatMap((sg) =>
        sg.colorways.flatMap((cw) =>
          hasInseams
            ? buildCompositeSizes(cw.sizes, product._inseams!)
            : cw.sizes,
        ),
      ),
    ),
  ]

  // Count total colorways (1 SKU per colorway, NOT per inseam)
  const totalColorways = product.styleGroups.reduce(
    (sum, sg) => sum + sg.colorways.length,
    0,
  )

  // Collect all color names
  const colorNames = [
    ...new Set(
      product.styleGroups.flatMap((sg) =>
        sg.colorways.map((cw) => cw.colorName),
      ),
    ),
  ]

  return {
    styleName: stripGenderPrefix(product.productName),
    styleNumber: allStyleNumbers[0] ?? "",
    previousStyleNumber: product.styleGroups[0]?.previousStyleNumber ?? "",
    gender: product.gender,
    productType: product.category,
    productSubcategory: product.subcategory,
    status: "active",
    archived: false,
    sizes: allSizes,
    sizeOptions: allSizes,
    skuCount: totalColorways,
    activeSkuCount: totalColorways,
    colorNames,
    skuCodes: [],
    notes: product._notes ?? "",
    // New fields from architecture proposal
    styleNumbers: allStyleNumbers,
    vendors: allVendors,
    retailPriceDisplay: product.retailPrice || null,
    // Audit
    createdBy: userId,
    updatedBy: userId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    clientId: "",
  }
}

function buildFamilyPatch(
  product: JsonProduct,
  userId: string,
  existingSkus: ReadonlyArray<ExistingSku>,
) {
  const allStyleNumbers = [
    ...new Set(product.styleGroups.map((sg) => sg.styleNumber)),
  ]
  const allVendors = [
    ...new Set(product.styleGroups.map((sg) => sg.vendor).filter(Boolean)),
  ]

  // Merge new colorways with existing (UNION)
  const existingColorNames = new Set(
    existingSkus.map((s) => s.colorName).filter(Boolean),
  )
  const newColorways = product.styleGroups.flatMap((sg) =>
    sg.colorways.filter((cw) => !existingColorNames.has(cw.colorName)),
  )
  const allColorNames = [
    ...new Set([
      ...existingSkus.map((s) => s.colorName).filter(Boolean),
      ...product.styleGroups.flatMap((sg) =>
        sg.colorways.map((cw) => cw.colorName),
      ),
    ]),
  ]
  const totalSkuCount = existingSkus.length + newColorways.length

  // All sizes across new + existing (composite if inseams present)
  const hasInseams = product._inseams && product._inseams.length > 0
  const allSizes = [
    ...new Set([
      ...existingSkus.flatMap((s) => s.sizes ?? []),
      ...product.styleGroups.flatMap((sg) =>
        sg.colorways.flatMap((cw) =>
          hasInseams
            ? buildCompositeSizes(cw.sizes, product._inseams!)
            : cw.sizes,
        ),
      ),
    ]),
  ]

  const patch: Record<string, unknown> = {
    // Merge arrays (never remove existing values)
    styleNumbers: FieldValue.arrayUnion(...allStyleNumbers),
    vendors: FieldValue.arrayUnion(...allVendors),
    colorNames: allColorNames,
    sizeOptions: allSizes,
    sizes: allSizes,
    skuCount: totalSkuCount,
    activeSkuCount: totalSkuCount,
    updatedBy: userId,
    updatedAt: FieldValue.serverTimestamp(),
  }

  // Only set retailPriceDisplay if not already set (never overwrite non-null)
  if (product.retailPrice) {
    // Will be conditionally applied during write
    ;(patch as Record<string, unknown>).__retailPrice = product.retailPrice
  }

  if (product._notes) {
    ;(patch as Record<string, unknown>).__notes = product._notes
  }

  return { patch, newColorways }
}

function buildSkuData(
  styleGroup: JsonStyleGroup,
  colorway: JsonColorway,
  userId: string,
  compositeSizes?: ReadonlyArray<string>,
) {
  const skuCode = buildSkuCode(styleGroup.styleNumber, colorway.colorName)

  return {
    name: colorway.colorName,
    colorName: colorway.colorName,
    skuCode,
    sizes: compositeSizes ?? colorway.sizes,
    status: "active",
    archived: false,
    deleted: false,
    // New fields from architecture proposal
    styleNumber: styleGroup.styleNumber,
    previousStyleNumber: styleGroup.previousStyleNumber ?? null,
    vendor: styleGroup.vendor,
    fabricContent: styleGroup.fabricContent,
    importSource: `line-sheet-2026`,
    // Audit
    createdBy: userId,
    updatedBy: userId,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

async function executeActions(
  db: FirebaseFirestore.Firestore,
  clientId: string,
  actions: ReadonlyArray<ImportAction>,
  dryRun: boolean,
): Promise<ImportStats> {
  const stats: ImportStats = {
    scanned: actions.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    skusCreated: 0,
    skusUpdated: 0,
  }

  const prefix = dryRun ? "[DRY RUN]" : "[WRITE]"
  const userId = "import-line-sheet"
  const familiesRef = db
    .collection("clients")
    .doc(clientId)
    .collection("productFamilies")

  for (const action of actions) {
    try {
      const name = stripGenderPrefix(action.product.productName)

      if (action.type === "SKIP") {
        console.info("%s SKIP   %s  reason=%s", prefix, name.padEnd(40), action.reason)
        stats.skipped += 1
        continue
      }

      if (action.type === "CREATE") {
        const familyData = buildFamilyData(action.product, userId)
        familyData.clientId = clientId

        // Build SKU entries (1 per colorway, composite sizes for inseam products)
        let skuCount = 0
        const skuEntries: Array<Record<string, unknown>> = []
        const hasInseams = action.product._inseams && action.product._inseams.length > 0
        for (const sg of action.product.styleGroups) {
          for (const cw of sg.colorways) {
            const sizes = hasInseams
              ? buildCompositeSizes(cw.sizes, action.product._inseams!)
              : undefined
            skuEntries.push(buildSkuData(sg, cw, userId, sizes))
            skuCount += 1
          }
        }

        familyData.skuCount = skuCount
        familyData.activeSkuCount = skuCount

        console.info(
          "%s CREATE %s  style#=%s  skus=%d  gender=%s",
          prefix,
          name.padEnd(40),
          familyData.styleNumber,
          skuCount,
          action.product.gender,
        )

        if (!dryRun) {
          const familyRef = await familiesRef.add(familyData)
          const skusRef = familyRef.collection("skus")
          for (const skuData of skuEntries) {
            await skusRef.add(skuData)
          }
          // Throttle to avoid Firestore rate limits
          await new Promise((r) => setTimeout(r, 100))
        }

        stats.created += 1
        stats.skusCreated += skuCount
        continue
      }

      if (action.type === "UPDATE") {
        const familyId = action.matchedFamilyId!
        const existingSkus = await fetchExistingSkus(db, clientId, familyId)
        const { patch, newColorways } = buildFamilyPatch(
          action.product,
          userId,
          existingSkus,
        )

        // Determine which SKUs need to be created
        const existingColorNames = new Set(
          existingSkus.map((s) => s.colorName).filter(Boolean),
        )

        let newSkuCount = 0
        const skuEntries: Array<Record<string, unknown>> = []
        const hasInseams = action.product._inseams && action.product._inseams.length > 0

        for (const sg of action.product.styleGroups) {
          const newCws = sg.colorways.filter(
            (cw) => !existingColorNames.has(cw.colorName),
          )
          if (newCws.length === 0) continue

          for (const cw of newCws) {
            const sizes = hasInseams
              ? buildCompositeSizes(cw.sizes, action.product._inseams!)
              : undefined
            skuEntries.push(buildSkuData(sg, cw, userId, sizes))
            newSkuCount += 1
          }
        }

        // Update existing SKUs with new fields (vendor, fabricContent, etc.)
        let skusUpdatedCount = 0
        for (const sg of action.product.styleGroups) {
          for (const cw of sg.colorways) {
            if (!existingColorNames.has(cw.colorName)) continue
            const existingSku = existingSkus.find(
              (s) => s.colorName === cw.colorName,
            )
            if (!existingSku) continue
            skusUpdatedCount += 1

            if (!dryRun) {
              const skuRef = familiesRef
                .doc(familyId)
                .collection("skus")
                .doc(existingSku.id)
              await skuRef.set(
                {
                  styleNumber: sg.styleNumber,
                  previousStyleNumber: sg.previousStyleNumber ?? null,
                  vendor: sg.vendor,
                  fabricContent: sg.fabricContent,
                  importSource: "line-sheet-2026",
                  updatedBy: userId,
                  updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true },
              )
            }
          }
        }

        console.info(
          "%s UPDATE %s  matched=%s (id=%s)  newSkus=%d  updatedSkus=%d",
          prefix,
          name.padEnd(40),
          action.matchedBy,
          familyId,
          newSkuCount,
          skusUpdatedCount,
        )

        if (!dryRun) {
          const familyRef = familiesRef.doc(familyId)
          // Check existing family for non-null fields before patching
          const familyDoc = await familyRef.get()
          const existingData = familyDoc.data() ?? {}

          const cleanPatch = { ...patch }
          // Don't overwrite non-null retailPriceDisplay
          const pendingRetailPrice = (cleanPatch as Record<string, unknown>)
            .__retailPrice
          delete (cleanPatch as Record<string, unknown>).__retailPrice
          if (
            pendingRetailPrice &&
            !existingData.retailPriceDisplay
          ) {
            ;(cleanPatch as Record<string, unknown>).retailPriceDisplay =
              pendingRetailPrice
          }

          // Don't overwrite non-null notes
          const pendingNotes = (cleanPatch as Record<string, unknown>).__notes
          delete (cleanPatch as Record<string, unknown>).__notes
          if (pendingNotes && !existingData.notes) {
            ;(cleanPatch as Record<string, unknown>).notes = pendingNotes
          }

          await familyRef.update(cleanPatch)

          // Create new SKUs
          const skusRef = familyRef.collection("skus")
          for (const skuData of skuEntries) {
            await skusRef.add(skuData)
          }

          await new Promise((r) => setTimeout(r, 100))
        }

        stats.updated += 1
        stats.skusCreated += newSkuCount
        stats.skusUpdated += skusUpdatedCount
        continue
      }
    } catch (err) {
      stats.errors += 1
      const name = stripGenderPrefix(action.product.productName)
      console.error("  ERROR processing %s: %s", name, err)
    }
  }

  return stats
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

;(async () => {
  try {
    const args = parseArgs()
    const dryRun = !args.write

    console.info("[import] Line Sheet Product Import")
    console.info("[import] Mode: %s", dryRun ? "DRY RUN" : "WRITE")
    console.info("[import] Client: %s", args.clientId)
    console.info("[import] JSON: %s", args.jsonPath)
    console.info("")

    // Parse JSON
    const raw = readFileSync(args.jsonPath, "utf-8")
    const data: JsonRoot = JSON.parse(raw)
    console.info(
      "[import] Loaded %d products, %d colorways",
      data._totalProducts,
      data._totalColorways,
    )

    // Initialize Firebase
    ensureApp()
    const db = getFirestore()

    // Fetch existing families
    console.info("[import] Fetching existing product families...")
    const existingFamilies = await fetchExistingFamilies(db, args.clientId!)

    console.info(
      "[import] Found %d existing families in Firestore",
      existingFamilies.length,
    )
    console.info("")

    // Plan actions
    const actions = planActions(data.products, existingFamilies)

    // Summary
    const creates = actions.filter((a) => a.type === "CREATE")
    const updates = actions.filter((a) => a.type === "UPDATE")
    const skips = actions.filter((a) => a.type === "SKIP")

    console.info("[import] Action plan:")
    console.info("  CREATE: %d new product families", creates.length)
    console.info("  UPDATE: %d existing families (merge colorways + fields)", updates.length)
    console.info("  SKIP:   %d", skips.length)
    console.info("")

    // Show match details for updates
    if (updates.length > 0) {
      console.info("[import] Matched products:")
      for (const action of updates) {
        const name = stripGenderPrefix(action.product.productName)
        console.info(
          "  %s → %s (id=%s)",
          name.padEnd(40),
          action.matchedBy,
          action.matchedFamilyId,
        )
      }
      console.info("")
    }

    // Execute
    const stats = await executeActions(db, args.clientId!, actions, dryRun)

    // Print summary
    console.info("")
    console.info("[import] ─── Summary ───")
    console.info("  Scanned:       %d", stats.scanned)
    console.info("  Created:       %d families", stats.created)
    console.info("  Updated:       %d families", stats.updated)
    console.info("  Skipped:       %d", stats.skipped)
    console.info("  Errors:        %d", stats.errors)
    console.info("  SKUs created:  %d", stats.skusCreated)
    console.info("  SKUs updated:  %d", stats.skusUpdated)

    if (dryRun && (creates.length > 0 || updates.length > 0)) {
      console.info("")
      console.info(
        "[import] To apply these changes, run with --write:",
      )
      console.info(
        "  npx tsx scripts/import-line-sheet.ts --clientId=%s --write",
        args.clientId,
      )
    }
  } catch (error) {
    console.error("[import] Fatal error:", error)
    process.exitCode = 1
  }
})()
