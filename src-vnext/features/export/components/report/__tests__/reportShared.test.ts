import { describe, it, expect } from "vitest"
import { statusMeta } from "../reportShared"

// Locks the canonical status-label vocabulary (statusMappings.ts): all three
// report recipes (image-led, production-sheet, balanced-rows) share it — no
// per-recipe label exception.
describe("report status labels", () => {
  it("statusMeta uses canonical labels", () => {
    expect(statusMeta("on_hold").label).toBe("On Hold")
    expect(statusMeta("todo").label).toBe("Draft")
    expect(statusMeta("in_progress").label).toBe("In Progress")
    expect(statusMeta("complete").label).toBe("Shot")
  })
})
