import { describe, it, expect } from "vitest"
import {
  ROLE,
  normalizeRole,
  roleLabel,
  canManageProjects,
  canManageShots,
  canManageProducts,
  canGeneratePulls,
  canManagePulls,
  canFulfillPulls,
  canEditScene,
  canRestoreVersions,
  roleRank,
} from "./rbac"

describe("normalizeRole", () => {
  it("normalizes known roles", () => {
    expect(normalizeRole("admin")).toBe("admin")
    expect(normalizeRole("producer")).toBe("producer")
    expect(normalizeRole("crew")).toBe("crew")
    expect(normalizeRole("warehouse")).toBe("warehouse")
    expect(normalizeRole("viewer")).toBe("viewer")
  })

  it("handles case insensitivity", () => {
    expect(normalizeRole("Admin")).toBe("admin")
    expect(normalizeRole("PRODUCER")).toBe("producer")
    expect(normalizeRole("  Crew  ")).toBe("crew")
  })

  it("adopts the legacy 'wardrobe' alias as warehouse (matches firestore.rules normalizedRole)", () => {
    expect(normalizeRole("wardrobe")).toBe("warehouse")
    expect(normalizeRole("Wardrobe")).toBe("warehouse")
    expect(normalizeRole("  WARDROBE  ")).toBe("warehouse")
  })

  it("returns viewer for unknown roles", () => {
    expect(normalizeRole("unknown")).toBe("viewer")
    expect(normalizeRole("")).toBe("viewer")
    expect(normalizeRole(null)).toBe("viewer")
    expect(normalizeRole(undefined)).toBe("viewer")
    expect(normalizeRole(42)).toBe("viewer")
    expect(normalizeRole({})).toBe("viewer")
  })
})

describe("roleLabel", () => {
  it("returns correct labels", () => {
    expect(roleLabel("admin")).toBe("Admin")
    expect(roleLabel("producer")).toBe("Producer")
    expect(roleLabel("crew")).toBe("Crew")
    expect(roleLabel("warehouse")).toBe("Warehouse")
    expect(roleLabel("viewer")).toBe("Viewer")
  })
})

describe("permission checks", () => {
  describe("canManageProjects", () => {
    it("admin can manage projects", () => {
      expect(canManageProjects("admin")).toBe(true)
    })

    it("producer can manage projects", () => {
      expect(canManageProjects("producer")).toBe(true)
    })

    it("crew cannot manage projects", () => {
      expect(canManageProjects("crew")).toBe(false)
    })

    it("warehouse cannot manage projects", () => {
      expect(canManageProjects("warehouse")).toBe(false)
    })

    it("viewer cannot manage projects", () => {
      expect(canManageProjects("viewer")).toBe(false)
    })
  })

  describe("canManageShots", () => {
    it("admin can manage shots", () => {
      expect(canManageShots("admin")).toBe(true)
    })

    it("producer can manage shots", () => {
      expect(canManageShots("producer")).toBe(true)
    })

    it("crew can manage shots", () => {
      expect(canManageShots("crew")).toBe(true)
    })

    it("warehouse cannot manage shots", () => {
      expect(canManageShots("warehouse")).toBe(false)
    })

    it("viewer cannot manage shots", () => {
      expect(canManageShots("viewer")).toBe(false)
    })
  })

  describe("canManageProducts", () => {
    it("admin can manage products", () => {
      expect(canManageProducts("admin")).toBe(true)
    })

    it("producer can manage products", () => {
      expect(canManageProducts("producer")).toBe(true)
    })

    it("crew cannot manage products", () => {
      expect(canManageProducts("crew")).toBe(false)
    })

    it("warehouse cannot manage products", () => {
      expect(canManageProducts("warehouse")).toBe(false)
    })

    it("viewer cannot manage products", () => {
      expect(canManageProducts("viewer")).toBe(false)
    })
  })

  describe("canManagePulls", () => {
    it("admin can manage pulls", () => {
      expect(canManagePulls("admin")).toBe(true)
    })

    it("producer can manage pulls", () => {
      expect(canManagePulls("producer")).toBe(true)
    })

    it("warehouse can manage pulls", () => {
      expect(canManagePulls("warehouse")).toBe(true)
    })

    it("crew cannot manage pulls", () => {
      expect(canManagePulls("crew")).toBe(false)
    })

    it("viewer cannot manage pulls", () => {
      expect(canManagePulls("viewer")).toBe(false)
    })
  })

  describe("canGeneratePulls", () => {
    it("admin can generate pulls", () => {
      expect(canGeneratePulls("admin")).toBe(true)
    })

    it("producer can generate pulls", () => {
      expect(canGeneratePulls("producer")).toBe(true)
    })

    it("crew cannot generate pulls", () => {
      expect(canGeneratePulls("crew")).toBe(false)
    })

    it("warehouse cannot generate pulls", () => {
      expect(canGeneratePulls("warehouse")).toBe(false)
    })

    it("viewer cannot generate pulls", () => {
      expect(canGeneratePulls("viewer")).toBe(false)
    })
  })

  describe("canFulfillPulls", () => {
    it("admin can fulfill pulls", () => {
      expect(canFulfillPulls("admin")).toBe(true)
    })

    it("warehouse can fulfill pulls", () => {
      expect(canFulfillPulls("warehouse")).toBe(true)
    })

    it("producer cannot fulfill pulls", () => {
      expect(canFulfillPulls("producer")).toBe(false)
    })
  })

})

