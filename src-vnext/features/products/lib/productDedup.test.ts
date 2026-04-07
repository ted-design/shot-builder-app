import { describe, expect, it } from "vitest"
import type { ProductFamily } from "@/shared/types"
import {
  detectDuplicates,
  normalizeStyleNumber,
  normalizeProductName,
  baseColorName,
  levenshtein,
} from "./productDedup"

// ---------------------------------------------------------------------------
// Factory helpers
// ---------------------------------------------------------------------------

function makeFamily(
  overrides: Partial<ProductFamily> & { id: string; styleName: string },
): ProductFamily {
  return {
    clientId: "c1",
    status: "active",
    sizes: [],
    ...overrides,
  } as unknown as ProductFamily
}

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

describe("normalizeStyleNumber", () => {
  it("uppercases and strips dashes/underscores/spaces", () => {
    expect(normalizeStyleNumber("ab-12_34 cd")).toBe("AB1234CD")
  })

  it("returns empty string for undefined", () => {
    expect(normalizeStyleNumber(undefined)).toBe("")
  })

  it("trims whitespace", () => {
    expect(normalizeStyleNumber("  ABC  ")).toBe("ABC")
  })
})

describe("normalizeProductName", () => {
  it("lowercases and normalizes quotes and whitespace", () => {
    expect(normalizeProductName("  Men\u2019s  Polo  ")).toBe("men's polo")
  })

  it("normalizes straight single quotes", () => {
    expect(normalizeProductName("Men\u2018s")).toBe("men's")
  })
})

describe("baseColorName", () => {
  it("strips vendor code suffix", () => {
    expect(baseColorName("Black (0101)")).toBe("black")
  })

  it("handles colors without suffix", () => {
    expect(baseColorName("White")).toBe("white")
  })

  it("strips complex vendor codes", () => {
    expect(baseColorName("Navy (2432)")).toBe("navy")
  })

  it("returns empty string for undefined", () => {
    expect(baseColorName(undefined)).toBe("")
  })

  it("trims leading/trailing spaces", () => {
    expect(baseColorName("  Red  ")).toBe("red")
  })
})

describe("levenshtein", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshtein("abc", "abc")).toBe(0)
  })

  it("returns length of other string when one is empty", () => {
    expect(levenshtein("", "abc")).toBe(3)
    expect(levenshtein("abc", "")).toBe(3)
  })

  it("computes distance for single-char difference", () => {
    expect(levenshtein("kitten", "sitten")).toBe(1)
  })

  it("computes distance for multi-char differences", () => {
    expect(levenshtein("polo shirt", "polo shirts")).toBe(1)
  })

  it("distance of 3 is within fuzzy threshold", () => {
    expect(levenshtein("henley", "henle")).toBe(1)
    expect(levenshtein("tshirt", "t-shirt")).toBeLessThanOrEqual(3)
  })
})

// ---------------------------------------------------------------------------
// detectDuplicates
// ---------------------------------------------------------------------------

