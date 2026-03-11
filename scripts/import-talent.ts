/**
 * One-time talent import from Excel spreadsheet (Model Info.xlsx)
 *
 * Parses "Model Info Women" and "Model Info Men" tabs, extracts names,
 * measurements, and embedded headshot images. Deduplicates against existing
 * Firestore talent records. Uploads headshot images to Firebase Storage.
 *
 * USAGE:
 *   # Dry run (default — no writes):
 *   npx tsx scripts/import-talent.ts --clientId=unbound-merino
 *
 *   # Write mode (mutates Firestore + Storage):
 *   npx tsx scripts/import-talent.ts --clientId=unbound-merino --write
 *
 *   # Custom Excel path:
 *   npx tsx scripts/import-talent.ts --clientId=unbound-merino --excel=/path/to/file.xlsx
 *
 * ARGUMENTS:
 *   --clientId=<id>  (REQUIRED) Client/tenant ID to target
 *   --write          Actually perform writes (default: dry-run)
 *   --excel=<path>   Path to Excel file (default: ./data/Model Info.xlsx)
 */

import { resolve } from "node:path"
import { existsSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { getApp, getApps, initializeApp, applicationDefault } from "firebase-admin/app"
import { FieldValue, getFirestore } from "firebase-admin/firestore"
import { getStorage } from "firebase-admin/storage"
import ExcelJS from "exceljs"
import sharp from "sharp"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CliArgs {
  readonly clientId: string | null
  readonly write: boolean
  readonly excelPath: string
}

interface ParsedRow {
  readonly name: string
  readonly firstName: string
  readonly lastName: string | null
  readonly gender: "women" | "men"
  readonly measurements: Record<string, number | string>
  readonly rowNumber: number
}

interface ImportAction {
  readonly type: "CREATE" | "UPDATE" | "SKIP"
  readonly row: ParsedRow
  readonly existingId?: string
  readonly updates?: readonly string[]
  readonly imageBuffer?: Buffer
}

interface ImportStats {
  scanned: number
  created: number
  updated: number
  skipped: number
  errors: number
  imageUploads: number
  imageFailures: number
}

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  let clientId: string | null = null
  let write = false
  let excelPath = resolve(process.cwd(), "data", "Model Info.xlsx")

  for (const arg of args) {
    if (arg.startsWith("--clientId=")) {
      clientId = arg.slice("--clientId=".length).trim()
    } else if (arg === "--write") {
      write = true
    } else if (arg.startsWith("--excel=")) {
      excelPath = resolve(arg.slice("--excel=".length).trim())
    }
  }

  return { clientId, write, excelPath }
}

function printUsageAndExit(): never {
  console.error("")
  console.error("ERROR: --clientId is required")
  console.error("")
  console.error("Usage:")
  console.error("  npx tsx scripts/import-talent.ts --clientId=<id> [--write] [--excel=<path>]")
  console.error("")
  console.error("Arguments:")
  console.error("  --clientId=<id>  (REQUIRED) Client/tenant ID to target")
  console.error("  --write          Actually perform writes (default: dry-run)")
  console.error("  --excel=<path>   Path to Excel file (default: ./data/Model Info.xlsx)")
  console.error("")
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Firebase Admin Init
// ---------------------------------------------------------------------------

const FIREBASE_PROJECT_ID = process.env.GCLOUD_PROJECT ?? "um-shotbuilder"
const STORAGE_BUCKET = process.env.STORAGE_BUCKET ?? "um-shotbuilder.firebasestorage.app"

function ensureApp() {
  if (getApps().length) return getApp()
  return initializeApp({
    credential: applicationDefault(),
    projectId: FIREBASE_PROJECT_ID,
    storageBucket: STORAGE_BUCKET,
  })
}

// ---------------------------------------------------------------------------
// Name Handling
// ---------------------------------------------------------------------------

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ")
}

function splitName(fullName: string): { firstName: string; lastName: string | null } {
  const trimmed = fullName.trim()
  const spaceIdx = trimmed.indexOf(" ")
  if (spaceIdx === -1) {
    return { firstName: trimmed, lastName: null }
  }
  return {
    firstName: trimmed.slice(0, spaceIdx),
    lastName: trimmed.slice(spaceIdx + 1),
  }
}

// ---------------------------------------------------------------------------
// Measurement Parsing
// ---------------------------------------------------------------------------

const FEET_INCHES_RE = /^(\d{1,2})'\s*(\d{1,2})"?$/
const PLAIN_NUMBER_RE = /^(\d+(?:\.\d+)?)$/

