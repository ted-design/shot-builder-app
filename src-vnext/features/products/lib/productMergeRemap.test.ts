import { describe, expect, it } from "vitest"
import {
  remapAssignmentForMerge,
  remapPullItemForMerge,
  remapShotForMerge,
  type MergeRemapContext,
} from "./productMergeRemap"

const ctx: MergeRemapContext = {
  loserId: "L",
  winnerId: "W",
  winnerName: "Merino Tee",
  winnerImageUrl: "https://dl/W.webp",
  winnerStyleNumber: "MT-100",
  winnerGender: "women",
  skuMap: new Map([
    ["l-navy", "w-navy"],
    ["l-olive", "w-olive"],
  ]),
  winnerSkus: new Map([
    ["w-navy", { name: "Navy", colorName: "Navy", imagePath: "img/w-navy.webp", imageUrl: "https://dl/w-navy.webp" }],
    ["w-olive", { name: "Olive", colorName: "Olive", imagePath: null, imageUrl: null }],
    ["w-black", { name: "Black", colorName: "Black", imagePath: "img/w-black.webp", imageUrl: null }],
  ]),
}

const hasUndefined = (row: Record<string, unknown>) => Object.values(row).some((v) => v === undefined)

describe("remapAssignmentForMerge", () => {
  it("returns a non-loser row unchanged (same object)", () => {
    const row = { familyId: "W", skuId: "l-navy", colourName: "Black" } // same SKU id as a loser SKU, but the winner's
    expect(remapAssignmentForMerge(row, ctx)).toBe(row)
  })

  it("matched colourway: winner ids, name and photo URL; nothing of the loser survives", () => {
    const row = {
      familyId: "L", familyName: "Old", skuId: "l-navy", colourId: "l-navy", skuName: "Navy (0101)", colourName: "Navy",
      skuImageUrl: "https://dl/l-navy.webp", thumbUrl: "https://dl/l-navy.webp", familyImageUrl: "https://dl/L.webp", quantity: 2, isHero: true,
    }
    expect(remapAssignmentForMerge(row, ctx)).toEqual({
      familyId: "W", familyName: "Merino Tee", familyImageUrl: "https://dl/W.webp",
      skuId: "w-navy", colourId: "w-navy", skuName: "Navy", colourName: "Navy",
      skuImageUrl: "https://dl/w-navy.webp", thumbUrl: "https://dl/w-navy.webp", quantity: 2, isHero: true,
    })
  })

  it("matched colourway whose winner SKU has no photo: the loser photo is dropped, not carried", () => {
    const out = remapAssignmentForMerge({ familyId: "L", skuId: "l-olive", colourId: "l-olive", skuImageUrl: "https://dl/l-olive.webp" }, ctx)
    expect(out).toMatchObject({ skuId: "w-olive", colourName: "Olive" })
    expect(out.skuImageUrl).toBeUndefined()
    expect(out.thumbUrl).toBeUndefined()
  })

  it("legacy fields: colourImagePath, thumbnailImagePath, productId and productName are replaced", () => {
    const out = remapAssignmentForMerge(
      { productId: "L", productName: "Old", colourId: "l-navy", colourImagePath: "img/l-navy.webp", thumbnailImagePath: "img/L.webp" },
      ctx,
    )
    expect(out).toEqual({
      familyId: "W", familyName: "Merino Tee", familyImageUrl: "https://dl/W.webp",
      skuId: "w-navy", colourId: "w-navy", skuName: "Navy", colourName: "Navy",
      skuImageUrl: "https://dl/w-navy.webp", thumbUrl: "https://dl/w-navy.webp",
    })
  })

  it("unmatched colourway is carried with its own stored photo", () => {
    const out = remapAssignmentForMerge(
      { familyId: "L", skuId: "l-gone", colourId: "l-gone", colourName: "Sand", skuImageUrl: "img/sand.webp", familyImageUrl: "img/L.webp" },
      ctx,
    )
    expect(out).toEqual({
      familyId: "W", familyName: "Merino Tee", familyImageUrl: "https://dl/W.webp",
      skuId: "l-gone", colourId: "l-gone", colourName: "Sand", skuImageUrl: "img/sand.webp", thumbUrl: "img/sand.webp",
    })
  })

  it("unmatched colourway whose id names a winner SKU: keeps its name and photo but drops the id (it would resolve to the winner's colour)", () => {
    const out = remapAssignmentForMerge(
      { familyId: "L", skuId: "w-black", colourId: "w-black", colourName: "Teal", skuImageUrl: "img/teal.webp" },
      ctx,
    )
    expect(out).toEqual({
      familyId: "W", familyName: "Merino Tee", familyImageUrl: "https://dl/W.webp",
      colourName: "Teal", skuImageUrl: "img/teal.webp", thumbUrl: "img/teal.webp",
    })
  })

  it("unmatched colourway with only a legacy colourImagePath keeps it as its own photo", () => {
    const out = remapAssignmentForMerge({ familyId: "L", colourId: "l-gone", colourName: "Sand", colourImagePath: "img/sand.webp" }, ctx)
    expect(out).toMatchObject({ colourId: "l-gone", skuImageUrl: "img/sand.webp", thumbUrl: "img/sand.webp" })
    expect(out).not.toHaveProperty("colourImagePath")
  })

  it("unmatched colourway whose only stored image was the loser family fallback carries no photo", () => {
    const out = remapAssignmentForMerge(
      { familyId: "L", colourId: "l-gone", colourName: "Sand", thumbUrl: "img/L.webp", familyImageUrl: "img/L.webp" },
      ctx,
    )
    expect(out.skuImageUrl).toBeUndefined()
    expect(out.thumbUrl).toBeUndefined()
    expect(JSON.stringify(out)).not.toContain("img/L.webp")
  })

  it("family-level loser row: winner family and image, the loser's family thumb dropped", () => {
    const out = remapAssignmentForMerge({ familyId: "L", thumbUrl: "img/L.webp", familyImageUrl: "img/L.webp", quantity: 1 }, ctx)
    expect(out).toEqual({ familyId: "W", familyName: "Merino Tee", familyImageUrl: "https://dl/W.webp", quantity: 1 })
  })

  it("winner with no name or image: falls back to the row's own name, writes no undefined values", () => {
    const bare = { ...ctx, winnerName: undefined, winnerImageUrl: null }
    const legacy = remapAssignmentForMerge({ productId: "L", productName: "Old", colourId: "l-olive" }, bare)
    expect(legacy).toMatchObject({ familyId: "W", familyName: "Old", skuId: "w-olive" })
    expect(legacy).not.toHaveProperty("productName")
    expect(legacy).not.toHaveProperty("familyImageUrl")
    const nameless = remapAssignmentForMerge({ familyId: "L", skuId: "l-gone" }, bare)
    expect(hasUndefined(legacy) || hasUndefined(nameless)).toBe(false)
  })
})

