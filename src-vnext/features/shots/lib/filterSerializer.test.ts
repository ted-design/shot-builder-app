import { describe, it, expect } from "vitest"
import {
  serializeFilters,
  deserializeFilters,
  migrateLegacyParams,
} from "./filterSerializer"
import type { FilterCondition, FilterOperator, FilterValue } from "./filterConditions"
import { FILTER_FIELD_META } from "./filterConditions"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip the auto-generated `id` so we can compare field/operator/value. */
function stripIds(conditions: readonly FilterCondition[]): ReadonlyArray<Omit<FilterCondition, "id">> {
  return conditions.map(({ field, operator, value }) => ({ field, operator, value }))
}

// ---------------------------------------------------------------------------
// serializeFilters
// ---------------------------------------------------------------------------

describe("serializeFilters", () => {
  it("returns empty string for empty array", () => {
    expect(serializeFilters([])).toBe("")
  })

  it("serializes a single set condition", () => {
    const conditions: FilterCondition[] = [
      { id: "1", field: "status", operator: "in", value: ["todo", "in_progress"] },
    ]
    expect(serializeFilters(conditions)).toBe("status.in:todo,in_progress")
  })

  it("serializes a notIn condition", () => {
    const conditions: FilterCondition[] = [
      { id: "1", field: "tag", operator: "notIn", value: ["default-media-video"] },
    ]
    expect(serializeFilters(conditions)).toBe("tag.notIn:default-media-video")
  })

  it("serializes a boolean condition", () => {
    const conditions: FilterCondition[] = [
      { id: "1", field: "hasRequirements", operator: "eq", value: true },
    ]
    expect(serializeFilters(conditions)).toBe("hasRequirements.eq:true")
  })

  it("serializes a date before condition", () => {
    const conditions: FilterCondition[] = [
      { id: "1", field: "launchDate", operator: "before", value: "2026-05-10" },
    ]
    expect(serializeFilters(conditions)).toBe("launchDate.before:2026-05-10")
  })

  it("serializes a date after condition", () => {
    const conditions: FilterCondition[] = [
      { id: "1", field: "launchDate", operator: "after", value: "2026-04-01" },
    ]
    expect(serializeFilters(conditions)).toBe("launchDate.after:2026-04-01")
  })

  it("serializes a date between condition", () => {
    const conditions: FilterCondition[] = [
      { id: "1", field: "launchDate", operator: "between", value: { from: "2026-04-01", to: "2026-05-10" } },
    ]
    expect(serializeFilters(conditions)).toBe("launchDate.between:2026-04-01~2026-05-10")
  })

  it("serializes a date empty condition", () => {
    const conditions: FilterCondition[] = [
      { id: "1", field: "launchDate", operator: "empty", value: null },
    ]
    expect(serializeFilters(conditions)).toBe("launchDate.empty:")
  })

  it("serializes multiple conditions with semicolons", () => {
    const conditions: FilterCondition[] = [
      { id: "1", field: "status", operator: "in", value: ["todo"] },
      { id: "2", field: "tag", operator: "in", value: ["men", "women"] },
      { id: "3", field: "launchDate", operator: "before", value: "2026-05-10" },
    ]
    expect(serializeFilters(conditions)).toBe(
      "status.in:todo;tag.in:men,women;launchDate.before:2026-05-10",
    )
  })
})

// ---------------------------------------------------------------------------
// deserializeFilters
// ---------------------------------------------------------------------------

