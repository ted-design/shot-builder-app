import { describe, expect, it } from "vitest"
import {
  humanizeLabel,
  normalizeText,
  normalizeWhitespace,
  parseCsvList,
} from "../textUtils"

describe("normalizeText", () => {
  it("returns null for non-string input", () => {
    expect(normalizeText(null)).toBe(null)
    expect(normalizeText(undefined)).toBe(null)
    expect(normalizeText(42)).toBe(null)
    expect(normalizeText(true)).toBe(null)
    expect(normalizeText({})).toBe(null)
  })

  it("returns null for empty or whitespace-only strings", () => {
    expect(normalizeText("")).toBe(null)
    expect(normalizeText("   ")).toBe(null)
    expect(normalizeText("\t\n")).toBe(null)
  })

  it("trims and lowercases a non-empty string", () => {
    expect(normalizeText("  Hello World  ")).toBe("hello world")
    expect(normalizeText("FOO")).toBe("foo")
    expect(normalizeText("bar")).toBe("bar")
  })

  it("preserves internal whitespace while trimming edges", () => {
    expect(normalizeText("  a  b  ")).toBe("a  b")
  })
})

describe("normalizeWhitespace", () => {
  it("collapses runs of whitespace to a single space", () => {
    expect(normalizeWhitespace("  hello   world  ")).toBe("hello world")
  })

  it("converts \\r\\n to \\n before collapsing", () => {
    expect(normalizeWhitespace("line1\r\nline2")).toBe("line1 line2")
  })

  it("trims leading and trailing whitespace", () => {
    expect(normalizeWhitespace("   spaced   ")).toBe("spaced")
  })

  it("handles tabs and mixed whitespace", () => {
    expect(normalizeWhitespace("\t foo \n bar \t")).toBe("foo bar")
  })

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeWhitespace("   ")).toBe("")
  })
})

describe("humanizeLabel", () => {
  it("converts snake_case to Title Case", () => {
    expect(humanizeLabel("product_type")).toBe("Product Type")
  })

  it("converts kebab-case to Title Case", () => {
    expect(humanizeLabel("product-type")).toBe("Product Type")
  })

  it("handles mixed delimiters", () => {
    expect(humanizeLabel("some_kebab-case_mix")).toBe("Some Kebab Case Mix")
  })

  it("collapses consecutive delimiters", () => {
    expect(humanizeLabel("some__double")).toBe("Some Double")
  })

  it("handles already-capitalized input", () => {
    expect(humanizeLabel("Already Fine")).toBe("Already Fine")
  })

  it("handles single word", () => {
    expect(humanizeLabel("shoes")).toBe("Shoes")
  })

  it("returns empty string for empty input", () => {
    expect(humanizeLabel("")).toBe("")
  })

  it("trims leading/trailing delimiters", () => {
    expect(humanizeLabel("_leading_")).toBe("Leading")
  })
})

describe("parseCsvList", () => {
  it("splits on commas and trims each entry", () => {
    expect(parseCsvList("a, b, c")).toEqual(["a", "b", "c"])
  })

  it("filters out empty entries", () => {
    expect(parseCsvList("a,,b, ,c")).toEqual(["a", "b", "c"])
  })

  it("returns empty array for empty string", () => {
    expect(parseCsvList("")).toEqual([])
  })

  it("returns single element for no commas", () => {
    expect(parseCsvList("solo")).toEqual(["solo"])
  })

  it("handles whitespace-only entries", () => {
    expect(parseCsvList("  ,  ,  ")).toEqual([])
  })

  it("preserves internal spaces within entries", () => {
    expect(parseCsvList("new york, los angeles")).toEqual(["new york", "los angeles"])
  })
})
