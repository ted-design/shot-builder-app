import { describe, it, expect } from "vitest"
import { deriveShotReportModel, normalizeGender } from "../reportModel"
import { DEFAULT_REPORT_CONFIG } from "../reportTypes"
import type { ExportData } from "../../../hooks/useExportData"
import type { ProductFamily, Shot, TalentRecord } from "@/shared/types"

// Minimal factories — cast past required audit fields the model never reads.
function fam(id: string, styleNumber: string, gender: string | null): ProductFamily {
  return { id, styleName: id, styleNumber, gender } as unknown as ProductFamily
}
function talent(id: string, name: string): TalentRecord {
  return { id, name } as unknown as TalentRecord
}
function shot(s: Partial<Shot> & { id: string }): Shot {
  return {
    title: "Shot",
    status: "complete",
    talent: [],
    products: [],
    sortOrder: 0,
    ...s,
  } as unknown as Shot
}

function data(over: Partial<ExportData>): ExportData {
  return {
    project: { name: "Q2-26 No. 3", clientId: "unbound-merino" } as ExportData["project"],
    shots: [],
    productFamilies: [],
    pulls: [],
    crew: [],
    talent: [],
    loading: false,
    ...over,
  }
}

const FAMILIES = [
  fam("fM", "M-TP-LS-1399", "men"),
  fam("fW", "W-BT-PN-1048", "women"),
]

describe("normalizeGender", () => {
  it("maps common forms to M/W and unknowns to null", () => {
    expect(normalizeGender("men")).toBe("M")
    expect(normalizeGender("Women")).toBe("W")
    expect(normalizeGender("female")).toBe("W")
    expect(normalizeGender("unisex")).toBeNull()
    expect(normalizeGender(null)).toBeNull()
    expect(normalizeGender("")).toBeNull()
  })
})

describe("deriveShotReportModel", () => {
  it("labels looks Primary/Alt and separates them (never merged)", () => {
    const model = deriveShotReportModel(
      data({
        productFamilies: FAMILIES,
        shots: [
          shot({
            id: "s1",
            shotNumber: "01",
            looks: [
              { id: "l0", order: 0, products: [{ familyId: "fM" }], heroProductId: "fM" },
              { id: "l1", order: 1, label: "Alt A", products: [{ familyId: "fM" }] },
            ],
          }),
        ],
      }),
      DEFAULT_REPORT_CONFIG,
    )
    const s = model.groups.flatMap((g) => g.shots).find((x) => x.id === "s1")
    expect(s?.looks.map((l) => l.label)).toEqual(["Primary", "Alt A"])
    expect(s?.looks.map((l) => l.isAlt)).toEqual([false, true])
  })

  it("resolves style# + hero from the product family and look heroProductId", () => {
    const model = deriveShotReportModel(
      data({
        productFamilies: FAMILIES,
        shots: [
          shot({
            id: "s1",
            shotNumber: "01",
            looks: [
              {
                id: "l0",
                order: 0,
                heroProductId: "fM",
                products: [
                  { familyId: "fM", familyName: "Crew", colourName: "Black", sizeScope: "pending" },
                  { familyId: "fW", familyName: "Pant", colourName: "Ivory", size: "M/30", sizeScope: "single", quantity: 1 },
                ],
              },
            ],
          }),
        ],
      }),
      DEFAULT_REPORT_CONFIG,
    )
    const prods = model.groups.flatMap((g) => g.shots)[0]?.looks[0]?.products ?? []
    expect(prods[0]).toMatchObject({ family: "Crew", style: "M-TP-LS-1399", colour: "Black", isHero: true, sizeScope: "pending", size: null })
    expect(prods[1]).toMatchObject({ family: "Pant", style: "W-BT-PN-1048", isHero: false, size: "M/30", qty: 1 })
  })

  it("groups by gender via the tag-then-product cascade, ordered W,M", () => {
    const model = deriveShotReportModel(
      data({
        productFamilies: FAMILIES,
        shots: [
          shot({ id: "m1", shotNumber: "02", looks: [{ id: "l", order: 0, products: [{ familyId: "fM" }] }] }),
          shot({ id: "w1", shotNumber: "01", looks: [{ id: "l", order: 0, products: [{ familyId: "fW" }] }] }),
          shot({
            id: "tagW", shotNumber: "03",
            tags: [{ id: "g", label: "Women", color: "blue", category: "gender" }],
            looks: [{ id: "l", order: 0, products: [{ familyId: "fM" }] }], // product says M, tag says W -> tag wins
          }),
        ],
      }),
      DEFAULT_REPORT_CONFIG,
    )
    expect(model.groups.map((g) => g.key)).toEqual(["W", "M"])
    expect(model.groups[0]?.shots.map((s) => s.id)).toEqual(["w1", "tagW"]) // sorted by number within group
    expect(model.groups[1]?.shots.map((s) => s.id)).toEqual(["m1"])
  })

  it("flags excluded shots and unresolved gender, and detects no-image", () => {
    const model = deriveShotReportModel(
      data({
        productFamilies: FAMILIES,
        shots: [
          shot({ id: "noG", shotNumber: "01", looks: [{ id: "l", order: 0, products: [{ familyId: "unknown" }] }] }),
        ],
      }),
      { groupBy: "gender", excludedShotIds: ["noG"] },
    )
    const s = model.groups.flatMap((g) => g.shots)[0]
    expect(s?.gender).toBe("?")
    expect(s?.excluded).toBe(true)
    expect(s?.hasImage).toBe(false)
    expect(model.groups[0]?.key).toBe("?")
  })

  it("drops deleted shots and honors groupBy:none", () => {
    const model = deriveShotReportModel(
      data({
        productFamilies: FAMILIES,
        shots: [
          shot({ id: "live", shotNumber: "01", looks: [{ id: "l", order: 0, products: [{ familyId: "fW" }] }] }),
          shot({ id: "gone", shotNumber: "02", deleted: true, looks: [] }),
        ],
      }),
      { groupBy: "none", excludedShotIds: [] },
    )
    expect(model.groups).toHaveLength(1)
    expect(model.groups[0]?.key).toBe("all")
    expect(model.groups[0]?.shots.map((s) => s.id)).toEqual(["live"])
  })
})
