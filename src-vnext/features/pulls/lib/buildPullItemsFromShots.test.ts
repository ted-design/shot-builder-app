import { describe, expect, it } from "vitest"
import { Timestamp } from "firebase/firestore"
import { buildPullItemsFromShots } from "@/features/pulls/lib/buildPullItemsFromShots"
import type { Shot } from "@/shared/types"

function makeShot(overrides: Partial<Shot> & Pick<Shot, "id">): Shot {
  return {
    id: overrides.id,
    title: overrides.title ?? "Shot",
    projectId: overrides.projectId ?? "p1",
    clientId: overrides.clientId ?? "c1",
    status: overrides.status ?? "todo",
    talent: overrides.talent ?? [],
    talentIds: overrides.talentIds,
    products: overrides.products ?? [],
    locationId: overrides.locationId,
    locationName: overrides.locationName,
    laneId: overrides.laneId,
    sortOrder: overrides.sortOrder ?? 0,
    shotNumber: overrides.shotNumber,
    notes: overrides.notes,
    notesAddendum: overrides.notesAddendum,
    date: overrides.date,
    heroImage: overrides.heroImage,
    looks: overrides.looks,
    tags: overrides.tags,
    deleted: overrides.deleted,
    createdAt: overrides.createdAt ?? new Timestamp(1, 0),
    updatedAt: overrides.updatedAt ?? new Timestamp(1, 0),
    createdBy: overrides.createdBy ?? "u1",
  }
}

describe("buildPullItemsFromShots", () => {
  it("aggregates by familyId+colourId and sums quantities", () => {
    const shots: Shot[] = [
      makeShot({
        id: "s1",
        products: [
          { familyId: "f1", familyName: "Hat", colourId: "c1", colourName: "Black", sizeScope: "single", size: "M", quantity: 1 },
        ],
      }),
      makeShot({
        id: "s2",
        products: [
          { familyId: "f1", familyName: "Hat", colourId: "c1", colourName: "Black", sizeScope: "single", size: "M", quantity: 2 },
        ],
      }),
    ]

    const items = buildPullItemsFromShots({ shots })
    expect(items).toHaveLength(1)
    expect(items[0]?.familyId).toBe("f1")
    expect(items[0]?.colourId).toBe("c1")
    expect(items[0]?.sizes).toEqual([
      { size: "M", quantity: 3, fulfilled: 0, status: "pending" },
    ])
  })

  it("expands sizeScope=all into one line per SKU size", () => {
    const shots: Shot[] = [
      makeShot({
        id: "s1",
        products: [
          { familyId: "f1", familyName: "Jacket", colourId: "c1", colourName: "Navy", skuId: "sku-1", sizeScope: "all", quantity: 1 },
        ],
      }),
    ]

    const skuSizesByKey = new Map<string, readonly string[]>([
      ["f1::sku-1", ["XS", "S", "M"]],
    ])

    const items = buildPullItemsFromShots({ shots, skuSizesByKey })
    expect(items).toHaveLength(1)
    expect(items[0]?.sizes.map((s) => s.size)).toEqual(["XS", "S", "M"])
    expect(items[0]?.sizes.map((s) => s.quantity)).toEqual([1, 1, 1])
  })

  it("uses One Size placeholder for pending sizeScope", () => {
    const shots: Shot[] = [
      makeShot({
        id: "s1",
        products: [
          { familyId: "f1", familyName: "Shoe", colourId: "c1", colourName: "White", sizeScope: "pending", quantity: 1 },
        ],
      }),
    ]
    const items = buildPullItemsFromShots({ shots })
    expect(items[0]?.sizes[0]?.size).toBe("One Size")
  })

  it("includes products assigned within looks", () => {
    const shots: Shot[] = [
      makeShot({
        id: "s1",
        looks: [
          {
            id: "look-1",
            products: [
              { familyId: "f1", familyName: "Hat", colourId: "c1", colourName: "Black", sizeScope: "single", size: "M", quantity: 1 },
            ],
          },
        ],
      }),
    ]

    const items = buildPullItemsFromShots({ shots })
    expect(items).toHaveLength(1)
    expect(items[0]?.familyId).toBe("f1")
    expect(items[0]?.colourId).toBe("c1")
  })
})
