import { describe, it, expect } from "vitest"
import { mapLane } from "../mapLane"

// Sets initiative — Phase 1. A "Scene" (Lane) is surfaced as a "Set" and now
// carries the location it is built at; shots inherit it on assign. These tests
// pin the new location fields plus prove legacy lanes (no fields) still map.

describe("mapLane — Sets location fields", () => {
  it("maps locationId and denormalized locationName when present", () => {
    const lane = mapLane("lane-1", {
      name: "Room Service",
      projectId: "p1",
      clientId: "c1",
      sortOrder: 2,
      locationId: "loc-b",
      locationName: "Studio B",
    })
    expect(lane.locationId).toBe("loc-b")
    expect(lane.locationName).toBe("Studio B")
  })

  it("collapses null location fields to undefined", () => {
    const lane = mapLane("lane-1", {
      name: "X",
      projectId: "p1",
      clientId: "c1",
      sortOrder: 0,
      locationId: null,
      locationName: null,
    })
    expect(lane.locationId).toBeUndefined()
    expect(lane.locationName).toBeUndefined()
  })

  it("leaves location undefined for legacy lanes lacking the fields (back-compat)", () => {
    const lane = mapLane("lane-1", {
      name: "Legacy",
      projectId: "p1",
      clientId: "c1",
      sortOrder: 0,
    })
    expect(lane.locationId).toBeUndefined()
    expect(lane.locationName).toBeUndefined()
    // Sanity: pre-existing mapping still works.
    expect(lane.name).toBe("Legacy")
    expect(lane.sceneNumber).toBe(1) // sortOrder + 1 fallback
  })
})
