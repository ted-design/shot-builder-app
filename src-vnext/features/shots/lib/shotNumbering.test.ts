import { describe, it, expect } from "vitest"
import {
  computeMaxShotNumber,
  formatShotNumber,
  nextShotNumber,
  previewRenumber,
  indexToLetterSuffix,
  formatSceneShotNumber,
  parseSceneShotNumber,
  computeMaxBaseNumber,
  previewRenumberWithScenes,
  buildSceneRenumberUpdates,
} from "./shotNumbering"
import type { Shot } from "@/shared/types"

function makeShot(overrides: Partial<Shot> = {}): Shot {
  return {
    id: "shot-1",
    title: "Test",
    description: null,
    projectId: "proj-1",
    clientId: "client-1",
    status: "todo",
    talent: [],
    products: [],
    sortOrder: 1,
    shotNumber: null,
    date: null,
    deleted: false,
    notes: null,
    referenceLinks: [],
    createdAt: null,
    updatedAt: null,
    createdBy: "user-1",
    ...overrides,
  } as Shot
}

describe("computeMaxShotNumber", () => {
  it("returns 0 for empty array", () => {
    expect(computeMaxShotNumber([])).toBe(0)
  })

  it("returns 0 when no shots have shot numbers", () => {
    const shots = [makeShot(), makeShot({ id: "shot-2" })]
    expect(computeMaxShotNumber(shots)).toBe(0)
  })

  it("extracts numeric suffix from SH-### format", () => {
    const shots = [
      makeShot({ shotNumber: "SH-001" }),
      makeShot({ id: "s2", shotNumber: "SH-005" }),
      makeShot({ id: "s3", shotNumber: "SH-003" }),
    ]
    expect(computeMaxShotNumber(shots)).toBe(5)
  })

  it("handles mixed — some with numbers, some without", () => {
    const shots = [
      makeShot({ shotNumber: "SH-010" }),
      makeShot({ id: "s2", shotNumber: null }),
      makeShot({ id: "s3", shotNumber: "SH-007" }),
    ]
    expect(computeMaxShotNumber(shots)).toBe(10)
  })

  it("handles numbers > 999", () => {
    const shots = [makeShot({ shotNumber: "SH-1234" })]
    expect(computeMaxShotNumber(shots)).toBe(1234)
  })
})

describe("formatShotNumber", () => {
  it("pads single digit to 2 characters", () => {
    expect(formatShotNumber(1)).toBe("01")
  })

  it("keeps double digit as-is", () => {
    expect(formatShotNumber(42)).toBe("42")
  })

  it("keeps triple digit as-is", () => {
    expect(formatShotNumber(100)).toBe("100")
  })

  it("does not truncate numbers > 999", () => {
    expect(formatShotNumber(1000)).toBe("1000")
  })
})

describe("nextShotNumber", () => {
  it("returns 01 for empty project", () => {
    expect(nextShotNumber([])).toBe("01")
  })

  it("increments from the highest existing number", () => {
    const shots = [
      makeShot({ shotNumber: "SH-003" }),
      makeShot({ id: "s2", shotNumber: "SH-007" }),
    ]
    expect(nextShotNumber(shots)).toBe("08")
  })

  it("increments from new-format numbers", () => {
    const shots = [
      makeShot({ shotNumber: "03" }),
      makeShot({ id: "s2", shotNumber: "07" }),
    ]
    expect(nextShotNumber(shots)).toBe("08")
  })
})