describe("detectDuplicates", () => {
  it("detects two families with same styleNumber and similar names", () => {
    const families = [
      makeFamily({ id: "f1", styleName: "Merino Polo", styleNumber: "AB-123" }),
      makeFamily({ id: "f2", styleName: "Merino Polo", styleNumber: "AB123" }),
    ]
    const result = detectDuplicates(families)
    expect(result).toHaveLength(1)
    expect(result[0]!.key).toBe("AB123")
    expect(result[0]!.families).toHaveLength(2)
  })

  it("does not detect families with different styleNumbers", () => {
    const families = [
      makeFamily({ id: "f1", styleName: "Merino Polo", styleNumber: "AB-123" }),
      makeFamily({ id: "f2", styleName: "Merino Polo", styleNumber: "XY-999" }),
    ]
    const result = detectDuplicates(families)
    expect(result).toHaveLength(0)
  })

  it("excludes deleted families", () => {
    const families = [
      makeFamily({ id: "f1", styleName: "Merino Polo", styleNumber: "AB-123" }),
      makeFamily({ id: "f2", styleName: "Merino Polo", styleNumber: "AB123", deleted: true }),
    ]
    const result = detectDuplicates(families)
    expect(result).toHaveLength(0)
  })

  it("excludes archived families", () => {
    const families = [
      makeFamily({ id: "f1", styleName: "Merino Polo", styleNumber: "AB-123" }),
      makeFamily({ id: "f2", styleName: "Merino Polo", styleNumber: "AB123", archived: true }),
    ]
    const result = detectDuplicates(families)
    expect(result).toHaveLength(0)
  })

  it("detects groups with 3+ duplicates", () => {
    const families = [
      makeFamily({ id: "f1", styleName: "Henley", styleNumber: "HN-100" }),
      makeFamily({ id: "f2", styleName: "Henley", styleNumber: "HN100" }),
      makeFamily({ id: "f3", styleName: "Henley", styleNumber: "HN 100" }),
    ]
    const result = detectDuplicates(families)
    expect(result).toHaveLength(1)
    expect(result[0]!.families).toHaveLength(3)
  })

  it("does not group families with same styleNumber but very different names", () => {
    const families = [
      makeFamily({ id: "f1", styleName: "Merino Polo", styleNumber: "AB-123" }),
      makeFamily({ id: "f2", styleName: "Cotton Jogger", styleNumber: "AB123" }),
    ]
    const result = detectDuplicates(families)
    expect(result).toHaveLength(0)
  })

  it("groups families with slightly different names (within Levenshtein 3)", () => {
    const families = [
      makeFamily({ id: "f1", styleName: "Merino Polo", styleNumber: "AB-123" }),
      makeFamily({ id: "f2", styleName: "Merino Polos", styleNumber: "AB123" }),
    ]
    const result = detectDuplicates(families)
    expect(result).toHaveLength(1)
  })

  it("computes field differences for category mismatch", () => {
    const families = [
      makeFamily({
        id: "f1",
        styleName: "Merino Polo",
        styleNumber: "AB-123",
        category: "Tops",
      }),
      makeFamily({
        id: "f2",
        styleName: "Merino Polo",
        styleNumber: "AB123",
        category: "Knits",
      }),
    ]
    const result = detectDuplicates(families)
    expect(result).toHaveLength(1)
    const catDiff = result[0]!.differences.find((d) => d.field === "category")
    expect(catDiff).toBeDefined()
    expect(catDiff!.values).toHaveLength(2)
    expect(catDiff!.values.map((v) => v.value)).toContain("Tops")
    expect(catDiff!.values.map((v) => v.value)).toContain("Knits")
  })

  it("computes field differences for gender mismatch", () => {
    const families = [
      makeFamily({
        id: "f1",
        styleName: "Merino Polo",
        styleNumber: "AB-123",
        gender: "Men",
      }),
      makeFamily({
        id: "f2",
        styleName: "Merino Polo",
        styleNumber: "AB123",
        gender: "Women",
      }),
    ]
    const result = detectDuplicates(families)
    const genderDiff = result[0]!.differences.find((d) => d.field === "gender")
    expect(genderDiff).toBeDefined()
    expect(genderDiff!.values.map((v) => v.value)).toEqual(["Men", "Women"])
  })

  it("does not report differences when all fields match", () => {
    const families = [
      makeFamily({
        id: "f1",
        styleName: "Merino Polo",
        styleNumber: "AB-123",
        category: "Tops",
        gender: "Men",
      }),
      makeFamily({
        id: "f2",
        styleName: "Merino Polo",
        styleNumber: "AB123",
        category: "Tops",
        gender: "Men",
      }),
    ]
    const result = detectDuplicates(families)
    expect(result).toHaveLength(1)
    // Only non-matching fields show up; category and gender match so no diffs
    const catDiff = result[0]!.differences.find((d) => d.field === "category")
    expect(catDiff).toBeUndefined()
    const genderDiff = result[0]!.differences.find((d) => d.field === "gender")
    expect(genderDiff).toBeUndefined()
  })

  it("skips families without a styleNumber", () => {
    const families = [
      makeFamily({ id: "f1", styleName: "No Style Num" }),
      makeFamily({ id: "f2", styleName: "No Style Num" }),
    ]
    const result = detectDuplicates(families)
    expect(result).toHaveLength(0)
  })

  it("returns empty array for empty input", () => {
    expect(detectDuplicates([])).toEqual([])
  })

  it("returns empty array when all families are unique", () => {
    const families = [
      makeFamily({ id: "f1", styleName: "Polo", styleNumber: "P-001" }),
      makeFamily({ id: "f2", styleName: "Henley", styleNumber: "H-002" }),
      makeFamily({ id: "f3", styleName: "Jogger", styleNumber: "J-003" }),
    ]
    const result = detectDuplicates(families)
    expect(result).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Color matching (via baseColorName)
// ---------------------------------------------------------------------------

describe("baseColorName matching", () => {
  it("Black matches Black (0101)", () => {
    expect(baseColorName("Black")).toBe(baseColorName("Black (0101)"))
  })

  it("Navy matches Navy (2432)", () => {
    expect(baseColorName("Navy")).toBe(baseColorName("Navy (2432)"))
  })

  it("White matches White", () => {
    expect(baseColorName("White")).toBe(baseColorName("White"))
  })

  it("Dark Grey does not match Light Grey", () => {
    expect(baseColorName("Dark Grey")).not.toBe(baseColorName("Light Grey"))
  })

  it("handles mixed case and spacing", () => {
    expect(baseColorName("DARK NAVY")).toBe(baseColorName("Dark Navy"))
  })
})
