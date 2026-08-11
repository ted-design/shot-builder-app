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

  // The reserved green/amber/blue/gray dot palette (STATUS_DOT in
  // reportShared.ts) has its own coverage — restored here after the prior
  // statusMetaLegacy-comparison assertion was deleted with no replacement.
  it("statusMeta assigns the reserved dot palette per status", () => {
    expect(statusMeta("complete").dotClass).toBe("sb-status--complete")
    expect(statusMeta("todo").dotClass).toBe("sb-status--todo")
    expect(statusMeta("in_progress").dotClass).toBe("sb-status--progress")
    expect(statusMeta("on_hold").dotClass).toBe("sb-status--hold")
  })
})