describe("previewRenumber", () => {
  it("returns 0 changes when shots are already sequential", () => {
    const shots = [
      makeShot({ id: "a", shotNumber: "01", sortOrder: 0 }),
      makeShot({ id: "b", shotNumber: "02", sortOrder: 1 }),
      makeShot({ id: "c", shotNumber: "03", sortOrder: 2 }),
    ]
    const result = previewRenumber(shots)
    expect(result.changes).toHaveLength(0)
    expect(result.unchangedCount).toBe(3)
  })

  it("detects gaps in shot numbers", () => {
    const shots = [
      makeShot({ id: "a", shotNumber: "02", sortOrder: 0 }),
      makeShot({ id: "b", shotNumber: "05", sortOrder: 1 }),
      makeShot({ id: "c", shotNumber: "06", sortOrder: 2 }),
      makeShot({ id: "d", shotNumber: "10", sortOrder: 3 }),
    ]
    const result = previewRenumber(shots)
    expect(result.changes).toHaveLength(4)
    expect(result.changes[0]).toEqual({
      shotId: "a",
      title: "Test",
      currentNumber: "02",
      newNumber: "01",
    })
    expect(result.changes[1]).toEqual({
      shotId: "b",
      title: "Test",
      currentNumber: "05",
      newNumber: "02",
    })
    expect(result.changes[3]).toEqual({
      shotId: "d",
      title: "Test",
      currentNumber: "10",
      newNumber: "04",
    })
    expect(result.unchangedCount).toBe(0)
  })

  it("handles shots missing shotNumber", () => {
    const shots = [
      makeShot({ id: "a", shotNumber: null, sortOrder: 0 }),
      makeShot({ id: "b", shotNumber: "02", sortOrder: 1 }),
    ]
    const result = previewRenumber(shots)
    // Shot "a" has null shotNumber -> needs "01", shot "b" already has "02" and sortOrder 1
    expect(result.changes).toHaveLength(1)
    expect(result.changes[0]).toEqual({
      shotId: "a",
      title: "Test",
      currentNumber: "\u2014",
      newNumber: "01",
    })
    expect(result.unchangedCount).toBe(1)
  })

  it("uses Untitled for shots without a title", () => {
    const shots = [
      makeShot({ id: "a", title: "", shotNumber: "05", sortOrder: 0 }),
    ]
    const result = previewRenumber(shots)
    expect(result.changes[0]!.title).toBe("Untitled")
  })

  it("detects mismatched sortOrder even when shotNumber is correct", () => {
    const shots = [
      makeShot({ id: "a", shotNumber: "01", sortOrder: 5 }),
      makeShot({ id: "b", shotNumber: "02", sortOrder: 10 }),
    ]
    const result = previewRenumber(shots)
    expect(result.changes).toHaveLength(2)
    expect(result.unchangedCount).toBe(0)
  })

  it("returns empty changes for empty array", () => {
    const result = previewRenumber([])
    expect(result.changes).toHaveLength(0)
    expect(result.unchangedCount).toBe(0)
  })

  it("mixes unchanged and changed shots correctly", () => {
    const shots = [
      makeShot({ id: "a", shotNumber: "01", sortOrder: 0 }),
      makeShot({ id: "b", shotNumber: "05", sortOrder: 1 }),
      makeShot({ id: "c", shotNumber: "06", sortOrder: 2 }),
    ]
    const result = previewRenumber(shots)
    // "a" is correct (01, sortOrder 0). "b" needs 02 not 05. "c" needs 03 not 06.
    expect(result.unchangedCount).toBe(1)
    expect(result.changes).toHaveLength(2)
    expect(result.changes[0]!.shotId).toBe("b")
    expect(result.changes[0]!.newNumber).toBe("02")
    expect(result.changes[1]!.shotId).toBe("c")
    expect(result.changes[1]!.newNumber).toBe("03")
  })
})

// ========================================================================
// Scene-aware numbering
// ========================================================================

