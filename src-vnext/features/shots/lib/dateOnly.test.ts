import { describe, it, expect } from "vitest"
import { Timestamp } from "firebase/firestore"
import { formatDateOnly, parseDateOnly } from "./dateOnly"

describe("formatDateOnly", () => {
  it("returns empty string for null", () => {
    expect(formatDateOnly(null)).toBe("")
  })

  it("returns empty string for undefined", () => {
    expect(formatDateOnly(undefined)).toBe("")
  })

  it("formats a Timestamp as YYYY-MM-DD using UTC", () => {
    // UTC midnight 2026-02-02
    const ts = Timestamp.fromDate(new Date("2026-02-02T00:00:00Z"))
    expect(formatDateOnly(ts)).toBe("2026-02-02")
  })

  it("does not shift day for timestamps at UTC midnight (US timezone proof)", () => {
    // This is the core bug scenario: UTC midnight = previous day in US timezones
    // Using UTC formatting guarantees no shift
    const ts = Timestamp.fromDate(new Date("2026-07-15T00:00:00Z"))
    expect(formatDateOnly(ts)).toBe("2026-07-15")
  })

  it("handles end-of-year boundary", () => {
    const ts = Timestamp.fromDate(new Date("2025-12-31T00:00:00Z"))
    expect(formatDateOnly(ts)).toBe("2025-12-31")
  })
})

describe("parseDateOnly", () => {
  it("returns null for empty string", () => {
    expect(parseDateOnly("")).toBeNull()
  })

  it("returns null for whitespace-only string", () => {
    expect(parseDateOnly("   ")).toBeNull()
  })

  it("parses a valid YYYY-MM-DD to a Timestamp at UTC midnight", () => {
    const ts = parseDateOnly("2026-02-02")
    expect(ts).not.toBeNull()
    const d = ts!.toDate()
    expect(d.getUTCFullYear()).toBe(2026)
    expect(d.getUTCMonth()).toBe(1) // Feb = 1
    expect(d.getUTCDate()).toBe(2)
    expect(d.getUTCHours()).toBe(0)
    expect(d.getUTCMinutes()).toBe(0)
    expect(d.getUTCSeconds()).toBe(0)
  })

  it("rejects invalid format (no dashes)", () => {
    expect(() => parseDateOnly("20260202")).toThrow("Invalid date format")
  })

  it("rejects invalid format (extra chars)", () => {
    expect(() => parseDateOnly("2026-02-02T00:00")).toThrow(
      "Invalid date format",
    )
  })

  it("rejects impossible month", () => {
    expect(() => parseDateOnly("2026-13-01")).toThrow("Invalid date")
  })

  it("rejects impossible day", () => {
    expect(() => parseDateOnly("2026-02-30")).toThrow(
      "date does not exist",
    )
  })

  it("rejects Feb 29 on non-leap year", () => {
    expect(() => parseDateOnly("2026-02-29")).toThrow(
      "date does not exist",
    )
  })

  it("accepts Feb 29 on leap year", () => {
    const ts = parseDateOnly("2024-02-29")
    expect(ts).not.toBeNull()
    expect(formatDateOnly(ts)).toBe("2024-02-29")
  })
})

describe("round-trip: parse then format", () => {
  it("2026-02-02 round-trips exactly", () => {
    const ts = parseDateOnly("2026-02-02")
    expect(formatDateOnly(ts)).toBe("2026-02-02")
  })

  it("2025-12-31 round-trips exactly", () => {
    const ts = parseDateOnly("2025-12-31")
    expect(formatDateOnly(ts)).toBe("2025-12-31")
  })

  it("2026-01-01 round-trips exactly", () => {
    const ts = parseDateOnly("2026-01-01")
    expect(formatDateOnly(ts)).toBe("2026-01-01")
  })
})
