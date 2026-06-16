import { describe, it, expect } from "vitest"
import { findExplicitCoverAssignment } from "../coverProductImage"
import type { ProductAssignment, Shot, ShotLook } from "@/shared/types"

function shotWith(looks: ShotLook[], activeLookId?: string | null): Shot {
  return { id: "shot-1", looks, activeLookId } as unknown as Shot
}

const tee: ProductAssignment = { familyId: "fam-X", familyName: "Tee" }
const skued: ProductAssignment = { familyId: "fam-Y", familyName: "Pant", skuId: "sku-Y1", colourId: "col-Y1" }

function look(partial: Partial<ShotLook>): ShotLook {
  return { id: "look-1", products: [], ...partial }
}

describe("findExplicitCoverAssignment", () => {
  it("returns null when there are no looks", () => {
    expect(findExplicitCoverAssignment(shotWith([]))).toBeNull()
  })

  it("returns the assignment whose familyId matches an explicit heroProductId", () => {
    const l = look({ id: "look-1", heroProductId: "fam-X", products: [tee] })
    expect(findExplicitCoverAssignment(shotWith([l], "look-1"))).toEqual(tee)
  })

  it("matches by skuId", () => {
    const l = look({ id: "look-1", heroProductId: "sku-Y1", products: [skued] })
    expect(findExplicitCoverAssignment(shotWith([l], "look-1"))).toEqual(skued)
  })

  it("matches by colourId", () => {
    const l = look({ id: "look-1", heroProductId: "col-Y1", products: [skued] })
    expect(findExplicitCoverAssignment(shotWith([l], "look-1"))).toEqual(skued)
  })

  it("returns null when the cover is explicitly cleared (heroProductId null)", () => {
    const l = look({ id: "look-1", heroProductId: null, products: [tee] })
    expect(findExplicitCoverAssignment(shotWith([l], "look-1"))).toBeNull()
  })

  it("returns null in auto mode (heroProductId undefined)", () => {
    const l = look({ id: "look-1", heroProductId: undefined, products: [tee] })
    expect(findExplicitCoverAssignment(shotWith([l], "look-1"))).toBeNull()
  })

  it("locks to the active look: ignores an explicit cover on a non-active look", () => {
    const active = look({ id: "look-1", heroProductId: undefined, products: [tee] })
    const other = look({ id: "look-2", heroProductId: "fam-X", products: [tee] })
    expect(findExplicitCoverAssignment(shotWith([active, other], "look-1"))).toBeNull()
  })

  it("falls through to scan looks when activeLookId is stale (look not found)", () => {
    const l = look({ id: "look-2", heroProductId: "fam-X", products: [tee] })
    expect(findExplicitCoverAssignment(shotWith([l], "look-missing"))).toEqual(tee)
  })

  it("uses the first look with an explicit cover when there is no active look", () => {
    const first = look({ id: "look-1", heroProductId: undefined, products: [tee] })
    const second = look({ id: "look-2", heroProductId: "fam-X", products: [tee] })
    expect(findExplicitCoverAssignment(shotWith([first, second]))).toEqual(tee)
  })

  it("returns null when the explicit heroProductId matches no product in the look", () => {
    const l = look({ id: "look-1", heroProductId: "fam-ZZZ", products: [tee] })
    expect(findExplicitCoverAssignment(shotWith([l], "look-1"))).toBeNull()
  })
})