describe("canEditScene (5f-III A1 — warehouse revoked)", () => {
  // 5f-III revoke (A1): canEditScene is now admin || producer ONLY. Warehouse,
  // which 5f-II kept for lane-write, no longer edits scenes/lanes — the surface
  // is read-only for warehouse. This change is scene/lane-edit UI ONLY; it does
  // NOT touch warehouse PULLS (canManagePulls, below) — guarded against
  // over-reach by the "warehouse keeps pulls" pin in canManagePulls.
  it("admin can edit scenes", () => {
    expect(canEditScene("admin")).toBe(true)
  })

  it("producer can edit scenes", () => {
    expect(canEditScene("producer")).toBe(true)
  })

  it("warehouse CANNOT edit scenes (5f-III A1 revoke — review surface is read-only)", () => {
    expect(canEditScene("warehouse")).toBe(false)
  })

  it("crew cannot edit scenes (crew writes shots, not lanes)", () => {
    expect(canEditScene("crew")).toBe(false)
  })

  it("viewer cannot edit scenes", () => {
    expect(canEditScene("viewer")).toBe(false)
  })

  // Over-reach guard: A1 removes scene-edit from warehouse but MUST NOT strip
  // its pull capability (canManagePulls is a separate helper). If a future edit
  // accidentally widened A1's revoke to pulls, this pin fails.
  it("warehouse KEEPS pulls after the scene-edit revoke (A1 is cleanly scoped)", () => {
    expect(canEditScene("warehouse")).toBe(false)
    expect(canManagePulls("warehouse")).toBe(true)
  })
})

describe("canRestoreVersions", () => {
  // Consolidates the 5a version-history twins (shot + product History
  // sections). Intentionally narrower than the shot rules' ['producer','crew']
  // arms — crew stays excluded until a 5e/5f decision widens it.
  it("admin can restore versions", () => {
    expect(canRestoreVersions("admin")).toBe(true)
  })

  it("producer can restore versions", () => {
    expect(canRestoreVersions("producer")).toBe(true)
  })

  it("crew cannot restore versions (UI narrower than the shot rules on purpose)", () => {
    expect(canRestoreVersions("crew")).toBe(false)
  })

  it("warehouse cannot restore versions", () => {
    expect(canRestoreVersions("warehouse")).toBe(false)
  })

  it("viewer cannot restore versions", () => {
    expect(canRestoreVersions("viewer")).toBe(false)
  })
})

describe("roleRank", () => {
  it("orders admin > producer > crew/warehouse > viewer", () => {
    expect(roleRank("admin")).toBeGreaterThan(roleRank("producer"))
    expect(roleRank("producer")).toBeGreaterThan(roleRank("crew"))
    expect(roleRank("producer")).toBeGreaterThan(roleRank("warehouse"))
    expect(roleRank("crew")).toBeGreaterThan(roleRank("viewer"))
    expect(roleRank("warehouse")).toBeGreaterThan(roleRank("viewer"))
  })

  it("treats crew and warehouse as lateral (equal rank, no downgrade either way)", () => {
    expect(roleRank("crew")).toBe(roleRank("warehouse"))
  })
})

describe("ROLE constants", () => {
  it("has all 5 roles", () => {
    expect(Object.keys(ROLE)).toHaveLength(5)
    expect(ROLE.ADMIN).toBe("admin")
    expect(ROLE.PRODUCER).toBe("producer")
    expect(ROLE.CREW).toBe("crew")
    expect(ROLE.WAREHOUSE).toBe("warehouse")
    expect(ROLE.VIEWER).toBe("viewer")
  })
})
