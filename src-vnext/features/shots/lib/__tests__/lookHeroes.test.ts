import { describe, expect, it } from "vitest"
import {
  assignmentHeroId,
  firstHeroProductId,
  lookHeroAssignments,
  lookHeroIndexes,
  reconcileHeroProductId,
} from "@/features/shots/lib/lookHeroes"
import type { ProductAssignment, ShotLook } from "@/shared/types"

const p = (over: Partial<ProductAssignment> & { familyId: string }): ProductAssignment => ({
  ...over,
})

const look = (
  products: ProductAssignment[],
  heroProductId?: string | null,
): ShotLook => ({ id: "look-1", products, heroProductId })

describe("assignmentHeroId", () => {
  it("prefers skuId, then colourId, then familyId", () => {
    expect(assignmentHeroId(p({ familyId: "fam", colourId: "col", skuId: "sku" }))).toBe("sku")
    expect(assignmentHeroId(p({ familyId: "fam", colourId: "col" }))).toBe("col")
    expect(assignmentHeroId(p({ familyId: "fam" }))).toBe("fam")
  })
})

describe("lookHeroIndexes", () => {
  it("returns starred indices when any product has isHero", () => {
    const l = look([
      p({ familyId: "a" }),
      p({ familyId: "b", isHero: true }),
      p({ familyId: "c", isHero: true }),
    ])
    expect(lookHeroIndexes(l)).toEqual([1, 2])
  })

  it("ignores legacy heroProductId once isHero is present", () => {
    const l = look(
      [p({ familyId: "a", isHero: true }), p({ familyId: "b", skuId: "sku-b" })],
      "sku-b",
    )
    expect(lookHeroIndexes(l)).toEqual([0])
  })

  it("falls back to the legacy heroProductId match when nothing is starred", () => {
    const l = look(
      [p({ familyId: "a", skuId: "sku-a" }), p({ familyId: "b", skuId: "sku-b" })],
      "sku-b",
    )
    expect(lookHeroIndexes(l)).toEqual([1])
  })

  it("matches a legacy heroProductId against familyId or colourId too", () => {
    expect(lookHeroIndexes(look([p({ familyId: "fam-1" })], "fam-1"))).toEqual([0])
    expect(lookHeroIndexes(look([p({ familyId: "fam-1", colourId: "col-1" })], "col-1"))).toEqual([0])
  })

  it("returns [] when legacy heroProductId matches no product", () => {
    expect(lookHeroIndexes(look([p({ familyId: "a" })], "missing"))).toEqual([])
  })

  it("returns [] when nothing is starred and there is no heroProductId", () => {
    expect(lookHeroIndexes(look([p({ familyId: "a" })]))).toEqual([])
    expect(lookHeroIndexes(look([p({ familyId: "a" })], null))).toEqual([])
  })
})

describe("lookHeroAssignments", () => {
  it("maps indices back to product assignments", () => {
    const heroes = lookHeroAssignments(
      look([p({ familyId: "a" }), p({ familyId: "b", isHero: true })]),
    )
    expect(heroes.map((x) => x.familyId)).toEqual(["b"])
  })
})

describe("firstHeroProductId", () => {
  it("returns the first starred product's hero id", () => {
    expect(
      firstHeroProductId([
        p({ familyId: "a" }),
        p({ familyId: "b", skuId: "sku-b", isHero: true }),
        p({ familyId: "c", isHero: true }),
      ]),
    ).toBe("sku-b")
  })

  it("returns undefined (AUTO cover) when nothing is starred", () => {
    expect(firstHeroProductId([p({ familyId: "a" })])).toBeUndefined()
  })
})

describe("reconcileHeroProductId", () => {
  it("follows the first star when products are starred", () => {
    expect(
      reconcileHeroProductId(
        [p({ familyId: "a", skuId: "sku-a", isHero: true }), p({ familyId: "b" })],
        "stale",
      ),
    ).toBe("sku-a")
  })

  it("drops a dangling legacy pointer to AUTO when the referenced product is gone", () => {
    // Starred product A was removed; the old heroProductId points at A's now-absent id.
    expect(reconcileHeroProductId([p({ familyId: "b", skuId: "sku-b" })], "sku-a")).toBeUndefined()
  })

  it("keeps a still-resolvable legacy pointer (non-destructive on add/edit of un-migrated shots)", () => {
    expect(
      reconcileHeroProductId(
        [p({ familyId: "a", skuId: "sku-a" }), p({ familyId: "b", skuId: "sku-b" })],
        "sku-b",
      ),
    ).toBe("sku-b")
  })

  it("preserves an explicit NONE (null) when nothing is starred", () => {
    expect(reconcileHeroProductId([p({ familyId: "a" })], null)).toBeNull()
  })

  it("stays AUTO (undefined) when there is no pointer and nothing is starred", () => {
    expect(reconcileHeroProductId([p({ familyId: "a" })], undefined)).toBeUndefined()
  })
})
