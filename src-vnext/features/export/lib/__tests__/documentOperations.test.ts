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
  addHStackRow,
  addColumnToRow,
  removeColumnFromRow,
  resizeColumns,
  addBlockToColumn,
  moveBlockBetweenColumns,
  wrapBlocksInHStack,
} from "../documentOperations"
import type {
  ExportBlock,
  ExportDocument,
  ExportTemplate,
  HStackRow,
  PageSettings,
  TextBlock,
} from "../../types/exportBuilder"
import { isHStackRow } from "../../types/exportBuilder"

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
        items: [
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

function makeHStackRow(id: string, colA: string, colB: string): HStackRow {
  return {
    id,
    type: "hstack",
    columns: [
      { id: colA, widthPercent: 50, blocks: [] },
      { id: colB, widthPercent: 50, blocks: [] },
    ],
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

    expect(result.pages[0]!.items).toHaveLength(3)
    expect(result.pages[0]!.items[2]!.id).toBe("block-c")
  })

  it("does not mutate the original document", () => {
    const doc = makeDocument()
    const newBlock = makeTextBlock("block-c", "New")
    const result = addBlockToPage(doc, "page-1", newBlock)

    expect(doc.pages[0]!.items).toHaveLength(2)
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
        { id: "page-1", items: [makeTextBlock("a")] },
        { id: "page-2", items: [makeTextBlock("b")] },
      ],
    })
    const result = addBlockToPage(doc, "page-1", makeTextBlock("c"))

    expect(result.pages[0]!.items).toHaveLength(2)
    expect(result.pages[1]!.items).toHaveLength(1)
  })
})

describe("removeBlockFromPage", () => {
  it("removes the block with the given id", () => {
    const doc = makeDocument()
    const result = removeBlockFromPage(doc, "page-1", "block-a")

    expect(result.pages[0]!.items).toHaveLength(1)
    expect(result.pages[0]!.items[0]!.id).toBe("block-b")
  })

  it("does not mutate the original document", () => {
    const doc = makeDocument()
    removeBlockFromPage(doc, "page-1", "block-a")
    expect(doc.pages[0]!.items).toHaveLength(2)
  })

  it("is a no-op if blockId is not found", () => {
    const doc = makeDocument()
    const result = removeBlockFromPage(doc, "page-1", "nonexistent")
    expect(result.pages[0]!.items).toHaveLength(2)
  })

  it("removes a block from inside an HStack column", () => {
    const row: HStackRow = {
      id: "row-1",
      type: "hstack",
      columns: [
        { id: "col-a", widthPercent: 50, blocks: [makeTextBlock("nested-1", "Inside")] },
        { id: "col-b", widthPercent: 50, blocks: [] },
      ],
    }
    const doc = makeDocument({
      pages: [{ id: "page-1", items: [makeTextBlock("top"), row] }],
    })

    const result = removeBlockFromPage(doc, "page-1", "nested-1")
    const resultRow = result.pages[0]!.items[1] as HStackRow
    expect(resultRow.columns[0]!.blocks).toHaveLength(0)
    // top-level block still exists
    expect(result.pages[0]!.items[0]!.id).toBe("top")
  })
})

describe("updateBlock", () => {
  it("merges updates into the target block", () => {
    const doc = makeDocument()
    const result = updateBlock(doc, "page-1", "block-a", { content: "Updated" })
    const updated = result.pages[0]!.items[0] as TextBlock

    expect(updated.content).toBe("Updated")
    expect(updated.type).toBe("text")
  })

  it("does not mutate the original document", () => {
    const doc = makeDocument()
    updateBlock(doc, "page-1", "block-a", { content: "Updated" })
    expect((doc.pages[0]!.items[0] as TextBlock).content).toBe("Hello")
  })

  it("leaves other blocks unchanged", () => {
    const doc = makeDocument()
    const result = updateBlock(doc, "page-1", "block-a", { content: "Updated" })
    expect((result.pages[0]!.items[1] as TextBlock).content).toBe("World")
  })

  it("updates a block inside an HStack column", () => {
    const row: HStackRow = {
      id: "row-1",
      type: "hstack",
      columns: [
        { id: "col-a", widthPercent: 50, blocks: [makeTextBlock("nested-1", "Original")] },
        { id: "col-b", widthPercent: 50, blocks: [] },
      ],
    }
    const doc = makeDocument({
      pages: [{ id: "page-1", items: [row] }],
    })

    const result = updateBlock(doc, "page-1", "nested-1", { content: "Changed" })
    const resultRow = result.pages[0]!.items[0] as HStackRow
    expect((resultRow.columns[0]!.blocks[0] as TextBlock).content).toBe("Changed")
  })
})

