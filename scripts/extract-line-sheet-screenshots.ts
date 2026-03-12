/**
 * Extract line sheet PDF pages as screenshots and upload to Firebase Storage
 *
 * Renders each PDF page as a high-resolution PNG using pdftoppm (Poppler),
 * then uploads to Firebase Storage and creates ProductDocument entries
 * linking each page image to the product families that appear on it.
 *
 * USAGE:
 *   # Dry run (default — renders PNGs locally, no uploads):
 *   npx tsx scripts/extract-line-sheet-screenshots.ts --clientId=unbound-merino
 *
 *   # Write mode (uploads to Storage + creates ProductDocuments):
 *   npx tsx scripts/extract-line-sheet-screenshots.ts --clientId=unbound-merino --write
 *
 * PREREQUISITES:
 *   brew install poppler   # provides pdftoppm
 *   npm install sharp      # already in project deps
 *
 * ARGUMENTS:
 *   --clientId=<id>  (REQUIRED) Client/tenant ID
 *   --write          Upload to Storage + create Firestore docs (default: dry-run)
 */

import { resolve, basename } from "node:path"
import { existsSync, readFileSync, mkdirSync, readdirSync } from "node:fs"
import { execSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { getApp, getApps, initializeApp, applicationDefault } from "firebase-admin/app"
import { FieldValue, getFirestore } from "firebase-admin/firestore"
import { getStorage } from "firebase-admin/storage"
import sharp from "sharp"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CliArgs {
  readonly clientId: string | null
  readonly write: boolean
  readonly jsonPath: string
}

interface JsonProduct {
  readonly productName: string
  readonly gender: string
  readonly _sourcePages: Record<string, ReadonlyArray<number>>
  readonly styleGroups: ReadonlyArray<{ readonly styleNumber: string }>
}

interface JsonRoot {
  readonly products: ReadonlyArray<JsonProduct>
}

interface PageMapping {
  readonly quarter: string
  readonly pdfPath: string
  readonly pageNumber: number
  readonly familyIds: ReadonlyArray<string>
  readonly productNames: ReadonlyArray<string>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIREBASE_PROJECT_ID = process.env.GCLOUD_PROJECT ?? "um-shotbuilder"
const STORAGE_BUCKET = process.env.STORAGE_BUCKET ?? "um-shotbuilder.firebasestorage.app"

const PDF_FILES: Record<string, string> = {
  Q1: "data/Line Sheets/Q1 - 2026.pdf",
  Q2: "data/Line Sheets/Q2 - 2026.pdf",
  Q3Q4: "data/Line Sheets/Q3 & Q4 - 2026.pdf",
}

const SCREENSHOT_DIR = "data/extracted/screenshots"
const RENDER_DPI = 200

// ---------------------------------------------------------------------------
// Firebase Admin
// ---------------------------------------------------------------------------

function ensureApp() {
  if (getApps().length) return getApp()
  return initializeApp({
    credential: applicationDefault(),
    projectId: FIREBASE_PROJECT_ID,
    storageBucket: STORAGE_BUCKET,
  })
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

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
    console.error("[screenshots] ERROR: --clientId is required")
    console.info("Usage: npx tsx scripts/extract-line-sheet-screenshots.ts --clientId=<id> [--write]")
    process.exit(1)
  }

  if (!/^[a-z0-9][-a-z0-9]*$/.test(clientId)) {
    console.error("[screenshots] ERROR: clientId must be lowercase alphanumeric with hyphens")
    process.exit(1)
  }

  return { clientId, write, jsonPath }
}

// ---------------------------------------------------------------------------
// PDF rendering
// ---------------------------------------------------------------------------

function renderPdfPages(pdfPath: string, outputDir: string, quarter: string): ReadonlyArray<string> {
  const absPath = resolve(process.cwd(), pdfPath)
  if (!existsSync(absPath)) {
    console.error("[screenshots] PDF not found: %s", absPath)
    return []
  }

  const quarterDir = resolve(outputDir, quarter.toLowerCase())
  mkdirSync(quarterDir, { recursive: true })

  const prefix = resolve(quarterDir, "page")
  console.info("[screenshots] Rendering %s at %d DPI...", basename(pdfPath), RENDER_DPI)

  execSync(
    `pdftoppm -png -r ${RENDER_DPI} "${absPath}" "${prefix}"`,
    { stdio: "pipe", maxBuffer: 100 * 1024 * 1024 },
  )

  // pdftoppm outputs page-01.png, page-02.png, etc.
  const files = readdirSync(quarterDir)
    .filter((f) => f.startsWith("page-") && f.endsWith(".png"))
    .sort()

  console.info("[screenshots] Rendered %d pages for %s", files.length, quarter)
  return files.map((f) => resolve(quarterDir, f))
}

function extractPageNumber(filePath: string): number {
  const match = basename(filePath).match(/page-(\d+)\.png$/)
  return match ? parseInt(match[1], 10) : 0
}

// ---------------------------------------------------------------------------
// Firestore matching
// ---------------------------------------------------------------------------

async function buildFamilyLookup(
  db: FirebaseFirestore.Firestore,
  clientId: string,
): Promise<Map<string, string>> {
  // Map styleNumber → familyId
  const lookup = new Map<string, string>()
  const snap = await db
    .collection("clients")
    .doc(clientId)
    .collection("productFamilies")
    .get()

  for (const doc of snap.docs) {
    const data = doc.data()
    if (data.deleted === true) continue
    if (data.styleNumber) {
      lookup.set(data.styleNumber, doc.id)
    }
    if (data.styleNumbers && Array.isArray(data.styleNumbers)) {
      for (const sn of data.styleNumbers) {
        lookup.set(sn, doc.id)
      }
    }
  }

  return lookup
}

function buildPageMappings(
  products: ReadonlyArray<JsonProduct>,
  familyLookup: Map<string, string>,
): ReadonlyArray<PageMapping> {
  // Build quarter+page → {familyIds, productNames}
  const pageMap = new Map<string, { familyIds: Set<string>; productNames: Set<string> }>()

  for (const product of products) {
    // Find the familyId for this product
    const styleNumbers = product.styleGroups.map((sg) => sg.styleNumber)
    let familyId: string | undefined
    for (const sn of styleNumbers) {
      familyId = familyLookup.get(sn)
      if (familyId) break
    }
    if (!familyId) continue

    for (const [quarter, pages] of Object.entries(product._sourcePages)) {
      for (const pageNum of pages) {
        const key = `${quarter}:${pageNum}`
        const entry = pageMap.get(key) ?? { familyIds: new Set(), productNames: new Set() }
        entry.familyIds.add(familyId)
        entry.productNames.add(product.productName)
        pageMap.set(key, entry)
      }
    }
  }

  const mappings: PageMapping[] = []
  for (const [key, entry] of pageMap.entries()) {
    const [quarter, pageStr] = key.split(":")
    const pdfPath = PDF_FILES[quarter]
    if (!pdfPath) continue

    mappings.push({
      quarter,
      pdfPath,
      pageNumber: parseInt(pageStr, 10),
      familyIds: [...entry.familyIds],
      productNames: [...entry.productNames],
    })
  }

  return mappings.sort((a, b) =>
    a.quarter.localeCompare(b.quarter) || a.pageNumber - b.pageNumber,
  )
}

// ---------------------------------------------------------------------------
// Upload + Firestore
// ---------------------------------------------------------------------------

function buildDownloadUrl(bucketName: string, storagePath: string, token: string): string {
  const encodedPath = encodeURIComponent(storagePath)
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodedPath}?alt=media&token=${token}`
}

async function uploadAndLink(
  db: FirebaseFirestore.Firestore,
  bucket: ReturnType<ReturnType<typeof getStorage>["bucket"]>,
  clientId: string,
  pngPath: string,
  mapping: PageMapping,
  dryRun: boolean,
): Promise<{ uploaded: number; linked: number }> {
  const prefix = dryRun ? "[DRY RUN]" : "[WRITE]"
  const fileName = `line-sheet-${mapping.quarter.toLowerCase()}-page-${String(mapping.pageNumber).padStart(2, "0")}.png`

  console.info(
    "%s Page %s/%d → %d families (%s)",
    prefix,
    mapping.quarter,
    mapping.pageNumber,
    mapping.familyIds.length,
    mapping.productNames.slice(0, 3).join(", ") +
      (mapping.productNames.length > 3 ? ` +${mapping.productNames.length - 3} more` : ""),
  )

  if (dryRun) {
    return { uploaded: 0, linked: mapping.familyIds.length }
  }

  // Optimize PNG with sharp
  const optimized = await sharp(pngPath)
    .png({ quality: 85, compressionLevel: 8 })
    .toBuffer()

  // Upload to Storage
  const storagePath = `images/lineSheets/${clientId}/${fileName}`
  const token = randomUUID()
  const file = bucket.file(storagePath)

  await file.save(optimized, {
    metadata: {
      contentType: "image/png",
      metadata: { firebaseStorageDownloadTokens: token },
    },
  })

  const downloadUrl = buildDownloadUrl(bucket.name, storagePath, token)

  // Create ProductDocument in each linked family
  let linked = 0
  for (const familyId of mapping.familyIds) {
    const docRef = db
      .collection("clients")
      .doc(clientId)
      .collection("productFamilies")
      .doc(familyId)
      .collection("documents")

    await docRef.add({
      name: `Line Sheet ${mapping.quarter} – Page ${mapping.pageNumber}`,
      storagePath,
      downloadUrl,
      contentType: "image/png",
      sizeBytes: optimized.length,
      createdAt: FieldValue.serverTimestamp(),
      createdBy: "import-line-sheet-screenshots",
      deleted: false,
    })

    linked += 1
  }

  // Throttle
  await new Promise((r) => setTimeout(r, 200))

  return { uploaded: 1, linked }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

;(async () => {
  try {
    const args = parseArgs()
    const dryRun = !args.write

    console.info("[screenshots] Line Sheet Screenshot Extraction")
    console.info("[screenshots] Mode: %s", dryRun ? "DRY RUN" : "WRITE")
    console.info("[screenshots] Client: %s", args.clientId)
    console.info("")

    // Parse JSON for page mappings
    const raw = readFileSync(args.jsonPath, "utf-8")
    const data: JsonRoot = JSON.parse(raw)

    // Initialize Firebase
    ensureApp()
    const db = getFirestore()
    const bucket = getStorage().bucket()

    // Build family lookup
    console.info("[screenshots] Building family lookup from Firestore...")
    const familyLookup = await buildFamilyLookup(db, args.clientId!)
    console.info("[screenshots] Found %d style numbers mapped to families", familyLookup.size)

    // Build page→family mappings
    const mappings = buildPageMappings(data.products, familyLookup)
    console.info("[screenshots] Found %d unique page→family mappings", mappings.length)
    console.info("")

    // Render PDFs to PNGs
    const screenshotDir = resolve(process.cwd(), SCREENSHOT_DIR)
    mkdirSync(screenshotDir, { recursive: true })

    const renderedPages = new Map<string, ReadonlyArray<string>>()
    for (const [quarter, pdfPath] of Object.entries(PDF_FILES)) {
      // Only render quarters that have mappings
      const hasMapping = mappings.some((m) => m.quarter === quarter)
      if (!hasMapping) {
        console.info("[screenshots] Skipping %s (no page mappings)", quarter)
        continue
      }
      const pages = renderPdfPages(pdfPath, screenshotDir, quarter)
      renderedPages.set(quarter, pages)
    }
    console.info("")

    // Upload and link
    let totalUploaded = 0
    let totalLinked = 0
    let errors = 0

    for (const mapping of mappings) {
      const quarterPages = renderedPages.get(mapping.quarter) ?? []
      const pngPath = quarterPages.find(
        (p) => extractPageNumber(p) === mapping.pageNumber,
      )

      if (!pngPath) {
        console.warn(
          "[screenshots] WARN: No rendered PNG for %s page %d",
          mapping.quarter,
          mapping.pageNumber,
        )
        errors += 1
        continue
      }

      try {
        const result = await uploadAndLink(
          db,
          bucket,
          args.clientId!,
          pngPath,
          mapping,
          dryRun,
        )
        totalUploaded += result.uploaded
        totalLinked += result.linked
      } catch (err) {
        errors += 1
        console.error(
          "  ERROR uploading %s page %d: %s",
          mapping.quarter,
          mapping.pageNumber,
          err,
        )
      }
    }

    // Summary
    console.info("")
    console.info("[screenshots] ─── Summary ───")
    console.info("  Pages rendered:    %d", [...renderedPages.values()].reduce((s, p) => s + p.length, 0))
    console.info("  Pages with links:  %d", mappings.length)
    console.info("  Pages uploaded:    %d", totalUploaded)
    console.info("  Documents linked:  %d", totalLinked)
    console.info("  Errors:            %d", errors)

    if (dryRun && mappings.length > 0) {
      console.info("")
      console.info("[screenshots] To upload, run with --write:")
      console.info(
        "  npx tsx scripts/extract-line-sheet-screenshots.ts --clientId=%s --write",
        args.clientId,
      )
    }
  } catch (error) {
    console.error("[screenshots] Fatal error:", error)
    process.exitCode = 1
  }
})()
