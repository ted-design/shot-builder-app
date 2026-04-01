import { describe, expect, it, vi, beforeEach } from "vitest"
import {
  addBlockToPage,
  removeBlockFromPage,
  updateBlock,
  moveBlock,
  addPage,
  removePage,
  duplicatePage,
  applyTemplate,
  updateSettings,
} from "../documentOperations"
import type {
  ExportBlock,
  ExportDocument,
  ExportTemplate,
  PageSettings,
  TextBlock,
} from "../../types/exportBuilder"

function makeTextBlock(id: string, content = ""): TextBlock {
  return { id, type: "text", content }
}

function makeDocument(overrides?: Partial<ExportDocument>): ExportDocument {
  return {
    id: "doc-1",
    name: "Test Doc",
    pages: [
      {
        id: "page-1",
        blocks: [
          makeTextBlock("block-a", "Hello"),
          makeTextBlock("block-b", "World"),
        ],
      },
    ],
    settings: {
      layout: "portrait",
      size: "letter",
      fontFamily: "Inter",
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

// Freeze the date so updatedAt assertions are stable
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"))
})

describe("addBlockToPage", () => {
  it("appends a block to the specified page", () => {
    const doc = makeDocument()
    const newBlock = makeTextBlock("block-c", "New")
    const result = addBlockToPage(doc, "page-1", newBlock)

    expect(result.pages[0]?.blocks).toHaveLength(3)
    expect(result.pages[0]?.blocks[2]?.id).toBe("block-c")
  })

  it("does not mutate the original document", () => {
    const doc = makeDocument()
    const newBlock = makeTextBlock("block-c", "New")
    const result = addBlockToPage(doc, "page-1", newBlock)

    expect(doc.pages[0]?.blocks).toHaveLength(2)
    expect(result).not.toBe(doc)
    expect(result.pages).not.toBe(doc.pages)
  })

  it("updates the updatedAt timestamp", () => {
    const doc = makeDocument()
    const result = addBlockToPage(doc, "page-1", makeTextBlock("x"))
    expect(result.updatedAt).toBe("2026-06-15T12:00:00.000Z")
  })

  it("leaves other pages unchanged when targeting a specific page", () => {
    const doc = makeDocument({
      pages: [
        { id: "page-1", blocks: [makeTextBlock("a")] },
        { id: "page-2", blocks: [makeTextBlock("b")] },
      ],
    })
    const result = addBlockToPage(doc, "page-1", makeTextBlock("c"))

    expect(result.pages[0]?.blocks).toHaveLength(2)
    expect(result.pages[1]?.blocks).toHaveLength(1)
  })
})

describe("removeBlockFromPage", () => {
  it("removes the block with the given id", () => {
    const doc = makeDocument()
    const result = removeBlockFromPage(doc, "page-1", "block-a")

    expect(result.pages[0]?.blocks).toHaveLength(1)
    expect(result.pages[0]?.blocks[0]?.id).toBe("block-b")
  })

  it("does not mutate the original document", () => {
    const doc = makeDocument()
    removeBlockFromPage(doc, "page-1", "block-a")
    expect(doc.pages[0]?.blocks).toHaveLength(2)
  })

  it("is a no-op if blockId is not found", () => {
    const doc = makeDocument()
    const result = removeBlockFromPage(doc, "page-1", "nonexistent")
    expect(result.pages[0]?.blocks).toHaveLength(2)
  })
})

describe("updateBlock", () => {
  it("merges updates into the target block", () => {
    const doc = makeDocument()
    const result = updateBlock(doc, "page-1", "block-a", { content: "Updated" })
    const updated = result.pages[0]?.blocks[0] as TextBlock

    expect(updated.content).toBe("Updated")
    expect(updated.type).toBe("text")
  })

  it("does not mutate the original document", () => {
    const doc = makeDocument()
    updateBlock(doc, "page-1", "block-a", { content: "Updated" })
    expect((doc.pages[0]?.blocks[0] as TextBlock).content).toBe("Hello")
  })

  it("leaves other blocks unchanged", () => {
    const doc = makeDocument()
    const result = updateBlock(doc, "page-1", "block-a", { content: "Updated" })
    expect((result.pages[0]?.blocks[1] as TextBlock).content).toBe("World")
  })
})

describe("moveBlock", () => {
  it("moves a block to a new index", () => {
    const doc = makeDocument({
      pages: [
        {
          id: "page-1",
          blocks: [
            makeTextBlock("a"),
            makeTextBlock("b"),
            makeTextBlock("c"),
          ],
        },
      ],
    })
    const result = moveBlock(doc, "page-1", "a", 2)
    const ids = result.pages[0]?.blocks.map((b) => b.id)

    expect(ids).toEqual(["b", "c", "a"])
  })

  it("clamps to the end if newIndex exceeds array length", () => {
    const doc = makeDocument()
    const result = moveBlock(doc, "page-1", "block-a", 100)
    const ids = result.pages[0]?.blocks.map((b) => b.id)

    expect(ids).toEqual(["block-b", "block-a"])
  })

  it("clamps to 0 if newIndex is negative", () => {
    const doc = makeDocument()
    const result = moveBlock(doc, "page-1", "block-b", -5)
    const ids = result.pages[0]?.blocks.map((b) => b.id)

    expect(ids).toEqual(["block-b", "block-a"])
  })

  it("is a no-op if blockId is not found", () => {
    const doc = makeDocument()
    const result = moveBlock(doc, "page-1", "nonexistent", 0)
    expect(result.pages[0]?.blocks).toHaveLength(2)
  })

  it("does not mutate the original document", () => {
    const doc = makeDocument()
    moveBlock(doc, "page-1", "block-a", 1)
    expect(doc.pages[0]?.blocks[0]?.id).toBe("block-a")
  })
})

describe("addPage", () => {
  it("appends a new empty page", () => {
    const doc = makeDocument()
    const result = addPage(doc)

    expect(result.pages).toHaveLength(2)
    expect(result.pages[1]?.blocks).toHaveLength(0)
    expect(result.pages[1]?.id).toBeTruthy()
  })

  it("does not mutate the original document", () => {
    const doc = makeDocument()
    addPage(doc)
    expect(doc.pages).toHaveLength(1)
  })
})

describe("removePage", () => {
  it("removes the page with the given id", () => {
    const doc = makeDocument({
      pages: [
        { id: "page-1", blocks: [] },
        { id: "page-2", blocks: [] },
      ],
    })
    const result = removePage(doc, "page-1")

    expect(result.pages).toHaveLength(1)
    expect(result.pages[0]?.id).toBe("page-2")
  })

  it("does not mutate the original document", () => {
    const doc = makeDocument({
      pages: [
        { id: "page-1", blocks: [] },
        { id: "page-2", blocks: [] },
      ],
    })
    removePage(doc, "page-1")
    expect(doc.pages).toHaveLength(2)
  })
})

describe("duplicatePage", () => {
  it("inserts a copy immediately after the source page", () => {
    const doc = makeDocument({
      pages: [
        { id: "page-1", blocks: [makeTextBlock("a")] },
        { id: "page-2", blocks: [] },
      ],
    })
    const result = duplicatePage(doc, "page-1")

    expect(result.pages).toHaveLength(3)
    // Duplicate is at index 1
    expect(result.pages[1]?.id).not.toBe("page-1")
    expect(result.pages[1]?.blocks).toHaveLength(1)
    // Original page-2 shifts to index 2
    expect(result.pages[2]?.id).toBe("page-2")
  })

  it("generates new ids for the duplicated page and its blocks", () => {
    const doc = makeDocument()
    const result = duplicatePage(doc, "page-1")
    const dup = result.pages[1]

    expect(dup?.id).not.toBe("page-1")
    expect(dup?.blocks[0]?.id).not.toBe("block-a")
    expect(dup?.blocks[1]?.id).not.toBe("block-b")
  })

  it("returns the document unchanged if pageId is not found", () => {
    const doc = makeDocument()
    const result = duplicatePage(doc, "nonexistent")
    expect(result.pages).toHaveLength(1)
  })

  it("does not mutate the original document", () => {
    const doc = makeDocument()
    duplicatePage(doc, "page-1")
    expect(doc.pages).toHaveLength(1)
  })
})

describe("applyTemplate", () => {
  it("creates a new document from a template with fresh ids", () => {
    const template: ExportTemplate = {
      id: "tmpl-1",
      name: "Test Template",
      description: "A test",
      category: "built-in",
      settings: { layout: "landscape", size: "a4", fontFamily: "Helvetica" },
      pages: [
        {
          id: "tmpl-page-1",
          blocks: [makeTextBlock("tmpl-block-1", "Template text")],
        },
      ],
    }

    const result = applyTemplate(template)

    expect(result.name).toBe("Test Template")
    expect(result.settings.layout).toBe("landscape")
    expect(result.settings.size).toBe("a4")
    expect(result.pages).toHaveLength(1)

    // IDs must be new
    expect(result.id).not.toBe("tmpl-1")
    expect(result.pages[0]?.id).not.toBe("tmpl-page-1")
    expect(result.pages[0]?.blocks[0]?.id).not.toBe("tmpl-block-1")
  })

  it("does not mutate the template", () => {
    const template: ExportTemplate = {
      id: "tmpl-1",
      name: "Test Template",
      description: "A test",
      category: "built-in",
      settings: { layout: "portrait", size: "letter", fontFamily: "Inter" },
      pages: [
        { id: "p1", blocks: [makeTextBlock("b1")] },
      ],
    }

    applyTemplate(template)
    expect(template.pages[0]?.id).toBe("p1")
    expect(template.pages[0]?.blocks[0]?.id).toBe("b1")
  })
})

describe("updateSettings", () => {
  it("replaces settings with the new values", () => {
    const doc = makeDocument()
    const newSettings: PageSettings = {
      layout: "landscape",
      size: "a4",
      fontFamily: "Georgia",
      watermark: { text: "DRAFT", opacity: 20, fontSize: 48, color: "#cccccc" },
    }
    const result = updateSettings(doc, newSettings)

    expect(result.settings.layout).toBe("landscape")
    expect(result.settings.size).toBe("a4")
    expect(result.settings.fontFamily).toBe("Georgia")
    expect(result.settings.watermark?.text).toBe("DRAFT")
  })

  it("does not mutate the original document", () => {
    const doc = makeDocument()
    const newSettings: PageSettings = {
      layout: "landscape",
      size: "legal",
      fontFamily: "Courier New",
    }
    updateSettings(doc, newSettings)
    expect(doc.settings.layout).toBe("portrait")
  })
})
