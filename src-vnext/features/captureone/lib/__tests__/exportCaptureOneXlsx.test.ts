import { describe, expect, it } from "vitest"
import ExcelJS from "exceljs"
import {
  buildCaptureOneXlsxBuffer,
  captureOneXlsxFilename,
  collectWarnings,
  flattenFilenames,
  type CaptureOneXlsxPayload,
} from "@/features/captureone/lib/exportCaptureOneXlsx"

const payload: CaptureOneXlsxPayload = {
  projectName: "Q2 Shoot",
  shots: [
    {
      id: "s1",
      shotNumber: "1",
      title: "Hero Look",
      filenames: [
        { name: "M_MerinoTee_Forest", genderResolved: true },
        { name: "U_Cap_Black", genderResolved: false },
      ],
    },
    { id: "s2", shotNumber: "2", title: "Flat Lay", filenames: [] },
    {
      id: "s3",
      shotNumber: "10",
      title: "Detail",
      filenames: [{ name: "W_Legging_Navy", genderResolved: true }],
    },
  ],
}

describe("flattenFilenames", () => {
  it("dedupes and alpha-sorts (numeric-aware) across shots", () => {
    const dup: CaptureOneXlsxPayload = {
      projectName: "P",
      shots: [
        { id: "a", shotNumber: "1", title: "A", filenames: [{ name: "M_Tee_Red", genderResolved: true }] },
        { id: "b", shotNumber: "2", title: "B", filenames: [{ name: "M_Tee_Red", genderResolved: true }] },
      ],
    }
    expect(flattenFilenames(dup).map((f) => f.name)).toEqual(["M_Tee_Red"])
    expect(flattenFilenames(payload).map((f) => f.name)).toEqual([
      "M_MerinoTee_Forest",
      "U_Cap_Black",
      "W_Legging_Navy",
    ])
  })
})

describe("collectWarnings", () => {
  it("lists only unresolved-gender filenames with shot context", () => {
    const warnings = collectWarnings(payload)
    expect(warnings).toEqual([{ shotNumber: "1", title: "Hero Look", name: "U_Cap_Black" }])
  })
})

describe("captureOneXlsxFilename", () => {
  it("sanitizes the project name and appends the suffix", () => {
    expect(captureOneXlsxFilename("Q2 Shoot / 2026")).toBe("Q2_Shoot_2026_capture-one.xlsx")
    expect(captureOneXlsxFilename("   ")).toBe("capture-one_capture-one.xlsx")
  })
})

describe("buildCaptureOneXlsxBuffer", () => {
  it("writes Shot Mapping / Flat List / Warnings with the expected cells", async () => {
    const buffer = await buildCaptureOneXlsxBuffer(payload)
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buffer)

    expect(wb.worksheets.map((w) => w.name)).toEqual(["Shot Mapping", "Flat List", "Warnings"])

    const mapping = wb.getWorksheet("Shot Mapping")!
    expect(mapping.getRow(1).values).toEqual([
      undefined,
      "Shot #",
      "Shot",
      "Capture One Filename",
      "Gender Resolved",
    ])
    // 2 hero filenames (s1) + 1 placeholder row (s2, no heroes) + 1 (s3) = 4 data rows.
    expect(mapping.rowCount).toBe(5)
    expect(mapping.getRow(2).getCell(3).value).toBe("M_MerinoTee_Forest")
    expect(mapping.getRow(2).getCell(4).value).toBe("Yes")
    expect(mapping.getRow(3).getCell(4).value).toBe("No")
    // s2 has no heroes -> blank filename cell, still listed.
    expect(mapping.getRow(4).getCell(2).value).toBe("Flat Lay")
    expect(mapping.getRow(4).getCell(3).value ?? "").toBe("")

    const flat = wb.getWorksheet("Flat List")!
    expect(flat.rowCount).toBe(4) // header + 3 unique
    expect(flat.getRow(2).getCell(1).value).toBe("M_MerinoTee_Forest")

    const warnings = wb.getWorksheet("Warnings")!
    expect(warnings.rowCount).toBe(2) // header + 1 unresolved
    expect(warnings.getRow(2).getCell(3).value).toBe("U_Cap_Black")
  })
})
