import { describe, it, expect } from "vitest"
import { resolveAdditionalImageSrcs, statusMeta } from "../reportShared"

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

// resolveAdditionalImageSrcs (WS-C, 2026-08-11) — resolves a shot's
// additionalImages candidates through the sidecar map, dropping (not
// placeholder-rendering) anything unresolved.
describe("resolveAdditionalImageSrcs", () => {
  it("resolves every candidate present in the map, in order", () => {
    const map = new Map([
      ["a", "src-a"],
      ["b", "src-b"],
    ])
    expect(resolveAdditionalImageSrcs(map, ["a", "b"])).toEqual(["src-a", "src-b"])
  })

  it("drops a candidate with no resolved src instead of rendering an empty slot", () => {
    const map = new Map([["a", "src-a"]])
    expect(resolveAdditionalImageSrcs(map, ["a", "missing", "b"])).toEqual(["src-a"])
  })

  it("returns [] for undefined or empty candidates — no crash", () => {
    expect(resolveAdditionalImageSrcs(new Map(), undefined)).toEqual([])
    expect(resolveAdditionalImageSrcs(new Map(), [])).toEqual([])
  })
})
