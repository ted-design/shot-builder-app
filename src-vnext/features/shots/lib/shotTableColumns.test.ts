import { describe, it, expect } from "vitest"
import {
  SHOT_TABLE_COLUMNS,
  fieldsToColumnConfigs,
  columnKeyToFieldKey,
} from "./shotTableColumns"
import { DEFAULT_FIELDS, type ShotsListFields } from "./shotListFilters"

describe("SHOT_TABLE_COLUMNS", () => {
  it("defines 15 columns with unique keys", () => {
    expect(SHOT_TABLE_COLUMNS).toHaveLength(15)
    const keys = SHOT_TABLE_COLUMNS.map((c) => c.key)
    expect(new Set(keys).size).toBe(15)
  })

  it("marks 'shot' and 'shotNumber' columns as pinned", () => {
    const shotCol = SHOT_TABLE_COLUMNS.find((c) => c.key === "shot")
    expect(shotCol?.pinned).toBe(true)
    const shotNumberCol = SHOT_TABLE_COLUMNS.find((c) => c.key === "shotNumber")
    expect(shotNumberCol?.pinned).toBe(true)
  })

  it("has ascending order values", () => {
    for (let i = 0; i < SHOT_TABLE_COLUMNS.length; i++) {
      expect(SHOT_TABLE_COLUMNS[i]!.order).toBe(i)
    }
  })
})

describe("fieldsToColumnConfigs", () => {
  it("reflects DEFAULT_FIELDS visibility", () => {
    const configs = fieldsToColumnConfigs(DEFAULT_FIELDS)

    const notesCol = configs.find((c) => c.key === "notes")
    expect(notesCol?.visible).toBe(false) // notes defaults to false

    const dateCol = configs.find((c) => c.key === "date")
    expect(dateCol?.visible).toBe(true) // date defaults to true
  })

  it("always marks 'shot' as visible regardless of fields", () => {
    const allFalse: ShotsListFields = {
      heroThumb: false,
      shotNumber: false,
      description: false,
      notes: false,
      readiness: false,
      tags: false,
      date: false,
      location: false,
      products: false,
      links: false,
      talent: false,
      launch: false,
      reqs: false,
      samples: false,
      updated: false,
    }
    const configs = fieldsToColumnConfigs(allFalse)
    const shotCol = configs.find((c) => c.key === "shot")
    expect(shotCol?.visible).toBe(true)
  })

  it("applies saved widths when provided", () => {
    const saved = { date: 200, tags: 300 }
    const configs = fieldsToColumnConfigs(DEFAULT_FIELDS, saved)

    const dateCol = configs.find((c) => c.key === "date")
    expect(dateCol?.width).toBe(200)

    const tagsCol = configs.find((c) => c.key === "tags")
    expect(tagsCol?.width).toBe(300)
  })

  it("uses default width when no saved width exists", () => {
    const configs = fieldsToColumnConfigs(DEFAULT_FIELDS, {})
    const dateCol = configs.find((c) => c.key === "date")
    const defaultDateCol = SHOT_TABLE_COLUMNS.find((c) => c.key === "date")
    expect(dateCol?.width).toBe(defaultDateCol?.width)
  })

  it("returns the same number of columns as SHOT_TABLE_COLUMNS", () => {
    const configs = fieldsToColumnConfigs(DEFAULT_FIELDS)
    expect(configs).toHaveLength(SHOT_TABLE_COLUMNS.length)
  })
})

describe("columnKeyToFieldKey", () => {
  it("maps 'heroThumb' to 'heroThumb'", () => {
    expect(columnKeyToFieldKey("heroThumb")).toBe("heroThumb")
  })

  it("maps 'shot' to null (pinned)", () => {
    expect(columnKeyToFieldKey("shot")).toBeNull()
  })

  it("maps 'shotNumber' to null (pinned)", () => {
    expect(columnKeyToFieldKey("shotNumber")).toBeNull()
  })

  it("maps all data columns correctly", () => {
    expect(columnKeyToFieldKey("date")).toBe("date")
    expect(columnKeyToFieldKey("notes")).toBe("notes")
    expect(columnKeyToFieldKey("location")).toBe("location")
    expect(columnKeyToFieldKey("products")).toBe("products")
    expect(columnKeyToFieldKey("links")).toBe("links")
    expect(columnKeyToFieldKey("talent")).toBe("talent")
    expect(columnKeyToFieldKey("tags")).toBe("tags")
    expect(columnKeyToFieldKey("updated")).toBe("updated")
  })

  it("returns null for unknown keys", () => {
    expect(columnKeyToFieldKey("nonexistent")).toBeNull()
  })
})