describe("moveBlock", () => {
  it("moves a block to a new index", () => {
    const doc = makeDocument({
      pages: [
        {
          id: "page-1",
          items: [
            makeTextBlock("a"),
            makeTextBlock("b"),
            makeTextBlock("c"),
          ],
        },
      ],
    })
    const result = moveBlock(doc, "page-1", "a", 2)
    const ids = result.pages[0]!.items.map((b) => b.id)

    expect(ids).toEqual(["b", "c", "a"])
  })

  it("clamps to the end if newIndex exceeds array length", () => {
    const doc = makeDocument()
    const result = moveBlock(doc, "page-1", "block-a", 100)
    const ids = result.pages[0]!.items.map((b) => b.id)

    expect(ids).toEqual(["block-b", "block-a"])
  })

  it("clamps to 0 if newIndex is negative", () => {
    const doc = makeDocument()
    const result = moveBlock(doc, "page-1", "block-b", -5)
    const ids = result.pages[0]!.items.map((b) => b.id)

    expect(ids).toEqual(["block-b", "block-a"])
  })

  it("is a no-op if blockId is not found", () => {
    const doc = makeDocument()
    const result = moveBlock(doc, "page-1", "nonexistent", 0)
    expect(result.pages[0]!.items).toHaveLength(2)
  })

  it("does not mutate the original document", () => {
    const doc = makeDocument()
    moveBlock(doc, "page-1", "block-a", 1)
    expect(doc.pages[0]!.items[0]!.id).toBe("block-a")
  })
})

