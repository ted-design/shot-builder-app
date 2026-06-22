import { describe, it, expect } from "vitest"
import { statusMeta, statusMetaLegacy } from "../reportShared"

// Locks the R3 label scoping: the two new recipes use the CLAUDE.md canonical
// labels; the shipped image-led report keeps its original labels unchanged.
describe("report status labels", () => {
  it("statusMeta (new recipes) uses canonical labels", () => {
    expect(statusMeta("on_hold").label).toBe("On Hold")
    expect(statusMeta("todo").label).toBe("Draft")
    expect(statusMeta("in_progress").label).toBe("In Progress")
    expect(statusMeta("complete").label).toBe("Shot")
  })

  it("statusMetaLegacy (image-led) keeps the original live labels", () => {
    expect(statusMetaLegacy("on_hold").label).toBe("On hold")
    expect(statusMetaLegacy("todo").label).toBe("To do")
    expect(statusMetaLegacy("in_progress").label).toBe("In progress")
    expect(statusMetaLegacy("complete").label).toBe("Shot")
  })

  it("both keep the same reserved dot palette", () => {
    expect(statusMeta("on_hold").dotClass).toBe(statusMetaLegacy("on_hold").dotClass)
  })
})
