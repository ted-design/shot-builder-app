import { describe, it, expect } from "vitest"
import { buildFamilyProjectMap } from "../useProductProjectMap"

function makeShot(overrides: {
  projectId?: string
  projectName?: string
  familyIds?: readonly string[]
  deleted?: boolean
}) {
  return {
    projectId: overrides.projectId ?? "proj-1",
    projectName: overrides.projectName ?? "Project One",
    familyIds: overrides.familyIds ?? [],
    deleted: overrides.deleted ?? false,
  }
}

describe("buildFamilyProjectMap", () => {
  it("returns empty maps for empty shots array", () => {
    const result = buildFamilyProjectMap([])
    expect(result.familyProjectMap.size).toBe(0)
    expect(result.projectNames.size).toBe(0)
  })

  it("maps one shot with one product to the correct projectId", () => {
    const shots = [makeShot({ familyIds: ["fam-a"] })]
    const result = buildFamilyProjectMap(shots)

    expect(result.familyProjectMap.size).toBe(1)
    const projects = result.familyProjectMap.get("fam-a")
    expect(projects).toBeDefined()
    expect(projects!.has("proj-1")).toBe(true)
    expect(projects!.size).toBe(1)

    expect(result.projectNames.get("proj-1")).toBe("Project One")
  })

  it("maps a family across multiple projects", () => {
    const shots = [
      makeShot({
        projectId: "proj-1",
        projectName: "Alpha",
        familyIds: ["fam-a"],
      }),
      makeShot({
        projectId: "proj-2",
        projectName: "Beta",
        familyIds: ["fam-a"],
      }),
    ]
    const result = buildFamilyProjectMap(shots)

    const projects = result.familyProjectMap.get("fam-a")
    expect(projects).toBeDefined()
    expect(projects!.size).toBe(2)
    expect(projects!.has("proj-1")).toBe(true)
    expect(projects!.has("proj-2")).toBe(true)

    expect(result.projectNames.get("proj-1")).toBe("Alpha")
    expect(result.projectNames.get("proj-2")).toBe("Beta")
  })

  it("excludes deleted shots", () => {
    const shots = [
      makeShot({ familyIds: ["fam-a"], deleted: true }),
      makeShot({
        projectId: "proj-2",
        projectName: "Beta",
        familyIds: ["fam-b"],
      }),
    ]
    const result = buildFamilyProjectMap(shots)

    expect(result.familyProjectMap.has("fam-a")).toBe(false)
    expect(result.familyProjectMap.get("fam-b")?.has("proj-2")).toBe(true)
  })

  it("handles multiple families in a single shot", () => {
    const shots = [
      makeShot({ familyIds: ["fam-a", "fam-b", "fam-c"] }),
    ]
    const result = buildFamilyProjectMap(shots)

    expect(result.familyProjectMap.size).toBe(3)
    for (const famId of ["fam-a", "fam-b", "fam-c"]) {
      expect(result.familyProjectMap.get(famId)?.has("proj-1")).toBe(true)
    }
  })

  it("deduplicates same projectId for same family across multiple shots", () => {
    const shots = [
      makeShot({ familyIds: ["fam-a"] }),
      makeShot({ familyIds: ["fam-a"] }),
    ]
    const result = buildFamilyProjectMap(shots)

    const projects = result.familyProjectMap.get("fam-a")
    expect(projects!.size).toBe(1)
  })

  it("skips shots with empty projectId", () => {
    const shots = [
      makeShot({ projectId: "", familyIds: ["fam-a"] }),
    ]
    const result = buildFamilyProjectMap(shots)

    expect(result.familyProjectMap.size).toBe(0)
  })
})