describe("remapShotForMerge: dedupe", () => {
  const look = (products: Record<string, unknown>[], heroProductId?: string) => ({ looks: [{ id: "a", heroProductId, products }] })

  it("different sizes or size scopes of the same colourway are different assignments: all kept", () => {
    const rows = [
      { familyId: "W", skuId: "w-navy", sizeScope: "single", size: "M", quantity: 1 },
      { familyId: "L", skuId: "l-navy", sizeScope: "single", size: "L", quantity: 2 },
      { familyId: "W", skuId: "w-navy", sizeScope: "all" },
      { familyId: "L", skuId: "l-navy", sizeScope: "pending" },
    ]
    const out = remapShotForMerge(look(rows), ctx).looks[0]!.products as Record<string, unknown>[]
    expect(out.map((p) => [p.familyId, p.skuId, p.sizeScope, p.size ?? null])).toEqual([
      ["W", "w-navy", "single", "M"], ["W", "w-navy", "single", "L"], ["W", "w-navy", "all", null], ["W", "w-navy", "pending", null],
    ])
  })

  it("an exact duplicate loser row is dropped and its hero star moves to the row that is kept", () => {
    const rows = [
      { familyId: "W", skuId: "w-navy", colourId: "w-navy", sizeScope: "single", size: "M" },
      { familyId: "L", skuId: "l-navy", colourId: "l-navy", sizeScope: "single", size: "M", isHero: true },
    ]
    const out = remapShotForMerge(look(rows), ctx).looks[0]!.products
    expect(out).toEqual([{ ...rows[0], isHero: true }])
  })

  it("a loser row duplicating a LATER winner row is the one dropped; winner rows keep their order", () => {
    const rows = [
      { familyId: "L", skuId: "l-navy", sizeScope: "all" },
      { familyId: "W", skuId: "w-black", sizeScope: "all" },
      { familyId: "W", skuId: "w-navy", sizeScope: "all" },
    ]
    expect(remapShotForMerge(look(rows), ctx).looks[0]!.products).toEqual([rows[1], rows[2]])
  })

  it("rows of unrelated families are never dropped, even pre-existing duplicates", () => {
    const x = { familyId: "X", skuId: "x-navy", sizeScope: "single", size: "M" }
    const rows = [x, { ...x }, { ...x, size: "XL" }, { familyId: "L", skuId: "l-navy" }]
    const out = remapShotForMerge(look(rows), ctx).looks[0]!.products as Record<string, unknown>[]
    expect(out.filter((p) => p.familyId === "X")).toHaveLength(3)
  })

  it("a carried colourway whose id was dropped (it names a winner SKU) is not mistaken for a family-level row", () => {
    const rows = [
      { familyId: "W", sizeScope: "all", quantity: 1 },
      { familyId: "L", skuId: "w-black", colourName: "Teal", sizeScope: "all", quantity: 3 },
    ]
    const out = remapShotForMerge(look(rows), ctx).looks[0]!.products as Record<string, unknown>[]
    expect(out.map((p) => [p.colourName ?? null, p.quantity])).toEqual([[null, 1], ["Teal", 3]])
  })

  it("two carried colourways whose ids were dropped are both kept", () => {
    const rows = [
      { familyId: "L", skuId: "w-black", colourName: "Teal", sizeScope: "all" },
      { familyId: "L", skuId: "w-olive", colourName: "Rust", sizeScope: "all" },
    ]
    const out = remapShotForMerge(look(rows), ctx).looks[0]!.products as Record<string, unknown>[]
    expect(out.map((p) => [p.colourName, p.skuId ?? null])).toEqual([["Teal", null], ["Rust", null]])
  })

  it("a carried row holds no slot: a later family-level loser row is not dropped because of it", () => {
    const rows = [
      { familyId: "L", skuId: "w-black", colourName: "Teal", sizeScope: "all" },
      { familyId: "L", sizeScope: "all" },
    ]
    expect(remapShotForMerge(look(rows), ctx).looks[0]!.products).toHaveLength(2)
  })

  it("a legacy shot with only the root products mirror (no looks) is remapped and deduped", () => {
    const shot = { products: [{ familyId: "W", skuId: "w-navy", sizeScope: "all" }, { familyId: "L", skuId: "l-navy", sizeScope: "all" }] }
    const out = remapShotForMerge(shot, ctx)
    expect(out.changed).toBe(true)
    expect(out.products).toEqual([shot.products[0]])
    expect(out.looks).toEqual([])
  })

  it("is unchanged when nothing references the loser", () => {
    const shot = { products: [{ familyId: "W" }], looks: [{ id: "a", heroProductId: "w-navy", products: [{ familyId: "W", skuId: "w-navy" }] }] }
    const out = remapShotForMerge(shot, ctx)
    expect(out.changed).toBe(false)
    expect(out.looks[0]).toEqual(shot.looks[0])
  })
})

