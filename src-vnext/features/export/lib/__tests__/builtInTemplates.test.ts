import { describe, expect, it } from "vitest"
import { BUILT_IN_TEMPLATES } from "../builtInTemplates"
import type { ExportBlock } from "../../types/exportBuilder"
import { isHStackRow } from "../../types/exportBuilder"

/** Extract all blocks from a page's items, flattening HStack rows */
function flattenItems(items: readonly import("../../types/exportBuilder").PageItem[]): ExportBlock[] {
  return items.flatMap((item) =>
    isHStackRow(item) ? item.columns.flatMap((c) => [...c.blocks]) : [item],
  )
}

describe("BUILT_IN_TEMPLATES", () => {
  it("contains exactly 5 templates", () => {
    expect(BUILT_IN_TEMPLATES).toHaveLength(5)
  })

  it("all templates have unique ids", () => {
    const ids = BUILT_IN_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("all templates are categorized as built-in", () => {
    for (const template of BUILT_IN_TEMPLATES) {
      expect(template.category).toBe("built-in")
    }
  })

  it("all templates have at least one page with items", () => {
    for (const template of BUILT_IN_TEMPLATES) {
      expect(template.pages.length).toBeGreaterThanOrEqual(1)
      for (const page of template.pages) {
        expect(page.items.length).toBeGreaterThanOrEqual(1)
        expect(page.id).toBeTruthy()
      }
    }
  })

  it("all templates have valid page settings", () => {
    for (const template of BUILT_IN_TEMPLATES) {
      expect(["portrait", "landscape"]).toContain(template.settings.layout)
      expect(["letter", "a4", "legal"]).toContain(template.settings.size)
      expect(template.settings.fontFamily).toBeTruthy()
    }
  })

  it("all blocks in all templates have valid ids and types", () => {
    const validTypes = [
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

    for (const template of BUILT_IN_TEMPLATES) {
      for (const page of template.pages) {
        for (const block of flattenItems(page.items)) {
          expect(block.id).toBeTruthy()
          expect(validTypes).toContain(block.type)
        }
      }
    }
  })

  it("Shot List template uses landscape and contains a shot-grid block", () => {
    const shotList = BUILT_IN_TEMPLATES.find((t) => t.id === "built-in-shot-list")
    expect(shotList).toBeDefined()
    expect(shotList!.settings.layout).toBe("landscape")

    const hasGrid = shotList!.pages.some((p) =>
      flattenItems(p.items).some((b) => b.type === "shot-grid"),
    )
    expect(hasGrid).toBe(true)
  })

  it("Storyboard template contains shot-detail blocks", () => {
    const storyboard = BUILT_IN_TEMPLATES.find((t) => t.id === "built-in-storyboard")
    expect(storyboard).toBeDefined()

    const detailBlocks = storyboard!.pages.flatMap((p) =>
      flattenItems(p.items).filter((b) => b.type === "shot-detail"),
    )
    expect(detailBlocks.length).toBeGreaterThanOrEqual(2)
  })

  it("Lookbook template has shot-detail blocks with hero image only", () => {
    const lookbook = BUILT_IN_TEMPLATES.find((t) => t.id === "built-in-lookbook")
    expect(lookbook).toBeDefined()

    const detailBlocks = lookbook!.pages.flatMap((p) =>
      flattenItems(p.items).filter((b) => b.type === "shot-detail"),
    )
    expect(detailBlocks.length).toBeGreaterThanOrEqual(1)

    for (const block of detailBlocks) {
      if (block.type === "shot-detail") {
        expect(block.showHeroImage).toBe(true)
        expect(block.showDescription).toBe(false)
        expect(block.showProducts).toBe(false)
      }
    }
  })

  it("Pull Sheet template contains a pull-sheet block", () => {
    const pullSheet = BUILT_IN_TEMPLATES.find((t) => t.id === "built-in-pull-sheet")
    expect(pullSheet).toBeDefined()

    const hasPull = pullSheet!.pages.some((p) =>
      flattenItems(p.items).some((b) => b.type === "pull-sheet"),
    )
    expect(hasPull).toBe(true)
  })

  it("Call Sheet template contains a crew-list block", () => {
    const callSheet = BUILT_IN_TEMPLATES.find((t) => t.id === "built-in-call-sheet")
    expect(callSheet).toBeDefined()

    const hasCrew = callSheet!.pages.some((p) =>
      flattenItems(p.items).some((b) => b.type === "crew-list"),
    )
    expect(hasCrew).toBe(true)
  })

  it("templates use variable tokens in text blocks", () => {
    for (const template of BUILT_IN_TEMPLATES) {
      const textBlocks = template.pages.flatMap((p) =>
        flattenItems(p.items).filter((b) => b.type === "text"),
      )
      const hasVariableToken = textBlocks.some(
        (b) => b.type === "text" && b.content.includes("{{"),
      )
      expect(hasVariableToken).toBe(true)
    }
  })
})
