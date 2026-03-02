import { describe, expect, it, vi } from "vitest"
import { Timestamp } from "firebase/firestore"
import {
  isSampleReturnOverdue,
  isSampleReturnDueSoon,
  SAMPLE_CONDITIONS,
} from "./productDetailHelpers"

function ts(offsetMs: number): Timestamp {
  const date = new Date(Date.now() + offsetMs)
  return Timestamp.fromDate(date)
}

const DAY_MS = 24 * 60 * 60 * 1000

describe("isSampleReturnOverdue", () => {
  it("returns false when no returnDueDate", () => {
    expect(isSampleReturnOverdue({ status: "arrived" })).toBe(false)
  })

  it("returns false when status is not arrived", () => {
    expect(isSampleReturnOverdue({ status: "requested", returnDueDate: ts(-DAY_MS) })).toBe(false)
    expect(isSampleReturnOverdue({ status: "in_transit", returnDueDate: ts(-DAY_MS) })).toBe(false)
    expect(isSampleReturnOverdue({ status: "returned", returnDueDate: ts(-DAY_MS) })).toBe(false)
  })

  it("returns true when arrived and returnDueDate is in the past", () => {
    expect(isSampleReturnOverdue({ status: "arrived", returnDueDate: ts(-DAY_MS) })).toBe(true)
  })

  it("returns false when arrived and returnDueDate is in the future", () => {
    expect(isSampleReturnOverdue({ status: "arrived", returnDueDate: ts(DAY_MS) })).toBe(false)
  })
})

describe("isSampleReturnDueSoon", () => {
  it("returns false when no returnDueDate", () => {
    expect(isSampleReturnDueSoon({ status: "arrived" })).toBe(false)
  })

  it("returns false when status is not arrived", () => {
    expect(isSampleReturnDueSoon({ status: "requested", returnDueDate: ts(DAY_MS) })).toBe(false)
  })

  it("returns true when arrived and returnDueDate within 3 days", () => {
    expect(isSampleReturnDueSoon({ status: "arrived", returnDueDate: ts(2 * DAY_MS) })).toBe(true)
  })

  it("returns false when arrived and returnDueDate more than 3 days away", () => {
    expect(isSampleReturnDueSoon({ status: "arrived", returnDueDate: ts(5 * DAY_MS) })).toBe(false)
  })

  it("returns false when overdue (past due)", () => {
    expect(isSampleReturnDueSoon({ status: "arrived", returnDueDate: ts(-DAY_MS) })).toBe(false)
  })

  it("respects custom withinDays parameter", () => {
    expect(isSampleReturnDueSoon({ status: "arrived", returnDueDate: ts(6 * DAY_MS) }, 7)).toBe(true)
    expect(isSampleReturnDueSoon({ status: "arrived", returnDueDate: ts(6 * DAY_MS) }, 5)).toBe(false)
  })
})

describe("SAMPLE_CONDITIONS", () => {
  it("has 4 entries", () => {
    expect(SAMPLE_CONDITIONS).toHaveLength(4)
  })

  it("includes all expected keys", () => {
    const keys = SAMPLE_CONDITIONS.map((c) => c.key)
    expect(keys).toEqual(["new", "good", "fair", "damaged"])
  })

  it("maps damaged to red", () => {
    const damaged = SAMPLE_CONDITIONS.find((c) => c.key === "damaged")
    expect(damaged?.color).toBe("red")
  })

  it("maps fair to amber", () => {
    const fair = SAMPLE_CONDITIONS.find((c) => c.key === "fair")
    expect(fair?.color).toBe("amber")
  })
})
