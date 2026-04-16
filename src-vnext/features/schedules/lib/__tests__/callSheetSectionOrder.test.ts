import { describe, expect, it } from "vitest"
import { normalizeCallSheetConfig } from "../callSheetConfig"

describe("callSheetConfig sectionOrder", () => {
  it("defaults to standard order when sectionOrder is absent", () => {
    const config = normalizeCallSheetConfig(null)
    expect(config.sectionOrder).toEqual([
      "header",
      "dayDetails",
      "schedule",
      "talent",
      "crew",
      "notes",
    ])
  })

  it("preserves a valid custom sectionOrder", () => {
    const config = normalizeCallSheetConfig({
      sectionOrder: ["notes", "crew", "talent", "schedule", "dayDetails", "header"],
    })
    expect(config.sectionOrder).toEqual([
      "notes",
      "crew",
      "talent",
      "schedule",
      "dayDetails",
      "header",
    ])
  })

  it("appends missing sections to the end of a partial sectionOrder", () => {
    const config = normalizeCallSheetConfig({
      sectionOrder: ["header", "schedule"],
    })
    expect(config.sectionOrder).toEqual([
      "header",
      "schedule",
      "dayDetails",
      "talent",
      "crew",
      "notes",
    ])
  })

  it("strips unknown keys from sectionOrder", () => {
    const config = normalizeCallSheetConfig({
      sectionOrder: ["header", "unknown", "schedule", "bogus"],
    })
    expect(config.sectionOrder).toEqual([
      "header",
      "schedule",
      "dayDetails",
      "talent",
      "crew",
      "notes",
    ])
  })

  it("falls back to default when sectionOrder is not an array", () => {
    const config = normalizeCallSheetConfig({
      sectionOrder: "invalid",
    })
    expect(config.sectionOrder).toEqual([
      "header",
      "dayDetails",
      "schedule",
      "talent",
      "crew",
      "notes",
    ])
  })
})
