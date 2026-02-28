import { describe, it, expect, vi } from "vitest"
import type { ShotTag } from "@/shared/types"

vi.mock("@/shared/lib/tagCategories", () => ({
  resolveShotTagCategory: (tag: { category?: string }) =>
    tag.category ?? "other",
}))

import { sortTagsByCategory } from "@/shared/lib/tagSort"

function makeTag(overrides: Partial<ShotTag> = {}): ShotTag {
  return {
    id: overrides.id ?? "t1",
    label: overrides.label ?? "Tag",
    color: overrides.color ?? "#333",
    category: overrides.category,
  }
}

describe("sortTagsByCategory", () => {
  it("returns empty array for empty input", () => {
    expect(sortTagsByCategory([])).toEqual([])
  })

  it("returns single tag unchanged", () => {
    const tag = makeTag({ id: "t1", label: "Solo", category: "media" })
    const result = sortTagsByCategory([tag])
    expect(result).toEqual([tag])
  })

  it("sorts priority before gender", () => {
    const gender = makeTag({ id: "g1", label: "Women", category: "gender" })
    const priority = makeTag({
      id: "p1",
      label: "Urgent",
      category: "priority",
    })
    const result = sortTagsByCategory([gender, priority])
    expect(result[0]!.id).toBe("p1")
    expect(result[1]!.id).toBe("g1")
  })

  it("sorts gender before media", () => {
    const media = makeTag({ id: "m1", label: "Video", category: "media" })
    const gender = makeTag({ id: "g1", label: "Men", category: "gender" })
    const result = sortTagsByCategory([media, gender])
    expect(result[0]!.id).toBe("g1")
    expect(result[1]!.id).toBe("m1")
  })

  it("sorts media before other", () => {
    const other = makeTag({ id: "o1", label: "Misc", category: "other" })
    const media = makeTag({ id: "m1", label: "Photo", category: "media" })
    const result = sortTagsByCategory([other, media])
    expect(result[0]!.id).toBe("m1")
    expect(result[1]!.id).toBe("o1")
  })

  it("full sort: priority -> gender -> media -> other", () => {
    const other = makeTag({ id: "o1", label: "Misc", category: "other" })
    const media = makeTag({ id: "m1", label: "Photo", category: "media" })
    const priority = makeTag({
      id: "p1",
      label: "Urgent",
      category: "priority",
    })
    const gender = makeTag({ id: "g1", label: "Women", category: "gender" })
    const result = sortTagsByCategory([other, media, priority, gender])
    expect(result.map((t) => t.id)).toEqual(["p1", "g1", "m1", "o1"])
  })

  it("tags with undefined category treated as 'other' (sorted last)", () => {
    const noCategory = makeTag({ id: "n1", label: "No Cat" })
    const priority = makeTag({
      id: "p1",
      label: "Urgent",
      category: "priority",
    })
    const result = sortTagsByCategory([noCategory, priority])
    expect(result[0]!.id).toBe("p1")
    expect(result[1]!.id).toBe("n1")
  })

  it("preserves original order within same category (stable sort)", () => {
    const a = makeTag({ id: "a", label: "Alpha", category: "gender" })
    const b = makeTag({ id: "b", label: "Bravo", category: "gender" })
    const c = makeTag({ id: "c", label: "Charlie", category: "gender" })
    const result = sortTagsByCategory([a, b, c])
    expect(result.map((t) => t.id)).toEqual(["a", "b", "c"])
  })

  it("does not mutate the original array", () => {
    const tags: readonly ShotTag[] = [
      makeTag({ id: "o1", label: "Other", category: "other" }),
      makeTag({ id: "p1", label: "Priority", category: "priority" }),
    ]
    const result = sortTagsByCategory(tags)
    // Result should be sorted differently than input
    expect(result[0]!.id).toBe("p1")
    // Original array unchanged
    expect(tags[0]!.id).toBe("o1")
    // Result is a new array
    expect(result).not.toBe(tags)
  })
})
