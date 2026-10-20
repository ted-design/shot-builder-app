import { describe, it, expect } from "vitest"
import { collectProjectTalentIds } from "../projectTalent"

const TALENT = [
  { id: "t1", projectIds: ["p1"] },
  { id: "t2", projectIds: [] as string[] },
  { id: "t3", projectIds: ["pX"] },
  { id: "t4" },
]

describe("collectProjectTalentIds", () => {
  it("includes talent linked to the project via projectIds", () => {
    expect([...collectProjectTalentIds([], TALENT, "p1")]).toEqual(["t1"])
  })

  it("includes talent on the project's shots even when not linked to the project", () => {
    const shots = [{ talent: ["t2"] }, { talent: [], talentIds: ["t4"] }]
    const ids = collectProjectTalentIds(shots, TALENT, "p1")
    expect([...ids].sort()).toEqual(["t1", "t2", "t4"])
  })

  it("reads talentIds over talent, matching the filter engine", () => {
    const shots = [{ talent: ["t3"], talentIds: ["t2"] }]
    const ids = collectProjectTalentIds(shots, [], "p1")
    expect([...ids]).toEqual(["t2"])
  })

  it("ignores blank and non-string ids", () => {
    const shots = [{ talent: ["", "  ", 42 as unknown as string, "t2"] }]
    expect([...collectProjectTalentIds(shots, [], "p1")]).toEqual(["t2"])
  })

  it("excludes talent linked only to other projects", () => {
    expect(collectProjectTalentIds([], TALENT, "p1").has("t3")).toBe(false)
  })
})