describe("deserializeFilters", () => {
  it("returns empty array for null", () => {
    expect(deserializeFilters(null)).toEqual([])
  })

  it("returns empty array for empty string", () => {
    expect(deserializeFilters("")).toEqual([])
  })

  it("returns empty array for whitespace", () => {
    expect(deserializeFilters("   ")).toEqual([])
  })

  it("deserializes a set condition", () => {
    const result = deserializeFilters("status.in:todo,in_progress")
    expect(stripIds(result)).toEqual([
      { field: "status", operator: "in", value: ["todo", "in_progress"] },
    ])
  })

  it("deserializes a boolean condition", () => {
    const result = deserializeFilters("hasRequirements.eq:true")
    expect(stripIds(result)).toEqual([
      { field: "hasRequirements", operator: "eq", value: true },
    ])
  })

  it("deserializes a date between condition", () => {
    const result = deserializeFilters("launchDate.between:2026-04-01~2026-05-10")
    expect(stripIds(result)).toEqual([
      { field: "launchDate", operator: "between", value: { from: "2026-04-01", to: "2026-05-10" } },
    ])
  })

  it("deserializes a date empty condition", () => {
    const result = deserializeFilters("launchDate.empty:")
    expect(stripIds(result)).toEqual([
      { field: "launchDate", operator: "empty", value: null },
    ])
  })

  it("deserializes multiple conditions", () => {
    const result = deserializeFilters("status.in:todo;tag.in:men,women;launchDate.before:2026-05-10")
    expect(result).toHaveLength(3)
    expect(stripIds(result)).toEqual([
      { field: "status", operator: "in", value: ["todo"] },
      { field: "tag", operator: "in", value: ["men", "women"] },
      { field: "launchDate", operator: "before", value: "2026-05-10" },
    ])
  })

  it("skips malformed segments without colons", () => {
    const result = deserializeFilters("status.in:todo;malformed;tag.in:men")
    expect(result).toHaveLength(2)
  })

  it("skips segments with unknown fields", () => {
    const result = deserializeFilters("unknown.in:x;status.in:todo")
    expect(result).toHaveLength(1)
    expect(result[0]!.field).toBe("status")
  })

  it("skips segments with invalid operators for the field", () => {
    // "missing" only supports "in", not "notIn"
    const result = deserializeFilters("missing.notIn:products;status.in:todo")
    expect(result).toHaveLength(1)
    expect(result[0]!.field).toBe("status")
  })
})

// ---------------------------------------------------------------------------
// Round-trip
// ---------------------------------------------------------------------------

describe("serialize/deserialize round-trip", () => {
  it("set condition round-trips", () => {
    const original: FilterCondition[] = [
      { id: "1", field: "status", operator: "in", value: ["todo", "in_progress"] },
    ]
    const serialized = serializeFilters(original)
    const deserialized = deserializeFilters(serialized)
    expect(stripIds(deserialized)).toEqual(stripIds(original))
  })

  it("boolean condition round-trips", () => {
    const original: FilterCondition[] = [
      { id: "1", field: "hasHeroImage", operator: "eq", value: false },
    ]
    const serialized = serializeFilters(original)
    const deserialized = deserializeFilters(serialized)
    expect(stripIds(deserialized)).toEqual(stripIds(original))
  })

  it("date between round-trips", () => {
    const original: FilterCondition[] = [
      { id: "1", field: "launchDate", operator: "between", value: { from: "2026-04-01", to: "2026-05-10" } },
    ]
    const serialized = serializeFilters(original)
    const deserialized = deserializeFilters(serialized)
    expect(stripIds(deserialized)).toEqual(stripIds(original))
  })

  it("complex multi-condition round-trips", () => {
    const original: FilterCondition[] = [
      { id: "1", field: "status", operator: "in", value: ["todo"] },
      { id: "2", field: "tag", operator: "notIn", value: ["default-media-video"] },
      { id: "3", field: "hasRequirements", operator: "eq", value: true },
      { id: "4", field: "launchDate", operator: "after", value: "2026-04-01" },
    ]
    const serialized = serializeFilters(original)
    const deserialized = deserializeFilters(serialized)
    expect(stripIds(deserialized)).toEqual(stripIds(original))
  })
})

// ---------------------------------------------------------------------------
// Exhaustive field x operator coverage — proves NO field/operator pair is
// dropped by the serialize -> deserialize round-trip. Drives directly off the
// canonical FILTER_FIELD_META so a new field or operator is automatically
// covered (and a regression that silently drops one fails here).
// ---------------------------------------------------------------------------

/** A representative value for a given field/operator pair. */
function sampleValue(type: "set" | "boolean" | "date", operator: FilterOperator): FilterValue {
  if (type === "set") return ["alpha", "beta"]
  if (type === "boolean") return true
  // date
  if (operator === "between") return { from: "2026-04-01", to: "2026-05-10" }
  if (operator === "empty") return null
  return "2026-05-10"
}