describe("addPage", () => {
  it("appends a new empty page", () => {
    const doc = makeDocument()
    const result = addPage(doc)

    expect(result.pages).toHaveLength(2)
    expect(result.pages[1]!.items).toHaveLength(0)
    expect(result.pages[1]!.id).toBeTruthy()
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
        { id: "page-1", items: [] },
        { id: "page-2", items: [] },
      ],
    })
    const result = removePage(doc, "page-1")

    expect(result.pages).toHaveLength(1)
    expect(result.pages[0]!.id).toBe("page-2")
  })

  it("does not mutate the original document", () => {
    const doc = makeDocument({
      pages: [
        { id: "page-1", items: [] },
        { id: "page-2", items: [] },
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
        { id: "page-1", items: [makeTextBlock("a")] },
        { id: "page-2", items: [] },
      ],
    })
    const result = duplicatePage(doc, "page-1")

    expect(result.pages).toHaveLength(3)
    // Duplicate is at index 1
    expect(result.pages[1]!.id).not.toBe("page-1")
    expect(result.pages[1]!.items).toHaveLength(1)
    // Original page-2 shifts to index 2
    expect(result.pages[2]!.id).toBe("page-2")
  })

  it("generates new ids for the duplicated page and its items", () => {
    const doc = makeDocument()
    const result = duplicatePage(doc, "page-1")
    const dup = result.pages[1]!

    expect(dup.id).not.toBe("page-1")
    expect(dup.items[0]!.id).not.toBe("block-a")
    expect(dup.items[1]!.id).not.toBe("block-b")
  })

  it("deep-duplicates HStack rows with new IDs for columns and nested blocks", () => {
    const row: HStackRow = {
      id: "row-1",
      type: "hstack",
      columns: [
        { id: "col-a", widthPercent: 50, blocks: [makeTextBlock("nested-1")] },
        { id: "col-b", widthPercent: 50, blocks: [] },
      ],
    }
    const doc = makeDocument({
      pages: [{ id: "page-1", items: [row] }],
    })

    const result = duplicatePage(doc, "page-1")
    const dupRow = result.pages[1]!.items[0] as HStackRow

    expect(dupRow.id).not.toBe("row-1")
    expect(dupRow.type).toBe("hstack")
    expect(dupRow.columns[0]!.id).not.toBe("col-a")
    expect(dupRow.columns[0]!.blocks[0]!.id).not.toBe("nested-1")
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
          items: [makeTextBlock("tmpl-block-1", "Template text")],
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
    expect(result.pages[0]!.id).not.toBe("tmpl-page-1")
    expect(result.pages[0]!.items[0]!.id).not.toBe("tmpl-block-1")
  })

  it("handles legacy templates that use blocks instead of items", () => {
    const legacyTemplate = {
      id: "tmpl-legacy",
      name: "Legacy Template",
      description: "Uses blocks",
      category: "built-in" as const,
      settings: { layout: "portrait" as const, size: "letter" as const, fontFamily: "Inter" },
      pages: [
        {
          id: "p1",
          blocks: [makeTextBlock("b1", "Legacy content")],
        },
      ],
    }

    const result = applyTemplate(legacyTemplate as unknown as ExportTemplate)
    expect(result.pages).toHaveLength(1)
    expect(result.pages[0]!.items).toHaveLength(1)
  })

  it("does not mutate the template", () => {
    const template: ExportTemplate = {
      id: "tmpl-1",
      name: "Test Template",
      description: "A test",
      category: "built-in",
      settings: { layout: "portrait", size: "letter", fontFamily: "Inter" },
      pages: [
        { id: "p1", items: [makeTextBlock("b1")] },
      ],
    }

    applyTemplate(template)
    expect(template.pages[0]!.id).toBe("p1")
    expect(template.pages[0]!.items[0]!.id).toBe("b1")
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

// ---------------------------------------------------------------------------
// HStack operations
// ---------------------------------------------------------------------------

describe("addHStackRow", () => {
  it("creates a 2-column 50/50 row", () => {
    const doc = makeDocument()
    const result = addHStackRow(doc, "page-1")

    expect(result.pages[0]!.items).toHaveLength(3) // 2 blocks + 1 HStack
    const row = result.pages[0]!.items[2]!
    expect(isHStackRow(row)).toBe(true)
    if (isHStackRow(row)) {
      expect(row.columns).toHaveLength(2)
      expect(row.columns[0]!.widthPercent).toBe(50)
      expect(row.columns[1]!.widthPercent).toBe(50)
      expect(row.columns[0]!.blocks).toHaveLength(0)
      expect(row.columns[1]!.blocks).toHaveLength(0)
    }
  })

  it("does not mutate the original document", () => {
    const doc = makeDocument()
    addHStackRow(doc, "page-1")
    expect(doc.pages[0]!.items).toHaveLength(2)
  })

  it("sets updatedAt", () => {
    const doc = makeDocument()
    const result = addHStackRow(doc, "page-1")
    expect(result.updatedAt).toBe("2026-06-15T12:00:00.000Z")
  })
})

describe("addColumnToRow", () => {
  it("adds a column and redistributes widths equally", () => {
    const doc = makeDocument({
      pages: [{ id: "page-1", items: [makeHStackRow("row-1", "col-a", "col-b")] }],
    })
    const result = addColumnToRow(doc, "page-1", "row-1")
    const row = result.pages[0]!.items[0] as HStackRow

    expect(row.columns).toHaveLength(3)
    // distributeWidths gives remainder to last column: floor(100/3)=33, remainder=1
    expect(row.columns[0]!.widthPercent).toBe(33)
    expect(row.columns[1]!.widthPercent).toBe(33)
    expect(row.columns[2]!.widthPercent).toBe(34)
  })

  it("caps at 4 columns", () => {
    const fourColRow: HStackRow = {
      id: "row-1",
      type: "hstack",
      columns: [
        { id: "c1", widthPercent: 25, blocks: [] },
        { id: "c2", widthPercent: 25, blocks: [] },
        { id: "c3", widthPercent: 25, blocks: [] },
        { id: "c4", widthPercent: 25, blocks: [] },
      ],
    }
    const doc = makeDocument({
      pages: [{ id: "page-1", items: [fourColRow] }],
    })
    const result = addColumnToRow(doc, "page-1", "row-1")
    const row = result.pages[0]!.items[0] as HStackRow

    expect(row.columns).toHaveLength(4) // unchanged
  })

  it("does not mutate the original document", () => {
    const doc = makeDocument({
      pages: [{ id: "page-1", items: [makeHStackRow("row-1", "col-a", "col-b")] }],
    })
    addColumnToRow(doc, "page-1", "row-1")
    const row = doc.pages[0]!.items[0] as HStackRow
    expect(row.columns).toHaveLength(2)
  })
})

describe("removeColumnFromRow", () => {
  it("removes a column and redistributes widths", () => {
    const threeColRow: HStackRow = {
      id: "row-1",
      type: "hstack",
      columns: [
        { id: "c1", widthPercent: 33, blocks: [] },
        { id: "c2", widthPercent: 33, blocks: [] },
        { id: "c3", widthPercent: 33, blocks: [] },
      ],
    }
    const doc = makeDocument({
      pages: [{ id: "page-1", items: [threeColRow] }],
    })
    const result = removeColumnFromRow(doc, "page-1", "row-1", "c2")
    const row = result.pages[0]!.items[0] as HStackRow

    expect(row.columns).toHaveLength(2)
    expect(row.columns[0]!.widthPercent).toBe(50)
    expect(row.columns[1]!.widthPercent).toBe(50)
    expect(row.columns[0]!.id).toBe("c1")
    expect(row.columns[1]!.id).toBe("c3")
  })

  it("removes the entire row when the last column is removed", () => {
    const singleColRow: HStackRow = {
      id: "row-1",
      type: "hstack",
      columns: [{ id: "c1", widthPercent: 100, blocks: [] }],
    }
    const doc = makeDocument({
      pages: [{ id: "page-1", items: [makeTextBlock("top"), singleColRow] }],
    })
    const result = removeColumnFromRow(doc, "page-1", "row-1", "c1")

    expect(result.pages[0]!.items).toHaveLength(1)
    expect(result.pages[0]!.items[0]!.id).toBe("top")
  })

  it("does not mutate the original document", () => {
    const doc = makeDocument({
      pages: [{ id: "page-1", items: [makeHStackRow("row-1", "col-a", "col-b")] }],
    })
    removeColumnFromRow(doc, "page-1", "row-1", "col-a")
    const row = doc.pages[0]!.items[0] as HStackRow
    expect(row.columns).toHaveLength(2)
  })
})

describe("resizeColumns", () => {
  it("sets widths when sum is 100 and each >= 15", () => {
    const doc = makeDocument({
      pages: [{ id: "page-1", items: [makeHStackRow("row-1", "col-a", "col-b")] }],
    })
    const result = resizeColumns(doc, "page-1", "row-1", {
      "col-a": 70,
      "col-b": 30,
    })
    const row = result.pages[0]!.items[0] as HStackRow

    expect(row.columns[0]!.widthPercent).toBe(70)
    expect(row.columns[1]!.widthPercent).toBe(30)
  })

  it("rejects widths that do not sum to 100", () => {
    const doc = makeDocument({
      pages: [{ id: "page-1", items: [makeHStackRow("row-1", "col-a", "col-b")] }],
    })
    const result = resizeColumns(doc, "page-1", "row-1", {
      "col-a": 60,
      "col-b": 60,
    })
    // Unchanged — original widths
    const row = result.pages[0]!.items[0] as HStackRow
    expect(row.columns[0]!.widthPercent).toBe(50)
    expect(row.columns[1]!.widthPercent).toBe(50)
  })

  it("rejects widths below 15%", () => {
    const doc = makeDocument({
      pages: [{ id: "page-1", items: [makeHStackRow("row-1", "col-a", "col-b")] }],
    })
    const result = resizeColumns(doc, "page-1", "row-1", {
      "col-a": 90,
      "col-b": 10,
    })
    // Unchanged
    const row = result.pages[0]!.items[0] as HStackRow
    expect(row.columns[0]!.widthPercent).toBe(50)
  })

  it("does not mutate the original document", () => {
    const doc = makeDocument({
      pages: [{ id: "page-1", items: [makeHStackRow("row-1", "col-a", "col-b")] }],
    })
    resizeColumns(doc, "page-1", "row-1", { "col-a": 70, "col-b": 30 })
    const row = doc.pages[0]!.items[0] as HStackRow
    expect(row.columns[0]!.widthPercent).toBe(50)
  })
})

describe("addBlockToColumn", () => {
  it("adds a block to the specified column", () => {
    const doc = makeDocument({
      pages: [{ id: "page-1", items: [makeHStackRow("row-1", "col-a", "col-b")] }],
    })
    const block = makeTextBlock("new-block", "Inside column")
    const result = addBlockToColumn(doc, "page-1", "row-1", "col-a", block)
    const row = result.pages[0]!.items[0] as HStackRow

    expect(row.columns[0]!.blocks).toHaveLength(1)
    expect(row.columns[0]!.blocks[0]!.id).toBe("new-block")
    expect(row.columns[1]!.blocks).toHaveLength(0) // other column untouched
  })

  it("appends to existing blocks", () => {
    const rowWithBlock: HStackRow = {
      id: "row-1",
      type: "hstack",
      columns: [
        { id: "col-a", widthPercent: 50, blocks: [makeTextBlock("existing")] },
        { id: "col-b", widthPercent: 50, blocks: [] },
      ],
    }
    const doc = makeDocument({
      pages: [{ id: "page-1", items: [rowWithBlock] }],
    })
    const result = addBlockToColumn(doc, "page-1", "row-1", "col-a", makeTextBlock("new"))
    const row = result.pages[0]!.items[0] as HStackRow

    expect(row.columns[0]!.blocks).toHaveLength(2)
    expect(row.columns[0]!.blocks[0]!.id).toBe("existing")
    expect(row.columns[0]!.blocks[1]!.id).toBe("new")
  })

  it("does not mutate the original document", () => {
    const doc = makeDocument({
      pages: [{ id: "page-1", items: [makeHStackRow("row-1", "col-a", "col-b")] }],
    })
    addBlockToColumn(doc, "page-1", "row-1", "col-a", makeTextBlock("new"))
    const row = doc.pages[0]!.items[0] as HStackRow
    expect(row.columns[0]!.blocks).toHaveLength(0)
  })
})

describe("moveBlockBetweenColumns", () => {
  it("moves a block from one column to another", () => {
    const row: HStackRow = {
      id: "row-1",
      type: "hstack",
      columns: [
        { id: "col-a", widthPercent: 50, blocks: [makeTextBlock("b1"), makeTextBlock("b2")] },
        { id: "col-b", widthPercent: 50, blocks: [makeTextBlock("b3")] },
      ],
    }
    const doc = makeDocument({
      pages: [{ id: "page-1", items: [row] }],
    })

    const result = moveBlockBetweenColumns(doc, "page-1", "row-1", "col-a", "b1", "col-b", 0)
    const resultRow = result.pages[0]!.items[0] as HStackRow

    expect(resultRow.columns[0]!.blocks).toHaveLength(1)
    expect(resultRow.columns[0]!.blocks[0]!.id).toBe("b2")
    expect(resultRow.columns[1]!.blocks).toHaveLength(2)
    expect(resultRow.columns[1]!.blocks[0]!.id).toBe("b1")
    expect(resultRow.columns[1]!.blocks[1]!.id).toBe("b3")
  })

  it("moves a block within the same column (reorder)", () => {
    const row: HStackRow = {
      id: "row-1",
      type: "hstack",
      columns: [
        { id: "col-a", widthPercent: 50, blocks: [makeTextBlock("b1"), makeTextBlock("b2"), makeTextBlock("b3")] },
        { id: "col-b", widthPercent: 50, blocks: [] },
      ],
    }
    const doc = makeDocument({
      pages: [{ id: "page-1", items: [row] }],
    })

    const result = moveBlockBetweenColumns(doc, "page-1", "row-1", "col-a", "b1", "col-a", 2)
    const resultRow = result.pages[0]!.items[0] as HStackRow

    expect(resultRow.columns[0]!.blocks.map((b) => b.id)).toEqual(["b2", "b3", "b1"])
  })

  it("is a no-op if source block is not found", () => {
    const doc = makeDocument({
      pages: [{ id: "page-1", items: [makeHStackRow("row-1", "col-a", "col-b")] }],
    })
    const result = moveBlockBetweenColumns(doc, "page-1", "row-1", "col-a", "nonexistent", "col-b", 0)
    const resultRow = result.pages[0]!.items[0] as HStackRow
    expect(resultRow.columns[0]!.blocks).toHaveLength(0)
  })

  it("does not mutate the original document", () => {
    const row: HStackRow = {
      id: "row-1",
      type: "hstack",
      columns: [
        { id: "col-a", widthPercent: 50, blocks: [makeTextBlock("b1")] },
        { id: "col-b", widthPercent: 50, blocks: [] },
      ],
    }
    const doc = makeDocument({
      pages: [{ id: "page-1", items: [row] }],
    })
    moveBlockBetweenColumns(doc, "page-1", "row-1", "col-a", "b1", "col-b", 0)
    const originalRow = doc.pages[0]!.items[0] as HStackRow
    expect(originalRow.columns[0]!.blocks).toHaveLength(1)
  })
})

describe("wrapBlocksInHStack", () => {
  it("wraps target and new block in a 50/50 HStack (position right)", () => {
    const doc = makeDocument({
      pages: [
        {
          id: "page-1",
          items: [makeTextBlock("a", "Alpha"), makeTextBlock("b", "Bravo")],
        },
      ],
    })
    const newBlock = makeTextBlock("c", "Charlie")
    const result = wrapBlocksInHStack(doc, "page-1", "a", newBlock, "right")

    // The first item should now be an HStack
    expect(result.pages[0]!.items).toHaveLength(2) // HStack + block-b
    const row = result.pages[0]!.items[0]!
    expect(isHStackRow(row)).toBe(true)
    if (isHStackRow(row)) {
      expect(row.columns).toHaveLength(2)
      expect(row.columns[0]!.widthPercent).toBe(50)
      expect(row.columns[1]!.widthPercent).toBe(50)
      // Right: target in col 1, new block in col 2
      expect(row.columns[0]!.blocks[0]!.id).toBe("a")
      expect(row.columns[1]!.blocks[0]!.id).toBe("c")
    }
    // Second item is unchanged
    expect(result.pages[0]!.items[1]!.id).toBe("b")
  })

  it("wraps target and new block in a 50/50 HStack (position left)", () => {
    const doc = makeDocument({
      pages: [
        {
          id: "page-1",
          items: [makeTextBlock("a", "Alpha"), makeTextBlock("b", "Bravo")],
        },
      ],
    })
    const newBlock = makeTextBlock("c", "Charlie")
    const result = wrapBlocksInHStack(doc, "page-1", "a", newBlock, "left")

    const row = result.pages[0]!.items[0]!
    expect(isHStackRow(row)).toBe(true)
    if (isHStackRow(row)) {
      // Left: new block in col 1, target in col 2
      expect(row.columns[0]!.blocks[0]!.id).toBe("c")
      expect(row.columns[1]!.blocks[0]!.id).toBe("a")
    }
  })

  it("returns unchanged document if target block is not found", () => {
    const doc = makeDocument()
    const newBlock = makeTextBlock("c", "Charlie")
    const result = wrapBlocksInHStack(doc, "page-1", "nonexistent", newBlock, "right")

    expect(result.pages[0]!.items).toHaveLength(2)
    expect(result.pages[0]!.items[0]!.id).toBe("block-a")
  })

  it("returns unchanged document if target is inside an HStack", () => {
    const row: HStackRow = {
      id: "row-1",
      type: "hstack",
      columns: [
        { id: "col-a", widthPercent: 50, blocks: [makeTextBlock("nested")] },
        { id: "col-b", widthPercent: 50, blocks: [] },
      ],
    }
    const doc = makeDocument({
      pages: [{ id: "page-1", items: [row] }],
    })
    const newBlock = makeTextBlock("c", "Charlie")
    const result = wrapBlocksInHStack(doc, "page-1", "nested", newBlock, "right")

    // Unchanged — nested block is not a top-level standalone
    expect(result.pages[0]!.items).toHaveLength(1)
    expect(isHStackRow(result.pages[0]!.items[0]!)).toBe(true)
  })

  it("does not affect other pages", () => {
    const doc = makeDocument({
      pages: [
        { id: "page-1", items: [makeTextBlock("a")] },
        { id: "page-2", items: [makeTextBlock("x")] },
      ],
    })
    const newBlock = makeTextBlock("c")
    const result = wrapBlocksInHStack(doc, "page-1", "a", newBlock, "right")

    expect(result.pages[1]!.items).toHaveLength(1)
    expect(result.pages[1]!.items[0]!.id).toBe("x")
  })

  it("does not mutate the original document", () => {
    const doc = makeDocument()
    const newBlock = makeTextBlock("c")
    wrapBlocksInHStack(doc, "page-1", "block-a", newBlock, "right")

    expect(doc.pages[0]!.items).toHaveLength(2)
    expect(doc.pages[0]!.items[0]!.id).toBe("block-a")
  })

  it("updates the updatedAt timestamp", () => {
    const doc = makeDocument()
    const result = wrapBlocksInHStack(doc, "page-1", "block-a", makeTextBlock("c"), "right")
    expect(result.updatedAt).toBe("2026-06-15T12:00:00.000Z")
  })

  it("generates unique IDs for the HStack row and columns", () => {
    const doc = makeDocument()
    const result = wrapBlocksInHStack(doc, "page-1", "block-a", makeTextBlock("c"), "right")
    const row = result.pages[0]!.items[0]!
    expect(isHStackRow(row)).toBe(true)
    if (isHStackRow(row)) {
      expect(row.id).toBeTruthy()
      expect(row.columns[0]!.id).toBeTruthy()
      expect(row.columns[1]!.id).toBeTruthy()
      expect(row.columns[0]!.id).not.toBe(row.columns[1]!.id)
    }
  })
})