function parseHeight(value: string | null | undefined): number | null {
  if (!value) return null
  const trimmed = value.toString().trim()
  if (!trimmed) return null

  // Normalize curly quotes and typographic apostrophes
  const normalized = trimmed
    .replace(/[\u2018\u2019\u201A\u0060\u00B4]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')

  const match = FEET_INCHES_RE.exec(normalized)
  if (match) {
    const feet = Number(match[1])
    const inches = Number(match[2])
    if (feet >= 2 && feet <= 9 && inches < 12) {
      return feet * 12 + inches
    }
  }
  return null
}

function parseBodyMeasurement(value: string | null | undefined): number | null {
  if (!value) return null
  const trimmed = value.toString().trim()
  if (!trimmed) return null

  // Strip cup size suffix: "34" B" or "34B" → "34"
  // Strip inch marks
  const cleaned = trimmed
    .replace(/[""\u201C\u201D]/g, "")
    .replace(/\s*[A-Z]{1,3}$/i, "")
    .trim()

  const match = PLAIN_NUMBER_RE.exec(cleaned)
  if (match) {
    return Number(match[1])
  }
  return null
}

function parseSizeString(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.toString().trim().toUpperCase()
  if (!trimmed) return null
  return trimmed
}

// ---------------------------------------------------------------------------
// Excel Parsing
// ---------------------------------------------------------------------------

function getCellValue(row: ExcelJS.Row, col: number): string | null {
  const cell = row.getCell(col)
  if (!cell || cell.value === null || cell.value === undefined) return null
  const val = cell.value
  if (typeof val === "object" && val !== null && "text" in val) {
    return String((val as { text: string }).text).trim() || null
  }
  return String(val).trim() || null
}

function parseSheet(
  worksheet: ExcelJS.Worksheet,
  gender: "women" | "men",
): readonly ParsedRow[] {
  const rows: ParsedRow[] = []

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    // Skip header row
    if (rowNumber === 1) return

    const name = getCellValue(row, 1) // Column A: Full Name
    if (!name) return

    // Skip obvious header-like rows
    if (name.toLowerCase() === "full name" || name.toLowerCase() === "name") return

    const heightRaw = getCellValue(row, 2) // Column B: Height
    const bustChestRaw = getCellValue(row, 3) // Column C: Chest/Bust
    const waistRaw = getCellValue(row, 4) // Column D: Waist
    const hipsRaw = getCellValue(row, 5) // Column E: Hips
    const sizeRaw = getCellValue(row, 6) // Column F: Size

    const measurements: Record<string, number | string> = {}

    const height = parseHeight(heightRaw)
    if (height !== null) measurements.height = height

    if (gender === "women") {
      const bust = parseBodyMeasurement(bustChestRaw)
      if (bust !== null) measurements.bust = bust
      const waist = parseBodyMeasurement(waistRaw)
      if (waist !== null) measurements.waist = waist
      const hips = parseBodyMeasurement(hipsRaw)
      if (hips !== null) measurements.hips = hips
      const dress = parseSizeString(sizeRaw)
      if (dress !== null) measurements.dress = dress
    } else {
      const chest = parseBodyMeasurement(bustChestRaw)
      if (chest !== null) measurements.chest = chest
      const waist = parseBodyMeasurement(waistRaw)
      if (waist !== null) measurements.waist = waist
      // Men: skip hips (column E)
      const suit = parseSizeString(sizeRaw)
      if (suit !== null) measurements.suit = suit
    }

    const { firstName, lastName } = splitName(name)

    rows.push({
      name: name.trim(),
      firstName,
      lastName,
      gender,
      measurements,
      rowNumber,
    })
  })

  return rows
}

// ---------------------------------------------------------------------------
// Image Extraction
// ---------------------------------------------------------------------------

function extractImagesByRow(
  worksheet: ExcelJS.Worksheet,
  workbook: ExcelJS.Workbook,
): ReadonlyMap<number, Buffer> {
  const imageMap = new Map<number, { buffer: Buffer; size: number }>()

  const images = worksheet.getImages()
  for (const img of images) {
    const imageId = img.imageId
    const media = workbook.model.media as ReadonlyArray<{
      readonly index: number
      readonly type: string
      readonly buffer: Buffer
      readonly extension: string
    }> | undefined

    if (!media) continue

    const mediaEntry = media.find((m) => m.index === Number(imageId))
    if (!mediaEntry?.buffer) continue

    // img.range gives the cell anchor
    const row = img.range.tl.nativeRow + 1 // 0-based to 1-based

    const existing = imageMap.get(row)
    const bufferSize = mediaEntry.buffer.length

    // Keep the largest image per row (best quality)
    if (!existing || bufferSize > existing.size) {
      imageMap.set(row, { buffer: Buffer.from(mediaEntry.buffer), size: bufferSize })
    }
  }

  const result = new Map<number, Buffer>()
  for (const [row, entry] of imageMap) {
    result.set(row, entry.buffer)
  }
  return result
}

