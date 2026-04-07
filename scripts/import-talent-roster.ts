/**
 * Talent roster import from Excel spreadsheet (UM_SS2026_Model_Roster.xlsx)
 *
 * Parses "Men" and "Women" sheets, extracts names, measurements, agency info,
 * and headshot references. Deduplicates against existing Firestore talent records.
 * Uploads headshot images from a local directory to Firebase Storage.
 *
 * USAGE:
 *   # Dry run (default — no writes):
 *   npx tsx scripts/import-talent-roster.ts --clientId=unbound-merino
 *
 *   # Write mode (mutates Firestore + Storage):
 *   npx tsx scripts/import-talent-roster.ts --clientId=unbound-merino --write
 *
 *   # Custom paths:
 *   npx tsx scripts/import-talent-roster.ts --clientId=unbound-merino --write \
 *     --excel=/path/to/roster.xlsx --headshots=/path/to/headshots/ --report=/path/to/report.json
 *
 * ARGUMENTS:
 *   --clientId=<id>      (REQUIRED) Client/tenant ID to target
 *   --write              Actually perform writes (default: dry-run)
 *   --excel=<path>       Path to Excel file
 *   --headshots=<path>   Path to headshots directory
 *   --report=<path>      Path to write JSON report (default: stdout summary only)
 */

import { resolve, join } from "node:path"
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { randomUUID } from "node:crypto"
import { getApp, getApps, initializeApp, applicationDefault } from "firebase-admin/app"
import { FieldValue, getFirestore } from "firebase-admin/firestore"
import { getStorage } from "firebase-admin/storage"
import ExcelJS from "exceljs"
import sharp from "sharp"

// ---------------------------------------------------------------------------
// ANSI Color Helpers
// ---------------------------------------------------------------------------

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
  bgBlue: "\x1b[44m",
} as const

