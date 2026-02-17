import { describe, expect, it } from "vitest"
import { extractReferenceLinkSuggestionsFromNotes } from "@/features/shots/lib/notesLinkMigration"

describe("notesLinkMigration", () => {
  it("extracts normalized link suggestions from notes text", () => {
    const result = extractReferenceLinkSuggestionsFromNotes({
      notesAddendum: "Refs: www.example.com and https://loom.com/share/abc.",
      existingLinks: [],
    })

    expect(result).toEqual([
      {
        id: "notes-link-1",
        title: "example.com",
        url: "https://www.example.com/",
        type: "web",
      },
      {
        id: "notes-link-2",
        title: "loom.com",
        url: "https://loom.com/share/abc",
        type: "video",
      },
    ])
  })

  it("filters out already-linked urls and duplicates", () => {
    const result = extractReferenceLinkSuggestionsFromNotes({
      notesAddendum: "https://example.com/a https://example.com/a",
      existingLinks: [
        {
          id: "lk-1",
          title: "A",
          url: "https://example.com/a",
          type: "web",
        },
      ],
    })
    expect(result).toEqual([])
  })

  it("returns empty when notes are missing", () => {
    expect(
      extractReferenceLinkSuggestionsFromNotes({
        notesAddendum: null,
        existingLinks: [],
      }),
    ).toEqual([])
  })
})

