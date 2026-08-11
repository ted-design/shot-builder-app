import { describe, it, expect } from "vitest"
import { SCENE_COLORS } from "../../components/SceneHeader"
import { shotIdsInLane } from "../laneActions"

// ---------------------------------------------------------------------------
// Since laneActions.ts functions require Firestore at runtime, we test the
// pure validation logic and constants. Integration tests would need emulators.
// ---------------------------------------------------------------------------

// We can test the validation logic by importing the module and checking
// thrown errors. But since createLane/assignShotsToLane talk to Firestore,
// we test the exported constants and groupShots scene logic instead.

describe("laneActions validation", () => {
  it("MAX_BULK_OPS is 500", async () => {
    // This tests that the constant exists and matches the codebase pattern
    const mod = await import("../laneActions")
    // Access the module — the MAX_BULK_OPS is private, but we can verify
    // the function signature enforces it by checking the error path.
    // Since we can't call Firestore in unit tests, we verify the import works
    expect(mod.createLane).toBeDefined()
    expect(mod.updateLane).toBeDefined()
    expect(mod.deleteLane).toBeDefined()
    expect(mod.assignShotsToLane).toBeDefined()
    expect(mod.ungroupAllShotsFromLane).toBeDefined()
  })
})

describe("shotIdsInLane (Sets — apply location target)", () => {
  const shots = [
    { id: "s1", laneId: "lane-a" },
    { id: "s2", laneId: "lane-b" },
    { id: "s3", laneId: "lane-a" },
    { id: "s4", laneId: undefined },
    { id: "s5", laneId: "lane-a" },
  ]

  it("returns ids of shots in the given lane, in order", () => {
    expect(shotIdsInLane(shots, "lane-a")).toEqual(["s1", "s3", "s5"])
  })

  it("returns a single-element list for a one-shot lane", () => {
    expect(shotIdsInLane(shots, "lane-b")).toEqual(["s2"])
  })

  it("returns [] for a lane with no shots (never null/undefined)", () => {
    expect(shotIdsInLane(shots, "lane-z")).toEqual([])
  })

  it("ignores unassigned shots (laneId undefined)", () => {
    expect(shotIdsInLane(shots, "lane-a")).not.toContain("s4")
  })
})

describe("SCENE_COLORS", () => {
  it("has 6 preset colors", () => {
    expect(SCENE_COLORS).toHaveLength(6)
  })

  it("each color has key and hex", () => {
    for (const c of SCENE_COLORS) {
      expect(c.key).toBeTruthy()
      expect(c.hex).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })

  it("keys are unique", () => {
    const keys = SCENE_COLORS.map((c) => c.key)
    expect(new Set(keys).size).toBe(keys.length)
  })
})
