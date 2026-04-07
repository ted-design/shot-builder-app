import { describe, it, expect } from "vitest"
import { Timestamp } from "firebase/firestore"
import type { Shot, ProductFamily, ShotLook } from "@/shared/types"
import type { FilterCondition } from "./filterConditions"
import { evaluateCondition, applyFilterConditions } from "./filterEngine"
import type { EvalContext } from "./filterEngine"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTs(dateStr: string): Timestamp {
  return Timestamp.fromDate(new Date(dateStr))
}

function makeShot(overrides: Partial<Shot> = {}): Shot {
  return {
    id: "shot-1",
    title: "Test Shot",
    status: "todo",
    projectId: "proj-1",
    clientId: "client-1",
    talent: [],
    products: [],
    sortOrder: 0,
    deleted: false,
    createdAt: Timestamp.fromMillis(1000),
    updatedAt: Timestamp.fromMillis(2000),
    createdBy: "user-1",
    ...overrides,
  } as Shot
}

function makeLook(overrides: Partial<ShotLook> = {}): ShotLook {
  return { id: "look-1", products: [], order: 0, ...overrides }
}

function makeFamily(overrides: Partial<ProductFamily> = {}): ProductFamily {
  return {
    id: "f1",
    styleName: "Test",
    clientId: "client-1",
    ...overrides,
  } as ProductFamily
}

function condition(
  field: FilterCondition["field"],
  operator: FilterCondition["operator"],
  value: FilterCondition["value"],
): FilterCondition {
  return { id: "test", field, operator, value }
}

function ctx(families?: Map<string, ProductFamily>): EvalContext {
  return { familyById: families ?? new Map() }
}

const EMPTY_CTX = ctx()

// ---------------------------------------------------------------------------
// status
// ---------------------------------------------------------------------------

