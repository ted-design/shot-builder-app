import { describe, expect, it, beforeEach, vi } from "vitest"
import {
  saveDocument,
  loadDocument,
  saveTemplate,
  loadTemplates,
  deleteTemplate,
} from "../documentPersistence"
import type { ExportDocument, ExportTemplate } from "../../types/exportBuilder"

function makeDocument(id = "doc-1"): ExportDocument {
  return {
    id,
    name: "Test Doc",
    pages: [{ id: "page-1", items: [] }],
    settings: { layout: "portrait", size: "letter", fontFamily: "Inter" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }
}

function makeTemplate(id: string, name: string): ExportTemplate {
  return {
    id,
    name,
    description: "Test template",
    category: "saved",
    settings: { layout: "portrait", size: "letter", fontFamily: "Inter" },
    pages: [{ id: "page-1", items: [] }],
  }
}

// Use a real storage map to simulate localStorage
let storage: Map<string, string>

beforeEach(() => {
  storage = new Map()
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
    get length() { return storage.size },
    key: (index: number) => [...storage.keys()][index] ?? null,
  })
})

describe("saveDocument / loadDocument", () => {
  it("saves and loads a document for a project", () => {
    const doc = makeDocument()
    saveDocument("proj-1", doc)
    const loaded = loadDocument("proj-1")

    expect(loaded).toEqual(doc)
  })

  it("returns null when no document has been saved", () => {
    expect(loadDocument("unknown")).toBeNull()
  })

  it("overwrites previous document for the same project", () => {
    saveDocument("proj-1", makeDocument("v1"))
    saveDocument("proj-1", makeDocument("v2"))
    const loaded = loadDocument("proj-1")

    expect(loaded?.id).toBe("v2")
  })

  it("isolates documents by project id", () => {
    saveDocument("proj-1", makeDocument("doc-a"))
    saveDocument("proj-2", makeDocument("doc-b"))

    expect(loadDocument("proj-1")?.id).toBe("doc-a")
    expect(loadDocument("proj-2")?.id).toBe("doc-b")
  })

  it("returns null when localStorage contains invalid JSON", () => {
    storage.set("sb:export-doc:proj-bad", "not-json{{{")
    expect(loadDocument("proj-bad")).toBeNull()
  })

  it("migrates legacy blocks-based documents to items", () => {
    const legacyDoc = {
      id: "doc-legacy",
      name: "Legacy Doc",
      pages: [{ id: "page-1", blocks: [{ id: "b1", type: "text", content: "hello" }] }],
      settings: { layout: "portrait", size: "letter", fontFamily: "Inter" },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    }
    storage.set("sb:export-doc:proj-legacy", JSON.stringify(legacyDoc))
    const loaded = loadDocument("proj-legacy")

    expect(loaded).not.toBeNull()
    expect(loaded!.pages[0]!.items).toHaveLength(1)
    expect(loaded!.pages[0]!.items[0]).toEqual({ id: "b1", type: "text", content: "hello" })
  })
})

describe("saveTemplate / loadTemplates / deleteTemplate", () => {
  it("saves and loads a template", () => {
    const template = makeTemplate("t-1", "Template A")
    saveTemplate(template)
    const loaded = loadTemplates()

    expect(loaded).toHaveLength(1)
    expect(loaded[0]?.name).toBe("Template A")
  })

  it("returns empty array when no templates exist", () => {
    expect(loadTemplates()).toEqual([])
  })

  it("appends multiple templates", () => {
    saveTemplate(makeTemplate("t-1", "A"))
    saveTemplate(makeTemplate("t-2", "B"))
    const loaded = loadTemplates()

    expect(loaded).toHaveLength(2)
  })

  it("replaces a template with the same id (upsert)", () => {
    saveTemplate(makeTemplate("t-1", "Original"))
    saveTemplate({ ...makeTemplate("t-1", "Updated"), description: "Changed" })
    const loaded = loadTemplates()

    expect(loaded).toHaveLength(1)
    expect(loaded[0]?.name).toBe("Updated")
    expect(loaded[0]?.description).toBe("Changed")
  })

  it("deletes a template by id", () => {
    saveTemplate(makeTemplate("t-1", "A"))
    saveTemplate(makeTemplate("t-2", "B"))
    deleteTemplate("t-1")
    const loaded = loadTemplates()

    expect(loaded).toHaveLength(1)
    expect(loaded[0]?.id).toBe("t-2")
  })

  it("is a no-op when deleting a nonexistent template", () => {
    saveTemplate(makeTemplate("t-1", "A"))
    deleteTemplate("nonexistent")
    expect(loadTemplates()).toHaveLength(1)
  })

  it("returns empty array when localStorage contains invalid JSON", () => {
    storage.set("sb:export-templates", "not-json{{{")
    expect(loadTemplates()).toEqual([])
  })
})
