import { describe, it, expect } from "vitest"
import { parseMeasurementValue } from "@/features/library/lib/measurementParsing"

describe("parseMeasurementValue", () => {
  // --- null/undefined/empty ---
  it("returns null for null", () => {
    expect(parseMeasurementValue(null)).toBeNull()
  })

  it("returns null for undefined", () => {
    expect(parseMeasurementValue(undefined)).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(parseMeasurementValue("")).toBeNull()
  })

  it("returns null for whitespace-only string", () => {
    expect(parseMeasurementValue("   ")).toBeNull()
  })

  // --- numeric passthrough ---
  it("passes through finite number", () => {
    expect(parseMeasurementValue(34)).toBe(34)
  })

  it("passes through decimal number", () => {
    expect(parseMeasurementValue(8.5)).toBe(8.5)
  })

  it("returns null for NaN", () => {
    expect(parseMeasurementValue(NaN)).toBeNull()
  })

  it("returns null for Infinity", () => {
    expect(parseMeasurementValue(Infinity)).toBeNull()
  })

  // --- feet + inches ---
  it("parses 5'9\" to 69 inches", () => {
    expect(parseMeasurementValue('5\'9"')).toBe(69)
  })

  it("parses 5'9 (no trailing quote) to 69 inches", () => {
    expect(parseMeasurementValue("5'9")).toBe(69)
  })

  it("parses 6'0\" to 72 inches", () => {
    expect(parseMeasurementValue('6\'0"')).toBe(72)
  })

  it("parses 5'11\" to 71 inches", () => {
    expect(parseMeasurementValue('5\'11"')).toBe(71)
  })

  it("returns null for invalid inches >= 12 in feet format", () => {
    expect(parseMeasurementValue('5\'13"')).toBeNull()
  })

  // --- inches only ---
  it('parses 34" to 34', () => {
    expect(parseMeasurementValue('34"')).toBe(34)
  })

  it('parses 28.5" to 28.5', () => {
    expect(parseMeasurementValue('28.5"')).toBe(28.5)
  })

  // --- centimeters ---
  it("parses 175cm to ~68.9 inches", () => {
    expect(parseMeasurementValue("175cm")).toBe(68.9)
  })

  it("parses 180 cm (with space) to ~70.9 inches", () => {
    expect(parseMeasurementValue("180 cm")).toBe(70.9)
  })

  it("parses CM case-insensitive", () => {
    expect(parseMeasurementValue("175CM")).toBe(68.9)
  })

  // --- suit/dress with suffix ---
  it("parses 40R to 40", () => {
    expect(parseMeasurementValue("40R")).toBe(40)
  })

  it("parses 42L to 42", () => {
    expect(parseMeasurementValue("42L")).toBe(42)
  })

  it("parses 38S to 38", () => {
    expect(parseMeasurementValue("38S")).toBe(38)
  })

  it("parses 42XL to 42", () => {
    expect(parseMeasurementValue("42XL")).toBe(42)
  })

  // --- plain numbers ---
  it("parses plain integer string", () => {
    expect(parseMeasurementValue("34")).toBe(34)
  })

  it("parses plain decimal string", () => {
    expect(parseMeasurementValue("8.5")).toBe(8.5)
  })

  // --- unparseable ---
  it("returns null for random text", () => {
    expect(parseMeasurementValue("medium")).toBeNull()
  })

  it("returns null for mixed nonsense", () => {
    expect(parseMeasurementValue("abc123")).toBeNull()
  })

  // --- whitespace tolerance ---
  it("trims leading/trailing whitespace", () => {
    expect(parseMeasurementValue("  34  ")).toBe(34)
  })
})
