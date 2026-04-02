import { describe, expect, it } from "vitest"
import { createBlock } from "../blockDefaults"
import type {
  BlockType,
  CrewListBlock,
  DividerBlock,
  ImageBlock,
  PageBreakBlock,
  ProductTableBlock,
  PullSheetBlock,
  ShotDetailBlock,
  ShotGridBlock,
  TextBlock,
} from "../../types/exportBuilder"

const ALL_BLOCK_TYPES: BlockType[] = [
  "text",
  "image",
  "shot-grid",
  "shot-detail",
  "product-table",
  "pull-sheet",
  "crew-list",
  "divider",
  "page-break",
]

describe("createBlock", () => {
  it("returns a block with a unique id for every type", () => {
    const ids = new Set<string>()
    for (const type of ALL_BLOCK_TYPES) {
      const block = createBlock(type)
      expect(block.id).toBeTruthy()
      expect(block.type).toBe(type)
      ids.add(block.id)
    }
    // All ids must be unique
    expect(ids.size).toBe(ALL_BLOCK_TYPES.length)
  })

  it("creates a text block with empty content and left alignment", () => {
    const block = createBlock("text") as TextBlock
    expect(block.type).toBe("text")
    expect(block.content).toBe("")
    expect(block.typography?.textAlign).toBe("left")
  })

  it("creates an image block with 100% width and center alignment", () => {
    const block = createBlock("image") as ImageBlock
    expect(block.type).toBe("image")
    expect(block.width).toBe(100)
    expect(block.alignment).toBe("center")
  })

  it("creates a shot-grid block with default columns", () => {
    const block = createBlock("shot-grid") as ShotGridBlock
    expect(block.type).toBe("shot-grid")
    expect(block.columns.length).toBeGreaterThanOrEqual(7)

    const visibleKeys = block.columns
      .filter((c) => c.visible)
      .map((c) => c.key)
    expect(visibleKeys).toContain("shotNumber")
    expect(visibleKeys).toContain("thumbnail")
    expect(visibleKeys).toContain("title")
    expect(visibleKeys).toContain("status")
    expect(visibleKeys).toContain("products")
    expect(visibleKeys).toContain("talent")
    expect(visibleKeys).toContain("location")

    const hiddenKeys = block.columns
      .filter((c) => !c.visible)
      .map((c) => c.key)
    expect(hiddenKeys).toContain("description")
    expect(hiddenKeys).toContain("tags")
    expect(hiddenKeys).toContain("notes")

    expect(block.sortBy).toBe("shotNumber")
    expect(block.sortDirection).toBe("asc")
    expect(block.tableStyle?.showBorders).toBe(true)
  })

  it("creates a shot-detail block with hero image and products enabled", () => {
    const block = createBlock("shot-detail") as ShotDetailBlock
    expect(block.type).toBe("shot-detail")
    expect(block.showHeroImage).toBe(true)
    expect(block.showDescription).toBe(true)
    expect(block.showProducts).toBe(true)
    expect(block.showNotes).toBe(false)
  })

  it("creates a product-table block with default columns", () => {
    const block = createBlock("product-table") as ProductTableBlock
    expect(block.type).toBe("product-table")
    expect(block.columns.length).toBe(5)

    const keys = block.columns.map((c) => c.key)
    expect(keys).toEqual(["styleName", "styleNumber", "gender", "skuCount", "classification"])

    for (const col of block.columns) {
      expect(col.visible).toBe(true)
    }
  })

  it("creates a pull-sheet block with fulfillment status enabled", () => {
    const block = createBlock("pull-sheet") as PullSheetBlock
    expect(block.type).toBe("pull-sheet")
    expect(block.showFulfillmentStatus).toBe(true)
  })

  it("creates a crew-list block grouped by department", () => {
    const block = createBlock("crew-list") as CrewListBlock
    expect(block.type).toBe("crew-list")
    expect(block.groupByDepartment).toBe(true)
  })

  it("creates a divider block with solid style", () => {
    const block = createBlock("divider") as DividerBlock
    expect(block.type).toBe("divider")
    expect(block.style).toBe("solid")
  })

  it("creates a page-break block with no extra properties", () => {
    const block = createBlock("page-break") as PageBreakBlock
    expect(block.type).toBe("page-break")
    expect(Object.keys(block)).toEqual(["id", "type"])
  })

  it("generates unique ids on successive calls of the same type", () => {
    const a = createBlock("text")
    const b = createBlock("text")
    expect(a.id).not.toBe(b.id)
  })
})
