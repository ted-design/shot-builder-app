// Builds the Capture One digi-tech .xlsx snapshot (Shot Mapping / Flat List /
// Warnings). exceljs is dynamically imported so its ~2.5 MB only loads when a
// user actually downloads — it stays out of the public page's initial chunk.

export interface CaptureOneXlsxFilename {
  readonly name: string
  readonly genderResolved: boolean
}

export interface CaptureOneXlsxShot {
  readonly id: string
  readonly shotNumber: string | null
  readonly title: string
  readonly filenames: readonly CaptureOneXlsxFilename[]
}

export interface CaptureOneXlsxPayload {
  readonly projectName: string
  readonly shots: readonly CaptureOneXlsxShot[]
}

/** Unique filenames across all shots, alpha-sorted (numeric-aware). */
export function flattenFilenames(payload: CaptureOneXlsxPayload): CaptureOneXlsxFilename[] {
  const byName = new Map<string, boolean>()
  for (const shot of payload.shots) {
    for (const f of shot.filenames) {
      // Same filename encodes the same gender prefix, so genderResolved is stable;
      // AND-collapse is just belt-and-suspenders against a mixed duplicate.
      byName.set(f.name, (byName.get(f.name) ?? true) && f.genderResolved)
    }
  }
  return [...byName.entries()]
    .map(([name, genderResolved]) => ({ name, genderResolved }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
}

export interface CaptureOneWarningRow {
  readonly shotNumber: string | null
  readonly title: string
  readonly name: string
}

/** Every unresolved-gender filename (U_ placeholder) with its shot context. */
export function collectWarnings(payload: CaptureOneXlsxPayload): CaptureOneWarningRow[] {
  const out: CaptureOneWarningRow[] = []
  for (const shot of payload.shots) {
    for (const f of shot.filenames) {
      if (!f.genderResolved) out.push({ shotNumber: shot.shotNumber, title: shot.title, name: f.name })
    }
  }
  return out
}

/** Safe .xlsx download filename from a project name. */
export function captureOneXlsxFilename(projectName: string): string {
  const base =
    projectName.trim().replace(/[^A-Za-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "") || "capture-one"
  return `${base}_capture-one.xlsx`
}

/** Build the .xlsx workbook buffer for a resolved Capture One payload. */
export async function buildCaptureOneXlsxBuffer(
  payload: CaptureOneXlsxPayload,
): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import("exceljs")
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "Shot Builder"

  // Shot Mapping — one row per filename; a shot with no starred heroes still lists once.
  const mapping = workbook.addWorksheet("Shot Mapping")
  mapping.columns = [
    { header: "Shot #", key: "num", width: 10 },
    { header: "Shot", key: "title", width: 32 },
    { header: "Capture One Filename", key: "name", width: 40 },
    { header: "Gender Resolved", key: "resolved", width: 16 },
  ]
  for (const shot of payload.shots) {
    if (shot.filenames.length === 0) {
      mapping.addRow({ num: shot.shotNumber ?? "", title: shot.title, name: "", resolved: "" })
      continue
    }
    for (const f of shot.filenames) {
      mapping.addRow({
        num: shot.shotNumber ?? "",
        title: shot.title,
        name: f.name,
        resolved: f.genderResolved ? "Yes" : "No",
      })
    }
  }

  // Flat List — deduped, sorted filenames (the digi-tech's quick reference).
  const flat = workbook.addWorksheet("Flat List")
  flat.columns = [
    { header: "Capture One Filename", key: "name", width: 40 },
    { header: "Gender Resolved", key: "resolved", width: 16 },
  ]
  for (const f of flattenFilenames(payload)) {
    flat.addRow({ name: f.name, resolved: f.genderResolved ? "Yes" : "No" })
  }

  // Warnings — unresolved-gender filenames that fell back to a U_ placeholder.
  const warnings = workbook.addWorksheet("Warnings")
  warnings.columns = [
    { header: "Shot #", key: "num", width: 10 },
    { header: "Shot", key: "title", width: 32 },
    { header: "Capture One Filename (U_ placeholder)", key: "name", width: 44 },
  ]
  for (const w of collectWarnings(payload)) {
    warnings.addRow({ num: w.shotNumber ?? "", title: w.title, name: w.name })
  }

  for (const ws of [mapping, flat, warnings]) ws.getRow(1).font = { bold: true }

  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer
}
