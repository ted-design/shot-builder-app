import { describe, it, expect } from "vitest"
import {
  collectProductInfoImageCandidates,
  deriveProductInfoModel,
} from "../productInfoModel"
import { DEFAULT_PRODUCT_INFO_CONFIG, type ProductInfoConfig } from "../productInfoTypes"
import type { ExportData } from "../../../hooks/useExportData"
import type { ProductFamily, Shot } from "@/shared/types"

// Minimal factories — cast past required audit fields the model never reads.
function fam(over: Partial<ProductFamily> & { id: string }): ProductFamily {
  return { styleName: over.id, clientId: "c", ...over } as unknown as ProductFamily
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

function cfg(over: Partial<ProductInfoConfig> = {}): ProductInfoConfig {
  return { ...DEFAULT_PRODUCT_INFO_CONFIG, ...over }
}

const FAMILIES = [
  fam({ id: "fM", styleName: "Merino Crew", styleNumber: "M-TP-LS-1399", gender: "men", productType: "Tops" }),
  fam({ id: "fW", styleName: "Wool Pant", styleNumber: "W-BT-PN-1048", gender: "women", productType: "Bottoms" }),
]

function flat(model: ReturnType<typeof deriveProductInfoModel>) {
  return model.groups.flatMap((g) => g.items)
}
function find(model: ReturnType<typeof deriveProductInfoModel>, id: string) {
  return flat(model).find((i) => i.id === id)
}

describe("deriveProductInfoModel — in-use scope", () => {
  it("includes only families styled into non-deleted shots' looks (not the flat library)", () => {
    const model = deriveProductInfoModel(
      data({
        productFamilies: FAMILIES,
        shots: [
          shot({ id: "s1", shotNumber: "01", looks: [{ id: "l", order: 0, products: [{ familyId: "fM" }] }] }),
          shot({ id: "gone", shotNumber: "02", deleted: true, looks: [{ id: "l", order: 0, products: [{ familyId: "fW" }] }] }),
        ],
      }),
      cfg(),
    )
    const ids = flat(model).map((i) => i.id)
    expect(ids).toContain("fM")
    expect(ids).not.toContain("fW") // only styled into a DELETED shot
    expect(model.project.familyCount).toBe(1)
  })

  it("aggregates colours and sizes as a de-duped union across every styling assignment", () => {
    const model = deriveProductInfoModel(
      data({
        productFamilies: FAMILIES,
        shots: [
          shot({
            id: "s1", shotNumber: "01",
            looks: [
              { id: "l0", order: 0, products: [{ familyId: "fM", colourName: "Black", size: "M", sizeScope: "single" }] },
              { id: "l1", order: 1, products: [{ familyId: "fM", colourName: "Black", size: "L", sizeScope: "single" }] },
            ],
          }),
          shot({
            id: "s2", shotNumber: "02",
            looks: [{ id: "l", order: 0, products: [{ familyId: "fM", skuName: "Navy", size: "M", sizeScope: "single" }] }],
          }),
        ],
      }),
      cfg(),
    )
    const e = find(model, "fM")
    expect(e?.colours).toEqual(["Black", "Navy"]) // colourName, then skuName fallback; deduped
    expect(e?.sizes).toEqual(["M", "L"]) // M appears twice -> once
  })

  it("flags sizePending when any assignment is sizeScope 'pending', and excludes that size from the union", () => {
    const model = deriveProductInfoModel(
      data({
        productFamilies: FAMILIES,
        shots: [
          shot({
            id: "s1", shotNumber: "01",
            looks: [{ id: "l", order: 0, products: [
              { familyId: "fM", colourName: "Black", size: "M", sizeScope: "single" },
              { familyId: "fM", colourName: "Black", size: "?", sizeScope: "pending" },
            ] }],
          }),
        ],
      }),
      cfg(),
    )
    const e = find(model, "fM")
    expect(e?.sizePending).toBe(true)
    expect(e?.sizes).toEqual(["M"]) // the pending entry's size is not unioned
  })

  it("isHero is true from an assignment isHero flag OR the look's heroProductId", () => {
    const model = deriveProductInfoModel(
      data({
        productFamilies: FAMILIES,
        shots: [
          shot({ id: "s1", shotNumber: "01", looks: [{ id: "l", order: 0, heroProductId: "fW", products: [{ familyId: "fW" }] }] }),
          shot({ id: "s2", shotNumber: "02", looks: [{ id: "l", order: 0, products: [{ familyId: "fM", isHero: true }] }] }),
        ],
      }),
      cfg({ groupBy: "none" }),
    )
    expect(find(model, "fW")?.isHero).toBe(true) // via heroProductId
    expect(find(model, "fM")?.isHero).toBe(true) // via assignment flag
  })

  it("does NOT mark hero when heroProductId points at a different family", () => {
    const model = deriveProductInfoModel(
      data({
        productFamilies: FAMILIES,
        shots: [
          shot({ id: "s1", shotNumber: "01", looks: [{ id: "l", order: 0, heroProductId: "fM", products: [{ familyId: "fW" }] }] }),
        ],
      }),
      cfg(),
    )
    expect(find(model, "fW")?.isHero).toBe(false)
  })

  it("builds appears[] as one entry per shot (looks accrued), sorted by shot number", () => {
    const model = deriveProductInfoModel(
      data({
        productFamilies: FAMILIES,
        shots: [
          shot({ id: "s10", shotNumber: "10", status: "todo", looks: [{ id: "l", order: 0, products: [{ familyId: "fM" }] }] }),
          shot({ id: "s2", shotNumber: "2", status: "complete", looks: [
            { id: "l0", order: 0, products: [{ familyId: "fM" }] },
            { id: "l1", order: 1, label: "Alt A", products: [{ familyId: "fM" }] },
          ] }),
        ],
      }),
      cfg(),
    )
    const appears = find(model, "fM")?.appears ?? []
    // shot 2 (one entry, both look labels) before shot 10 — NOT three rows
    expect(appears.map((a) => `${a.number}:${a.looks.join("+")}:${a.status}`)).toEqual([
      "2:Primary+Alt A:complete",
      "10:Primary:todo",
    ])
  })

  it("counts one appearance per shot for multiple same-family SKUs in one look", () => {
    const model = deriveProductInfoModel(
      data({
        productFamilies: FAMILIES,
        shots: [
          shot({ id: "s1", shotNumber: "01", status: "complete", looks: [{ id: "l", order: 0, products: [
            { familyId: "fM", colourName: "Black" },
            { familyId: "fM", colourName: "White" },
          ] }] }),
        ],
      }),
      cfg(),
    )
    const appears = find(model, "fM")?.appears ?? []
    expect(appears.length).toBe(1) // one shot, not two
    expect(appears[0]?.looks).toEqual(["Primary"]) // one look, deduped
  })

  it("flags isHero when the look heroProductId points at a SKU id, not the family id", () => {
    const model = deriveProductInfoModel(
      data({
        productFamilies: FAMILIES,
        shots: [
          shot({ id: "s1", shotNumber: "01", looks: [{ id: "l", order: 0, heroProductId: "sku-1", products: [
            { familyId: "fM", skuId: "sku-1" },
          ] }] }),
        ],
      }),
      cfg({ groupBy: "none" }),
    )
    expect(find(model, "fM")?.isHero).toBe(true)
  })
})

describe("deriveProductInfoModel — library scope", () => {
  it("includes every non-deleted family even when never styled, and still derives appears", () => {
    const model = deriveProductInfoModel(
      data({
        productFamilies: [
          ...FAMILIES,
          fam({ id: "fGone", styleName: "Retired", gender: "men", deleted: true }),
        ],
        shots: [shot({ id: "s1", shotNumber: "01", looks: [{ id: "l", order: 0, products: [{ familyId: "fM" }] }] })],
      }),
      cfg({ productScope: "library" }),
    )
    const ids = flat(model).map((i) => i.id)
    expect(ids).toContain("fW") // unused but in the library
    expect(ids).not.toContain("fGone") // soft-deleted family dropped
    expect(find(model, "fM")?.appears.length).toBe(1)
    expect(find(model, "fW")?.appears.length).toBe(0) // unused -> no appearances
  })
})

describe("deriveProductInfoModel — grouping", () => {
  const styled = () =>
    data({
      productFamilies: FAMILIES,
      shots: [
        shot({ id: "sM", shotNumber: "02", looks: [{ id: "l", order: 0, products: [{ familyId: "fM" }] }] }),
        shot({ id: "sW", shotNumber: "01", looks: [{ id: "l", order: 0, products: [{ familyId: "fW" }] }] }),
      ],
    })

  it("group-by gender orders Women then Men and reuses the shared GROUP_LABEL", () => {
    const model = deriveProductInfoModel(styled(), cfg({ groupBy: "gender" }))
    expect(model.groups.map((g) => g.key)).toEqual(["W", "M"])
    expect(model.groups.map((g) => g.label)).toEqual(["Women", "Men"])
    expect(model.groups[0]?.items.map((i) => i.id)).toEqual(["fW"])
  })

  it("group-by product-type buckets by family.productType, alpha-ordered", () => {
    const model = deriveProductInfoModel(styled(), cfg({ groupBy: "product-type" }))
    expect(model.groups.map((g) => g.key)).toEqual(["Bottoms", "Tops"])
    expect(model.groups[0]?.items.map((i) => i.id)).toEqual(["fW"]) // Bottoms
  })

  it("group-by none yields one flat alpha group by styleName", () => {
    const model = deriveProductInfoModel(styled(), cfg({ groupBy: "none" }))
    expect(model.groups).toHaveLength(1)
    expect(model.groups[0]?.key).toBe("all")
    expect(model.groups[0]?.items.map((i) => i.styleName)).toEqual(["Merino Crew", "Wool Pant"])
  })
})

describe("deriveProductInfoModel — entry fields & images", () => {
  it("resolves styleNumber from styleNumbers[0] then styleNumber, gender label, and excluded flag", () => {
    const model = deriveProductInfoModel(
      data({
        productFamilies: [
          fam({ id: "fM", styleName: "Crew", styleNumbers: ["PREF-1"], styleNumber: "OLD-1", gender: "men" }),
          fam({ id: "fX", styleName: "Mystery", gender: "alien" }),
        ],
        shots: [shot({ id: "s1", shotNumber: "01", looks: [{ id: "l", order: 0, products: [{ familyId: "fM" }, { familyId: "fX" }] }] })],
      }),
      cfg({ groupBy: "none", excludedFamilyIds: ["fM"] }),
    )
    expect(find(model, "fM")).toMatchObject({ styleNumber: "PREF-1", genderLabel: "Men", excluded: true })
    expect(find(model, "fX")).toMatchObject({ gender: "?", genderLabel: null, excluded: false })
  })

  it("picks the image candidate by assignment thumbs, then family thumbnail, then header", () => {
    const model = deriveProductInfoModel(
      data({
        productFamilies: [
          fam({ id: "fA", styleName: "A", thumbnailImagePath: "fam/A-thumb.jpg", headerImagePath: "fam/A-head.jpg" }),
          fam({ id: "fB", styleName: "B", headerImagePath: "fam/B-head.jpg" }),
          fam({ id: "fC", styleName: "C", thumbnailImagePath: "fam/C-thumb.jpg" }),
        ],
        shots: [
          shot({ id: "s1", shotNumber: "01", looks: [{ id: "l", order: 0, products: [
            { familyId: "fA", thumbUrl: "asn/A.jpg" }, // assignment wins
            { familyId: "fB" }, // no assignment image, no thumbnail -> header
            { familyId: "fC" }, // no assignment image -> family thumbnail
          ] }] }),
        ],
      }),
      cfg({ groupBy: "none" }),
    )
    expect(find(model, "fA")?.image).toBe("asn/A.jpg")
    expect(find(model, "fB")?.image).toBe("fam/B-head.jpg")
    expect(find(model, "fC")?.image).toBe("fam/C-thumb.jpg")
  })

  it("collectProductInfoImageCandidates returns each unique resolved candidate once", () => {
    const model = deriveProductInfoModel(
      data({
        productFamilies: [
          fam({ id: "fA", styleName: "A", thumbnailImagePath: "shared.jpg" }),
          fam({ id: "fB", styleName: "B", thumbnailImagePath: "shared.jpg" }),
          fam({ id: "fC", styleName: "C" }), // no image
        ],
        shots: [
          shot({ id: "s1", shotNumber: "01", looks: [{ id: "l", order: 0, products: [
            { familyId: "fA" }, { familyId: "fB" }, { familyId: "fC" },
          ] }] }),
        ],
      }),
      cfg({ groupBy: "none" }),
    )
    expect(collectProductInfoImageCandidates(model)).toEqual(["shared.jpg"])
  })

  it("dateRange + familyCount surface on the project masthead block", () => {
    const model = deriveProductInfoModel(
      data({
        project: { name: "P", clientId: "c", shootDates: ["2026-06-04", "2026-06-02"] } as ExportData["project"],
        productFamilies: FAMILIES,
        shots: [shot({ id: "s1", shotNumber: "01", looks: [{ id: "l", order: 0, products: [{ familyId: "fM" }, { familyId: "fW" }] }] })],
      }),
      cfg(),
    )
    expect(model.project.dateRange).toBe("Jun 2–4, 2026")
    expect(model.project.familyCount).toBe(2)
  })
})