describe("indexToLetterSuffix", () => {
  it("converts 0 to A", () => {
    expect(indexToLetterSuffix(0)).toBe("A")
  })

  it("converts 1 to B", () => {
    expect(indexToLetterSuffix(1)).toBe("B")
  })

  it("converts 25 to Z", () => {
    expect(indexToLetterSuffix(25)).toBe("Z")
  })

  it("converts 26 to AA", () => {
    expect(indexToLetterSuffix(26)).toBe("AA")
  })

  it("converts 27 to AB", () => {
    expect(indexToLetterSuffix(27)).toBe("AB")
  })

  it("converts 51 to AZ", () => {
    expect(indexToLetterSuffix(51)).toBe("AZ")
  })

  it("converts 52 to BA", () => {
    expect(indexToLetterSuffix(52)).toBe("BA")
  })

  it("clamps negative to A", () => {
    expect(indexToLetterSuffix(-1)).toBe("A")
    expect(indexToLetterSuffix(-100)).toBe("A")
  })

  it("handles boundary at 701 (ZZ) and clamps beyond", () => {
    expect(indexToLetterSuffix(701)).toBe("ZZ")
    expect(indexToLetterSuffix(702)).toBe("ZZ") // clamped to max
    expect(indexToLetterSuffix(9999)).toBe("ZZ") // clamped to max
  })
})

describe("formatSceneShotNumber", () => {
  it("formats scene 1, index 0 as 1A", () => {
    expect(formatSceneShotNumber(1, 0)).toBe("1A")
  })

  it("formats scene 1, index 2 as 1C", () => {
    expect(formatSceneShotNumber(1, 2)).toBe("1C")
  })

  it("formats scene 51, index 0 as 51A", () => {
    expect(formatSceneShotNumber(51, 0)).toBe("51A")
  })

  it("formats scene 10, index 25 as 10Z", () => {
    expect(formatSceneShotNumber(10, 25)).toBe("10Z")
  })

  it("formats scene 10, index 26 as 10AA", () => {
    expect(formatSceneShotNumber(10, 26)).toBe("10AA")
  })
})

describe("parseSceneShotNumber", () => {
  it("parses 51A into base 51 suffix A", () => {
    expect(parseSceneShotNumber("51A")).toEqual({ base: 51, suffix: "A" })
  })

  it("parses 1C into base 1 suffix C", () => {
    expect(parseSceneShotNumber("1C")).toEqual({ base: 1, suffix: "C" })
  })

  it("parses 10AA into base 10 suffix AA", () => {
    expect(parseSceneShotNumber("10AA")).toEqual({ base: 10, suffix: "AA" })
  })

  it("parses flat number 03 into base 3 suffix null", () => {
    expect(parseSceneShotNumber("03")).toEqual({ base: 3, suffix: null })
  })

  it("parses empty string into base 0 suffix null", () => {
    expect(parseSceneShotNumber("")).toEqual({ base: 0, suffix: null })
  })

  it("parses legacy SH-005 into base 5 suffix null", () => {
    expect(parseSceneShotNumber("SH-005")).toEqual({ base: 5, suffix: null })
  })

  it("handles lowercase letters by normalizing to uppercase", () => {
    expect(parseSceneShotNumber("10a")).toEqual({ base: 10, suffix: "A" })
    expect(parseSceneShotNumber("5bc")).toEqual({ base: 5, suffix: "BC" })
  })
})

describe("computeMaxBaseNumber", () => {
  it("returns 0 for empty array", () => {
    expect(computeMaxBaseNumber([])).toBe(0)
  })

  it("finds max base from scene-numbered shots", () => {
    const shots = [
      makeShot({ id: "a", shotNumber: "51A" }),
      makeShot({ id: "b", shotNumber: "51C" }),
      makeShot({ id: "c", shotNumber: "52B" }),
    ]
    expect(computeMaxBaseNumber(shots)).toBe(52)
  })

  it("finds max base from flat-numbered shots", () => {
    const shots = [
      makeShot({ id: "a", shotNumber: "03" }),
      makeShot({ id: "b", shotNumber: "07" }),
      makeShot({ id: "c", shotNumber: "12" }),
    ]
    expect(computeMaxBaseNumber(shots)).toBe(12)
  })

  it("handles mixed scene and flat numbers", () => {
    const shots = [
      makeShot({ id: "a", shotNumber: "51A" }),
      makeShot({ id: "b", shotNumber: "03" }),
      makeShot({ id: "c", shotNumber: "52B" }),
    ]
    expect(computeMaxBaseNumber(shots)).toBe(52)
  })

  it("ignores shots without numbers", () => {
    const shots = [
      makeShot({ id: "a", shotNumber: "10A" }),
      makeShot({ id: "b", shotNumber: null }),
      makeShot({ id: "c", shotNumber: undefined }),
    ]
    expect(computeMaxBaseNumber(shots)).toBe(10)
  })
})

