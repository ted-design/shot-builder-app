import { describe, expect, it } from "vitest"
import { Timestamp } from "firebase/firestore"
import {
  getShootUrgency,
  getUrgencyLabel,
  getUrgencyColor,
  getUrgencyTimeText,
  getUrgencySortOrder,
} from "./shootUrgency"

const DAY_MS = 24 * 60 * 60 * 1000

function ts(offsetMs: number): Timestamp {
  return Timestamp.fromDate(new Date(Date.now() + offsetMs))
}

describe("getShootUrgency", () => {
  it("returns 'overdue' for a date in the past", () => {
    expect(getShootUrgency(ts(-5 * DAY_MS))).toBe("overdue")
  })

  it("returns 'overdue' for yesterday", () => {
    expect(getShootUrgency(ts(-1 * DAY_MS))).toBe("overdue")
  })

  it("returns 'urgent' for today (0 days)", () => {
    // A date just a few ms in the future rounds to 0 days via Math.ceil
    // Actually Math.ceil of a small positive fraction is 1, so use a near-zero
    // future: 1 hour from now = ceil(1h / 24h) = 1 day = urgent
    expect(getShootUrgency(ts(1 * 60 * 60 * 1000))).toBe("urgent")
  })

  it("returns 'urgent' for 3 days from now", () => {
    expect(getShootUrgency(ts(3 * DAY_MS))).toBe("urgent")
  })

  it("returns 'urgent' for exactly 7 days from now", () => {
    expect(getShootUrgency(ts(7 * DAY_MS))).toBe("urgent")
  })

  it("returns 'soon' for 8 days from now", () => {
    expect(getShootUrgency(ts(8 * DAY_MS))).toBe("soon")
  })

  it("returns 'soon' for 12 days from now", () => {
    expect(getShootUrgency(ts(12 * DAY_MS))).toBe("soon")
  })

  it("returns 'soon' for exactly 15 days from now", () => {
    expect(getShootUrgency(ts(15 * DAY_MS))).toBe("soon")
  })

  it("returns 'upcoming' for 16 days from now", () => {
    expect(getShootUrgency(ts(16 * DAY_MS))).toBe("upcoming")
  })

  it("returns 'upcoming' for 22 days from now", () => {
    expect(getShootUrgency(ts(22 * DAY_MS))).toBe("upcoming")
  })

  it("returns 'upcoming' for exactly 30 days from now", () => {
    expect(getShootUrgency(ts(30 * DAY_MS))).toBe("upcoming")
  })

  it("returns 'unscheduled' for 31 days from now", () => {
    expect(getShootUrgency(ts(31 * DAY_MS))).toBe("unscheduled")
  })

  it("returns 'unscheduled' for 90 days from now", () => {
    expect(getShootUrgency(ts(90 * DAY_MS))).toBe("unscheduled")
  })

  it("returns 'unscheduled' for null launch date", () => {
    expect(getShootUrgency(null)).toBe("unscheduled")
  })

  it("returns 'unscheduled' for undefined launch date", () => {
    expect(getShootUrgency(undefined)).toBe("unscheduled")
  })
})

describe("getUrgencyLabel", () => {
  it("returns 'OVERDUE' for overdue", () => {
    expect(getUrgencyLabel("overdue")).toBe("OVERDUE")
  })

  it("returns 'URGENT' for urgent", () => {
    expect(getUrgencyLabel("urgent")).toBe("URGENT")
  })

  it("returns 'SOON' for soon", () => {
    expect(getUrgencyLabel("soon")).toBe("SOON")
  })

  it("returns 'UPCOMING' for upcoming", () => {
    expect(getUrgencyLabel("upcoming")).toBe("UPCOMING")
  })

  it("returns 'UNSCHEDULED' for unscheduled", () => {
    expect(getUrgencyLabel("unscheduled")).toBe("UNSCHEDULED")
  })
})

describe("getUrgencyColor", () => {
  it("returns token-based red classes for overdue", () => {
    expect(getUrgencyColor("overdue")).toContain("--color-status-red-bg")
  })

  it("returns token-based amber classes for urgent", () => {
    expect(getUrgencyColor("urgent")).toContain("--color-status-amber-bg")
  })

  it("returns token-based amber classes for soon", () => {
    expect(getUrgencyColor("soon")).toContain("--color-status-amber-bg")
  })

  it("returns token-based blue classes for upcoming", () => {
    expect(getUrgencyColor("upcoming")).toContain("--color-status-blue-bg")
  })

  it("returns token-based gray classes for unscheduled", () => {
    expect(getUrgencyColor("unscheduled")).toContain("--color-status-gray-bg")
  })
})

describe("getUrgencyTimeText", () => {
  it("returns '5 days overdue' for 5 days past", () => {
    expect(getUrgencyTimeText(ts(-5 * DAY_MS))).toBe("5 days overdue")
  })

  it("returns '1 day overdue' for 1 day past (singular)", () => {
    expect(getUrgencyTimeText(ts(-1 * DAY_MS))).toBe("1 day overdue")
  })

  it("returns days left for a future date", () => {
    const text = getUrgencyTimeText(ts(3 * DAY_MS))
    expect(text).toMatch(/\d+ days? left/)
  })

  it("returns '1 day left' for ~1 day in the future (singular)", () => {
    // Use exactly 1 day ahead to get ceil = 1
    expect(getUrgencyTimeText(ts(DAY_MS))).toBe("1 day left")
  })

  it("returns null for null launch date", () => {
    expect(getUrgencyTimeText(null)).toBeNull()
  })

  it("returns null for undefined launch date", () => {
    expect(getUrgencyTimeText(undefined)).toBeNull()
  })
})

describe("getUrgencySortOrder", () => {
  it("ranks overdue highest (0)", () => {
    expect(getUrgencySortOrder("overdue")).toBe(0)
  })

  it("ranks urgent second (1)", () => {
    expect(getUrgencySortOrder("urgent")).toBe(1)
  })

  it("ranks soon third (2)", () => {
    expect(getUrgencySortOrder("soon")).toBe(2)
  })

  it("ranks upcoming fourth (3)", () => {
    expect(getUrgencySortOrder("upcoming")).toBe(3)
  })

  it("ranks unscheduled last (4)", () => {
    expect(getUrgencySortOrder("unscheduled")).toBe(4)
  })

  it("maintains correct ordering: overdue < urgent < soon < upcoming < unscheduled", () => {
    expect(getUrgencySortOrder("overdue")).toBeLessThan(getUrgencySortOrder("urgent"))
    expect(getUrgencySortOrder("urgent")).toBeLessThan(getUrgencySortOrder("soon"))
    expect(getUrgencySortOrder("soon")).toBeLessThan(getUrgencySortOrder("upcoming"))
    expect(getUrgencySortOrder("upcoming")).toBeLessThan(getUrgencySortOrder("unscheduled"))
  })
})
