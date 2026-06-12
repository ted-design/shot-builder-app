// Display-only unit conversion for talent measurements (never mutates stored data).
// LINEAR → inches"/cm (height as ft'in"); SHOE → US/EU; GARMENT (suit/dress) → never converted.

import { normalizeGender } from "./measurementOptions"
import { parseMeasurementValue } from "./measurementParsing"

export type UnitSystem = "imperial" | "metric"

const LINEAR_INCHES = new Set([
  "height",
  "chest",
  "waist",
  "hips",
  "bust",
  "inseam",
  "sleeve",
  "collar",
])
const SHOE = new Set(["shoes"])
const GARMENT = new Set(["suit", "dress"])

const CM_PER_INCH = 2.54

/**
 * Format a number with no decimals when integral, else up to one decimal place.
 */
export function stripTrailingZero(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return String(Math.round(n * 10) / 10)
}

function inchesToCm(inches: number): number {
  return Math.round(inches * CM_PER_INCH)
}

function formatHeightImperial(totalInches: number): string {
  const feet = Math.floor(totalInches / 12)
  const remainder = Math.round((totalInches - feet * 12) * 10) / 10
  // Carry case: 5'12" → 6'0" (defensive; parser caps inches < 12 already)
  if (remainder >= 12) {
    return `${feet + 1}'${stripTrailingZero(remainder - 12)}"`
  }
  return `${feet}'${stripTrailingZero(remainder)}"`
}

// Standard US → EU shoe-size conversion tables (monotonic across the realistic range).
const MEN_US_TO_EU: Readonly<Record<string, number>> = {
  "7": 40,
  "7.5": 40.5,
  "8": 41,
  "8.5": 42,
  "9": 42.5,
  "9.5": 43,
  "10": 44,
  "10.5": 44.5,
  "11": 45,
  "11.5": 45.5,
  "12": 46,
  "12.5": 46.5,
  "13": 47.5,
  "13.5": 48,
  "14": 48.5,
  "14.5": 49,
  "15": 49.5,
}

const WOMEN_US_TO_EU: Readonly<Record<string, number>> = {
  "5": 35.5,
  "5.5": 36,
  "6": 36.5,
  "6.5": 37,
  "7": 37.5,
  "7.5": 38,
  "8": 38.5,
  "8.5": 39.5,
  "9": 40,
  "9.5": 40.5,
  "10": 41,
  "10.5": 41.5,
  "11": 42,
  "11.5": 42.5,
  "12": 43,
}

function roundToHalf(n: number): number {
  return Math.round(n * 2) / 2
}

// Monotonic extrapolation beyond the table: ~1.5 EU per US size.
function extrapolateEu(table: Readonly<Record<string, number>>, usSize: number): number {
  const keys = Object.keys(table).map(Number)
  const minUs = Math.min(...keys)
  const maxUs = Math.max(...keys)
  if (usSize > maxUs) return roundToHalf(table[stripTrailingZero(maxUs)]! + (usSize - maxUs) * 1.5)
  if (usSize < minUs) return roundToHalf(table[stripTrailingZero(minUs)]! - (minUs - usSize) * 1.5)
  // Unreachable for whole/half sizes (tables cover every .5 in range); last-resort for odd fractions.
  return roundToHalf(usSize + 33)
}

/**
 * Convert a US shoe size to its EU equivalent, gender-aware. Out-of-table sizes
 * extrapolate monotonically so a larger US size never maps to a smaller EU size.
 */
export function usShoeToEu(usSize: number, gender?: string | null): number {
  const isWomen = normalizeGender(gender) === "women"
  const table = isWomen ? WOMEN_US_TO_EU : MEN_US_TO_EU
  const exact = table[stripTrailingZero(usSize)]
  if (exact !== undefined) return exact
  return extrapolateEu(table, usSize)
}

interface FormatOptions {
  readonly system: UnitSystem
  readonly gender?: string | null
}

/**
 * Format a single raw measurement value for display in the given unit system.
 *
 * Display-only. Never mutates stored data. If a value cannot be parsed, the raw
 * value is returned unchanged so no information is lost.
 */
export function formatMeasurement(
  key: string,
  raw: string | number | null | undefined,
  opts: FormatOptions,
): string {
  const rawStr = String(raw ?? "").trim()

  // Garment sizing is never converted — display raw for both systems.
  if (GARMENT.has(key)) return rawStr

  const parsed = parseMeasurementValue(raw)
  if (parsed === null) return rawStr

  const { system, gender } = opts

  if (SHOE.has(key)) {
    if (system === "metric") return `EU ${stripTrailingZero(usShoeToEu(parsed, gender))}`
    return `US ${stripTrailingZero(parsed)}`
  }

  if (LINEAR_INCHES.has(key)) {
    if (system === "metric") return `${inchesToCm(parsed)} cm`
    if (key === "height") return formatHeightImperial(parsed)
    return `${stripTrailingZero(parsed)}"`
  }

  // Unknown/non-standard key: passthrough (don't invent a unit) — matches the prior String(raw) behavior.
  return rawStr
}
