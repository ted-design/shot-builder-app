import { describe, expect, it } from "vitest"
import {
  inferReferenceLinkType,
  normalizeReferenceLinkType,
  normalizeReferenceLinks,
  normalizeReferenceLinkUrl,
} from "@/features/shots/lib/referenceLinks"

describe("referenceLinks", () => {
  it("normalizes links without protocol to https", () => {
    expect(normalizeReferenceLinkUrl("example.com/page")).toBe("https://example.com/page")
  })

  it("rejects unsupported protocols", () => {
    expect(normalizeReferenceLinkUrl("javascript:alert(1)")).toBeNull()
  })

  it("infers video link types from common video hosts", () => {
    expect(inferReferenceLinkType("https://www.youtube.com/watch?v=abc")).toBe("video")
  })

  it("infers document links from file extension", () => {
    expect(inferReferenceLinkType("https://cdn.example.com/lookbook.pdf")).toBe("document")
  })

  it("uses explicit type when valid", () => {
    expect(normalizeReferenceLinkType("document", "https://example.com/file.pdf")).toBe("document")
  })

  it("normalizes structured link arrays and drops invalid entries", () => {
    const normalized = normalizeReferenceLinks([
      {
        id: "lk-1",
        title: "Campaign Board",
        url: "https://example.com/board",
        type: "web",
      },
      {
        title: "No URL",
      },
      {
        id: "lk-2",
        url: "loom.com/share/abc",
      },
    ])

    expect(normalized).toEqual([
      {
        id: "lk-1",
        title: "Campaign Board",
        url: "https://example.com/board",
        type: "web",
      },
      {
        id: "lk-2",
        title: "loom.com",
        url: "https://loom.com/share/abc",
        type: "video",
      },
    ])
  })
})