describe("every field x its allowed operators survive round-trip", () => {
  for (const meta of FILTER_FIELD_META) {
    for (const operator of meta.operators) {
      it(`${meta.field}.${operator} round-trips with no operator dropped`, () => {
        const value = sampleValue(meta.type, operator)
        const original: FilterCondition[] = [
          { id: "x", field: meta.field, operator, value },
        ]
        const serialized = serializeFilters(original)
        const deserialized = deserializeFilters(serialized)

        // The pair survived: exactly one condition, same field + operator + value.
        expect(deserialized).toHaveLength(1)
        expect(deserialized[0]!.field).toBe(meta.field)
        expect(deserialized[0]!.operator).toBe(operator)
        expect(stripIds(deserialized)).toEqual(stripIds(original))
      })
    }
  }

  it("a single payload carrying one condition per field x operator survives intact", () => {
    const original: FilterCondition[] = FILTER_FIELD_META.flatMap((meta) =>
      meta.operators.map((operator, idx): FilterCondition => ({
        id: `${meta.field}-${idx}`,
        field: meta.field,
        operator,
        value: sampleValue(meta.type, operator),
      })),
    )

    const serialized = serializeFilters(original)
    const deserialized = deserializeFilters(serialized)

    // Count of (field, operator) pairs must match — nothing dropped.
    const expectedPairCount = FILTER_FIELD_META.reduce((n, m) => n + m.operators.length, 0)
    expect(deserialized).toHaveLength(expectedPairCount)
    expect(stripIds(deserialized)).toEqual(stripIds(original))
  })
})

// ---------------------------------------------------------------------------
// migrateLegacyParams
// ---------------------------------------------------------------------------

describe("migrateLegacyParams", () => {
  it("returns null when 'filters' param exists", () => {
    const params = new URLSearchParams("filters=status.in:todo")
    expect(migrateLegacyParams(params)).toBeNull()
  })

  it("converts status param to condition", () => {
    const params = new URLSearchParams("status=todo,in_progress")
    const result = migrateLegacyParams(params)!
    expect(result).toHaveLength(1)
    expect(stripIds(result)).toEqual([
      { field: "status", operator: "in", value: ["todo", "in_progress"] },
    ])
  })

  it("converts talent param to condition", () => {
    const params = new URLSearchParams("talent=t1")
    const result = migrateLegacyParams(params)!
    expect(result).toHaveLength(1)
    expect(stripIds(result)).toEqual([
      { field: "talent", operator: "in", value: ["t1"] },
    ])
  })

  it("converts tag param (comma-separated) to condition", () => {
    const params = new URLSearchParams("tag=men,women")
    const result = migrateLegacyParams(params)!
    expect(result).toHaveLength(1)
    expect(stripIds(result)).toEqual([
      { field: "tag", operator: "in", value: ["men", "women"] },
    ])
  })

  it("converts location param to condition", () => {
    const params = new URLSearchParams("location=loc1")
    const result = migrateLegacyParams(params)!
    expect(result).toHaveLength(1)
    expect(stripIds(result)).toEqual([
      { field: "location", operator: "in", value: ["loc1"] },
    ])
  })

  it("converts product param to condition", () => {
    const params = new URLSearchParams("product=f1")
    const result = migrateLegacyParams(params)!
    expect(result).toHaveLength(1)
    expect(stripIds(result)).toEqual([
      { field: "product", operator: "in", value: ["f1"] },
    ])
  })

  it("returns null when no legacy params exist", () => {
    const params = new URLSearchParams("")
    expect(migrateLegacyParams(params)).toBeNull()
  })

  it("combines multiple legacy params into multiple conditions", () => {
    const params = new URLSearchParams("status=todo&talent=t1&tag=men,women")
    const result = migrateLegacyParams(params)!
    expect(result).toHaveLength(3)
    const fields = result.map((c) => c.field)
    expect(fields).toContain("status")
    expect(fields).toContain("talent")
    expect(fields).toContain("tag")
  })
})

// ---------------------------------------------------------------------------
// Stable ids — condition ids must survive URL round-trips so filter rows keyed
// by id are not remounted on every value update.
// ---------------------------------------------------------------------------

describe("deserializeFilters — stable ids", () => {
  it("yields identical ids for the same input across calls", () => {
    const raw = "status.in:todo,in_progress;talent.in:t1"
    const a = deserializeFilters(raw)
    const b = deserializeFilters(raw)
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id))
  })

  it("derives the id from field+operator", () => {
    const [status, talent] = deserializeFilters("status.in:todo;talent.in:t1")
    expect(status!.id).toBe("status.in")
    expect(talent!.id).toBe("talent.in")
  })

  it("gives each condition a unique id within a result set", () => {
    const ids = deserializeFilters("status.in:todo;talent.in:t1;location.in:l1").map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