describe("remapShotForMerge: heroProductId resolves to the same assignment as before", () => {
  const heroOf = (heroProductId: unknown, products: Record<string, unknown>[]) =>
    remapShotForMerge({ looks: [{ id: "a", heroProductId, products }] }, ctx).looks[0]!.heroProductId

  it("SKU-id hero on a loser row follows it to the winner SKU", () => {
    expect(heroOf("l-navy", [{ familyId: "L", skuId: "l-navy", colourId: "l-navy" }])).toBe("w-navy")
  })

  it("family-id hero on the only loser row becomes the winner family id", () => {
    expect(heroOf("L", [{ familyId: "L", skuId: "l-olive" }])).toBe("W")
  })

  it("family-id hero 'L' with a winner row first: points at the remapped row, not the winner's first row", () => {
    expect(heroOf("L", [{ familyId: "W", skuId: "w-black" }, { familyId: "L", skuId: "l-navy" }])).toBe("w-navy")
  })

  it("family-id hero 'W' on a winner row, with a loser row first: still points at that winner row", () => {
    expect(heroOf("W", [{ familyId: "L", skuId: "l-navy" }, { familyId: "W", skuId: "w-black" }])).toBe("w-black")
  })

  it("a hero on a winner row whose SKU id equals a loser SKU id is kept", () => {
    expect(heroOf("l-navy", [{ familyId: "W", skuId: "l-navy" }, { familyId: "L", skuId: "l-navy" }])).toBe("l-navy")
  })

  it("a hero on a dropped duplicate moves to the kept row's id", () => {
    expect(heroOf("l-navy", [{ familyId: "W", skuId: "w-navy", sizeScope: "all" }, { familyId: "L", skuId: "l-navy", sizeScope: "all" }])).toBe("w-navy")
  })

  it("a size variant of the same colourway is an acceptable target when no id can address the exact row", () => {
    expect(heroOf("L", [{ familyId: "W", skuId: "w-navy", sizeScope: "single", size: "M" }, { familyId: "L", skuId: "l-navy", sizeScope: "single", size: "L" }])).toBe("W")
  })

  it("is cleared rather than pointed at a sibling colour: carried row with its id dropped", () => {
    expect(heroOf("w-olive", [{ familyId: "W", skuId: "w-black" }, { familyId: "L", skuId: "w-olive", colourName: "Teal" }])).toBeNull()
  })

  it("is cleared rather than pointed at a sibling colour: family-level loser row behind a winner colourway", () => {
    expect(heroOf("L", [{ familyId: "W", skuId: "w-black" }, { familyId: "L" }])).toBeNull()
  })

  it("is cleared rather than pointed at another family's row that shares the SKU id", () => {
    expect(heroOf("l-navy", [{ familyId: "X", skuId: "w-navy" }, { familyId: "W", skuId: "w-black" }, { familyId: "L", skuId: "l-navy" }])).toBeNull()
  })

  it("is cleared rather than moved from a carried colour (id dropped) to a family-level row", () => {
    expect(heroOf("w-black", [{ familyId: "W" }, { familyId: "L", skuId: "w-black", colourName: "Teal" }])).toBeNull()
  })

  it("is cleared rather than moved between two carried colours whose ids were dropped", () => {
    expect(heroOf("w-olive", [{ familyId: "L", skuId: "w-black", colourName: "Teal" }, { familyId: "L", skuId: "w-olive", colourName: "Rust" }])).toBeNull()
  })

  it("null, absent and dangling heroes are left as they are", () => {
    expect(heroOf(null, [{ familyId: "L" }])).toBeNull()
    expect(heroOf(undefined, [{ familyId: "L" }])).toBeUndefined()
    const out = remapShotForMerge({ looks: [{ id: "a", heroProductId: "L", products: [] }] }, ctx)
    expect(out.looks[0]!.heroProductId).toBe("L")
  })
})