function c(color: keyof typeof ANSI, text: string): string {
  return `${ANSI[color]}${text}${ANSI.reset}`
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CliArgs {
  readonly clientId: string | null
  readonly write: boolean
  readonly excelPath: string
  readonly headshotsDir: string
  readonly reportPath: string | null
}

interface ParsedRow {
  readonly name: string
  readonly firstName: string
  readonly lastName: string | null
  readonly gender: "male" | "female"
  readonly genderRaw: string
  readonly agency: string | null
  readonly agentName: string | null
  readonly measurements: Readonly<Record<string, string>>
  readonly headshotFile: string | null
  readonly sheetName: string
  readonly rowNumber: number
}

interface ImportAction {
  readonly type: "CREATE" | "UPDATE" | "SKIP"
  readonly row: ParsedRow
  readonly matchedExistingId: string | null
  readonly fieldsAdded: readonly string[]
  readonly headshotAction: string
  readonly headshotFile: string | null
}

interface ImportReport {
  readonly timestamp: string
  readonly mode: "dry-run" | "write"
  readonly stats: {
    total: number
    created: number
    updated: number
    skipped: number
    headshotsUploaded: number
    headshotsMissing: number
    fuzzyWarnings: number
  }
  readonly actions: ReadonlyArray<{
    type: "CREATE" | "UPDATE" | "SKIP"
    name: string
    gender: string
    agency: string
    matchedExistingId: string | null
    fieldsAdded: string[]
    headshotAction: string
    headshotFile: string | null
  }>
  readonly fuzzyMatches: ReadonlyArray<{
    spreadsheetName: string
    existingName: string
    existingId: string
    distance: number
  }>
  readonly warnings: string[]
}

interface ExistingTalent {
  readonly id: string
  readonly data: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// CLI Argument Parsing
// ---------------------------------------------------------------------------

const DEFAULT_EXCEL =
  "/Users/tedghanime/Desktop/Project Scoping/UM - SS 2026/UM_SS2026_Model_Roster.xlsx"
const DEFAULT_HEADSHOTS =
  "/Users/tedghanime/Desktop/Project Scoping/UM - SS 2026/headshots"

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  let clientId: string | null = null
  let write = false
  let excelPath = DEFAULT_EXCEL
  let headshotsDir = DEFAULT_HEADSHOTS
  let reportPath: string | null = null

  for (const arg of args) {
    if (arg.startsWith("--clientId=")) {
      clientId = arg.slice("--clientId=".length).trim()
    } else if (arg === "--write") {
      write = true
    } else if (arg.startsWith("--excel=")) {
      excelPath = resolve(arg.slice("--excel=".length).trim())
    } else if (arg.startsWith("--headshots=")) {
      headshotsDir = resolve(arg.slice("--headshots=".length).trim())
    } else if (arg.startsWith("--report=")) {
      reportPath = resolve(arg.slice("--report=".length).trim())
    }
  }

  return { clientId, write, excelPath, headshotsDir, reportPath }
}

function printUsageAndExit(): never {
  console.error("")
  console.error(c("red", "ERROR: --clientId is required"))
  console.error("")
  console.error("Usage:")
  console.error(
    "  npx tsx scripts/import-talent-roster.ts --clientId=<id> [--write] [--report=path]",
  )
  console.error("")
  console.error("Arguments:")
  console.error("  --clientId=<id>      (REQUIRED) Client/tenant ID to target")
  console.error("  --write              Actually perform writes (default: dry-run)")
  console.error("  --excel=<path>       Path to Excel file")
  console.error("  --headshots=<path>   Path to headshots directory")
  console.error("  --report=<path>      Path to write JSON report")
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
// Levenshtein Distance
// ---------------------------------------------------------------------------

function levenshtein(a: string, b: string): number {
  const aLen = a.length
  const bLen = b.length

  if (aLen === 0) return bLen
  if (bLen === 0) return aLen

  // Use two-row approach for memory efficiency
  let prevRow = new Array<number>(bLen + 1)
  let currRow = new Array<number>(bLen + 1)

  for (let j = 0; j <= bLen; j++) {
    prevRow[j] = j
  }

  for (let i = 1; i <= aLen; i++) {
    currRow[0] = i
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      currRow[j] = Math.min(
        prevRow[j] + 1,       // deletion
        currRow[j - 1] + 1,   // insertion
        prevRow[j - 1] + cost, // substitution
      )
    }
    // Swap rows
    const temp = prevRow
    prevRow = currRow
    currRow = temp
  }

  return prevRow[bLen]
}

// ---------------------------------------------------------------------------
// Measurement Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize height to compact X'Y" format.
 * Input examples: `6' 1"`, `5'7"`, `5' 8.5"`, `6'0"`
 * Output: `6'1"`, `5'7"`, `5'8.5"`, `6'0"`
 */
function normalizeHeight(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null

  // Normalize curly quotes and typographic apostrophes
  const normalized = trimmed
    .replace(/[\u2018\u2019\u201A\u0060\u00B4]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')

  // Match X' Y" or X'Y" pattern (with optional decimal inches)
  const match = /^(\d{1,2})'\s*(\d{1,2}(?:\.\d+)?)"?$/.exec(normalized)
  if (match) {
    return `${match[1]}'${match[2]}"`
  }
  return null
}

/**
 * Strip trailing quote mark from measurements like `31"` -> `"31"`.
 */
function stripQuote(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  // Remove trailing quote marks
  const cleaned = trimmed.replace(/[""\u201C\u201D]$/g, "").trim()
  return cleaned || null
}

/**
 * Strip " US" suffix from shoe sizes: `10.5 US` -> `"10.5"`.
 */
function normalizeShoes(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  return trimmed.replace(/\s*US$/i, "").trim() || null
}

/**
 * Strip " US" from dress sizes, preserve ranges: `"0-2 US"` -> `"0-2"`.
 */
function normalizeDress(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  return trimmed.replace(/\s*US$/i, "").trim() || null
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

/**
 * Column layout (both sheets):
 *   1: Model Name
 *   2: Headshot File
 *   3: Gender
 *   4: Agency
 *   5: Agent Name
 *   6: Height
 *   7: Waist
 *   8: Inseam
 *   9: Shoes
 *  10: Hips
 *  11: Suit (men) / Dress (women)
 *  12: Chest (men) / Bust/Bra (women)
 */
function parseSheet(
  worksheet: ExcelJS.Worksheet,
  sheetGender: "male" | "female",
  sheetName: string,
): readonly ParsedRow[] {
  const rows: ParsedRow[] = []

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    // Skip header row
    if (rowNumber === 1) return

    const name = getCellValue(row, 1)
    if (!name) return

    // Skip header-like rows
    const lowerName = name.toLowerCase()
    if (lowerName === "model name" || lowerName === "name" || lowerName === "full name") return

    const headshotFile = getCellValue(row, 2)
    const genderRaw = getCellValue(row, 3) ?? (sheetGender === "male" ? "Men" : "Women")
    const agency = getCellValue(row, 4)
    const agentName = getCellValue(row, 5)
    const heightRaw = getCellValue(row, 6)
    const waistRaw = getCellValue(row, 7)
    const inseamRaw = getCellValue(row, 8)
    const shoesRaw = getCellValue(row, 9)
    const hipsRaw = getCellValue(row, 10)
    const col11Raw = getCellValue(row, 11) // Suit or Dress
    const col12Raw = getCellValue(row, 12) // Chest or Bust/Bra

    const measurements: Record<string, string> = {}

    if (heightRaw) {
      const h = normalizeHeight(heightRaw)
      if (h) measurements.height = h
    }
    if (waistRaw) {
      const w = stripQuote(waistRaw)
      if (w) measurements.waist = w
    }
    if (inseamRaw) {
      const i = stripQuote(inseamRaw)
      if (i) measurements.inseam = i
    }
    if (shoesRaw) {
      const s = normalizeShoes(shoesRaw)
      if (s) measurements.shoes = s
    }
    if (hipsRaw) {
      const h = stripQuote(hipsRaw)
      if (h) measurements.hips = h
    }

    if (sheetGender === "male") {
      // Col 11 = Suit, Col 12 = Chest
      if (col11Raw) {
        const suit = col11Raw.trim()
        if (suit) measurements.suit = suit
      }
      if (col12Raw) {
        const chest = stripQuote(col12Raw)
        if (chest) measurements.chest = chest
      }
    } else {
      // Col 11 = Dress, Col 12 = Bust/Bra
      if (col11Raw) {
        const dress = normalizeDress(col11Raw)
        if (dress) measurements.dress = dress
      }
      if (col12Raw) {
        const bust = stripQuote(col12Raw)
        if (bust) measurements.bust = bust
      }
    }

    const { firstName, lastName } = splitName(name)

    rows.push({
      name: name.trim(),
      firstName,
      lastName,
      gender: sheetGender,
      genderRaw,
      agency,
      agentName,
      measurements,
      headshotFile,
      sheetName,
      rowNumber,
    })
  })

  return rows
}

// ---------------------------------------------------------------------------
// Headshot File Matching
// ---------------------------------------------------------------------------

function buildHeadshotIndex(
  headshotsDir: string,
): ReadonlyMap<string, string> {
  if (!existsSync(headshotsDir)) return new Map()

  const files = readdirSync(headshotsDir)
  const index = new Map<string, string>()

  for (const file of files) {
    // Index by lowercase filename for case-insensitive matching
    index.set(file.toLowerCase(), file)
  }

  return index
}

function findHeadshotFile(
  modelName: string,
  headshotFileColumn: string | null,
  headshotIndex: ReadonlyMap<string, string>,
  headshotsDir: string,
): string | null {
  // Strategy 1: Match by name (spaces -> underscores, case-insensitive prefix match)
  const namePattern = modelName.replace(/\s+/g, "_").toLowerCase()
  for (const [lowerFile, originalFile] of headshotIndex) {
    if (lowerFile.startsWith(namePattern) && lowerFile.endsWith(".jpg")) {
      const fullPath = join(headshotsDir, originalFile)
      try {
        const stat = statSync(fullPath)
        if (stat.size > 100) return fullPath
      } catch {
        // File not accessible
      }
    }
  }

  // Strategy 2: Use the "Headshot File" column value
  if (headshotFileColumn) {
    const lowerCol = headshotFileColumn.toLowerCase()
    const matched = headshotIndex.get(lowerCol)
    if (matched) {
      const fullPath = join(headshotsDir, matched)
      try {
        const stat = statSync(fullPath)
        if (stat.size > 100) return fullPath
      } catch {
        // File not accessible
      }
    }
  }

  return null
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
  imagePath: string,
): Promise<{ storagePath: string; downloadUrl: string }> {
  const rawBuffer = readFileSync(imagePath)
  const webpBuffer = await processImage(rawBuffer)
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
// Firestore: Load Existing Talent
// ---------------------------------------------------------------------------

/**
 * Force-match overrides for known near-misses confirmed by the user.
 * Maps normalized spreadsheet name → normalized DB name (with different spelling).
 */
const FORCE_MATCH_ALIASES: Readonly<Record<string, string>> = {
  "jason squires-benjamin": "jason squires- benjamin",
  "juliann hergott": "juliann hergot",
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

// ---------------------------------------------------------------------------
// Fuzzy Match Detection
// ---------------------------------------------------------------------------

interface FuzzyMatch {
  readonly spreadsheetName: string
  readonly existingName: string
  readonly existingId: string
  readonly distance: number
}

function findFuzzyMatches(
  rows: readonly ParsedRow[],
  existingTalent: ReadonlyMap<string, ExistingTalent>,
): readonly FuzzyMatch[] {
  const matches: FuzzyMatch[] = []
  const existingEntries = Array.from(existingTalent.entries())

  for (const row of rows) {
    const normalizedRow = normalizeName(row.name)

    // Skip exact matches — those are handled by the main dedup
    if (existingTalent.has(normalizedRow)) continue

    for (const [existingNorm, existing] of existingEntries) {
      // Only compute Levenshtein for names of similar length (optimization)
      const lenDiff = Math.abs(normalizedRow.length - existingNorm.length)
      if (lenDiff > 3) continue

      const dist = levenshtein(normalizedRow, existingNorm)
      if (dist > 0 && dist <= 3) {
        matches.push({
          spreadsheetName: row.name,
          existingName: typeof existing.data.name === "string" ? existing.data.name : existingNorm,
          existingId: existing.id,
          distance: dist,
        })
      }
    }
  }

  return matches
}

// ---------------------------------------------------------------------------
// Build Import Actions
// ---------------------------------------------------------------------------

function hasExistingHeadshot(data: Record<string, unknown>): boolean {
  return Boolean(data.headshotPath || data.headshotUrl || data.imageUrl)
}

function buildActions(
  rows: readonly ParsedRow[],
  existingTalent: ReadonlyMap<string, ExistingTalent>,
  headshotIndex: ReadonlyMap<string, string>,
  headshotsDir: string,
  warnings: string[],
): readonly ImportAction[] {
  const seenNames = new Set<string>()

  return rows.map((row): ImportAction => {
    const normalized = normalizeName(row.name)

    // Dedup within the spreadsheet
    if (seenNames.has(normalized)) {
      warnings.push(
        `Duplicate in spreadsheet: "${row.name}" (${row.sheetName} row ${row.rowNumber}) — skipping second occurrence`,
      )
      return {
        type: "SKIP",
        row,
        matchedExistingId: null,
        fieldsAdded: [],
        headshotAction: "skip-duplicate",
        headshotFile: null,
      }
    }
    seenNames.add(normalized)

    // Find headshot file on disk
    const headshotFile = findHeadshotFile(row.name, row.headshotFile, headshotIndex, headshotsDir)

    // Check for exact match first, then force-match aliases
    const aliasKey = FORCE_MATCH_ALIASES[normalized]
    const existing = existingTalent.get(normalized) ?? (aliasKey ? existingTalent.get(aliasKey) : undefined)

    if (!existing) {
      // CREATE
      const fieldsAdded = ["name", "firstName", "gender"]
      if (row.lastName) fieldsAdded.push("lastName")
      if (row.agency) fieldsAdded.push("agency")
      if (row.agentName) fieldsAdded.push("notes")
      for (const key of Object.keys(row.measurements)) {
        fieldsAdded.push(`measurements.${key}`)
      }

      const headshotAction = headshotFile ? "upload" : "missing"

      return {
        type: "CREATE",
        row,
        matchedExistingId: null,
        fieldsAdded,
        headshotAction,
        headshotFile,
      }
    }

    // Existing talent found — check what we can add
    const fieldsAdded: string[] = []
    const data = existing.data

    // Gender: only set if existing is null/empty
    if (!data.gender && row.gender) {
      fieldsAdded.push("gender")
    }

    // Agency: only set if existing is null/empty
    if (!data.agency && row.agency) {
      fieldsAdded.push("agency")
    }

    // Notes (agent name): only prepend if existing notes don't contain "Agent:"
    if (row.agentName) {
      const existingNotes = typeof data.notes === "string" ? data.notes : ""
      if (!existingNotes.includes("Agent:")) {
        fieldsAdded.push("notes")
      }
    }

    // Measurements: only set missing keys
    const existingMeasurements =
      (data.measurements as Record<string, unknown> | null) ?? {}
    for (const key of Object.keys(row.measurements)) {
      const existingValue = existingMeasurements[key]
      if (existingValue === null || existingValue === undefined || existingValue === "") {
        fieldsAdded.push(`measurements.${key}`)
      }
    }

    // Headshot: only upload if no existing headshot
    let headshotAction: string
    if (hasExistingHeadshot(data)) {
      headshotAction = "exists"
    } else if (headshotFile) {
      headshotAction = "upload"
      fieldsAdded.push("headshot")
    } else {
      headshotAction = "missing"
    }

    if (fieldsAdded.length === 0) {
      return {
        type: "SKIP",
        row,
        matchedExistingId: existing.id,
        fieldsAdded: [],
        headshotAction,
        headshotFile: null,
      }
    }

    return {
      type: "UPDATE",
      row,
      matchedExistingId: existing.id,
      fieldsAdded,
      headshotAction,
      headshotFile: headshotAction === "upload" ? headshotFile : null,
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
  warnings: string[],
): Promise<ImportReport["stats"]> {
  const stats: ImportReport["stats"] = {
    total: actions.length,
    created: 0,
    updated: 0,
    skipped: 0,
    headshotsUploaded: 0,
    headshotsMissing: 0,
    fuzzyWarnings: 0, // set later
  }

  const collectionPath = `clients/${clientId}/talent`
  const modeTag = dryRun
    ? c("yellow", "[DRY RUN]")
    : c("green", "[WRITE]")

  for (const action of actions) {
    try {
      if (action.type === "SKIP") {
        stats.skipped += 1
        const idLabel = action.matchedExistingId
          ? c("gray", ` (id: ${action.matchedExistingId})`)
          : ""
        console.info(
          `${modeTag} ${c("gray", "SKIP")}   ${action.row.name}${idLabel}`,
        )
        continue
      }

      if (action.type === "CREATE") {
        stats.created += 1
        const mKeys = Object.keys(action.row.measurements).join(", ")
        const imgLabel = action.headshotFile
          ? c("green", "yes")
          : c("yellow", "missing")
        console.info(
          `${modeTag} ${c("green", "CREATE")} ${c("bold", action.row.name)}  ` +
          `gender=${action.row.gender}  agency=${action.row.agency ?? "—"}  ` +
          `measurements=[${mKeys}]  headshot=${imgLabel}`,
        )

        if (!action.headshotFile) {
          stats.headshotsMissing += 1
        }

        if (!dryRun) {
          const docRef = db.collection(collectionPath).doc()
          const docData: Record<string, unknown> = {
            clientId,
            name: action.row.name,
            firstName: action.row.firstName,
            lastName: action.row.lastName,
            gender: action.row.gender,
            agency: action.row.agency,
            measurements: { ...action.row.measurements },
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            createdBy: "system:import",
            updatedBy: "system:import",
          }

          // Add agent name to notes
          if (action.row.agentName) {
            docData.notes = `Agent: ${action.row.agentName}`
          }

          // Upload headshot
          if (action.headshotFile) {
            try {
              const uploaded = await uploadHeadshot(bucket, docRef.id, action.headshotFile)
              docData.headshotPath = uploaded.storagePath
              docData.headshotUrl = uploaded.downloadUrl
              docData.imageUrl = uploaded.storagePath
              stats.headshotsUploaded += 1
              console.info(
                `  ${c("cyan", "+")} headshot uploaded: ${uploaded.storagePath}`,
              )
            } catch (err) {
              warnings.push(`Headshot upload failed for ${action.row.name}: ${err}`)
              console.error(
                `  ${c("red", "x")} headshot upload failed: ${err}`,
              )
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
          `${modeTag} ${c("blue", "UPDATE")} ${c("bold", action.row.name)}  ` +
          `(id: ${action.matchedExistingId})  ` +
          `fields=[${action.fieldsAdded.join(", ")}]`,
        )

        if (!dryRun && action.matchedExistingId) {
          const docRef = db.collection(collectionPath).doc(action.matchedExistingId)
          const patch: Record<string, unknown> = {
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: "system:import",
          }

          // Gender
          if (action.fieldsAdded.includes("gender")) {
            patch.gender = action.row.gender
          }

          // Agency
          if (action.fieldsAdded.includes("agency")) {
            patch.agency = action.row.agency
          }

          // Notes (agent name)
          if (action.fieldsAdded.includes("notes") && action.row.agentName) {
            const existingDoc = await docRef.get()
            const existingNotes =
              typeof existingDoc.data()?.notes === "string"
                ? (existingDoc.data()?.notes as string)
                : ""
            const agentLine = `Agent: ${action.row.agentName}`
            patch.notes = existingNotes
              ? `${agentLine}\n${existingNotes}`
              : agentLine
          }

          // Measurements: merge missing keys
          const measurementFields = action.fieldsAdded.filter((f) =>
            f.startsWith("measurements."),
          )
          if (measurementFields.length > 0) {
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

          // Headshot
          if (action.fieldsAdded.includes("headshot") && action.headshotFile) {
            try {
              const uploaded = await uploadHeadshot(
                bucket,
                action.matchedExistingId,
                action.headshotFile,
              )
              patch.headshotPath = uploaded.storagePath
              patch.headshotUrl = uploaded.downloadUrl
              patch.imageUrl = uploaded.storagePath
              stats.headshotsUploaded += 1
              console.info(
                `  ${c("cyan", "+")} headshot uploaded: ${uploaded.storagePath}`,
              )
            } catch (err) {
              warnings.push(`Headshot upload failed for ${action.row.name}: ${err}`)
              console.error(
                `  ${c("red", "x")} headshot upload failed: ${err}`,
              )
            }
          }

          await docRef.update(patch)
          await new Promise((r) => setTimeout(r, 100))
        }
        continue
      }
    } catch (err) {
      warnings.push(`Error processing ${action.row.name}: ${err}`)
      console.error(
        `  ${c("red", "ERROR")} processing ${action.row.name}: ${err}`,
      )
    }
  }

  return stats
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function buildReport(
  actions: readonly ImportAction[],
  stats: ImportReport["stats"],
  fuzzyMatches: readonly FuzzyMatch[],
  warnings: readonly string[],
  dryRun: boolean,
): ImportReport {
  return {
    timestamp: new Date().toISOString(),
    mode: dryRun ? "dry-run" : "write",
    stats: { ...stats, fuzzyWarnings: fuzzyMatches.length },
    actions: actions.map((a) => ({
      type: a.type,
      name: a.row.name,
      gender: a.row.gender,
      agency: a.row.agency ?? "",
      matchedExistingId: a.matchedExistingId,
      fieldsAdded: [...a.fieldsAdded],
      headshotAction: a.headshotAction,
      headshotFile: a.headshotFile,
    })),
    fuzzyMatches: [...fuzzyMatches],
    warnings: [...warnings],
  }
}

// ---------------------------------------------------------------------------
// Console Output
// ---------------------------------------------------------------------------

function printHeader(args: CliArgs, dryRun: boolean): void {
  console.info("")
  console.info(c("bold", "=".repeat(70)))
  console.info(c("bold", "  TALENT ROSTER IMPORT: Excel -> Firestore"))
  console.info(c("bold", "=".repeat(70)))
  console.info(`  Client ID:      ${c("cyan", args.clientId!)}`)
  console.info(`  Excel file:     ${args.excelPath}`)
  console.info(`  Headshots dir:  ${args.headshotsDir}`)
  console.info(
    `  Mode:           ${dryRun ? c("yellow", "DRY RUN (no writes)") : c("red", "WRITE MODE")}`,
  )
  if (args.reportPath) {
    console.info(`  Report:         ${args.reportPath}`)
  }
  console.info(c("bold", "=".repeat(70)))
  console.info("")
}

function printFuzzyWarnings(fuzzyMatches: readonly FuzzyMatch[]): void {
  if (fuzzyMatches.length === 0) return

  console.info("")
  console.info(c("yellow", "=".repeat(70)))
  console.info(c("yellow", "  FUZZY MATCH WARNINGS (Levenshtein distance <= 3)"))
  console.info(c("yellow", "=".repeat(70)))

  for (const fm of fuzzyMatches) {
    console.info(
      `  ${c("yellow", "~")} "${fm.spreadsheetName}" ${c("gray", "<->")} ` +
      `"${fm.existingName}" ${c("gray", `(id: ${fm.existingId}, dist: ${fm.distance})`)}`,
    )
  }

  console.info(c("yellow", "=".repeat(70)))
  console.info("")
}

function printSummary(
  stats: ImportReport["stats"],
  dryRun: boolean,
  clientId: string,
  headshotIndex: ReadonlyMap<string, string>,
): void {
  console.info("")
  console.info(c("bold", "=".repeat(70)))
  console.info(c("bold", "  IMPORT SUMMARY"))
  console.info(c("bold", "=".repeat(70)))
  console.info(`  Client ID:           ${c("cyan", clientId)}`)
  console.info(
    `  Mode:                ${dryRun ? c("yellow", "DRY RUN") : c("green", "WRITE")}`,
  )
  console.info(`  Headshots on disk:   ${headshotIndex.size}`)
  console.info(c("bold", "-".repeat(70)))
  console.info(`  Total models:        ${c("bold", String(stats.total))}`)
  console.info(`  Created:             ${c("green", String(stats.created))}`)
  console.info(`  Updated:             ${c("blue", String(stats.updated))}`)
  console.info(`  Skipped:             ${c("gray", String(stats.skipped))}`)
  console.info(`  Headshots uploaded:  ${c("cyan", String(stats.headshotsUploaded))}`)
  console.info(`  Headshots missing:   ${c("yellow", String(stats.headshotsMissing))}`)
  console.info(`  Fuzzy warnings:      ${c("yellow", String(stats.fuzzyWarnings))}`)
  console.info(c("bold", "=".repeat(70)))

  if (dryRun && (stats.created > 0 || stats.updated > 0)) {
    console.info("")
    console.info(
      c("yellow", "  To apply these changes, run with --write flag:"),
    )
    console.info(
      `  npx tsx scripts/import-talent-roster.ts --clientId=${clientId} --write`,
    )
  }
  console.info("")
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

;(async () => {
  try {
    const args = parseArgs()
    if (!args.clientId) printUsageAndExit()

    const clientId = args.clientId!
    const dryRun = !args.write

    if (!/^[a-z0-9][-a-z0-9]*$/.test(clientId)) {
      console.error(c("red", "ERROR: clientId must be lowercase alphanumeric with hyphens only"))
      process.exit(1)
    }

    if (!existsSync(args.excelPath)) {
      console.error(c("red", `ERROR: Excel file not found: ${args.excelPath}`))
      process.exit(1)
    }

    if (!existsSync(args.headshotsDir)) {
      console.error(
        c("yellow", `WARNING: Headshots directory not found: ${args.headshotsDir}`),
      )
      console.error(c("yellow", "  Headshot uploads will be skipped."))
    }

    printHeader(args, dryRun)

    // Build headshot file index
    console.info(`${c("cyan", "[1/5]")} Indexing headshot files...`)
    const headshotIndex = buildHeadshotIndex(args.headshotsDir)
    console.info(`  Found ${c("bold", String(headshotIndex.size))} headshot files`)
    console.info("")

    // Load Excel
    console.info(`${c("cyan", "[2/5]")} Loading Excel file...`)
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.readFile(args.excelPath)

    const menSheet = workbook.getWorksheet("Men")
    const womenSheet = workbook.getWorksheet("Women")

    if (!menSheet && !womenSheet) {
      console.error(c("red", "ERROR: No 'Men' or 'Women' worksheets found. Available sheets:"))
      workbook.eachSheet((ws) => console.error(`  - ${ws.name}`))
      process.exit(1)
    }

    const allRows: ParsedRow[] = []

    if (menSheet) {
      const menRows = parseSheet(menSheet, "male", "Men")
      console.info(`  Parsed ${c("bold", String(menRows.length))} models from "Men" sheet`)
      allRows.push(...menRows)
    }

    if (womenSheet) {
      const womenRows = parseSheet(womenSheet, "female", "Women")
      console.info(`  Parsed ${c("bold", String(womenRows.length))} models from "Women" sheet`)
      allRows.push(...womenRows)
    }

    console.info(`  Total: ${c("bold", String(allRows.length))} models`)
    console.info("")

    // Init Firebase
    console.info(`${c("cyan", "[3/5]")} Connecting to Firestore...`)
    const app = ensureApp()
    const db = getFirestore(app)
    db.settings({ ignoreUndefinedProperties: true })

    const existingTalent = await loadExistingTalent(db, clientId)
    console.info(
      `  Found ${c("bold", String(existingTalent.size))} existing talent records in clients/${clientId}/talent`,
    )
    console.info("")

    // Build actions
    console.info(`${c("cyan", "[4/5]")} Planning import actions...`)
    const warnings: string[] = []
    const actions = buildActions(allRows, existingTalent, headshotIndex, args.headshotsDir, warnings)

    // Fuzzy match detection
    const fuzzyMatches = findFuzzyMatches(allRows, existingTalent)
    if (fuzzyMatches.length > 0) {
      printFuzzyWarnings(fuzzyMatches)
    }

    // Print warnings from action building
    if (warnings.length > 0) {
      for (const w of warnings) {
        console.info(`  ${c("yellow", "WARNING:")} ${w}`)
      }
      console.info("")
    }

    const createCount = actions.filter((a) => a.type === "CREATE").length
    const updateCount = actions.filter((a) => a.type === "UPDATE").length
    const skipCount = actions.filter((a) => a.type === "SKIP").length
    console.info(
      `  Plan: ${c("green", String(createCount))} create, ` +
      `${c("blue", String(updateCount))} update, ` +
      `${c("gray", String(skipCount))} skip`,
    )
    console.info("")

    // Execute
    console.info(`${c("cyan", "[5/5]")} Executing...`)
    console.info(c("bold", "-".repeat(70)))
    const storageBucket = getStorage(app).bucket()
    const stats = await executeActions(actions, db, storageBucket, clientId, dryRun, warnings)
    stats.fuzzyWarnings = fuzzyMatches.length

    // Summary
    printSummary(stats, dryRun, clientId, headshotIndex)

    // Report
    if (args.reportPath) {
      const report = buildReport(actions, stats, fuzzyMatches, warnings, dryRun)
      writeFileSync(args.reportPath, JSON.stringify(report, null, 2), "utf-8")
      console.info(`Report written to: ${c("cyan", args.reportPath)}`)
      console.info("")
    }

    if (warnings.length > 0) {
      console.info(c("yellow", `${warnings.length} warning(s) recorded. Use --report for details.`))
      console.info("")
    }
  } catch (error) {
    console.error(c("red", "[import] Fatal error:"), error)
    process.exitCode = 1
  }
})()
