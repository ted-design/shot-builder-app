import { describe, it, expect } from "vitest"
import {
  formatMeasurement,
  usShoeToEu,
  stripTrailingZero,
} from "@/features/library/lib/measurementUnits"

describe("stripTrailingZero", () => {
  it("drops decimals for integers", () => {
    expect(stripTrailingZero(32)).toBe("32")
    expect(stripTrailingZero(6)).toBe("6")
  })
  it("keeps one decimal for non-integers", () => {
    expect(stripTrailingZero(35.5)).toBe("35.5")
    expect(stripTrailingZero(44.5)).toBe("44.5")
  })
})

describe("formatMeasurement — height", () => {
  const cases: ReadonlyArray<[string | number, string, number]> = [
    ["6'0\"", "6'0\"", 183],
    ["6'1.5\"", "6'1.5\"", 187],
    [72, "6'0\"", 183],
    ["71", "5'11\"", 180],
  ]
  for (const [raw, imperial, cm] of cases) {
    it(`${JSON.stringify(raw)} → imperial ${imperial}`, () => {
      expect(formatMeasurement("height", raw, { system: "imperial" })).toBe(imperial)
    })
    it(`${JSON.stringify(raw)} → metric ${cm} cm`, () => {
      expect(formatMeasurement("height", raw, { system: "metric" })).toBe(`${cm} cm`)
    })
  }
})

describe("formatMeasurement — linear (waist)", () => {
  const cases: ReadonlyArray<[string | number, string, number]> = [
    ["32", "32\"", 81],
    [32, "32\"", 81],
    ["35.5", "35.5\"", 90],
  ]
  for (const [raw, imperial, cm] of cases) {
    it(`${JSON.stringify(raw)} → imperial ${imperial}`, () => {
      expect(formatMeasurement("waist", raw, { system: "imperial" })).toBe(imperial)
    })
    it(`${JSON.stringify(raw)} → metric ${cm} cm`, () => {
      expect(formatMeasurement("waist", raw, { system: "metric" })).toBe(`${cm} cm`)
    })
  }
})

describe("formatMeasurement — shoes", () => {
  it("male 10.5 → US 10.5 / EU 44.5", () => {
    expect(formatMeasurement("shoes", "10.5", { system: "imperial", gender: "male" })).toBe("US 10.5")
    expect(formatMeasurement("shoes", "10.5", { system: "metric", gender: "male" })).toBe("EU 44.5")
  })
  it("female 9 → US 9 / EU 40", () => {
    expect(formatMeasurement("shoes", "9", { system: "imperial", gender: "female" })).toBe("US 9")
    expect(formatMeasurement("shoes", "9", { system: "metric", gender: "female" })).toBe("EU 40")
  })
  it("defaults to men's table when gender unknown", () => {
    expect(formatMeasurement("shoes", "10", { system: "metric" })).toBe("EU 44")
  })
})

describe("usShoeToEu — monotonic across + beyond the table", () => {
  it("men's table is dense and strictly increasing (no half-size collapse)", () => {
    expect(usShoeToEu(11, "male")).toBe(45)
    expect(usShoeToEu(11.5, "male")).toBe(45.5) // was previously collapsed to 45
    expect(usShoeToEu(12, "male")).toBe(46)
    expect(usShoeToEu(12.5, "male")).toBe(46.5) // was previously a non-monotonic fallback (45.5)
    expect(usShoeToEu(14, "male")).toBe(48.5)
  })
  it("women's table covers half sizes and 12", () => {
    expect(usShoeToEu(9.5, "female")).toBe(40.5)
    expect(usShoeToEu(12, "female")).toBe(43)
  })
  it("out-of-table sizes extrapolate monotonically (never invert)", () => {
    expect(usShoeToEu(16, "male")).toBe(51) // 49.5 (US15) + 1.5
    expect(usShoeToEu(16, "male")).toBeGreaterThan(usShoeToEu(15, "male"))
    expect(usShoeToEu(6, "male")).toBeLessThan(usShoeToEu(7, "male"))
  })
})

describe("formatMeasurement — garment (suit/dress) never converted", () => {
  it("suit 40R unchanged in both systems", () => {
    expect(formatMeasurement("suit", "40R", { system: "imperial" })).toBe("40R")
    expect(formatMeasurement("suit", "40R", { system: "metric" })).toBe("40R")
  })
  it("dress 4 unchanged in both systems", () => {
    expect(formatMeasurement("dress", "4", { system: "imperial" })).toBe("4")
    expect(formatMeasurement("dress", "4", { system: "metric" })).toBe("4")
  })
})

describe("formatMeasurement — unparseable returns raw, no throw", () => {
  it("returns the raw string for 'n/a'", () => {
    expect(formatMeasurement("waist", "n/a", { system: "metric" })).toBe("n/a")
    expect(formatMeasurement("height", "n/a", { system: "imperial" })).toBe("n/a")
  })
  it("handles null/undefined as empty string", () => {
    expect(formatMeasurement("waist", null, { system: "metric" })).toBe("")
    expect(formatMeasurement("waist", undefined, { system: "imperial" })).toBe("")
  })
})

describe("formatMeasurement — unknown key passthrough (no invented unit)", () => {
  it("returns the raw value unchanged for a non-standard key in both systems", () => {
    // Must NOT append a unit / convert — matches the prior String(raw) behavior.
    expect(formatMeasurement("neck", "34", { system: "imperial" })).toBe("34")
    expect(formatMeasurement("neck", "34", { system: "metric" })).toBe("34")
    expect(formatMeasurement("eyeColor", "blue", { system: "metric" })).toBe("blue")
  })
})
