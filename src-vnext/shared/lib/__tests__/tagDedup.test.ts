import { describe, it, expect } from "vitest"
import {
  normalizeTagLabel,
  findCanonicalTag,
  canonicalizeTag,
  deduplicateTags,
} from "../tagDedup"
import type { ShotTag } from "@/shared/types"

describe("normalizeTagLabel", () => {
  it("lowercases and trims", () => {
    expect(normalizeTagLabel("  Men  ")).toBe("men")
  })

  it("collapses internal whitespace", () => {
    expect(normalizeTagLabel("High   Priority")).toBe("high priority")
  })

  it("handles mixed case", () => {
    expect(normalizeTagLabel("WOMEN")).toBe("women")
  })

  it("handles tabs and newlines", () => {
    expect(normalizeTagLabel(" \t Men \n ")).toBe("men")
  })

  it("returns empty string for empty input", () => {
    expect(normalizeTagLabel("")).toBe("")
    expect(normalizeTagLabel("   ")).toBe("")
  })
})

describe("findCanonicalTag", () => {
  it("returns default tag for 'Men'", () => {
    const result = findCanonicalTag("Men")
    expect(result).not.toBeNull()
    expect(result!.id).toBe("default-gender-men")
    expect(result!.label).toBe("Men")
    expect(result!.color).toBe("blue")
    expect(result!.category).toBe("gender")
  })

  it("is case-insensitive", () => {
    const result = findCanonicalTag("women")
    expect(result).not.toBeNull()
    expect(result!.id).toBe("default-gender-women")
  })

  it("handles whitespace variations", () => {
    const result = findCanonicalTag("  High   Priority  ")
    expect(result).not.toBeNull()
    expect(result!.id).toBe("default-priority-high")
  })

  it("returns null for non-default labels", () => {
    expect(findCanonicalTag("Custom Tag")).toBeNull()
    expect(findCanonicalTag("Lifestyle")).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(findCanonicalTag("")).toBeNull()
  })
})

describe("canonicalizeTag", () => {
  it("replaces random ID with default ID when label matches", () => {
    const tag: ShotTag = {
      id: "tag-12345-abc",
      label: "Men",
      color: "gray",
      category: "other",
    }
    const result = canonicalizeTag(tag)
    expect(result.id).toBe("default-gender-men")
    expect(result.color).toBe("blue")
    expect(result.category).toBe("gender")
    expect(result.label).toBe("Men")
  })

  it("preserves custom tag when no default match", () => {
    const tag: ShotTag = {
      id: "tag-custom-123",
      label: "Lifestyle",
      color: "emerald",
      category: "other",
    }
    const result = canonicalizeTag(tag)
    expect(result.id).toBe("tag-custom-123")
    expect(result.label).toBe("Lifestyle")
    expect(result.color).toBe("emerald")
    expect(result.category).toBe("other")
  })

  it("trims whitespace on custom tags", () => {
    const tag: ShotTag = {
      id: "tag-abc",
      label: "  Outdoor  Shot  ",
      color: "green",
    }
    const result = canonicalizeTag(tag)
    expect(result.label).toBe("Outdoor Shot")
  })
})

describe("deduplicateTags", () => {
  it("returns unchanged array when no duplicates", () => {
    const tags: ShotTag[] = [
      { id: "default-gender-men", label: "Men", color: "blue", category: "gender" },
      { id: "default-media-photo", label: "Photo", color: "emerald", category: "media" },
    ]
    const result = deduplicateTags(tags)
    expect(result).toHaveLength(2)
    expect(result[0]!.id).toBe("default-gender-men")
    expect(result[1]!.id).toBe("default-media-photo")
  })

  it("deduplicates by label, preferring default IDs", () => {
    const tags: ShotTag[] = [
      { id: "tag-random-123", label: "Men", color: "gray", category: "other" },
      { id: "default-gender-men", label: "Men", color: "blue", category: "gender" },
    ]
    const result = deduplicateTags(tags)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe("default-gender-men")
    expect(result[0]!.color).toBe("blue")
    expect(result[0]!.category).toBe("gender")
  })

  it("keeps canonical version even when random ID comes first", () => {
    const tags: ShotTag[] = [
      { id: "tag-random-abc", label: "Women", color: "red" },
      { id: "tag-another-xyz", label: "Women", color: "green" },
    ]
    const result = deduplicateTags(tags)
    expect(result).toHaveLength(1)
    // Both are non-default IDs, but canonicalizeTag will find the default
    expect(result[0]!.id).toBe("default-gender-women")
  })

  it("is case-insensitive", () => {
    const tags: ShotTag[] = [
      { id: "tag-1", label: "MEN", color: "blue" },
      { id: "tag-2", label: "men", color: "gray" },
    ]
    const result = deduplicateTags(tags)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe("default-gender-men")
  })

  it("handles empty input", () => {
    expect(deduplicateTags([])).toHaveLength(0)
  })

  it("preserves order of first occurrence", () => {
    const tags: ShotTag[] = [
      { id: "default-media-photo", label: "Photo", color: "emerald", category: "media" },
      { id: "default-gender-men", label: "Men", color: "blue", category: "gender" },
      { id: "tag-dup", label: "Photo", color: "gray" },
    ]
    const result = deduplicateTags(tags)
    expect(result).toHaveLength(2)
    expect(result[0]!.label).toBe("Photo")
    expect(result[1]!.label).toBe("Men")
  })
})
