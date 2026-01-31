import { describe, it, expect } from "vitest"
import {
  ROLE,
  normalizeRole,
  resolveEffectiveRole,
  roleLabel,
  canManageProjects,
  canManageShots,
  canManagePulls,
  canFulfillPulls,
  isViewer,
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

  it("returns viewer for unknown roles", () => {
    expect(normalizeRole("unknown")).toBe("viewer")
    expect(normalizeRole("")).toBe("viewer")
    expect(normalizeRole(null)).toBe("viewer")
    expect(normalizeRole(undefined)).toBe("viewer")
    expect(normalizeRole(42)).toBe("viewer")
    expect(normalizeRole({})).toBe("viewer")
  })
})

describe("resolveEffectiveRole", () => {
  it("uses project-scoped role when available", () => {
    expect(
      resolveEffectiveRole("viewer", { "proj-1": "admin" }, "proj-1"),
    ).toBe("admin")
  })

  it("falls back to global role when no project role", () => {
    expect(
      resolveEffectiveRole("producer", { "proj-1": "admin" }, "proj-2"),
    ).toBe("producer")
  })

  it("falls back to global when no projectRoles", () => {
    expect(resolveEffectiveRole("crew")).toBe("crew")
  })

  it("falls back to viewer when no roles at all", () => {
    expect(resolveEffectiveRole(undefined)).toBe("viewer")
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

  describe("isViewer", () => {
    it("viewer is viewer", () => {
      expect(isViewer("viewer")).toBe(true)
    })

    it("admin is not viewer", () => {
      expect(isViewer("admin")).toBe(false)
    })
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