describe("status conditions", () => {
  it("status.in: shot passes when value includes its status", () => {
    const shot = makeShot({ status: "todo" })
    expect(evaluateCondition(shot, condition("status", "in", ["todo", "in_progress"]), EMPTY_CTX)).toBe(true)
  })

  it("status.in: shot fails when value does not include its status", () => {
    const shot = makeShot({ status: "complete" })
    expect(evaluateCondition(shot, condition("status", "in", ["todo"]), EMPTY_CTX)).toBe(false)
  })

  it("status.notIn: shot passes when value does not include its status", () => {
    const shot = makeShot({ status: "complete" })
    expect(evaluateCondition(shot, condition("status", "notIn", ["todo"]), EMPTY_CTX)).toBe(true)
  })

  it("status.notIn: shot fails when value includes its status", () => {
    const shot = makeShot({ status: "todo" })
    expect(evaluateCondition(shot, condition("status", "notIn", ["todo"]), EMPTY_CTX)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// tag
// ---------------------------------------------------------------------------

describe("tag conditions", () => {
  it("tag.in: shot with matching tag passes", () => {
    const shot = makeShot({ tags: [{ id: "men", label: "Men", color: "#333" }] })
    expect(evaluateCondition(shot, condition("tag", "in", ["men"]), EMPTY_CTX)).toBe(true)
  })

  it("tag.in: shot without matching tag fails", () => {
    const shot = makeShot({ tags: [{ id: "women", label: "Women", color: "#333" }] })
    expect(evaluateCondition(shot, condition("tag", "in", ["men"]), EMPTY_CTX)).toBe(false)
  })

  it("tag.in: shot with no tags returns false", () => {
    const shot = makeShot({ tags: [] })
    expect(evaluateCondition(shot, condition("tag", "in", ["men"]), EMPTY_CTX)).toBe(false)
  })

  it("tag.in: shot with undefined tags returns false", () => {
    const shot = makeShot()
    expect(evaluateCondition(shot, condition("tag", "in", ["men"]), EMPTY_CTX)).toBe(false)
  })

  it("tag.notIn: shot with matching tag fails", () => {
    const shot = makeShot({ tags: [{ id: "video", label: "Video", color: "#333" }] })
    expect(evaluateCondition(shot, condition("tag", "notIn", ["video"]), EMPTY_CTX)).toBe(false)
  })

  it("tag.notIn: shot without matching tag passes", () => {
    const shot = makeShot({ tags: [{ id: "photo", label: "Photo", color: "#333" }] })
    expect(evaluateCondition(shot, condition("tag", "notIn", ["video"]), EMPTY_CTX)).toBe(true)
  })

  it("tag.notIn: shot with no tags passes", () => {
    const shot = makeShot({ tags: [] })
    expect(evaluateCondition(shot, condition("tag", "notIn", ["video"]), EMPTY_CTX)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// talent
// ---------------------------------------------------------------------------

describe("talent conditions", () => {
  it("talent.in: shot with matching talentIds passes", () => {
    const shot = makeShot({ talentIds: ["t1", "t2"] })
    expect(evaluateCondition(shot, condition("talent", "in", ["t1"]), EMPTY_CTX)).toBe(true)
  })

  it("talent.in: falls back to talent array when talentIds missing", () => {
    const shot = makeShot({ talent: ["t1"] })
    expect(evaluateCondition(shot, condition("talent", "in", ["t1"]), EMPTY_CTX)).toBe(true)
  })

  it("talent.notIn: exclusion works", () => {
    const shot = makeShot({ talentIds: ["t1"] })
    expect(evaluateCondition(shot, condition("talent", "notIn", ["t1"]), EMPTY_CTX)).toBe(false)
  })

  it("talent.notIn: passes when talent not in exclusion set", () => {
    const shot = makeShot({ talentIds: ["t2"] })
    expect(evaluateCondition(shot, condition("talent", "notIn", ["t1"]), EMPTY_CTX)).toBe(true)
  })

  it("talent.in: shot with empty talent returns false", () => {
    const shot = makeShot({ talent: [] })
    expect(evaluateCondition(shot, condition("talent", "in", ["t1"]), EMPTY_CTX)).toBe(false)
  })

  it("talent.notIn: shot with empty talent passes", () => {
    const shot = makeShot({ talent: [] })
    expect(evaluateCondition(shot, condition("talent", "notIn", ["t1"]), EMPTY_CTX)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// location
// ---------------------------------------------------------------------------

describe("location conditions", () => {
  it("location.in: shot with matching locationId passes", () => {
    const shot = makeShot({ locationId: "loc1" })
    expect(evaluateCondition(shot, condition("location", "in", ["loc1"]), EMPTY_CTX)).toBe(true)
  })

  it("location.in: shot without matching locationId fails", () => {
    const shot = makeShot({ locationId: "loc2" })
    expect(evaluateCondition(shot, condition("location", "in", ["loc1"]), EMPTY_CTX)).toBe(false)
  })

  it("location.notIn: exclusion works", () => {
    const shot = makeShot({ locationId: "loc1" })
    expect(evaluateCondition(shot, condition("location", "notIn", ["loc1"]), EMPTY_CTX)).toBe(false)
  })

  it("location.notIn: passes when no locationId", () => {
    const shot = makeShot()
    expect(evaluateCondition(shot, condition("location", "notIn", ["loc1"]), EMPTY_CTX)).toBe(true)
  })

  it("location.in: shot without locationId fails", () => {
    const shot = makeShot()
    expect(evaluateCondition(shot, condition("location", "in", ["loc1"]), EMPTY_CTX)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// product
// ---------------------------------------------------------------------------

describe("product conditions", () => {
  it("product.in: shot with matching product in look passes", () => {
    const shot = makeShot({
      looks: [makeLook({ products: [{ familyId: "f1", familyName: "Tee" }] })],
    })
    expect(evaluateCondition(shot, condition("product", "in", ["f1"]), EMPTY_CTX)).toBe(true)
  })

  it("product.in: shot with matching product in top-level products passes", () => {
    const shot = makeShot({
      products: [{ familyId: "f1", familyName: "Tee" }],
    })
    expect(evaluateCondition(shot, condition("product", "in", ["f1"]), EMPTY_CTX)).toBe(true)
  })

  it("product.notIn: exclusion works", () => {
    const shot = makeShot({
      looks: [makeLook({ products: [{ familyId: "f1", familyName: "Tee" }] })],
    })
    expect(evaluateCondition(shot, condition("product", "notIn", ["f1"]), EMPTY_CTX)).toBe(false)
  })

  it("product.in: shot with empty products fails", () => {
    const shot = makeShot({ products: [], looks: [] })
    expect(evaluateCondition(shot, condition("product", "in", ["f1"]), EMPTY_CTX)).toBe(false)
  })

  it("product.notIn: shot with empty products passes", () => {
    const shot = makeShot({ products: [], looks: [] })
    expect(evaluateCondition(shot, condition("product", "notIn", ["f1"]), EMPTY_CTX)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// missing
// ---------------------------------------------------------------------------

describe("missing conditions", () => {
  it("missing.in products: shot with empty products passes", () => {
    const shot = makeShot({ products: [] })
    expect(evaluateCondition(shot, condition("missing", "in", ["products"]), EMPTY_CTX)).toBe(true)
  })

  it("missing.in products: shot with products fails", () => {
    const shot = makeShot({
      looks: [makeLook({ products: [{ familyId: "f1", familyName: "Tee" }] })],
    })
    expect(evaluateCondition(shot, condition("missing", "in", ["products"]), EMPTY_CTX)).toBe(false)
  })

  it("missing.in talent: shot with empty talent passes", () => {
    const shot = makeShot({ talent: [] })
    expect(evaluateCondition(shot, condition("missing", "in", ["talent"]), EMPTY_CTX)).toBe(true)
  })

  it("missing.in location: shot without locationId passes", () => {
    const shot = makeShot()
    expect(evaluateCondition(shot, condition("missing", "in", ["location"]), EMPTY_CTX)).toBe(true)
  })

  it("missing.in image: shot without heroImage passes", () => {
    const shot = makeShot()
    expect(evaluateCondition(shot, condition("missing", "in", ["image"]), EMPTY_CTX)).toBe(true)
  })

  it("missing.in image: shot with heroImage fails", () => {
    const shot = makeShot({ heroImage: { path: "shots/hero.webp", downloadURL: "https://example.com" } })
    expect(evaluateCondition(shot, condition("missing", "in", ["image"]), EMPTY_CTX)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// hasRequirements
// ---------------------------------------------------------------------------

describe("hasRequirements conditions", () => {
  const familyWithReqs = makeFamily({
    id: "f1",
    activeRequirementCount: 2,
  })
  const familyWithoutReqs = makeFamily({
    id: "f2",
    activeRequirementCount: 0,
  })

  it("hasRequirements.eq true: shot with requirements passes", () => {
    const shot = makeShot({
      looks: [makeLook({ products: [{ familyId: "f1", familyName: "Tee" }] })],
    })
    expect(evaluateCondition(shot, condition("hasRequirements", "eq", true), ctx(new Map([["f1", familyWithReqs]])))).toBe(true)
  })

  it("hasRequirements.eq true: shot without requirements fails", () => {
    const shot = makeShot({
      looks: [makeLook({ products: [{ familyId: "f2", familyName: "Belt" }] })],
    })
    expect(evaluateCondition(shot, condition("hasRequirements", "eq", true), ctx(new Map([["f2", familyWithoutReqs]])))).toBe(false)
  })

  it("hasRequirements.eq false: shot without requirements passes", () => {
    const shot = makeShot({
      looks: [makeLook({ products: [{ familyId: "f2", familyName: "Belt" }] })],
    })
    expect(evaluateCondition(shot, condition("hasRequirements", "eq", false), ctx(new Map([["f2", familyWithoutReqs]])))).toBe(true)
  })

  it("hasRequirements.eq false: shot with requirements fails", () => {
    const shot = makeShot({
      looks: [makeLook({ products: [{ familyId: "f1", familyName: "Tee" }] })],
    })
    expect(evaluateCondition(shot, condition("hasRequirements", "eq", false), ctx(new Map([["f1", familyWithReqs]])))).toBe(false)
  })

  it("hasRequirements.eq true: shot with no products fails", () => {
    const shot = makeShot()
    expect(evaluateCondition(shot, condition("hasRequirements", "eq", true), EMPTY_CTX)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// hasHeroImage
// ---------------------------------------------------------------------------

describe("hasHeroImage conditions", () => {
  it("hasHeroImage.eq true: shot with heroImage passes", () => {
    const shot = makeShot({ heroImage: { path: "shots/hero.webp", downloadURL: "https://example.com" } })
    expect(evaluateCondition(shot, condition("hasHeroImage", "eq", true), EMPTY_CTX)).toBe(true)
  })

  it("hasHeroImage.eq true: shot without heroImage fails", () => {
    const shot = makeShot()
    expect(evaluateCondition(shot, condition("hasHeroImage", "eq", true), EMPTY_CTX)).toBe(false)
  })

  it("hasHeroImage.eq false: shot without heroImage passes", () => {
    const shot = makeShot()
    expect(evaluateCondition(shot, condition("hasHeroImage", "eq", false), EMPTY_CTX)).toBe(true)
  })

  it("hasHeroImage.eq false: shot with heroImage fails", () => {
    const shot = makeShot({ heroImage: { path: "shots/hero.webp", downloadURL: "https://example.com" } })
    expect(evaluateCondition(shot, condition("hasHeroImage", "eq", false), EMPTY_CTX)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// launchDate
// ---------------------------------------------------------------------------

describe("launchDate conditions", () => {
  const familyEarly = makeFamily({
    id: "f1",
    earliestLaunchDate: makeTs("2026-05-01"),
  })
  const familyLate = makeFamily({
    id: "f2",
    earliestLaunchDate: makeTs("2026-07-01"),
  })
  const familyNoDate = makeFamily({ id: "f3" })

  function shotWithFamily(familyId: string): Shot {
    return makeShot({
      looks: [makeLook({ products: [{ familyId, familyName: "Product" }] })],
    })
  }

  it("launchDate.before: date before threshold passes", () => {
    expect(
      evaluateCondition(shotWithFamily("f1"), condition("launchDate", "before", "2026-06-01"), ctx(new Map([["f1", familyEarly]]))),
    ).toBe(true)
  })

  it("launchDate.before: date on or after threshold fails", () => {
    expect(
      evaluateCondition(shotWithFamily("f2"), condition("launchDate", "before", "2026-06-01"), ctx(new Map([["f2", familyLate]]))),
    ).toBe(false)
  })

  it("launchDate.after: date on or after threshold passes", () => {
    expect(
      evaluateCondition(shotWithFamily("f2"), condition("launchDate", "after", "2026-06-01"), ctx(new Map([["f2", familyLate]]))),
    ).toBe(true)
  })

  it("launchDate.after: date before threshold fails", () => {
    expect(
      evaluateCondition(shotWithFamily("f1"), condition("launchDate", "after", "2026-06-01"), ctx(new Map([["f1", familyEarly]]))),
    ).toBe(false)
  })

  it("launchDate.between: date in range passes", () => {
    expect(
      evaluateCondition(
        shotWithFamily("f1"),
        condition("launchDate", "between", { from: "2026-04-01", to: "2026-06-01" }),
        ctx(new Map([["f1", familyEarly]])),
      ),
    ).toBe(true)
  })

  it("launchDate.between: date outside range fails", () => {
    expect(
      evaluateCondition(
        shotWithFamily("f2"),
        condition("launchDate", "between", { from: "2026-04-01", to: "2026-06-01" }),
        ctx(new Map([["f2", familyLate]])),
      ),
    ).toBe(false)
  })

  it("launchDate.empty: shot with no launch date passes", () => {
    expect(
      evaluateCondition(shotWithFamily("f3"), condition("launchDate", "empty", null), ctx(new Map([["f3", familyNoDate]]))),
    ).toBe(true)
  })

  it("launchDate.empty: shot with launch date fails", () => {
    expect(
      evaluateCondition(shotWithFamily("f1"), condition("launchDate", "empty", null), ctx(new Map([["f1", familyEarly]]))),
    ).toBe(false)
  })

  it("launchDate.before: shot with no products (no date) fails", () => {
    const shot = makeShot()
    expect(evaluateCondition(shot, condition("launchDate", "before", "2026-06-01"), EMPTY_CTX)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Edge cases: empty set values
// ---------------------------------------------------------------------------

describe("empty set values", () => {
  it("condition with empty [] value passes all shots (vacuous truth)", () => {
    const shot = makeShot({ status: "todo" })
    expect(evaluateCondition(shot, condition("status", "in", []), EMPTY_CTX)).toBe(true)
  })

  it("notIn with empty [] value passes all shots", () => {
    const shot = makeShot({ status: "todo" })
    expect(evaluateCondition(shot, condition("status", "notIn", []), EMPTY_CTX)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// applyFilterConditions
// ---------------------------------------------------------------------------

describe("applyFilterConditions", () => {
  const shots = [
    makeShot({ id: "s1", status: "todo", tags: [{ id: "men", label: "Men", color: "#333" }] }),
    makeShot({ id: "s2", status: "in_progress", tags: [{ id: "women", label: "Women", color: "#444" }] }),
    makeShot({ id: "s3", status: "complete" }),
  ]

  it("returns all shots when conditions are empty", () => {
    const result = applyFilterConditions(shots, [], EMPTY_CTX)
    expect(result).toHaveLength(3)
  })

  it("filters with a single condition", () => {
    const conditions: FilterCondition[] = [condition("status", "in", ["todo"])]
    const result = applyFilterConditions(shots, conditions, EMPTY_CTX)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe("s1")
  })

  it("AND logic: all conditions must pass", () => {
    const conditions: FilterCondition[] = [
      condition("status", "in", ["todo", "in_progress"]),
      condition("tag", "in", ["men"]),
    ]
    const result = applyFilterConditions(shots, conditions, EMPTY_CTX)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe("s1")
  })

  it("AND logic: no match when conditions conflict", () => {
    const conditions: FilterCondition[] = [
      condition("status", "in", ["complete"]),
      condition("tag", "in", ["men"]),
    ]
    const result = applyFilterConditions(shots, conditions, EMPTY_CTX)
    expect(result).toHaveLength(0)
  })

  it("does not mutate the input array", () => {
    const original = [...shots]
    const conditions: FilterCondition[] = [condition("status", "in", ["todo"])]
    applyFilterConditions(shots, conditions, EMPTY_CTX)
    expect(shots).toEqual(original)
  })
})
