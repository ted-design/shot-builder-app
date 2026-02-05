import { describe, it, expect } from "vitest"
import { formatMinutesTo12h, minutesToHHMM, parseTimeToMinutes } from "./time"

describe("time", () => {
  describe("parseTimeToMinutes", () => {
    it("parses 12h with minutes", () => {
      expect(parseTimeToMinutes("6:05 AM")).toBe(6 * 60 + 5)
      expect(parseTimeToMinutes("12:00 AM")).toBe(0)
      expect(parseTimeToMinutes("12:00 PM")).toBe(12 * 60)
      expect(parseTimeToMinutes("1:00 PM")).toBe(13 * 60)
    })

    it("parses 12h without minutes", () => {
      expect(parseTimeToMinutes("6 AM")).toBe(6 * 60)
      expect(parseTimeToMinutes("6PM")).toBe(18 * 60)
    })

    it("parses 24h", () => {
      expect(parseTimeToMinutes("06:00")).toBe(6 * 60)
      expect(parseTimeToMinutes("18:30")).toBe(18 * 60 + 30)
      expect(parseTimeToMinutes("6:30")).toBe(6 * 60 + 30)
    })

    it("returns null for invalid", () => {
      expect(parseTimeToMinutes("")).toBeNull()
      expect(parseTimeToMinutes("25:00")).toBeNull()
      expect(parseTimeToMinutes("13 PM")).toBeNull()
    })
  })

  it("formats minutes to 12h", () => {
    expect(formatMinutesTo12h(0)).toBe("12:00 AM")
    expect(formatMinutesTo12h(6 * 60)).toBe("6:00 AM")
    expect(formatMinutesTo12h(12 * 60)).toBe("12:00 PM")
    expect(formatMinutesTo12h(13 * 60 + 5)).toBe("1:05 PM")
  })

  it("converts minutes to HH:MM", () => {
    expect(minutesToHHMM(0)).toBe("00:00")
    expect(minutesToHHMM(6 * 60 + 5)).toBe("06:05")
  })
})