describe("previewRenumberWithScenes", () => {
  it("assigns letter suffixes to scene shots and sequential to ungrouped", () => {
    const scene1Shots = [
      makeShot({ id: "s1a", title: "Scene 1 Shot A", shotNumber: "01", sortOrder: 0 }),
      makeShot({ id: "s1b", title: "Scene 1 Shot B", shotNumber: "02", sortOrder: 1 }),
      makeShot({ id: "s1c", title: "Scene 1 Shot C", shotNumber: "03", sortOrder: 2 }),
    ]
    const scene2Shots = [
      makeShot({ id: "s2a", title: "Scene 2 Shot A", shotNumber: "04", sortOrder: 3 }),
      makeShot({ id: "s2b", title: "Scene 2 Shot B", shotNumber: "05", sortOrder: 4 }),
    ]
    const ungrouped = [
      makeShot({ id: "u1", title: "Ungrouped 1", shotNumber: "06", sortOrder: 5 }),
      makeShot({ id: "u2", title: "Ungrouped 2", shotNumber: "07", sortOrder: 6 }),
    ]

    const result = previewRenumberWithScenes(
      [
        { sceneNumber: 1, sceneName: "Scene 1", shots: scene1Shots },
        { sceneNumber: 2, sceneName: "Scene 2", shots: scene2Shots },
      ],
      ungrouped,
    )

    // Scene 1: 1A, 1B, 1C
    expect(result.changes.find((c) => c.shotId === "s1a")?.newNumber).toBe("1A")
    expect(result.changes.find((c) => c.shotId === "s1b")?.newNumber).toBe("1B")
    expect(result.changes.find((c) => c.shotId === "s1c")?.newNumber).toBe("1C")
    // Scene 2: 2A, 2B
    expect(result.changes.find((c) => c.shotId === "s2a")?.newNumber).toBe("2A")
    expect(result.changes.find((c) => c.shotId === "s2b")?.newNumber).toBe("2B")
    // Ungrouped: sequential from max scene number + 1 = 3, 4
    expect(result.changes.find((c) => c.shotId === "u1")?.newNumber).toBe("03")
    expect(result.changes.find((c) => c.shotId === "u2")?.newNumber).toBe("04")
  })

  it("includes sceneName in change entries", () => {
    const sceneShots = [
      makeShot({ id: "s1", shotNumber: "01", sortOrder: 0 }),
    ]
    const result = previewRenumberWithScenes(
      [{ sceneNumber: 1, sceneName: "Hero Shots", shots: sceneShots }],
      [],
    )
    expect(result.changes[0]!.sceneName).toBe("Hero Shots")
  })

  it("labels ungrouped shots with empty sceneName", () => {
    const ungrouped = [
      makeShot({ id: "u1", shotNumber: "99", sortOrder: 0 }),
    ]
    const result = previewRenumberWithScenes([], ungrouped)
    expect(result.changes[0]!.sceneName).toBe("")
  })

  it("counts already-correct shots as unchanged", () => {
    const sceneShots = [
      makeShot({ id: "s1a", shotNumber: "1A", sortOrder: 0 }),
      makeShot({ id: "s1b", shotNumber: "1B", sortOrder: 1 }),
    ]
    const result = previewRenumberWithScenes(
      [{ sceneNumber: 1, sceneName: "Scene 1", shots: sceneShots }],
      [],
    )
    expect(result.unchangedCount).toBe(2)
    expect(result.changes).toHaveLength(0)
  })

  it("handles empty scene groups and empty ungrouped", () => {
    const result = previewRenumberWithScenes([], [])
    expect(result.changes).toHaveLength(0)
    expect(result.unchangedCount).toBe(0)
  })

  it("uses Untitled for shots without a title", () => {
    const shots = [
      makeShot({ id: "s1", title: "", shotNumber: "05", sortOrder: 0 }),
    ]
    const result = previewRenumberWithScenes(
      [{ sceneNumber: 1, sceneName: "Scene 1", shots }],
      [],
    )
    expect(result.changes[0]!.title).toBe("Untitled")
  })

  it("shows em-dash for shots without a current number", () => {
    const shots = [
      makeShot({ id: "s1", shotNumber: null, sortOrder: 0 }),
    ]
    const result = previewRenumberWithScenes(
      [{ sceneNumber: 1, sceneName: "Scene 1", shots }],
      [],
    )
    expect(result.changes[0]!.currentNumber).toBe("\u2014")
  })

  it("ungrouped numbering starts after highest scene number", () => {
    const scene5Shots = [
      makeShot({ id: "s5a", shotNumber: "01", sortOrder: 0 }),
    ]
    const ungrouped = [
      makeShot({ id: "u1", shotNumber: "02", sortOrder: 1 }),
    ]
    const result = previewRenumberWithScenes(
      [{ sceneNumber: 5, sceneName: "Late Scene", shots: scene5Shots }],
      ungrouped,
    )
    // Scene 5: 5A. Ungrouped starts at 6.
    expect(result.changes.find((c) => c.shotId === "s5a")?.newNumber).toBe("5A")
    expect(result.changes.find((c) => c.shotId === "u1")?.newNumber).toBe("06")
  })

  it("respects maxSceneNumberOverride for cross-filter safety", () => {
    // User has scenes 1, 2, 5 in project but only scene 2 + ungrouped visible.
    // Ungrouped numbering must start at 6, not 3, to avoid colliding with scene 5 shots.
    const scene2Shots = [makeShot({ id: "s2a", sortOrder: 0 })]
    const ungrouped = [makeShot({ id: "u1", sortOrder: 1 })]
    const result = previewRenumberWithScenes(
      [{ sceneNumber: 2, sceneName: "Visible", shots: scene2Shots }],
      ungrouped,
      5, // override — user has scene 5 hidden by filter
    )
    expect(result.changes.find((c) => c.shotId === "s2a")?.newNumber).toBe("2A")
    expect(result.changes.find((c) => c.shotId === "u1")?.newNumber).toBe("06")
  })

  it("propagates sceneId through to changes for stable grouping in preview UI", () => {
    // Regression: two scenes with the same name should not collide in preview grouping.
    // The preview UI filters by sceneId, not sceneName, so different lane ids must be preserved.
    const sceneA = [makeShot({ id: "a1", sortOrder: 0 })]
    const sceneB = [makeShot({ id: "b1", sortOrder: 1 })]
    const result = previewRenumberWithScenes(
      [
        { sceneId: "lane-A", sceneNumber: 1, sceneName: "Duplicate Name", shots: sceneA },
        { sceneId: "lane-B", sceneNumber: 2, sceneName: "Duplicate Name", shots: sceneB },
      ],
      [],
    )
    // Both changes must have their respective laneId preserved
    const aChange = result.changes.find((c) => c.shotId === "a1")
    const bChange = result.changes.find((c) => c.shotId === "b1")
    expect(aChange?.sceneId).toBe("lane-A")
    expect(bChange?.sceneId).toBe("lane-B")
    // sceneName is still populated (for display) but may collide — that's fine, sceneId disambiguates
    expect(aChange?.sceneName).toBe("Duplicate Name")
    expect(bChange?.sceneName).toBe("Duplicate Name")
  })

  it("defaults sceneId to empty string when caller omits it", () => {
    // Backward compat: callers that don't pass sceneId should still work.
    const shots = [makeShot({ id: "s1", sortOrder: 0 })]
    const result = previewRenumberWithScenes(
      [{ sceneNumber: 1, sceneName: "No ID", shots }],
      [],
    )
    expect(result.changes[0]?.sceneId).toBe("")
  })

  it("tags ungrouped changes with empty sceneId", () => {
    const ungrouped = [makeShot({ id: "u1", sortOrder: 0 })]
    const result = previewRenumberWithScenes([], ungrouped)
    expect(result.changes[0]?.sceneId).toBe("")
  })
})

