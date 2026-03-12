import { describe, it, expect } from "vitest"
import { compressSizeRange } from "@/shared/lib/sizeRange"

describe("compressSizeRange", () => {
  it("returns null for empty array", () => {
    expect(compressSizeRange([])).toBeNull()
  })

  it("returns single size as-is", () => {
    expect(compressSizeRange(["M"])).toBe("M")
  })

  it("returns 'One Size' as-is", () => {
    expect(compressSizeRange(["One Size"])).toBe("One Size")
  })

  it("compresses a contiguous apparel range", () => {
    expect(compressSizeRange(["S", "M", "L", "XL"])).toBe("S - XL")
  })

  it("compresses XS through XXL", () => {
    expect(compressSizeRange(["XS", "S", "M", "L", "XL", "XXL"])).toBe("XS - XXL")
  })

  it("compresses two adjacent sizes as a range", () => {
    expect(compressSizeRange(["S", "M"])).toBe("S - M")
  })

  it("handles unordered input", () => {
    expect(compressSizeRange(["XL", "S", "L", "M"])).toBe("S - XL")
  })

  it("compresses composite sizes (inseam products)", () => {
    expect(compressSizeRange(["S/30", "S/32", "M/30", "M/32", "L/30", "L/32"])).toBe(
      'S - L / 30", 32"',
    )
  })

  it("compresses full inseam range", () => {
    expect(
      compressSizeRange([
        "S/30", "S/32",
        "M/30", "M/32",
        "L/30", "L/32",
        "XL/30", "XL/32",
        "XXL/30", "XXL/32",
      ]),
    ).toBe('S - XXL / 30", 32"')
  })

  it("handles sock composite sizes (S/M, L/XL)", () => {
    expect(compressSizeRange(["S/M", "L/XL"])).toBe("S/M, L/XL")
  })

  it("compresses numeric sizes as a range", () => {
    expect(compressSizeRange(["28", "30", "32", "34"])).toBe("28 - 34")
  })

  it("handles single numeric size", () => {
    expect(compressSizeRange(["32"])).toBe("32")
  })

  it("falls back to comma-join for non-contiguous apparel sizes", () => {
    expect(compressSizeRange(["S", "XL"])).toBe("S, XL")
  })

  it("truncates long lists with +N", () => {
    expect(compressSizeRange(["A", "B", "C", "D", "E", "F", "G"])).toBe("A, B, C, D, E +2")
  })

  it("handles contiguous range through 3XL", () => {
    expect(compressSizeRange(["S", "M", "L", "XL", "XXL", "2XL", "3XL"])).toBe("S - 3XL")
  })

  it("handles non-contiguous range with gap (skips XXL)", () => {
    expect(compressSizeRange(["S", "M", "L", "XL", "2XL", "3XL"])).toBe("S, M, L, XL, 2XL +1")
  })
})
