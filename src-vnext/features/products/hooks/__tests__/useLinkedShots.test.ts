import { describe, it, expect } from "vitest"
import {
  groupLinkedShotsByProject,
  type LinkedShotEntry,
} from "@/features/products/hooks/useLinkedShots"

function makeShotEntry(overrides: Partial<LinkedShotEntry> = {}): LinkedShotEntry {
  return {
    shotId: "shot-1",
    projectId: "proj-1",
    projectName: "Project Alpha",
    title: "Shot Title",
    shotNumber: "001",
    status: "todo",
    heroImageUrl: null,
    ...overrides,
  }
}

describe("groupLinkedShotsByProject", () => {
  it("returns empty array for empty input", () => {
    const result = groupLinkedShotsByProject([])
    expect(result).toEqual([])
  })

  it("groups shots by projectId", () => {
    const entries: readonly LinkedShotEntry[] = [
      makeShotEntry({ shotId: "s1", projectId: "p1", projectName: "Alpha" }),
      makeShotEntry({ shotId: "s2", projectId: "p2", projectName: "Beta" }),
      makeShotEntry({ shotId: "s3", projectId: "p1", projectName: "Alpha" }),
    ]

    const groups = groupLinkedShotsByProject(entries)

    expect(groups).toHaveLength(2)
    expect(groups[0]!.projectId).toBe("p1")
    expect(groups[0]!.projectName).toBe("Alpha")
    expect(groups[0]!.shots).toHaveLength(2)
    expect(groups[1]!.projectId).toBe("p2")
    expect(groups[1]!.shots).toHaveLength(1)
  })

  it("uses projectId as fallback when projectName is empty", () => {
    const entries: readonly LinkedShotEntry[] = [
      makeShotEntry({ shotId: "s1", projectId: "p1", projectName: "" }),
    ]

    const groups = groupLinkedShotsByProject(entries)

    expect(groups).toHaveLength(1)
    expect(groups[0]!.projectName).toBe("p1")
  })

  it("uses 'Unknown Project' when both projectName and projectId are empty", () => {
    const entries: readonly LinkedShotEntry[] = [
      makeShotEntry({ shotId: "s1", projectId: "", projectName: "" }),
    ]

    const groups = groupLinkedShotsByProject(entries)

    expect(groups).toHaveLength(1)
    expect(groups[0]!.projectName).toBe("Unknown Project")
  })

  it("preserves shot data within groups", () => {
    const entries: readonly LinkedShotEntry[] = [
      makeShotEntry({
        shotId: "s1",
        projectId: "p1",
        projectName: "Alpha",
        title: "Hero Shot",
        shotNumber: "042",
        status: "complete",
        heroImageUrl: "https://example.com/img.jpg",
      }),
    ]

    const groups = groupLinkedShotsByProject(entries)

    expect(groups).toHaveLength(1)
    const shot = groups[0]!.shots[0]!
    expect(shot.shotId).toBe("s1")
    expect(shot.title).toBe("Hero Shot")
    expect(shot.shotNumber).toBe("042")
    expect(shot.status).toBe("complete")
    expect(shot.heroImageUrl).toBe("https://example.com/img.jpg")
  })

  it("groups a single shot correctly", () => {
    const entries: readonly LinkedShotEntry[] = [
      makeShotEntry({ shotId: "s1", projectId: "p1", projectName: "Solo" }),
    ]

    const groups = groupLinkedShotsByProject(entries)

    expect(groups).toHaveLength(1)
    expect(groups[0]!.shots).toHaveLength(1)
  })

  it("handles many projects with one shot each", () => {
    const entries: readonly LinkedShotEntry[] = [
      makeShotEntry({ shotId: "s1", projectId: "p1", projectName: "A" }),
      makeShotEntry({ shotId: "s2", projectId: "p2", projectName: "B" }),
      makeShotEntry({ shotId: "s3", projectId: "p3", projectName: "C" }),
    ]

    const groups = groupLinkedShotsByProject(entries)

    expect(groups).toHaveLength(3)
    for (const group of groups) {
      expect(group.shots).toHaveLength(1)
    }
  })
})
