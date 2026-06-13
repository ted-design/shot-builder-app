import { describe, it, expect } from "vitest"
import { buildWarehousePullList } from "./warehousePullList"
import type { ProductAssignment, ProductFamily, Shot, ShotLook } from "@/shared/types"

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

function makeLook(
  id: string,
  products: ProductAssignment[],
  order = 0,
): ShotLook {
  return { id, order, products }
}

const shorts: ProductAssignment = {
  familyId: "fam-shorts",
  familyName: "Merino Flex Shorts",
  colourName: "Maroon",
  size: "M",
  sizeScope: "single",
  quantity: 2,
}

const tee: ProductAssignment = {
  familyId: "fam-tee",
  familyName: "Base Tee",
  colourName: "Black",
  size: "L",
  sizeScope: "single",
  quantity: 1,
}

describe("buildWarehousePullList", () => {
  it("returns an empty list for no shots", () => {
    expect(buildWarehousePullList([])).toEqual([])
  })

  it("returns an empty list when shots have no looks/products", () => {
    expect(buildWarehousePullList([makeShot()])).toEqual([])
  })

  it("includes legacy top-level shot.products for shots with no look rows", () => {
    // legacy/imported shots carry assignments in shot.products with no looks
    const shot = makeShot({ products: [shorts], looks: [] })
    const rows = buildWarehousePullList([shot])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.label).toContain("Merino Flex Shorts")
    expect(rows[0]!.neededByShots.map((r) => r.shotId)).toEqual(["shot-1"])
  })

  it("prefers look products over legacy shot.products when both exist (no double-count)", () => {
    // a shot with looks should NOT also pull from the legacy fallback
    const shot = makeShot({ products: [tee], looks: [makeLook("l", [shorts])] })
    const rows = buildWarehousePullList([shot])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.label).toContain("Merino Flex Shorts")
  })

  it("aggregates products across ALL looks of a shot, not just the primary", () => {
    const shot = makeShot({
      shotNumber: "1",
      looks: [makeLook("look-a", [shorts], 0), makeLook("look-b", [tee], 1)],
    })
    const rows = buildWarehousePullList([shot])
    expect(rows.map((r) => r.label)).toEqual([
      "Base Tee (Black • L)",
      "Merino Flex Shorts (Maroon • M • x2)",
    ])
  })

  it("collapses the same garment/colour/size across shots into one row", () => {
    const shotA = makeShot({
      id: "shot-a",
      shotNumber: "2",
      looks: [makeLook("la", [shorts])],
    })
    const shotB = makeShot({
      id: "shot-b",
      shotNumber: "1",
      looks: [makeLook("lb", [shorts])],
    })
    const rows = buildWarehousePullList([shotA, shotB])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.neededByShots).toEqual([
      { shotId: "shot-b", shotLabel: "1" },
      { shotId: "shot-a", shotLabel: "2" },
    ])
  })

  it("de-duplicates a shot listed twice for the same product (two looks)", () => {
    const shot = makeShot({
      id: "shot-x",
      shotNumber: "5",
      looks: [makeLook("l1", [shorts], 0), makeLook("l2", [shorts], 1)],
    })
    const rows = buildWarehousePullList([shot])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.neededByShots).toEqual([{ shotId: "shot-x", shotLabel: "5" }])
  })

  it("treats different sizes of the same family as separate rows", () => {
    const small: ProductAssignment = { ...shorts, size: "S" }
    const shot = makeShot({ looks: [makeLook("l", [shorts, small])] })
    const rows = buildWarehousePullList([shot])
    expect(rows).toHaveLength(2)
  })

  it("treats different colourways of the same family/size as separate rows", () => {
    const navy: ProductAssignment = { ...shorts, colourName: "Navy" }
    const shot = makeShot({ looks: [makeLook("l", [shorts, navy])] })
    const rows = buildWarehousePullList([shot])
    expect(rows.map((r) => r.colourName).sort()).toEqual(["Maroon", "Navy"])
  })

  it("resolves styleNumber from the family map, falling back to styleNumbers[0]", () => {
    const familyById = new Map<string, ProductFamily>([
      ["fam-shorts", { id: "fam-shorts", styleName: "Shorts", styleNumber: "MS-100" }],
      ["fam-tee", { id: "fam-tee", styleName: "Tee", styleNumbers: ["BT-200"] }],
    ])
    const shot = makeShot({ looks: [makeLook("l", [shorts, tee])] })
    const rows = buildWarehousePullList([shot], familyById)
    const byKey = new Map(rows.map((r) => [r.colourName, r.styleNumber]))
    expect(byKey.get("Maroon")).toBe("MS-100")
    expect(byKey.get("Black")).toBe("BT-200")
  })

  it("falls back to skuName when no family style number resolves", () => {
    const p: ProductAssignment = { ...shorts, skuName: "SKU-XYZ" }
    const shot = makeShot({ looks: [makeLook("l", [p])] })
    expect(buildWarehousePullList([shot])[0]!.styleNumber).toBe("SKU-XYZ")
  })

  it("carries null styleNumber and colourName when unresolvable", () => {
    const bare: ProductAssignment = { familyId: "fam-x", familyName: "Mystery" }
    const shot = makeShot({ looks: [makeLook("l", [bare])] })
    const row = buildWarehousePullList([shot])[0]!
    expect(row.styleNumber).toBeNull()
    expect(row.colourName).toBeNull()
  })

  it("skips deleted shots entirely", () => {
    const live = makeShot({ id: "live", looks: [makeLook("l", [shorts])] })
    const dead = makeShot({ id: "dead", deleted: true, looks: [makeLook("l", [tee])] })
    const rows = buildWarehousePullList([live, dead])
    expect(rows).toHaveLength(1)
    expect(rows[0]!.label).toContain("Merino Flex Shorts")
  })

  it("falls back to title then id for the shot label", () => {
    const titled = makeShot({ id: "t", shotNumber: null, title: "Opening Wide", looks: [makeLook("l", [shorts])] })
    const idOnly = makeShot({ id: "id-only", shotNumber: null, title: "", looks: [makeLook("l2", [tee])] })
    const rows = buildWarehousePullList([titled, idOnly])
    expect(rows.find((r) => r.colourName === "Maroon")!.neededByShots[0]!.shotLabel).toBe("Opening Wide")
    expect(rows.find((r) => r.colourName === "Black")!.neededByShots[0]!.shotLabel).toBe("id-only")
  })

  it("produces a deterministic, stable label sort", () => {
    const shot = makeShot({ looks: [makeLook("l", [tee, shorts])] })
    const rows = buildWarehousePullList([shot])
    expect(rows.map((r) => r.label)).toEqual([
      "Base Tee (Black • L)",
      "Merino Flex Shorts (Maroon • M • x2)",
    ])
  })

  // ⚠️ Anti-fabrication pin: there is NO per-product prep/pull-status field in
  // the shot/product model (the only 'fulfilled'/'fulfillment' state lives in
  // the SEPARATE pulls feature). The row shape is EXACTLY what the lib defines —
  // a row must NOT invent a prep/status/fulfilled/pulled field. Asserting the
  // full key-set (not just absence) catches any accidental extra column.
  it("fabricates NO prep/status field — the row shape is exactly the lib contract", () => {
    const shot = makeShot({ shotNumber: "9", looks: [makeLook("l", [shorts])] })
    const row = buildWarehousePullList([shot])[0]!

    expect(Object.keys(row).sort()).toEqual([
      "colourName",
      "key",
      "label",
      "neededByShots",
      "styleNumber",
    ])
    // Explicit negatives for the prep-status fields a naive impl might invent.
    expect(row).not.toHaveProperty("prep")
    expect(row).not.toHaveProperty("prepStatus")
    expect(row).not.toHaveProperty("status")
    expect(row).not.toHaveProperty("fulfilled")
    expect(row).not.toHaveProperty("fulfillment")
    expect(row).not.toHaveProperty("pulled")
    expect(row).not.toHaveProperty("quantity")
    // The shot ref carries only id + label — no per-shot prep state either.
    expect(Object.keys(row.neededByShots[0]!).sort()).toEqual(["shotId", "shotLabel"])
  })
})
