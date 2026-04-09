import { describe, it, expect } from "vitest"
import { sanitizeForFirestore } from "../firestoreSanitize"

describe("sanitizeForFirestore", () => {
  it("converts top-level undefined to null", () => {
    expect(sanitizeForFirestore(undefined)).toBe(null)
  })

  it("passes through null", () => {
    expect(sanitizeForFirestore(null)).toBe(null)
  })

  it("passes through primitives", () => {
    expect(sanitizeForFirestore(0)).toBe(0)
    expect(sanitizeForFirestore(false)).toBe(false)
    expect(sanitizeForFirestore("")).toBe("")
    expect(sanitizeForFirestore("hello")).toBe("hello")
    expect(sanitizeForFirestore(42)).toBe(42)
  })

  it("strips undefined keys from flat objects", () => {
    const result = sanitizeForFirestore({ a: 1, b: undefined, c: "x" })
    expect(result).toEqual({ a: 1, c: "x" })
  })

  it("preserves null values in objects", () => {
    const result = sanitizeForFirestore({ a: null, b: 1 })
    expect(result).toEqual({ a: null, b: 1 })
  })

  it("preserves falsy values (0, false, empty string)", () => {
    const result = sanitizeForFirestore({ a: 0, b: false, c: "" })
    expect(result).toEqual({ a: 0, b: false, c: "" })
  })

  it("recursively strips undefined from nested objects", () => {
    const result = sanitizeForFirestore({
      top: "ok",
      nested: { a: 1, b: undefined, deep: { x: undefined, y: 2 } },
    })
    expect(result).toEqual({
      top: "ok",
      nested: { a: 1, deep: { y: 2 } },
    })
  })

  it("handles arrays — recurses into elements", () => {
    const result = sanitizeForFirestore([
      { a: 1, b: undefined },
      { c: undefined, d: "ok" },
    ])
    expect(result).toEqual([{ a: 1 }, { d: "ok" }])
  })

  it("converts undefined array elements to null", () => {
    const result = sanitizeForFirestore([1, undefined, 3])
    expect(result).toEqual([1, null, 3])
  })

  it("handles empty objects and arrays", () => {
    expect(sanitizeForFirestore({})).toEqual({})
    expect(sanitizeForFirestore([])).toEqual([])
  })

  it("preserves Date objects", () => {
    const date = new Date("2026-01-01")
    expect(sanitizeForFirestore(date)).toBe(date)
  })

  it("preserves Firestore Timestamp-like objects (with toDate)", () => {
    const timestamp = { toDate: () => new Date(), seconds: 123, nanoseconds: 0 }
    expect(sanitizeForFirestore(timestamp)).toBe(timestamp)
  })

  it("preserves Firestore sentinel objects (with _methodName)", () => {
    const sentinel = { _methodName: "serverTimestamp" }
    expect(sanitizeForFirestore(sentinel)).toBe(sentinel)
  })

  it("handles mixed nested structure", () => {
    const input = {
      products: [
        { familyId: "f1", familyName: "Polo", undefined_field: undefined },
        { familyId: "f2", familyName: undefined },
      ],
      looks: [
        {
          id: "l1",
          products: [{ familyId: "f1", missing: undefined }],
          heroProductId: undefined,
        },
      ],
      status: "todo",
    }
    const result = sanitizeForFirestore(input)
    expect(result).toEqual({
      products: [
        { familyId: "f1", familyName: "Polo" },
        { familyId: "f2" },
      ],
      looks: [
        {
          id: "l1",
          products: [{ familyId: "f1" }],
        },
      ],
      status: "todo",
    })
  })
})