describe("buildSceneRenumberUpdates", () => {
  it("returns empty array when all shots already have correct numbers and sortOrder", () => {
    const shots = [
      makeShot({ id: "s1", shotNumber: "1A", sortOrder: 0 }),
      makeShot({ id: "s2", shotNumber: "1B", sortOrder: 1 }),
    ]
    const updates = buildSceneRenumberUpdates(
      [{ sceneNumber: 1, shots }],
      [],
    )
    expect(updates).toHaveLength(0)
  })

  it("produces updates for scene shots with letter suffixes", () => {
    const shots = [
      makeShot({ id: "s1", shotNumber: "03", sortOrder: 5 }),
      makeShot({ id: "s2", shotNumber: "07", sortOrder: 9 }),
    ]
    const updates = buildSceneRenumberUpdates(
      [{ sceneNumber: 1, shots }],
      [],
    )
    expect(updates).toHaveLength(2)
    expect(updates[0]).toEqual({ shotId: "s1", newNumber: "1A", newSortOrder: 0 })
    expect(updates[1]).toEqual({ shotId: "s2", newNumber: "1B", newSortOrder: 1 })
  })

  it("continues ungrouped sortOrder from where scene shots left off", () => {
    const sceneShots = [
      makeShot({ id: "s1", sortOrder: 0 }),
      makeShot({ id: "s2", sortOrder: 1 }),
    ]
    const ungrouped = [
      makeShot({ id: "u1", sortOrder: 2 }),
    ]
    const updates = buildSceneRenumberUpdates(
      [{ sceneNumber: 1, shots: sceneShots }],
      ungrouped,
    )
    // s1/s2 already correct → no update. u1 needs "02" with sortOrder 2 (matches — no update)
    // but shotNumber is missing so it IS an update
    const ungroupedUpdate = updates.find((u) => u.shotId === "u1")
    expect(ungroupedUpdate?.newSortOrder).toBe(2)
    expect(ungroupedUpdate?.newNumber).toBe("02")
  })

  it("skips already-correct shots but updates incorrect ones", () => {
    const shots = [
      makeShot({ id: "s1", shotNumber: "1A", sortOrder: 0 }), // correct
      makeShot({ id: "s2", shotNumber: "WRONG", sortOrder: 1 }), // wrong number
      makeShot({ id: "s3", shotNumber: "1C", sortOrder: 99 }), // wrong sortOrder
    ]
    const updates = buildSceneRenumberUpdates(
      [{ sceneNumber: 1, shots }],
      [],
    )
    expect(updates).toHaveLength(2)
    expect(updates.find((u) => u.shotId === "s2")).toBeDefined()
    expect(updates.find((u) => u.shotId === "s3")).toBeDefined()
    expect(updates.find((u) => u.shotId === "s1")).toBeUndefined()
  })

  it("applies maxSceneNumberOverride to ungrouped start", () => {
    const ungrouped = [makeShot({ id: "u1", sortOrder: 0 })]
    const updates = buildSceneRenumberUpdates([], ungrouped, 10)
    expect(updates[0]?.newNumber).toBe("11")
  })
})
