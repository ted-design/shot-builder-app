import { describe, it, expect } from "vitest"
import { groupShots } from "../shotListFilters"
import type { Shot } from "@/shared/types"

function makeShot(overrides: Partial<Shot> & { id: string }): Shot {
  return {
    title: "Test",
    description: undefined,
    projectId: "proj-1",
    clientId: "client-1",
    status: "todo",
    talent: [],
    products: [],
    sortOrder: 0,
    shotNumber: undefined,
    date: undefined,
    deleted: false,
    notes: undefined,
    referenceLinks: [],
    createdAt: null,
    updatedAt: null,
    createdBy: "user-1",
    ...overrides,
  } as Shot
}

const EMPTY_LOOKUPS = {
  talentNameById: new Map<string, string>(),
  locationNameById: new Map<string, string>(),
}

describe("groupShots — scene grouping", () => {
  it("returns null for groupKey 'none'", () => {
    const shots = [makeShot({ id: "s1" })]
    expect(groupShots(shots, "none", EMPTY_LOOKUPS)).toBeNull()
  })

  it("groups shots by laneId", () => {
    const shots = [
      makeShot({ id: "s1", laneId: "lane-a" }),
      makeShot({ id: "s2", laneId: "lane-a" }),
      makeShot({ id: "s3", laneId: "lane-b" }),
    ]
    const laneNameById = new Map([
      ["lane-a", "Beach"],
      ["lane-b", "Studio"],
    ])
    const groups = groupShots(shots, "scene", { ...EMPTY_LOOKUPS, laneNameById })
    expect(groups).not.toBeNull()
    expect(groups!).toHaveLength(2)
    expect(groups![0]!.key).toBe("lane-a")
    expect(groups![0]!.label).toBe("Beach")
    expect(groups![0]!.shots).toHaveLength(2)
    expect(groups![1]!.key).toBe("lane-b")
    expect(groups![1]!.label).toBe("Studio")
    expect(groups![1]!.shots).toHaveLength(1)
  })

  it("puts ungrouped shots last", () => {
    const shots = [
      makeShot({ id: "s1", laneId: "lane-a" }),
      makeShot({ id: "s2" }), // no laneId
      makeShot({ id: "s3", laneId: undefined }),
    ]
    const laneNameById = new Map([["lane-a", "Beach"]])
    const groups = groupShots(shots, "scene", { ...EMPTY_LOOKUPS, laneNameById })
    expect(groups).not.toBeNull()
    expect(groups!).toHaveLength(2)
    expect(groups![0]!.label).toBe("Beach")
    expect(groups![1]!.key).toBe("__ungrouped")
    expect(groups![1]!.label).toBe("Ungrouped")
    expect(groups![1]!.shots).toHaveLength(2)
  })

  it("sorts scenes by laneOrder", () => {
    const shots = [
      makeShot({ id: "s1", laneId: "lane-b" }),
      makeShot({ id: "s2", laneId: "lane-a" }),
    ]
    const laneNameById = new Map([
      ["lane-a", "Studio"],
      ["lane-b", "Beach"],
    ])
    const laneOrder = new Map([
      ["lane-a", 2],
      ["lane-b", 1],
    ])
    const groups = groupShots(shots, "scene", { ...EMPTY_LOOKUPS, laneNameById, laneOrder })
    expect(groups![0]!.label).toBe("Beach") // sortOrder 1
    expect(groups![1]!.label).toBe("Studio") // sortOrder 2
  })

  it("handles all shots ungrouped", () => {
    const shots = [
      makeShot({ id: "s1" }),
      makeShot({ id: "s2" }),
    ]
    const groups = groupShots(shots, "scene", EMPTY_LOOKUPS)
    expect(groups!).toHaveLength(1)
    expect(groups![0]!.key).toBe("__ungrouped")
    expect(groups![0]!.shots).toHaveLength(2)
  })

  it("handles empty shot list", () => {
    const groups = groupShots([], "scene", EMPTY_LOOKUPS)
    expect(groups).not.toBeNull()
    expect(groups!).toHaveLength(0)
  })

  it("uses 'Unnamed Scene' for unknown laneId", () => {
    const shots = [
      makeShot({ id: "s1", laneId: "unknown-lane" }),
    ]
    const groups = groupShots(shots, "scene", EMPTY_LOOKUPS)
    expect(groups![0]!.label).toBe("Unnamed Scene")
  })

  it("falls back to alphabetical when laneOrder is not provided", () => {
    const shots = [
      makeShot({ id: "s1", laneId: "lane-z" }),
      makeShot({ id: "s2", laneId: "lane-a" }),
    ]
    const laneNameById = new Map([
      ["lane-z", "Zebra"],
      ["lane-a", "Alpha"],
    ])
    const groups = groupShots(shots, "scene", { ...EMPTY_LOOKUPS, laneNameById })
    // Without laneOrder, both have sortOrder 0, so alphabetical fallback
    expect(groups![0]!.label).toBe("Alpha")
    expect(groups![1]!.label).toBe("Zebra")
  })

  it("preserves shot order within groups", () => {
    const shots = [
      makeShot({ id: "s1", laneId: "lane-a", sortOrder: 1 }),
      makeShot({ id: "s2", laneId: "lane-a", sortOrder: 3 }),
      makeShot({ id: "s3", laneId: "lane-a", sortOrder: 2 }),
    ]
    const laneNameById = new Map([["lane-a", "Beach"]])
    const groups = groupShots(shots, "scene", { ...EMPTY_LOOKUPS, laneNameById })
    // Shots are in the order they were passed (s1, s2, s3)
    // groupShots doesn't re-sort within groups — the input is pre-sorted
    expect(groups![0]!.shots.map((s) => s.id)).toEqual(["s1", "s2", "s3"])
  })

  it("treats shots with orphaned laneId as ungrouped when laneById is provided", () => {
    const shots = [
      makeShot({ id: "s1", laneId: "lane-a" }),
      makeShot({ id: "s2", laneId: "deleted-lane" }), // references deleted lane
      makeShot({ id: "s3" }), // truly ungrouped
    ]
    const laneNameById = new Map([["lane-a", "Beach"]])
    // laneById only contains the existing lane
    const laneById = new Map<string, import("@/shared/types").Lane>([
      [
        "lane-a",
        {
          id: "lane-a",
          name: "Beach",
          projectId: "proj-1",
          clientId: "client-1",
          sortOrder: 0,
          sceneNumber: 1,
          createdAt: null,
          updatedAt: null,
          createdBy: "user-1",
        } as import("@/shared/types").Lane,
      ],
    ])
    const groups = groupShots(shots, "scene", { ...EMPTY_LOOKUPS, laneNameById, laneById })
    expect(groups).not.toBeNull()
    expect(groups!).toHaveLength(2)
    // Beach has s1, Ungrouped has orphan (s2) + s3
    const beach = groups!.find((g) => g.key === "lane-a")
    const ungrouped = groups!.find((g) => g.key === "__ungrouped")
    expect(beach!.shots.map((s) => s.id)).toEqual(["s1"])
    expect(ungrouped!.shots.map((s) => s.id).sort()).toEqual(["s2", "s3"])
  })
})