// ---------------------------------------------------------------------------
// Image Processing & Upload
// ---------------------------------------------------------------------------

async function processImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer)
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer()
}

function buildDownloadUrl(bucket: string, storagePath: string, token: string): string {
  const encodedPath = encodeURIComponent(storagePath)
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodedPath}?alt=media&token=${token}`
}

async function uploadHeadshot(
  bucket: ReturnType<ReturnType<typeof getStorage>["bucket"]>,
  talentId: string,
  imageBuffer: Buffer,
): Promise<{ storagePath: string; downloadUrl: string }> {
  const webpBuffer = await processImage(imageBuffer)
  const storagePath = `images/talent/${talentId}/headshot.webp`
  const token = randomUUID()

  const file = bucket.file(storagePath)
  await file.save(webpBuffer, {
    contentType: "image/webp",
    metadata: {
      metadata: { firebaseStorageDownloadTokens: token },
    },
  })

  const downloadUrl = buildDownloadUrl(bucket.name, storagePath, token)
  return { storagePath, downloadUrl }
}

// ---------------------------------------------------------------------------
// Dedup & Merge Logic
// ---------------------------------------------------------------------------

interface ExistingTalent {
  readonly id: string
  readonly data: Record<string, unknown>
}

async function loadExistingTalent(
  db: FirebaseFirestore.Firestore,
  clientId: string,
): Promise<ReadonlyMap<string, ExistingTalent>> {
  const snapshot = await db.collection(`clients/${clientId}/talent`).get()
  const map = new Map<string, ExistingTalent>()

  for (const doc of snapshot.docs) {
    const data = doc.data()
    const name = typeof data.name === "string" ? data.name : ""
    const normalized = normalizeName(name)
    if (normalized) {
      map.set(normalized, { id: doc.id, data })
    }
  }

  return map
}

function buildImportActions(
  rows: readonly ParsedRow[],
  imagesByRow: ReadonlyMap<number, Buffer>,
  existingTalent: ReadonlyMap<string, ExistingTalent>,
): readonly ImportAction[] {
  return rows.map((row) => {
    const normalized = normalizeName(row.name)
    const imageBuffer = imagesByRow.get(row.rowNumber)
    const existing = existingTalent.get(normalized)

    if (!existing) {
      return { type: "CREATE", row, imageBuffer }
    }

    const updates: string[] = []

    // Check if headshot is missing
    const hasHeadshot = Boolean(
      existing.data.headshotPath || existing.data.headshotUrl || existing.data.imageUrl,
    )
    if (!hasHeadshot && imageBuffer) {
      updates.push("headshot")
    }

    // Check for missing measurements
    const existingMeasurements =
      (existing.data.measurements as Record<string, unknown> | null) ?? {}
    for (const [key, value] of Object.entries(row.measurements)) {
      const existingValue = existingMeasurements[key]
      if (existingValue === null || existingValue === undefined || existingValue === "") {
        updates.push(`measurement:${key}`)
      }
    }

    // Check for missing gender
    if (!existing.data.gender && row.gender) {
      updates.push("gender")
    }

    // Check for missing firstName/lastName
    if (!existing.data.firstName && row.firstName) {
      updates.push("firstName")
    }
    if (!existing.data.lastName && row.lastName) {
      updates.push("lastName")
    }

    if (updates.length === 0) {
      return { type: "SKIP", row, existingId: existing.id }
    }

    return {
      type: "UPDATE",
      row,
      existingId: existing.id,
      updates,
      imageBuffer: updates.includes("headshot") ? imageBuffer : undefined,
    }
  })
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

async function executeActions(
  actions: readonly ImportAction[],
  db: FirebaseFirestore.Firestore,
  bucket: ReturnType<ReturnType<typeof getStorage>["bucket"]>,
  clientId: string,
  dryRun: boolean,
): Promise<ImportStats> {
  const stats: ImportStats = {
    scanned: actions.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    imageUploads: 0,
    imageFailures: 0,
  }

  const collectionPath = `clients/${clientId}/talent`

  for (const action of actions) {
    const prefix = dryRun ? "[DRY RUN]" : "[WRITE]"

    try {
      if (action.type === "SKIP") {
        stats.skipped += 1
        console.info(
          "%s SKIP  %-30s (id: %s, already complete)",
          prefix,
          action.row.name,
          action.existingId,
        )
        continue
      }

      if (action.type === "CREATE") {
        stats.created += 1
        const mKeys = Object.keys(action.row.measurements).join(", ")
        const hasImg = action.imageBuffer ? "yes" : "no"
        console.info(
          "%s CREATE %-30s gender=%s measurements=[%s] image=%s",
          prefix,
          action.row.name,
          action.row.gender,
          mKeys,
          hasImg,
        )

        if (!dryRun) {
          const docRef = db.collection(collectionPath).doc()
          const docData: Record<string, unknown> = {
            clientId,
            name: action.row.name,
            firstName: action.row.firstName,
            lastName: action.row.lastName,
            gender: action.row.gender,
            measurements: action.row.measurements,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            createdBy: "system:import",
            updatedBy: "system:import",
          }

          if (action.imageBuffer) {
            try {
              const uploaded = await uploadHeadshot(bucket, docRef.id, action.imageBuffer)
              docData.headshotPath = uploaded.storagePath
              docData.headshotUrl = uploaded.downloadUrl
              docData.imageUrl = uploaded.storagePath
              stats.imageUploads += 1
            } catch (err) {
              console.error("  Image upload failed for %s: %s", action.row.name, err)
              stats.imageFailures += 1
            }
          }

          await docRef.set(docData)
          await new Promise((r) => setTimeout(r, 100))
        }
        continue
      }

      if (action.type === "UPDATE") {
        stats.updated += 1
        console.info(
          "%s UPDATE %-30s (id: %s) fields=[%s]",
          prefix,
          action.row.name,
          action.existingId,
          action.updates?.join(", "),
        )

        if (!dryRun && action.existingId) {
          const docRef = db.collection(collectionPath).doc(action.existingId)
          const patch: Record<string, unknown> = {
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: "system:import",
          }

          // Merge missing measurements
          if (action.updates?.some((u) => u.startsWith("measurement:"))) {
            const existingDoc = await docRef.get()
            const existingMeasurements =
              (existingDoc.data()?.measurements as Record<string, unknown>) ?? {}
            const merged = { ...existingMeasurements }
            for (const [key, value] of Object.entries(action.row.measurements)) {
              const existing = merged[key]
              if (existing === null || existing === undefined || existing === "") {
                merged[key] = value
              }
            }
            patch.measurements = merged
          }

          // Set missing gender
          if (action.updates?.includes("gender")) {
            patch.gender = action.row.gender
          }

          // Set missing firstName/lastName
          if (action.updates?.includes("firstName")) {
            patch.firstName = action.row.firstName
          }
          if (action.updates?.includes("lastName")) {
            patch.lastName = action.row.lastName
          }

          // Upload headshot if missing
          if (action.updates?.includes("headshot") && action.imageBuffer) {
            try {
              const uploaded = await uploadHeadshot(
                bucket,
                action.existingId,
                action.imageBuffer,
              )
              patch.headshotPath = uploaded.storagePath
              patch.headshotUrl = uploaded.downloadUrl
              patch.imageUrl = uploaded.storagePath
              stats.imageUploads += 1
            } catch (err) {
              console.error("  Image upload failed for %s: %s", action.row.name, err)
              stats.imageFailures += 1
            }
          }

          await docRef.update(patch)
          await new Promise((r) => setTimeout(r, 100))
        }
        continue
      }
    } catch (err) {
      stats.errors += 1
      console.error("  ERROR processing %s: %s", action.row.name, err)
    }
  }

  return stats
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function printHeader(args: CliArgs, dryRun: boolean): void {
  console.info("")
  console.info("=".repeat(60))
  console.info("TALENT IMPORT: Model Info Excel → Firestore")
  console.info("=".repeat(60))
  console.info("Client ID:               %s", args.clientId)
  console.info("Excel file:              %s", args.excelPath)
  console.info("Mode:                    %s", dryRun ? "DRY RUN (no writes)" : "WRITE MODE")
  console.info("=".repeat(60))
  console.info("")
}

function printSummary(stats: ImportStats, dryRun: boolean, clientId: string): void {
  console.info("")
  console.info("=".repeat(60))
  console.info("IMPORT SUMMARY")
  console.info("=".repeat(60))
  console.info("Client ID:               %s", clientId)
  console.info("Mode:                    %s", dryRun ? "DRY RUN" : "WRITE")
  console.info("Scanned:                 %d", stats.scanned)
  console.info("Created:                 %d", stats.created)
  console.info("Updated:                 %d", stats.updated)
  console.info("Skipped:                 %d", stats.skipped)
  console.info("Images uploaded:         %d", stats.imageUploads)
  console.info("Image failures:          %d", stats.imageFailures)
  console.info("Errors:                  %d", stats.errors)
  console.info("=".repeat(60))

  if (dryRun && (stats.created > 0 || stats.updated > 0)) {
    console.info("")
    console.info("To apply these changes, run with --write flag:")
    console.info("  npx tsx scripts/import-talent.ts --clientId=%s --write", clientId)
  }
}

;(async () => {
  try {
    const args = parseArgs()
    if (!args.clientId) printUsageAndExit()

    const clientId = args.clientId!
    const dryRun = !args.write

    if (!/^[a-z0-9][-a-z0-9]*$/.test(clientId)) {
      console.error("ERROR: clientId must be lowercase alphanumeric with hyphens only")
      process.exit(1)
    }

    if (!existsSync(args.excelPath)) {
      console.error("ERROR: Excel file not found: %s", args.excelPath)
      process.exit(1)
    }

    printHeader(args, dryRun)

    // Load Excel
    console.info("[import] Loading Excel file: %s", args.excelPath)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(args.excelPath)

    // Parse sheets
    const womenSheet = workbook.getWorksheet("Model Info Women")
    const menSheet = workbook.getWorksheet("Model Info Men")

    if (!womenSheet && !menSheet) {
      console.error("[import] No matching worksheets found. Available sheets:")
      workbook.eachSheet((ws) => console.error("  - %s", ws.name))
      process.exit(1)
    }

    const allRows: ParsedRow[] = []
    const allImages = new Map<number, Buffer>()

    if (womenSheet) {
      const womenRows = parseSheet(womenSheet, "women")
      console.info("[import] Parsed %d women from '%s'", womenRows.length, womenSheet.name)
      allRows.push(...womenRows)

      const womenImages = extractImagesByRow(womenSheet, workbook)
      console.info("[import] Extracted %d images from women sheet", womenImages.size)
      for (const [row, buffer] of womenImages) {
        allImages.set(row, buffer)
      }
    }

    // Men sheet images need row offset to avoid collision with women sheet rows
    // Use a large offset since men sheet rows are independent
    const MEN_ROW_OFFSET = 10000
    if (menSheet) {
      const menRows = parseSheet(menSheet, "men")
      // Remap row numbers to avoid collision
      const remappedRows = menRows.map((r) => ({
        ...r,
        rowNumber: r.rowNumber + MEN_ROW_OFFSET,
      }))
      console.info("[import] Parsed %d men from '%s'", menRows.length, menSheet.name)
      allRows.push(...remappedRows)

      const menImages = extractImagesByRow(menSheet, workbook)
      console.info("[import] Extracted %d images from men sheet", menImages.size)
      for (const [row, buffer] of menImages) {
        allImages.set(row + MEN_ROW_OFFSET, buffer)
      }
    }

    console.info("[import] Total rows: %d, Total images: %d", allRows.length, allImages.size)
    console.info("")

    // Init Firebase
    const app = ensureApp()
    const db = getFirestore(app)
    db.settings({ ignoreUndefinedProperties: true })

    // Load existing talent for dedup
    console.info("[import] Loading existing talent from clients/%s/talent...", clientId)
    const existingTalent = await loadExistingTalent(db, clientId)
    console.info("[import] Found %d existing talent records", existingTalent.size)
    console.info("")

    // Build actions
    const actions = buildImportActions(allRows, allImages, existingTalent)

    // Warn about cross-sheet name collisions targeting the same existing doc
    const seenIds = new Map<string, string>()
    for (const action of actions) {
      if (action.existingId) {
        const prev = seenIds.get(action.existingId)
        if (prev) {
          console.warn(
            "[import] WARNING: Both '%s' and '%s' match existing doc %s — second will overwrite first's updates",
            prev,
            action.row.name,
            action.existingId,
          )
        } else {
          seenIds.set(action.existingId, action.row.name)
        }
      }
    }

    // Get Storage bucket (only needed for write mode with images)
    const storageBucket = getStorage(app).bucket()

    // Execute
    const stats = await executeActions(actions, db, storageBucket, clientId, dryRun)
    printSummary(stats, dryRun, clientId)

    if (stats.errors > 0) {
      process.exitCode = 1
    }
  } catch (error) {
    console.error("[import] Fatal error:", error)
    process.exitCode = 1
  }
})()
