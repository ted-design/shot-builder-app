import { describe, it, expect } from "vitest"
import {
  FILTER_FIELD_META,
  FILTER_FIELD_BY_KEY,
  OPERATOR_LABELS,
} from "./filterConditions"
import type { FilterField, FieldType, FilterOperator } from "./filterConditions"

describe("FILTER_FIELD_META", () => {
  it("has exactly 9 entries", () => {
    expect(FILTER_FIELD_META).toHaveLength(9)
  })

  it("every entry has field, label, type, operators, defaultOperator", () => {
    for (const meta of FILTER_FIELD_META) {
      expect(typeof meta.field).toBe("string")
      expect(meta.field.length).toBeGreaterThan(0)
      expect(typeof meta.label).toBe("string")
      expect(meta.label.length).toBeGreaterThan(0)
      expect(typeof meta.type).toBe("string")
      expect(Array.isArray(meta.operators)).toBe(true)
      expect(meta.operators.length).toBeGreaterThan(0)
      expect(meta.operators).toContain(meta.defaultOperator)
    }
  })

  it("all field types are valid", () => {
    const validTypes: FieldType[] = ["set", "boolean", "date"]
    for (const meta of FILTER_FIELD_META) {
      expect(validTypes).toContain(meta.type)
    }
  })

  it("covers all expected fields", () => {
    const fields = FILTER_FIELD_META.map((m) => m.field)
    const expected: FilterField[] = [
      "status", "tag", "talent", "location", "product",
      "missing", "launchDate", "hasRequirements", "hasHeroImage",
    ]
    expect(fields).toEqual(expect.arrayContaining(expected))
    expect(fields).toHaveLength(expected.length)
  })
})

describe("FILTER_FIELD_BY_KEY", () => {
  it("maps all fields correctly", () => {
    for (const meta of FILTER_FIELD_META) {
      expect(FILTER_FIELD_BY_KEY.get(meta.field)).toBe(meta)
    }
  })

  it("has same size as FILTER_FIELD_META", () => {
    expect(FILTER_FIELD_BY_KEY.size).toBe(FILTER_FIELD_META.length)
  })
})

describe("OPERATOR_LABELS", () => {
  it("has entries for all operators used in field metadata", () => {
    const allOperators = new Set<FilterOperator>()
    for (const meta of FILTER_FIELD_META) {
      for (const op of meta.operators) {
        allOperators.add(op)
      }
    }
    for (const op of allOperators) {
      expect(OPERATOR_LABELS[op]).toBeDefined()
      expect(typeof OPERATOR_LABELS[op]).toBe("string")
    }
  })

  it("has human-readable labels", () => {
    expect(OPERATOR_LABELS.in).toBe("is")
    expect(OPERATOR_LABELS.notIn).toBe("is not")
    expect(OPERATOR_LABELS.eq).toBe("is")
    expect(OPERATOR_LABELS.before).toBe("is before")
    expect(OPERATOR_LABELS.after).toBe("is on or after")
    expect(OPERATOR_LABELS.between).toBe("is between")
    expect(OPERATOR_LABELS.empty).toBe("has no value")
  })
})
