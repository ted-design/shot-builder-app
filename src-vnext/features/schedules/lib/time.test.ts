import { describe, it, expect } from "vitest"
import { classifyTimeInput, formatMinutesTo12h, minutesToHHMM, parseTimeToMinutes } from "./time"

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

  describe("classifyTimeInput", () => {
    it("classifies valid times as canonical HH:MM", () => {
      expect(classifyTimeInput("6:05 AM")).toEqual({
        kind: "time",
        canonical: "06:05",
      })
      expect(classifyTimeInput("18:30")).toEqual({
        kind: "time",
        canonical: "18:30",
      })
    })

    it("supports text override only when allowed", () => {
      expect(classifyTimeInput("OFF", { allowText: true })).toEqual({
        kind: "text",
        text: "OFF",
      })
      expect(classifyTimeInput("OFF")).toEqual({
        kind: "invalid-time",
      })
    })

    it("rejects malformed time-like input", () => {
      expect(classifyTimeInput("24:00")).toEqual({
        kind: "invalid-time",
      })
      expect(classifyTimeInput("12:61")).toEqual({
        kind: "invalid-time",
      })
    })
  })
})
