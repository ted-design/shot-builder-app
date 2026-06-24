import { describe, it, expect } from "vitest"
import { deriveShotReportModel, formatDateWindow, normalizeGender, sizeLabel } from "../reportModel"
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

describe("formatDateWindow", () => {
  it("returns null for no dates", () => {
    expect(formatDateWindow([])).toBeNull()
    expect(formatDateWindow(undefined)).toBeNull()
    expect(formatDateWindow(["nope"])).toBeNull()
  })
  it("formats a single day, a same-month range, cross-month, and cross-year (unsorted input)", () => {
    expect(formatDateWindow(["2026-06-02"])).toBe("Jun 2, 2026")
    expect(formatDateWindow(["2026-06-06", "2026-06-02", "2026-06-04"])).toBe("Jun 2–6, 2026")
    expect(formatDateWindow(["2026-06-28", "2026-07-02"])).toBe("Jun 28 – Jul 2, 2026")
    expect(formatDateWindow(["2026-01-02", "2025-12-30"])).toBe("Dec 30, 2025 – Jan 2, 2026")
  })
})

describe("deriveShotReportModel", () => {
  it("derives project.dateRange from shootDates (null when absent)", () => {
    const withDates = deriveShotReportModel(
      data({ project: { name: "P", clientId: "c", shootDates: ["2026-06-04", "2026-06-02"] } as ExportData["project"] }),
      DEFAULT_REPORT_CONFIG,
    )
    expect(withDates.project.dateRange).toBe("Jun 2–4, 2026")
    const noDates = deriveShotReportModel(data({}), DEFAULT_REPORT_CONFIG)
    expect(noDates.project.dateRange).toBeNull()
  })

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

  const twoLookShot = () =>
    data({
      productFamilies: FAMILIES,
      shots: [
        shot({
          id: "s1",
          shotNumber: "01",
          looks: [
            { id: "l0", order: 0, products: [{ familyId: "fM" }] },
            { id: "l1", order: 1, label: "Alt A", products: [{ familyId: "fM" }] },
          ],
        }),
      ],
    })

  it("looksMode 'primary-only' shows only the primary look; 'all' shows every look", () => {
    const d = twoLookShot()
    const all = deriveShotReportModel(d, { groupBy: "gender", excludedShotIds: [], looksMode: "all" })
    const primary = deriveShotReportModel(d, { groupBy: "gender", excludedShotIds: [], looksMode: "primary-only" })
    expect(all.groups.flatMap((g) => g.shots)[0]?.looks.map((l) => l.label)).toEqual(["Primary", "Alt A"])
    const pLooks = primary.groups.flatMap((g) => g.shots)[0]?.looks
    expect(pLooks?.map((l) => l.label)).toEqual(["Primary"])
    expect(pLooks?.[0]?.isAlt).toBe(false)
  })

  it("default looksMode (omitted) shows all looks", () => {
    const model = deriveShotReportModel(twoLookShot(), { groupBy: "none", excludedShotIds: [] })
    expect(model.groups.flatMap((g) => g.shots)[0]?.looks).toHaveLength(2)
  })

  it("plate falls back to a product image (hero first) when the look has no reference photo", () => {
    const d = data({
      productFamilies: FAMILIES,
      shots: [
        shot({
          id: "s1",
          shotNumber: "01",
          looks: [
            // No references; two products, only the hero carries an image.
            {
              id: "l0",
              order: 0,
              heroProductId: "fM",
              products: [
                { familyId: "fW", skuImageUrl: "non-hero-img" },
                { familyId: "fM", thumbUrl: "hero-img" },
              ],
            },
          ],
        }),
      ],
    })
    const m = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], looksMode: "all" })
    const look = m.groups[0]?.shots[0]?.looks[0]
    expect(look?.image).toBe("hero-img")
    // The plate shows the product fallback, but it's NOT a real reference — so the
    // "references ready" counter (hasImage) must stay false.
    expect(look?.hasReference).toBe(false)
    expect(m.groups[0]?.shots[0]?.hasImage).toBe(false)
  })

  it("the product-image fallback applies to the PRIMARY look only, not alt looks", () => {
    const d = data({
      productFamilies: FAMILIES,
      shots: [
        shot({
          id: "s1",
          shotNumber: "01",
          looks: [
            { id: "l0", order: 0, products: [{ familyId: "fM", thumbUrl: "primary-prod" }] },
            { id: "l1", order: 1, label: "Alt", products: [{ familyId: "fW", thumbUrl: "alt-prod" }] },
          ],
        }),
      ],
    })
    const looks = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], looksMode: "all" })
      .groups[0]?.shots[0]?.looks
    expect(looks?.[0]?.image).toBe("primary-prod") // primary plate gets the product fallback
    expect(looks?.[1]?.image).toBeNull() // alt look stays reference-only (no stand-in)
  })

  it("falls through a hero with no image to the next product that has one", () => {
    const d = data({
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
                { familyId: "fM" }, // hero, no image
                { familyId: "fW", skuImageUrl: "non-hero-img" },
              ],
            },
          ],
        }),
      ],
    })
    const m = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], looksMode: "all" })
    expect(m.groups[0]?.shots[0]?.looks[0]?.image).toBe("non-hero-img")
  })

  it("an uploaded reference still wins over a product image (precedence unchanged)", () => {
    const d = data({
      productFamilies: FAMILIES,
      shots: [
        shot({
          id: "s1",
          shotNumber: "01",
          looks: [
            {
              id: "l0",
              order: 0,
              references: [{ id: "r", path: "ref-img" }],
              products: [{ familyId: "fM", thumbUrl: "prod-img" }],
            },
          ],
        }),
      ],
    })
    const m = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], looksMode: "all" })
    expect(m.groups[0]?.shots[0]?.looks[0]?.image).toBe("ref-img")
  })

  it("plate stays null when a look has neither references nor any product image", () => {
    const d = data({
      productFamilies: FAMILIES,
      shots: [
        shot({
          id: "s1",
          shotNumber: "01",
          looks: [{ id: "l0", order: 0, products: [{ familyId: "fM" }] }],
        }),
      ],
    })
    const m = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], looksMode: "all" })
    expect(m.groups[0]?.shots[0]?.looks[0]?.image).toBeNull()
    expect(m.groups[0]?.shots[0]?.hasImage).toBe(false)
  })

  it("hasImage recomputes on the filtered looks (no masthead overcount)", () => {
    const d = data({
      productFamilies: FAMILIES,
      shots: [
        shot({
          id: "s1",
          shotNumber: "01",
          looks: [
            { id: "l0", order: 0, products: [{ familyId: "fM" }] }, // primary: no image
            { id: "l1", order: 1, references: [{ id: "r", path: "u" }], products: [{ familyId: "fM" }] },
          ],
        }),
      ],
    })
    const all = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], looksMode: "all" })
    const primary = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], looksMode: "primary-only" })
    expect(all.groups[0]?.shots[0]?.hasImage).toBe(true)
    expect(primary.groups[0]?.shots[0]?.hasImage).toBe(false)
  })

  it("looksMode does not change grouping (gender resolves from all looks)", () => {
    const d = data({
      productFamilies: FAMILIES,
      shots: [
        shot({
          id: "s1",
          shotNumber: "01",
          looks: [
            { id: "l0", order: 0, products: [{ familyId: "unknown" }] }, // primary: ungendered
            { id: "l1", order: 1, products: [{ familyId: "fM" }] }, // alt: men
          ],
        }),
      ],
    })
    const all = deriveShotReportModel(d, { groupBy: "gender", excludedShotIds: [], looksMode: "all" })
    const primary = deriveShotReportModel(d, { groupBy: "gender", excludedShotIds: [], looksMode: "primary-only" })
    expect(all.groups.find((g) => g.shots.some((s) => s.id === "s1"))?.key).toBe("M")
    expect(primary.groups.find((g) => g.shots.some((s) => s.id === "s1"))?.key).toBe("M")
  })
})

describe("sizeLabel", () => {
  it("shows the concrete size for a single scope", () => {
    expect(sizeLabel("single", "M")).toEqual({ text: "M", pending: false })
  })
  it("shows 'All sizes' (not muted) for the bulk scope, even with empty size", () => {
    expect(sizeLabel("all", null)).toEqual({ text: "All sizes", pending: false })
    expect(sizeLabel("all", "")).toEqual({ text: "All sizes", pending: false })
  })
  it("shows 'Pending' (muted) for the pending scope or a missing single size", () => {
    expect(sizeLabel("pending", null)).toEqual({ text: "Pending", pending: true })
    expect(sizeLabel("single", "  ")).toEqual({ text: "Pending", pending: true })
    expect(sizeLabel(null, null)).toEqual({ text: "Pending", pending: true })
  })
  it("pending scope stays 'Pending' even with a stale non-empty size", () => {
    expect(sizeLabel("pending", "M")).toEqual({ text: "Pending", pending: true })
  })
})