describe("remapPullItemForMerge", () => {
  it("maps a loser colour id, name and image path; leaves sizes and fulfilment alone", () => {
    const item = { id: "i1", familyId: "L", familyName: "Old", colourId: "l-navy", colourName: "Navy", colourImagePath: "img/l.webp", sizes: [{ size: "M" }], fulfillmentStatus: "pending" }
    expect(remapPullItemForMerge(item, ctx)).toEqual({
      id: "i1", familyId: "W", familyName: "Merino Tee", colourId: "w-navy", colourName: "Navy",
      colourImagePath: "img/w-navy.webp", sizes: [{ size: "M" }], fulfillmentStatus: "pending",
    })
  })

  it("style number and gender the item already has follow the winner; absent ones are not added", () => {
    const out = remapPullItemForMerge({ familyId: "L", styleNumber: "OLD-1", gender: "men", sizes: [] }, ctx)
    expect(out).toMatchObject({ styleNumber: "MT-100", gender: "women" })
    const bare = remapPullItemForMerge({ familyId: "L", sizes: [] }, ctx)
    expect(bare).not.toHaveProperty("styleNumber")
    expect(bare).not.toHaveProperty("gender")
  })

  it("style number and gender the winner lacks are cleared, not left as the loser's", () => {
    const out = remapPullItemForMerge({ familyId: "L", styleNumber: "OLD-1", gender: "men", sizes: [] }, { ...ctx, winnerStyleNumber: null, winnerGender: null })
    expect(out).toMatchObject({ styleNumber: null, gender: null })
  })

  it("only items with the loser's familyId are touched (the app ignores items without one); legacy keys are dropped", () => {
    const legacyOnly = { productId: "L", colourId: "l-navy", sizes: [] }
    expect(remapPullItemForMerge(legacyOnly, ctx)).toBe(legacyOnly)
    const out = remapPullItemForMerge({ familyId: "L", productId: "L", productName: "Old", sizes: [] }, ctx)
    expect(out).not.toHaveProperty("productId")
    expect(out).not.toHaveProperty("productName")
  })

  it("an unmatched colour id that names a winner SKU is cleared; its name is kept", () => {
    const out = remapPullItemForMerge({ familyId: "L", colourId: "w-black", colourName: "Teal", sizes: [] }, ctx)
    expect(out).toMatchObject({ familyId: "W", colourId: null, colourName: "Teal" })
  })

  it("writes no undefined values when the winner and the item both lack a name (mapped, unmatched and colourless items)", () => {
    const nameless = { ...ctx, winnerName: undefined }
    for (const colourId of ["l-navy", "l-gone", undefined]) {
      const out = remapPullItemForMerge({ familyId: "L", ...(colourId ? { colourId } : {}), sizes: [] }, nameless)
      expect(hasUndefined(out)).toBe(false)
    }
  })

  it("carries an unmatched colour and does not add an image field that wasn't there", () => {
    const out = remapPullItemForMerge({ familyId: "L", colourId: "l-gone", colourName: "Sand" }, ctx)
    expect(out).toEqual({ familyId: "W", familyName: "Merino Tee", colourId: "l-gone", colourName: "Sand" })
    const mapped = remapPullItemForMerge({ familyId: "L", colourId: "l-olive" }, ctx)
    expect(mapped).not.toHaveProperty("colourImagePath")
  })

  it("leaves a winner item with a loser-looking colour id untouched", () => {
    const item = { familyId: "W", colourId: "l-navy" }
    expect(remapPullItemForMerge(item, ctx)).toBe(item)
  })
})
