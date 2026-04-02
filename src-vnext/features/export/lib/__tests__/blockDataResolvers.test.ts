import { describe, it, expect } from "vitest"
import {
  resolveProductNamesString,
  resolveProductNamesList,
  resolveTalentNames,
  filterShots,
  sortShots,
} from "../blockDataResolvers"
import type { Shot, TalentRecord } from "@/shared/types"

function makeShot(overrides: Partial<Shot> = {}): Shot {
  return {
    id: "s1",
    title: "Test Shot",
    status: "todo",
    shotNumber: 1,
    products: [],
    tags: [],
    ...overrides,
  } as Shot
}

function makeTalent(id: string, name: string): TalentRecord {
  return { id, name } as TalentRecord
}

// ---------------------------------------------------------------------------
// resolveProductNamesString
// ---------------------------------------------------------------------------

describe("resolveProductNamesString", () => {
  it("returns em-dash when shot has no products", () => {
    expect(resolveProductNamesString(makeShot())).toBe("\u2014")
  })

  it("joins product family names with comma", () => {
    const shot = makeShot({
      products: [
        { familyName: "T-Shirt" },
        { familyName: "Hoodie" },
      ] as Shot["products"],
    })
    expect(resolveProductNamesString(shot)).toBe("T-Shirt, Hoodie")
  })

  it("includes look products and deduplicates", () => {
    const shot = makeShot({
      products: [{ familyName: "T-Shirt" }] as Shot["products"],
      looks: [
        { id: "l1", products: [{ familyName: "T-Shirt" }, { familyName: "Jeans" }] },
      ] as unknown as Shot["looks"],
    })
    expect(resolveProductNamesString(shot)).toBe("T-Shirt, Jeans")
  })

  it("filters out null/undefined family names", () => {
    const shot = makeShot({
      products: [
        { familyName: "Valid" },
        { familyName: null },
        { familyName: undefined },
      ] as unknown as Shot["products"],
    })
    expect(resolveProductNamesString(shot)).toBe("Valid")
  })
})

// ---------------------------------------------------------------------------
// resolveProductNamesList
// ---------------------------------------------------------------------------

describe("resolveProductNamesList", () => {
  it("returns empty readonly array when no products", () => {
    const result = resolveProductNamesList(makeShot())
    expect(result).toEqual([])
  })

  it("returns deduplicated readonly array", () => {
    const shot = makeShot({
      products: [
        { familyName: "A" },
        { familyName: "B" },
        { familyName: "A" },
      ] as Shot["products"],
    })
    const result = resolveProductNamesList(shot)
    expect(result).toEqual(["A", "B"])
  })
})

// ---------------------------------------------------------------------------
// resolveTalentNames
// ---------------------------------------------------------------------------

describe("resolveTalentNames", () => {
  it("returns em-dash when shot has no talent", () => {
    expect(resolveTalentNames(makeShot(), [])).toBe("\u2014")
  })

  it("resolves talent by ID lookup", () => {
    const shot = makeShot({ talentIds: ["t1", "t2"] })
    const talent = [makeTalent("t1", "Alice"), makeTalent("t2", "Bob")]
    expect(resolveTalentNames(shot, talent)).toBe("Alice, Bob")
  })

  it("skips dangling talent IDs", () => {
    const shot = makeShot({ talentIds: ["t1", "t-missing"] })
    const talent = [makeTalent("t1", "Alice")]
    expect(resolveTalentNames(shot, talent)).toBe("Alice")
  })

  it("falls back to legacy talent string array", () => {
    const shot = makeShot({ talent: ["Charlie", "Dana"] })
    expect(resolveTalentNames(shot, [])).toBe("Charlie, Dana")
  })

  it("prefers talentIds over legacy talent array", () => {
    const shot = makeShot({
      talentIds: ["t1"],
      talent: ["Legacy Name"],
    })
    const talent = [makeTalent("t1", "Modern Name")]
    expect(resolveTalentNames(shot, talent)).toBe("Modern Name")
  })
})

// ---------------------------------------------------------------------------
// filterShots
// ---------------------------------------------------------------------------

describe("filterShots", () => {
  const shots = [
    makeShot({ id: "s1", status: "todo", tags: [{ id: "tag1", label: "A", color: "gray" }] }),
    makeShot({ id: "s2", status: "in_progress", tags: [{ id: "tag2", label: "B", color: "blue" }] }),
    makeShot({ id: "s3", status: "complete", tags: [] }),
  ] as readonly Shot[]

  it("returns all shots when filter is undefined", () => {
    expect(filterShots(shots, undefined)).toBe(shots)
  })

  it("filters by status", () => {
    const result = filterShots(shots, { status: ["todo"] })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe("s1")
  })

  it("filters by tag IDs", () => {
    const result = filterShots(shots, { tagIds: ["tag2"] })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe("s2")
  })

  it("combines status and tag filters", () => {
    const result = filterShots(shots, { status: ["todo", "in_progress"], tagIds: ["tag1"] })
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe("s1")
  })
})

// ---------------------------------------------------------------------------
// sortShots
// ---------------------------------------------------------------------------

describe("sortShots", () => {
  const shots = [
    makeShot({ id: "s1", shotNumber: "3", title: "Charlie", status: "complete" }),
    makeShot({ id: "s2", shotNumber: "1", title: "Alice", status: "todo" }),
    makeShot({ id: "s3", shotNumber: "2", title: "Bob", status: "in_progress" }),
  ] as readonly Shot[]

  it("returns original array when sortBy is undefined", () => {
    expect(sortShots(shots, undefined, "asc")).toBe(shots)
  })

  it("sorts by shotNumber ascending", () => {
    const result = sortShots(shots, "shotNumber", "asc")
    expect(result.map((s) => s.id)).toEqual(["s2", "s3", "s1"])
  })

  it("sorts by shotNumber descending", () => {
    const result = sortShots(shots, "shotNumber", "desc")
    expect(result.map((s) => s.id)).toEqual(["s1", "s3", "s2"])
  })

  it("sorts by title ascending", () => {
    const result = sortShots(shots, "title", "asc")
    expect(result.map((s) => s.id)).toEqual(["s2", "s3", "s1"])
  })

  it("sorts by status ascending", () => {
    const result = sortShots(shots, "status", "asc")
    expect(result.map((s) => s.id)).toEqual(["s1", "s3", "s2"])
  })

  it("does not mutate the original array", () => {
    const original = [...shots]
    sortShots(shots, "shotNumber", "asc")
    expect(shots).toEqual(original)
  })
})
