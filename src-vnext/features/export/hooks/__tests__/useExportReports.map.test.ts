import { describe, it, expect } from "vitest"
import { mapReport, type ExportReport } from "../useExportReports"

describe("mapReport reportType discriminator", () => {
  it("defaults a missing reportType to block-canvas (legacy docs are never migrated)", () => {
    const r = mapReport("id1", { name: "Legacy", schemaVersion: 2 })
    expect(r.reportType).toBe("block-canvas")
  })

  it("surfaces an explicit shot-report type", () => {
    const r = mapReport("id2", { name: "Deck", reportType: "shot-report" })
    expect(r.reportType).toBe("shot-report")
  })

  it("surfaces an explicit block-canvas type", () => {
    const r = mapReport("id3", { name: "Blocks", reportType: "block-canvas" })
    expect(r.reportType).toBe("block-canvas")
  })
})

describe("mapReport layout (R3 recipe surfacing)", () => {
  it("defaults a missing config.layout to image-led (pre-R3 docs)", () => {
    expect(mapReport("a", { name: "x" }).layout).toBe("image-led")
    expect(mapReport("b", { name: "x", config: { groupBy: "gender" } }).layout).toBe("image-led")
  })

  it("surfaces config.layout from the config blob", () => {
    expect(mapReport("c", { name: "x", config: { layout: "production-sheet" } }).layout).toBe(
      "production-sheet",
    )
    expect(mapReport("d", { name: "x", config: { layout: "balanced-rows" } }).layout).toBe(
      "balanced-rows",
    )
  })
})

describe("block-canvas compat filter (legacy list safety)", () => {
  // Mirrors ExportBuilderPage: only block-canvas docs may enter the block editor,
  // so a shot-report doc can never be auto-selected and auto-save-clobbered.
  const keepBlockCanvas = (rs: readonly ExportReport[]) =>
    rs.filter((r) => r.reportType === "block-canvas")

  it("keeps legacy (missing-type) + block-canvas docs, drops shot-report docs", () => {
    const reports = [
      mapReport("legacy", { name: "Legacy" }), // no reportType -> block-canvas
      mapReport("blocks", { name: "B", reportType: "block-canvas" }),
      mapReport("shot", { name: "S", reportType: "shot-report" }),
    ]
    expect(keepBlockCanvas(reports).map((r) => r.id)).toEqual(["legacy", "blocks"])
  })
})
