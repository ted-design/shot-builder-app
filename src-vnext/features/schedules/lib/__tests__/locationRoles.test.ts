import { describe, it, expect } from "vitest"
import type { LocationBlock } from "@/shared/types"
import {
  CANONICAL_ROLE_ORDER,
  compareLocationsByRole,
  inferLocationRole,
  resolveLocationRole,
  roleDisplayLabel,
  type LocationRole,
} from "../locationRoles"

function makeBlock(overrides: Partial<LocationBlock> = {}): LocationBlock {
  return {
    id: "block-1",
    title: "Location",
    ref: null,
    showName: true,
    showPhone: false,
    ...overrides,
  }
}

describe("inferLocationRole", () => {
  it("maps 'Basecamp' to 'basecamp'", () => {
    expect(inferLocationRole("Basecamp")).toBe("basecamp")
  })

  it("maps a lowercase 'basecamp' to 'basecamp'", () => {
    expect(inferLocationRole("basecamp")).toBe("basecamp")
  })

  it("trims padding and is case-insensitive", () => {
    expect(inferLocationRole("  BASECAMP  ")).toBe("basecamp")
  })

  it("matches 'basecamp' as a substring of a longer title", () => {
    expect(inferLocationRole("Wayne's Basecamp")).toBe("basecamp")
  })

  it("maps 'Hospital' to 'hospital'", () => {
    expect(inferLocationRole("Hospital")).toBe("hospital")
  })

  it("maps 'Parking' to 'parking'", () => {
    expect(inferLocationRole("Parking")).toBe("parking")
  })

  it("maps 'Parking Lot B' to 'parking' (substring match)", () => {
    expect(inferLocationRole("Parking Lot B")).toBe("parking")
  })

  it("maps 'Production Office' to 'office' (substring match)", () => {
    expect(inferLocationRole("Production Office")).toBe("office")
  })

  it("maps 'Office' to 'office'", () => {
    expect(inferLocationRole("Office")).toBe("office")
  })

  it("maps 'Shoot Location' to 'shoot'", () => {
    expect(inferLocationRole("Shoot Location")).toBe("shoot")
  })

  it("returns 'custom' for an empty string", () => {
    expect(inferLocationRole("")).toBe("custom")
  })

  it("returns 'custom' for whitespace-only titles", () => {
    expect(inferLocationRole("   ")).toBe("custom")
  })

  it("returns 'custom' for 'Random Thing'", () => {
    expect(inferLocationRole("Random Thing")).toBe("custom")
  })

  it("returns 'custom' for 'Lot B' (no substring match)", () => {
    expect(inferLocationRole("Lot B")).toBe("custom")
  })

  it("uses first-match precedence when a title contains multiple canonical keywords", () => {
    // The substring check order is basecamp → hospital → parking → office
    // → shoot, so "Hospital Parking" resolves to hospital (the safety-
    // critical tag dominates). Pinning this here so any future refactor
    // that reorders the checks fails loudly rather than silently flipping
    // producer-facing chip colors.
    expect(inferLocationRole("Hospital Parking")).toBe("hospital")
    expect(inferLocationRole("Basecamp Parking")).toBe("basecamp")
    expect(inferLocationRole("Production Office Basecamp")).toBe("basecamp")
  })
})

describe("resolveLocationRole", () => {
  it("returns the explicit role when set, ignoring the title", () => {
    const block = makeBlock({ title: "Hospital", role: "office" })
    expect(resolveLocationRole(block)).toBe("office")
  })

  it("falls back to inferLocationRole when role is undefined", () => {
    const block = makeBlock({ title: "Basecamp", role: undefined })
    expect(resolveLocationRole(block)).toBe("basecamp")
  })

  it("falls back to inferLocationRole when role is null", () => {
    const block = makeBlock({ title: "Basecamp", role: null })
    expect(resolveLocationRole(block)).toBe("basecamp")
  })
})

describe("roleDisplayLabel", () => {
  it("renders 'Basecamp' for basecamp", () => {
    expect(roleDisplayLabel("basecamp")).toBe("Basecamp")
  })

  it("renders 'Hospital' for hospital", () => {
    expect(roleDisplayLabel("hospital")).toBe("Hospital")
  })

  it("renders 'Parking' for parking", () => {
    expect(roleDisplayLabel("parking")).toBe("Parking")
  })

  it("renders 'Office' for office", () => {
    expect(roleDisplayLabel("office")).toBe("Office")
  })

  it("renders 'Shoot' for shoot", () => {
    expect(roleDisplayLabel("shoot")).toBe("Shoot")
  })

  it("renders 'Custom' for custom", () => {
    expect(roleDisplayLabel("custom")).toBe("Custom")
  })
})

describe("CANONICAL_ROLE_ORDER", () => {
  it("contains exactly six roles in the canonical print order", () => {
    expect(CANONICAL_ROLE_ORDER).toEqual([
      "basecamp",
      "parking",
      "hospital",
      "office",
      "shoot",
      "custom",
    ] as readonly LocationRole[])
  })
})

describe("compareLocationsByRole", () => {
  it("sorts a mixed array into canonical role order", () => {
    const input = [
      makeBlock({ id: "c", title: "Studio A", role: "custom" }),
      makeBlock({ id: "b", title: "Basecamp", role: "basecamp" }),
      makeBlock({ id: "o", title: "Production Office", role: "office" }),
      makeBlock({ id: "p", title: "Parking", role: "parking" }),
    ]
    const sorted = [...input].sort(compareLocationsByRole)
    expect(sorted.map((b) => b.id)).toEqual(["b", "p", "o", "c"])
  })

  it("is stable for ties — two 'custom' blocks retain their input order", () => {
    const input = [
      makeBlock({ id: "c1", title: "Studio A", role: "custom" }),
      makeBlock({ id: "c2", title: "Studio B", role: "custom" }),
    ]
    const sorted = [...input].sort(compareLocationsByRole)
    expect(sorted.map((b) => b.id)).toEqual(["c1", "c2"])
  })

  it("falls back to inferred role when the block has no explicit role", () => {
    const input = [
      makeBlock({ id: "custom-1", title: "Studio A" }), // infers custom
      makeBlock({ id: "basecamp-1", title: "Basecamp" }), // infers basecamp
    ]
    const sorted = [...input].sort(compareLocationsByRole)
    expect(sorted.map((b) => b.id)).toEqual(["basecamp-1", "custom-1"])
  })
})
