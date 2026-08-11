import { describe, it, expect } from "vitest"
import { deriveShotReportModel, formatDateWindow, mostOutstandingStatus, normalizeGender, sizeLabel, titleCaseSlug } from "../reportModel"
import {
  DEFAULT_REPORT_CONFIG,
  formatFilterSummary,
  formatOrderNote,
  LEGACY_HIDDEN_STATUSES_FILTER_ID,
  neutralizeReportConfigForFlag,
  resolveReportFilters,
  type ReportConfig,
  type ReportFilterCondition,
  type ReportSortField,
} from "../reportTypes"
import type { ExportData } from "../../../hooks/useExportData"
import type { Lane, ProductFamily, Shot, TalentRecord } from "@/shared/types"

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
function lane(l: Partial<Lane> & { id: string }): Lane {
  return {
    name: l.id,
    projectId: "p1",
    clientId: "c1",
    sortOrder: 0,
    ...l,
  } as unknown as Lane
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

  it("R3: hides shots whose status is in hiddenStatuses (gone from every group + shotCount)", () => {
    const d = data({
      productFamilies: FAMILIES,
      shots: [
        shot({ id: "hold", shotNumber: "01", status: "on_hold", looks: [{ id: "l", order: 0, products: [{ familyId: "fW" }] }] }),
        shot({ id: "done", shotNumber: "02", status: "complete", looks: [{ id: "l", order: 0, products: [{ familyId: "fW" }] }] }),
      ],
    })
    const model = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], hiddenStatuses: ["on_hold"] })
    expect(model.groups.flatMap((g) => g.shots).map((s) => s.id)).toEqual(["done"])
    expect(model.project.shotCount).toBe(1)
  })

  it("R3: an omitted hiddenStatuses is byte-identical to [] — nothing is hidden", () => {
    const d = data({
      productFamilies: FAMILIES,
      shots: [
        shot({ id: "hold", shotNumber: "01", status: "on_hold", looks: [{ id: "l", order: 0, products: [{ familyId: "fW" }] }] }),
      ],
    })
    const omitted = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [] })
    const empty = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], hiddenStatuses: [] })
    expect(omitted.groups.flatMap((g) => g.shots).map((s) => s.id)).toEqual(["hold"])
    expect(empty.groups.flatMap((g) => g.shots).map((s) => s.id)).toEqual(["hold"])
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

// A MANUAL hero upload always writes to this exact Storage path
// (uploadHeroImage, uploadImage.ts) — the same convention reportModel.ts's
// isManualHeroImage / ActiveLookCoverReferencesPanel.tsx / HeroImageSection.tsx
// all key off. Every fixture below that wants "hero WINS" uses this shape;
// fixtures proving a SYNTHESIZED heroImage does NOT win use an arbitrary path
// that does not end in "/hero.webp" (see the second describe block).
const MANUAL_HERO = { path: "clients/c1/shots/s1/hero.webp", downloadURL: "hero-url" }

describe("deriveShotReportModel — WS-C hero-first cover (2026-08-11, corrected: manual hero only)", () => {
  it("a MANUAL Shot.heroImage (path ends /hero.webp) WINS over the existing reference when both are set and differ", () => {
    const d = data({
      shots: [
        shot({
          id: "s1",
          shotNumber: "01",
          heroImage: MANUAL_HERO,
          looks: [
            {
              id: "l0",
              order: 0,
              references: [{ id: "r1", path: "ref.jpg", downloadURL: "ref-url" }],
              products: [],
            },
          ],
        }),
      ],
    })
    const m = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], looksMode: "all" })
    expect(m.groups[0]?.shots[0]?.looks[0]?.image).toBe("hero-url")
  })

  it("hero absent -> byte-identical to today's look-reference logic (falls through to the reference)", () => {
    const d = data({
      shots: [
        shot({
          id: "s1",
          shotNumber: "01",
          looks: [
            {
              id: "l0",
              order: 0,
              references: [{ id: "r1", path: "ref.jpg", downloadURL: "ref-url" }],
              products: [],
            },
          ],
        }),
      ],
    })
    const m = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], looksMode: "all" })
    expect(m.groups[0]?.shots[0]?.looks[0]?.image).toBe("ref-url")
  })

  it("hero absent, no reference either -> falls through to the pre-WS-C product-fallback, unchanged", () => {
    const d = data({
      productFamilies: FAMILIES,
      shots: [
        shot({
          id: "s1",
          shotNumber: "01",
          looks: [{ id: "l0", order: 0, heroProductId: "fM", products: [{ familyId: "fM", thumbUrl: "prod-img" }] }],
        }),
      ],
    })
    const m = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], looksMode: "all" })
    expect(m.groups[0]?.shots[0]?.looks[0]?.image).toBe("prod-img")
  })

  it("manual hero wins over the product fallback too when there is no reference at all", () => {
    const d = data({
      productFamilies: FAMILIES,
      shots: [
        shot({
          id: "s1",
          shotNumber: "01",
          heroImage: MANUAL_HERO,
          looks: [{ id: "l0", order: 0, heroProductId: "fM", products: [{ familyId: "fM", thumbUrl: "prod-img" }] }],
        }),
      ],
    })
    const m = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], looksMode: "all" })
    expect(m.groups[0]?.shots[0]?.looks[0]?.image).toBe("hero-url")
  })

  it("hero-first applies ONLY to the primary look slot — alt looks keep their pre-existing reference-only behavior under looksMode:'all'", () => {
    const d = data({
      shots: [
        shot({
          id: "s1",
          shotNumber: "01",
          heroImage: MANUAL_HERO,
          looks: [
            { id: "l0", order: 0, products: [] }, // primary: no reference — hero wins
            { id: "l1", order: 1, label: "Alt A", products: [] }, // alt: no reference — stays null, hero never applies
          ],
        }),
      ],
    })
    const m = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], looksMode: "all" })
    const looks = m.groups[0]?.shots[0]?.looks
    expect(looks?.[0]?.image).toBe("hero-url")
    expect(looks?.[1]?.image).toBeNull()
  })

  it("hero-first does not change hasReference — the 'references ready' counter still tracks a real uploaded reference only", () => {
    const d = data({
      shots: [
        shot({
          id: "s1",
          shotNumber: "01",
          heroImage: MANUAL_HERO,
          looks: [{ id: "l0", order: 0, products: [] }], // no reference — hero supplies the cover, but it's not a reference
        }),
      ],
    })
    const m = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], looksMode: "all" })
    expect(m.groups[0]?.shots[0]?.looks[0]?.hasReference).toBe(false)
    expect(m.groups[0]?.shots[0]?.hasImage).toBe(false)
  })

  it("a manual heroImage with only a path (no downloadURL survives the mapper in practice, but defend anyway) resolves via path", () => {
    const d = data({
      shots: [
        shot({
          id: "s1",
          shotNumber: "01",
          heroImage: { path: "clients/c1/shots/s1/hero.webp" } as unknown as Shot["heroImage"],
          looks: [{ id: "l0", order: 0, products: [] }],
        }),
      ],
    })
    const m = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], looksMode: "all" })
    expect(m.groups[0]?.shots[0]?.looks[0]?.image).toBe("clients/c1/shots/s1/hero.webp")
  })
})

// Regression coverage for the confirmed bug: mapShot.normalizeHeroImage
// SYNTHESIZES Shot.heroImage for virtually every shot (Priority 1 = the
// ACTIVE look's display image/hero product — mapShot.ts:139), and
// ShotLooksSection's look-tab click ("setActiveLookForCover") patches
// `activeLookId` on a routine edit. Before the fix, resolveLooks trusted ANY
// heroImage (synthesized or manual) as the cover override — so clicking a
// look tab silently swapped the report's cover to whichever look merely
// became ACTIVE, demoting the primary (order 0) look's own reference to an
// "additional" thumb, even though the report's own primary-look definition
// (sortLooksByOrder / looks[0]) never changed. isManualHeroImage fixes this
// by requiring the heroImage to be a genuine manual upload (path ends
// "/hero.webp") before it can override the primary look's cover.
describe("deriveShotReportModel — hero-first does NOT follow a synthesized (active-look) heroImage", () => {
  it("a heroImage synthesized from the ACTIVE (non-primary) look is IGNORED — the primary look's own reference stays the cover", () => {
    const d = data({
      shots: [
        shot({
          id: "s1",
          shotNumber: "01",
          activeLookId: "l1",
          // Synthesized shape (as mapShot.normalizeHeroImage Priority 1 would
          // produce from the ACTIVE alt look's own reference) — NOT a manual
          // upload: no "/hero.webp" in the path.
          heroImage: { path: "alt-ref.jpg", downloadURL: "alt-ref-url" },
          looks: [
            {
              id: "l0",
              order: 0,
              references: [{ id: "r1", path: "primary-ref.jpg", downloadURL: "primary-ref-url" }],
              products: [],
            },
            {
              id: "l1",
              order: 1,
              label: "Alt",
              references: [{ id: "r2", path: "alt-ref.jpg", downloadURL: "alt-ref-url" }],
              products: [],
            },
          ],
        }),
      ],
    })
    const m = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], looksMode: "all" })
    const looks = m.groups[0]?.shots[0]?.looks
    // Primary look's cover is its OWN reference — unaffected by which look is "active".
    expect(looks?.[0]?.image).toBe("primary-ref-url")
    // The alt look renders its own reference, in its own slot — nothing swapped.
    expect(looks?.[1]?.image).toBe("alt-ref-url")
  })

  it("clicking a look tab (activeLookId change) never moves the primary look's reference into additionalImages", () => {
    const d = data({
      shots: [
        shot({
          id: "s1",
          shotNumber: "01",
          activeLookId: "l1",
          heroImage: { path: "alt-ref.jpg", downloadURL: "alt-ref-url" }, // synthesized from the now-active alt look
          looks: [
            {
              id: "l0",
              order: 0,
              references: [{ id: "r1", path: "primary-ref.jpg", downloadURL: "primary-ref-url" }],
              products: [],
            },
            {
              id: "l1",
              order: 1,
              label: "Alt",
              references: [{ id: "r2", path: "alt-ref.jpg", downloadURL: "alt-ref-url" }],
              products: [],
            },
          ],
        }),
      ],
    })
    const m = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], looksMode: "all" })
    const s = m.groups[0]?.shots[0]
    // The primary look's own reference is still the cover (coverIdentity),
    // so it's excluded from additionalImages — it must NOT get demoted into
    // this list just because a different look became "active". The alt
    // look's own reference legitimately appears here too (looksMode:"all"
    // shows every look's references as additional alongside its own slot —
    // see the looksMode:"primary-only" test below for the same rule), but
    // "primary-ref-url" — the shot's actual cover — must never be in it.
    expect(s?.additionalImages).toEqual(["alt-ref-url"])
    expect(s?.additionalImages).not.toContain("primary-ref-url")
  })
})

describe("deriveShotReportModel — WS-C additional images (2026-08-11)", () => {
  it("a MANUAL hero IS one of the references -> that reference is excluded from additionalImages, no duplicate", () => {
    const d = data({
      shots: [
        shot({
          id: "s1",
          shotNumber: "01",
          heroImage: { path: "clients/c1/shots/s1/hero.webp", downloadURL: "shared-url" },
          looks: [
            {
              id: "l0",
              order: 0,
              references: [
                { id: "r1", path: "shared.jpg", downloadURL: "shared-url" }, // same stored object as the hero
                { id: "r2", path: "other.jpg", downloadURL: "other-url" },
              ],
              products: [],
            },
          ],
        }),
      ],
    })
    const m = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], looksMode: "all" })
    const s = m.groups[0]?.shots[0]
    expect(s?.looks[0]?.image).toBe("shared-url") // hero wins as the cover
    expect(s?.additionalImages).toEqual(["other-url"]) // the identical-identity reference is excluded, not duplicated
  })

  it("a MANUAL hero is a DISTINCT image from every reference -> all references render as additional", () => {
    const d = data({
      shots: [
        shot({
          id: "s1",
          shotNumber: "01",
          heroImage: MANUAL_HERO,
          looks: [
            {
              id: "l0",
              order: 0,
              references: [
                { id: "r1", path: "ref1.jpg", downloadURL: "ref1-url" },
                { id: "r2", path: "ref2.jpg", downloadURL: "ref2-url" },
              ],
              products: [],
            },
          ],
        }),
      ],
    })
    const m = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], looksMode: "all" })
    expect(m.groups[0]?.shots[0]?.additionalImages).toEqual(["ref1-url", "ref2-url"])
  })

  it("no hero: the FIRST reference becomes the cover (today's logic) and is excluded from additionalImages", () => {
    const d = data({
      shots: [
        shot({
          id: "s1",
          shotNumber: "01",
          looks: [
            {
              id: "l0",
              order: 0,
              references: [
                { id: "r1", path: "cover.jpg", downloadURL: "cover-url" },
                { id: "r2", path: "extra.jpg", downloadURL: "extra-url" },
              ],
              products: [],
            },
          ],
        }),
      ],
    })
    const m = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], looksMode: "all" })
    const s = m.groups[0]?.shots[0]
    expect(s?.looks[0]?.image).toBe("cover-url")
    expect(s?.additionalImages).toEqual(["extra-url"])
  })

  it("looksMode:'primary-only' -> additionalImages sees only the PRIMARY look's references, never an alt look's", () => {
    const d = data({
      shots: [
        shot({
          id: "s1",
          shotNumber: "01",
          looks: [
            { id: "l0", order: 0, references: [{ id: "r1", path: "p1.jpg", downloadURL: "p1-url" }, { id: "r2", path: "p2.jpg", downloadURL: "p2-url" }], products: [] },
            { id: "l1", order: 1, label: "Alt", references: [{ id: "r3", path: "a1.jpg", downloadURL: "a1-url" }], products: [] },
          ],
        }),
      ],
    })
    const all = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], looksMode: "all" })
    const primary = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], looksMode: "primary-only" })
    // "all": primary's cover (p1-url) excluded, p2 + the alt look's reference both show
    expect(all.groups[0]?.shots[0]?.additionalImages).toEqual(["p2-url", "a1-url"])
    // primary-only: the alt look's reference must never appear
    expect(primary.groups[0]?.shots[0]?.additionalImages).toEqual(["p2-url"])
  })

  it("two references sharing the same stored object collapse to one additional thumb", () => {
    const d = data({
      shots: [
        shot({
          id: "s1",
          shotNumber: "01",
          looks: [
            {
              id: "l0",
              order: 0,
              references: [
                { id: "r1", path: "cover.jpg", downloadURL: "cover-url" },
                { id: "r2", path: "dup.jpg", downloadURL: "dup-url" },
                { id: "r3", path: "dup.jpg", downloadURL: "dup-url" }, // same stored object, different reference id
              ],
              products: [],
            },
          ],
        }),
      ],
    })
    const m = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], looksMode: "all" })
    expect(m.groups[0]?.shots[0]?.additionalImages).toEqual(["dup-url"])
  })

  // Regression: a Firestore doc that only ever stored `path` normalizes
  // (mapShot.ts's normalizeReferences) to `{ path, downloadURL: undefined }`,
  // while a sibling entry stored with both fields normalizes to
  // `{ path, downloadURL: <the URL> }` — even when both point at the exact
  // same Storage object. Before the fix, resolveImageIdentity returned
  // `downloadURL ?? path` verbatim, so those two entries produced DIFFERENT
  // identity strings (a bare path vs. a full https URL) and the dedupe
  // silently missed the collision.
  it("a reference stored with only `path` and a sibling stored with a full Firebase downloadURL pointing at the SAME object dedupe to one thumb", () => {
    const d = data({
      shots: [
        shot({
          id: "s1",
          shotNumber: "01",
          looks: [
            {
              id: "l0",
              order: 0,
              references: [
                { id: "r1", path: "cover.jpg", downloadURL: "cover-url" },
                // Only `path` set — the shape normalizeReferences produces for a
                // doc that never stored a downloadURL (downloadURL is optional
                // on ShotReferenceImage, so this is a structurally valid fixture).
                { id: "r2", path: "clients/c1/shots/s1/refs/dup.webp" },
                // The SAME Storage object, but stored (and normalized) with a
                // full Firebase download URL instead.
                {
                  id: "r3",
                  path: "clients/c1/shots/s1/refs/dup.webp",
                  downloadURL:
                    "https://firebasestorage.googleapis.com/v0/b/bucket/o/clients%2Fc1%2Fshots%2Fs1%2Frefs%2Fdup.webp?alt=media",
                },
              ],
              products: [],
            },
          ],
        }),
      ],
    })
    const m = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], looksMode: "all" })
    // One thumb, not two — r2 and r3 resolve to the SAME canonical identity
    // (the decoded Storage path), so the second occurrence is deduped.
    expect(m.groups[0]?.shots[0]?.additionalImages).toHaveLength(1)
  })

  it("a shot with no references at all derives an empty additionalImages array, not undefined", () => {
    const d = data({
      shots: [shot({ id: "s1", shotNumber: "01", looks: [{ id: "l0", order: 0, products: [] }] })],
    })
    const m = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [] })
    expect(m.groups[0]?.shots[0]?.additionalImages).toEqual([])
  })

  it("additionalImages is derived regardless of any config toggle — the model has no flag-shaped hole in it", () => {
    // deriveShotReportModel never reads a showAdditionalImages field; the model
    // always carries the real derived list. Rendering it is a presentation
    // concern (ReportConfig.showAdditionalImages), not a model concern.
    const d = data({
      shots: [
        shot({
          id: "s1",
          shotNumber: "01",
          looks: [
            {
              id: "l0",
              order: 0,
              references: [
                { id: "r1", path: "cover.jpg", downloadURL: "cover-url" },
                { id: "r2", path: "extra.jpg", downloadURL: "extra-url" },
              ],
              products: [],
            },
          ],
        }),
      ],
    })
    const m = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [] })
    expect(m.groups[0]?.shots[0]?.additionalImages).toEqual(["extra-url"])
  })
})

describe("deriveShotReportModel — R2 order-by (Phase B)", () => {
  // Worked example: groupBy 'status', sortBy 'talent', sortDir 'asc'. Ties fall to
  // the shot-number tie-break. Four shots, two talent names shared across statuses.
  const worked = () =>
    data({
      talent: [talent("tZoe", "Zoe"), talent("tAlice", "Alice"), talent("tBob", "Bob")],
      shots: [
        shot({ id: "S1", shotNumber: "01", status: "complete", talentIds: ["tZoe"] }),
        shot({ id: "S2", shotNumber: "02", status: "todo", talentIds: ["tAlice"] }),
        shot({ id: "S3", shotNumber: "03", status: "complete", talentIds: ["tBob"] }),
        shot({ id: "S4", shotNumber: "04", status: "todo", talentIds: ["tAlice"] }),
      ],
    })

  it("groups by status (workflow order, empties dropped) and sorts by talent within each group", () => {
    const model = deriveShotReportModel(worked(), {
      groupBy: "status",
      excludedShotIds: [],
      sortBy: "talent",
      sortDir: "asc",
    })
    expect(model.groups.map((g) => g.key)).toEqual(["todo", "complete"]) // in_progress/on_hold dropped
    expect(model.groups.map((g) => g.label)).toEqual(["Draft", "Shot"]) // canonical labels (statusMappings.ts)
    // todo: both "Alice" -> tie-break shot-number 02<04
    expect(model.groups[0]?.shots.map((s) => s.id)).toEqual(["S2", "S4"])
    // complete: "Bob" < "Zoe"
    expect(model.groups[1]?.shots.map((s) => s.id)).toEqual(["S3", "S1"])
  })

  it("flag-off byte-identical: a flag-ON config, run through the ShotReportPage neutralizer, deep-equals the default", () => {
    const d = data({
      productFamilies: FAMILIES,
      shots: [
        shot({ id: "S1", shotNumber: "01", status: "complete", tags: [{ id: "g", label: "Women", color: "b", category: "gender" }], looks: [{ id: "l", order: 0, products: [{ familyId: "fW" }] }] }),
        shot({ id: "S2", shotNumber: "02", status: "todo", tags: [{ id: "g", label: "Men", color: "b", category: "gender" }], looks: [{ id: "l", order: 0, products: [{ familyId: "fM" }] }] }),
        shot({ id: "S3", shotNumber: "03", status: "complete", tags: [{ id: "g", label: "Women", color: "b", category: "gender" }], looks: [{ id: "l", order: 0, products: [{ familyId: "fW" }] }] }),
        shot({ id: "S4", shotNumber: "04", status: "todo", tags: [{ id: "g", label: "Men", color: "b", category: "gender" }], looks: [{ id: "l", order: 0, products: [{ familyId: "fM" }] }] }),
      ],
    })
    const persisted: ReportConfig = {
      groupBy: "status",
      excludedShotIds: [],
      sortBy: "talent",
      sortDir: "desc",
      hiddenStatuses: ["todo"],
    }
    // The REAL neutralizer the ShotReportPage runs flag-off (shared pure fn), so
    // this test breaks if that code path ever diverges — not an inline copy of it.
    const neutralized = neutralizeReportConfigForFlag(persisted, false)
    expect(deriveShotReportModel(d, neutralized)).toEqual(deriveShotReportModel(d, DEFAULT_REPORT_CONFIG))
  })

  it("crash-safe: an out-of-union persisted sortBy falls back to shot-number order, never throws", () => {
    // exportReports writes schemaless (no rules validation), so a hand-edited/corrupt
    // sortBy can reach the derive. It must degrade, not kill the whole report render.
    const d = data({
      shots: [
        shot({ id: "S_a", shotNumber: "10", status: "todo" }),
        shot({ id: "S_b", shotNumber: "02", status: "todo" }),
      ],
    })
    const corrupt = { groupBy: "none", excludedShotIds: [], sortBy: "not-a-field", sortDir: "asc" } as unknown as ReportConfig
    const model = deriveShotReportModel(d, corrupt)
    // Falls back to the shot-number comparator: "02" before "10".
    expect(model.groups[0]?.shots.map((s) => s.id)).toEqual(["S_b", "S_a"])
  })

  it("stable + deterministic: equal-status shots break the tie NUMERICALLY (2 before 10), not lexicographically", () => {
    const model = deriveShotReportModel(
      data({
        shots: [
          shot({ id: "S_a", shotNumber: "10", status: "todo" }),
          shot({ id: "S_b", shotNumber: "02", status: "todo" }),
        ],
      }),
      { groupBy: "none", excludedShotIds: [], sortBy: "status", sortDir: "asc" },
    )
    expect(model.groups[0]?.key).toBe("all")
    expect(model.groups[0]?.shots.map((s) => s.id)).toEqual(["S_b", "S_a"])
  })

  it("desc flips the primary key only — the shot-number tie-break stays ascending", () => {
    const a = deriveShotReportModel(
      data({
        shots: [
          shot({ id: "S1", shotNumber: "01", status: "todo" }),
          shot({ id: "S2", shotNumber: "02", status: "todo" }),
          shot({ id: "S3", shotNumber: "03", status: "todo" }),
        ],
      }),
      { groupBy: "none", excludedShotIds: [], sortBy: "shot-number", sortDir: "desc" },
    )
    expect(a.groups[0]?.shots.map((s) => s.id)).toEqual(["S3", "S2", "S1"])

    const b = deriveShotReportModel(
      data({
        shots: [
          shot({ id: "S_x", shotNumber: "10", status: "todo" }),
          shot({ id: "S_y", shotNumber: "02", status: "todo" }),
        ],
      }),
      { groupBy: "none", excludedShotIds: [], sortBy: "status", sortDir: "desc" },
    )
    // status desc reorders buckets, but the two equal-status shots keep ASC shot-number tie-break
    expect(b.groups[0]?.shots.map((s) => s.id)).toEqual(["S_y", "S_x"])
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

describe("titleCaseSlug", () => {
  it("title-cases a hyphenated client slug", () => {
    expect(titleCaseSlug("unbound-merino")).toBe("Unbound Merino")
  })
  it("treats underscores as word separators", () => {
    expect(titleCaseSlug("acme_widgets_co")).toBe("Acme Widgets Co")
  })
  it("handles mixed hyphen + underscore separators", () => {
    expect(titleCaseSlug("big-brand_inc")).toBe("Big Brand Inc")
  })
  it("normalizes an already-spaced name", () => {
    expect(titleCaseSlug("Acme Co")).toBe("Acme Co")
  })
  it("lowercases the tail of each word (simple title-case)", () => {
    expect(titleCaseSlug("ACME-LLC")).toBe("Acme Llc")
  })
  it("collapses runs of separators and trims edges", () => {
    expect(titleCaseSlug("--foo__bar--")).toBe("Foo Bar")
  })
  it("returns empty string for empty / nullish input", () => {
    expect(titleCaseSlug("")).toBe("")
    expect(titleCaseSlug(undefined)).toBe("")
    expect(titleCaseSlug(null)).toBe("")
  })
  it("capitalizes a single-char slug", () => {
    expect(titleCaseSlug("c")).toBe("C")
  })
})

describe("mostOutstandingStatus (O2 status-grouping reduction)", () => {
  it("returns the least-done (lowest STATUS_GROUP_ORDER) status among appearances", () => {
    expect(mostOutstandingStatus(["complete", "todo"])).toBe("todo")
    expect(mostOutstandingStatus(["complete", "on_hold"])).toBe("on_hold")
    expect(mostOutstandingStatus(["on_hold", "in_progress"])).toBe("in_progress")
    expect(mostOutstandingStatus(["complete", "complete"])).toBe("complete")
  })
  it("is order-insensitive", () => {
    expect(mostOutstandingStatus(["todo", "complete"])).toBe("todo")
    expect(mostOutstandingStatus(["complete", "todo"])).toBe("todo")
  })
  it("returns null for an item with no appearances", () => {
    expect(mostOutstandingStatus([])).toBeNull()
  })
})

describe("model.order — the APPLIED order (so a recipe caption can never claim an order the shots don't have)", () => {
  it("absent sortBy (flag-off / legacy) → order = {shot-number, asc}, matching the verbatim legacy sort", () => {
    const model = deriveShotReportModel(data({}), { groupBy: "gender", excludedShotIds: [] })
    expect(model.order).toEqual({ sortBy: "shot-number", sortDir: "asc", groupBy: "gender", filterSummary: null })
  })
  it("a chosen sortBy/sortDir flows into model.order verbatim", () => {
    const model = deriveShotReportModel(data({}), { groupBy: "none", excludedShotIds: [], sortBy: "talent", sortDir: "desc" })
    expect(model.order).toEqual({ sortBy: "talent", sortDir: "desc", groupBy: "none", filterSummary: null })
  })
  it("neutralizing (flag off) a persisted talent/desc config resets order to legacy — the shots are re-sorted, and so is the caption", () => {
    const raw: ReportConfig = { groupBy: "status", excludedShotIds: [], sortBy: "talent", sortDir: "desc" }
    const model = deriveShotReportModel(data({}), neutralizeReportConfigForFlag(raw, false))
    expect(model.order).toEqual({ sortBy: "shot-number", sortDir: "asc", groupBy: "gender", filterSummary: null })
  })
  it("a chosen groupBy:'scene' flows into model.order verbatim", () => {
    const model = deriveShotReportModel(data({}), { groupBy: "scene", excludedShotIds: [] })
    expect(model.order.groupBy).toBe("scene")
  })
  it("active filters flow into model.order.filterSummary", () => {
    const model = deriveShotReportModel(
      data({ shots: [shot({ id: "s1", shotNumber: "01", status: "todo" })] }),
      { groupBy: "gender", excludedShotIds: [], filters: [{ id: "status", field: "status", operator: "notIn", value: ["on_hold"] }] },
    )
    expect(model.order.filterSummary).toBe("filtered: status excluded (1)")
  })
})

describe("formatOrderNote — honest, config-driven recipe caption (replaces the hardcoded 'sorted by shot no.' lie)", () => {
  it("default order reads 'Sorted by shot #'", () => {
    expect(formatOrderNote({ sortBy: "shot-number", sortDir: "asc" })).toBe("Sorted by shot #")
  })
  it("a talent/descending order is described honestly and never says 'shot'", () => {
    const note = formatOrderNote({ sortBy: "talent", sortDir: "desc" })
    expect(note).toBe("Sorted by talent, descending")
    expect(note).not.toMatch(/shot/i)
  })
  it("status ascending reads 'Sorted by status'", () => {
    expect(formatOrderNote({ sortBy: "status", sortDir: "asc" })).toBe("Sorted by status")
  })
  it("falls back to shot # (never throws) on an out-of-union persisted sortBy", () => {
    // exportReports is schemaless; a corrupted/legacy blob can carry an invalid
    // sortBy. shotPrimaryFor sorts such shots by shot-number, so the caption
    // honestly reads "shot #" rather than crashing on an undefined label.
    const note = formatOrderNote({ sortBy: "retired-field" as ReportSortField, sortDir: "asc" })
    expect(note).toBe("Sorted by shot #")
  })
  it("sortBy:'custom' reads 'Custom order' — never 'Sorted by custom order'", () => {
    expect(formatOrderNote({ sortBy: "custom", sortDir: "asc" })).toBe("Custom order")
  })
  it("sortBy:'custom' descending reads 'Custom order, descending'", () => {
    expect(formatOrderNote({ sortBy: "custom", sortDir: "desc" })).toBe("Custom order, descending")
  })
  it("groupBy:'scene' appends 'grouped by Set' — mutation: omitting the groupBy field reddens", () => {
    const note = formatOrderNote({ sortBy: "shot-number", sortDir: "asc", groupBy: "scene" })
    expect(note).toBe("Sorted by shot # · grouped by Set")
  })
  it("groupBy other than 'scene' never mentions Set", () => {
    expect(formatOrderNote({ sortBy: "shot-number", sortDir: "asc", groupBy: "status" })).toBe("Sorted by shot #")
  })
  it("a filterSummary appends its clause verbatim — mutation: dropping the append reddens", () => {
    const note = formatOrderNote({
      sortBy: "shot-number",
      sortDir: "asc",
      filterSummary: "filtered: status excluded (2), tags included (3)",
    })
    expect(note).toBe("Sorted by shot # · filtered: status excluded (2), tags included (3)")
  })
  it("a null/absent filterSummary appends nothing", () => {
    expect(formatOrderNote({ sortBy: "shot-number", sortDir: "asc", filterSummary: null })).toBe(
      "Sorted by shot #",
    )
  })
  it("custom order + Set grouping + active filters all compose in one caption", () => {
    const note = formatOrderNote({
      sortBy: "custom",
      sortDir: "asc",
      groupBy: "scene",
      filterSummary: "filtered: tags included (1)",
    })
    expect(note).toBe("Custom order · grouped by Set · filtered: tags included (1)")
  })
})

describe("formatFilterSummary — the 'filtered: ...' clause formatOrderNote appends", () => {
  it("returns null when no filters are active", () => {
    expect(formatFilterSummary([])).toBeNull()
  })
  it("skips a field whose condition carries zero selected values (chosen mode, no values yet)", () => {
    const filters: ReportFilterCondition[] = [{ id: "status", field: "status", operator: "in", value: [] }]
    expect(formatFilterSummary(filters)).toBeNull()
  })
  it("counts each active field's selected-value count, status before tags regardless of array order", () => {
    const filters: ReportFilterCondition[] = [
      { id: "tag", field: "tag", operator: "in", value: ["t1", "t2", "t3"] },
      { id: "status", field: "status", operator: "notIn", value: ["on_hold", "todo"] },
    ]
    expect(formatFilterSummary(filters)).toBe("filtered: status excluded (2), tags included (3)")
  })
  it("a single active field omits the other from the summary", () => {
    const filters: ReportFilterCondition[] = [{ id: "tag", field: "tag", operator: "in", value: ["t1"] }]
    expect(formatFilterSummary(filters)).toBe("filtered: tags included (1)")
  })
  it("names the OPERATOR, not just the count — 'include these 2' and 'exclude these 2' must read differently", () => {
    // Same field, same value count, opposite arrangement of the actual shots.
    const included: ReportFilterCondition[] = [{ id: "status", field: "status", operator: "in", value: ["complete", "todo"] }]
    const excluded: ReportFilterCondition[] = [{ id: "status", field: "status", operator: "notIn", value: ["complete", "todo"] }]
    expect(formatFilterSummary(included)).toBe("filtered: status included (2)")
    expect(formatFilterSummary(excluded)).toBe("filtered: status excluded (2)")
    expect(formatFilterSummary(included)).not.toBe(formatFilterSummary(excluded))
  })
})

describe("resolveReportFilters — hiddenStatuses -> filters migration precedence", () => {
  it("absent filters + empty hiddenStatuses -> no filters", () => {
    expect(resolveReportFilters({ hiddenStatuses: [] })).toEqual([])
    expect(resolveReportFilters({})).toEqual([])
  })
  it("absent filters + non-empty hiddenStatuses -> a single synthetic status/notIn filter", () => {
    expect(resolveReportFilters({ hiddenStatuses: ["on_hold", "todo"] })).toEqual([
      { id: LEGACY_HIDDEN_STATUSES_FILTER_ID, field: "status", operator: "notIn", value: ["on_hold", "todo"] },
    ])
  })
  it("filters present (even []) is authoritative — hiddenStatuses is ignored outright, never merged", () => {
    // toEqual (content), not toBe (reference): resolveReportFilters now
    // always routes `filters` through dedupeFiltersByField (see that fn's
    // docstring), which allocates a fresh array even when there was nothing
    // to dedupe. The load-bearing claim is unchanged — hiddenStatuses never
    // appears — only the object identity, which was never a documented
    // contract, changed.
    const filters: ReportFilterCondition[] = [{ id: "tag", field: "tag", operator: "in", value: ["t1"] }]
    expect(resolveReportFilters({ filters, hiddenStatuses: ["on_hold"] })).toEqual(filters)
    expect(resolveReportFilters({ filters: [], hiddenStatuses: ["on_hold"] })).toEqual([])
  })
})

describe("deriveShotReportModel — unified filters (status + tag), reusing filterEngine.ts verbatim", () => {
  const filterFixture = () =>
    data({
      shots: [
        shot({ id: "s1", shotNumber: "01", status: "todo", tags: [{ id: "hero", label: "Hero", color: "b", category: "other" }] }),
        shot({ id: "s2", shotNumber: "02", status: "complete", tags: [{ id: "hero", label: "Hero", color: "b", category: "other" }] }),
        shot({ id: "s3", shotNumber: "03", status: "complete", tags: [{ id: "flat", label: "Flat", color: "b", category: "other" }] }),
        shot({ id: "s4", shotNumber: "04", status: "on_hold", tags: [] }),
      ],
    })

  it("status field, operator 'in' — include mode keeps only matching statuses", () => {
    const model = deriveShotReportModel(filterFixture(), {
      groupBy: "none",
      excludedShotIds: [],
      filters: [{ id: "status", field: "status", operator: "in", value: ["complete"] }],
    })
    expect(model.groups[0]?.shots.map((s) => s.id)).toEqual(["s2", "s3"])
  })

  it("status field, operator 'notIn' — exclude mode drops matching statuses", () => {
    const model = deriveShotReportModel(filterFixture(), {
      groupBy: "none",
      excludedShotIds: [],
      filters: [{ id: "status", field: "status", operator: "notIn", value: ["on_hold"] }],
    })
    expect(model.groups[0]?.shots.map((s) => s.id)).toEqual(["s1", "s2", "s3"])
  })

  it("tag field is OR-within-field: a shot matches if it carries ANY of the selected tags", () => {
    const model = deriveShotReportModel(filterFixture(), {
      groupBy: "none",
      excludedShotIds: [],
      filters: [{ id: "tag", field: "tag", operator: "in", value: ["hero", "flat"] }],
    })
    expect(model.groups[0]?.shots.map((s) => s.id)).toEqual(["s1", "s2", "s3"])
  })

  it("status + tag together is AND-across-fields — both conditions must pass", () => {
    const model = deriveShotReportModel(filterFixture(), {
      groupBy: "none",
      excludedShotIds: [],
      filters: [
        { id: "status", field: "status", operator: "in", value: ["complete"] },
        { id: "tag", field: "tag", operator: "in", value: ["hero"] },
      ],
    })
    // s2 is complete AND hero; s3 is complete but flat (fails tag); s1 is hero but todo (fails status).
    expect(model.groups[0]?.shots.map((s) => s.id)).toEqual(["s2"])
  })

  it("a filter that matches nothing empties the report (hasAnyIncludedShot false path)", () => {
    const model = deriveShotReportModel(filterFixture(), {
      groupBy: "none",
      excludedShotIds: [],
      filters: [{ id: "tag", field: "tag", operator: "in", value: ["no-such-tag"] }],
    })
    expect(model.groups[0]?.shots).toEqual([])
    expect(model.project.shotCount).toBe(0)
  })

  it("legacy hiddenStatuses (no filters field) still filters — resolveReportFilters migrates it at derive time", () => {
    const model = deriveShotReportModel(filterFixture(), {
      groupBy: "none",
      excludedShotIds: [],
      hiddenStatuses: ["on_hold"],
    })
    expect(model.groups[0]?.shots.map((s) => s.id)).toEqual(["s1", "s2", "s3"])
  })

  it("filters present (even a tag-only filter) makes hiddenStatuses inert — no double-apply", () => {
    const model = deriveShotReportModel(filterFixture(), {
      groupBy: "none",
      excludedShotIds: [],
      hiddenStatuses: ["complete"], // would drop s2/s3 if it were still consulted
      filters: [{ id: "tag", field: "tag", operator: "in", value: ["hero", "flat"] }],
    })
    expect(model.groups[0]?.shots.map((s) => s.id)).toEqual(["s1", "s2", "s3"])
  })
})

describe("deriveShotReportModel — sortBy:'custom' respects Shot.sortOrder", () => {
  it("exports in sortOrder, NOT shot-number order — a fixture where they deliberately disagree", () => {
    // shot-number order would read A,B,C; sortOrder deliberately reverses it.
    // If the "custom" case ever falls through to the shot-number default (the
    // mutation this guards against), this assertion flips to ["A","B","C"].
    const d = data({
      shots: [
        shot({ id: "A", shotNumber: "01", sortOrder: 300 }),
        shot({ id: "B", shotNumber: "02", sortOrder: 200 }),
        shot({ id: "C", shotNumber: "03", sortOrder: 100 }),
      ],
    })
    const model = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], sortBy: "custom", sortDir: "asc" })
    expect(model.groups[0]?.shots.map((s) => s.id)).toEqual(["C", "B", "A"])
  })

  it("descending flips the custom order too", () => {
    const d = data({
      shots: [
        shot({ id: "A", shotNumber: "01", sortOrder: 100 }),
        shot({ id: "B", shotNumber: "02", sortOrder: 200 }),
      ],
    })
    const model = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], sortBy: "custom", sortDir: "desc" })
    expect(model.groups[0]?.shots.map((s) => s.id)).toEqual(["B", "A"])
  })

  it("a REAL sortOrder:0 (the shot dragged to the top) sorts FIRST, not last — persistShotOrder's shape", () => {
    // Exactly what persistShotOrder's full-reindex writes after a drag
    // (reorderShots.ts:55, called with no range from every drag-and-drop —
    // DraggableShotList.tsx:89): the dragged-to-top shot gets sortOrder 0,
    // everything else keeps its 1-based index. useShots.ts (the shot list
    // itself) sorts this shot FIRST — the report must agree.
    const d = data({
      shots: [
        shot({ id: "top", shotNumber: "09", sortOrder: 0 }),
        shot({ id: "second", shotNumber: "01", sortOrder: 1 }),
        shot({ id: "third", shotNumber: "02", sortOrder: 2 }),
      ],
    })
    const model = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], sortBy: "custom", sortDir: "asc" })
    expect(model.groups[0]?.shots.map((s) => s.id)).toEqual(["top", "second", "third"])
  })

  it("descending still keeps the real sortOrder:0 shot in its true rank (last when descending)", () => {
    const d = data({
      shots: [
        shot({ id: "top", shotNumber: "09", sortOrder: 0 }),
        shot({ id: "second", shotNumber: "01", sortOrder: 1 }),
        shot({ id: "third", shotNumber: "02", sortOrder: 2 }),
      ],
    })
    const model = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], sortBy: "custom", sortDir: "desc" })
    expect(model.groups[0]?.shots.map((s) => s.id)).toEqual(["third", "second", "top"])
  })

  it("nobody has EVER reordered this project (every shot is 0/default) — falls back to shot-number order", () => {
    // No shot carries a non-zero sortOrder anywhere in the project, matching
    // useShots.ts's own "no real sortOrder" branch (useShots.ts:33) — the
    // whole set has never been through persistShotOrder/renumberShots, so
    // there's no real drag order to honour yet.
    const d = data({
      shots: [
        shot({ id: "hi", shotNumber: "10", sortOrder: 0 }),
        shot({ id: "lo", shotNumber: "02", sortOrder: 0 }),
      ],
    })
    const model = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], sortBy: "custom", sortDir: "asc" })
    expect(model.groups[0]?.shots.map((s) => s.id)).toEqual(["lo", "hi"])
  })

  it("a mix of real 0 and real non-zero sorts purely numerically — 0 is rank #1, not a sentinel", () => {
    // Once hasCustomOrder is true, EVERY sortOrder (including 0) is a plain
    // numeric rank with no special-cased value — this is what actually
    // distinguishes the fix from the old "0 means missing" comparator.
    const d = data({
      shots: [
        shot({ id: "middle", shotNumber: "05", sortOrder: 5 }),
        shot({ id: "first", shotNumber: "01", sortOrder: 0 }),
        shot({ id: "last", shotNumber: "09", sortOrder: 9 }),
      ],
    })
    const model = deriveShotReportModel(d, { groupBy: "none", excludedShotIds: [], sortBy: "custom", sortDir: "asc" })
    expect(model.groups[0]?.shots.map((s) => s.id)).toEqual(["first", "middle", "last"])
  })
})

describe("deriveShotReportModel — groupBy:'scene' (\"Set\")", () => {
  const sceneFixture = () =>
    data({
      shots: [
        shot({ id: "inLaneB", shotNumber: "01", laneId: "laneB" }),
        shot({ id: "inLaneA", shotNumber: "02", laneId: "laneA" }),
        shot({ id: "noLane", shotNumber: "03" }),
        shot({ id: "orphanLane", shotNumber: "04", laneId: "deleted-lane" }),
      ],
      lanes: [
        lane({ id: "laneA", name: "Kitchen", sceneNumber: 1, sortOrder: 0 }),
        lane({ id: "laneB", name: "Bedroom", sceneNumber: 2, sortOrder: 1 }),
      ],
    })

  it("groups by laneId, ordered by Lane.sceneNumber then Lane.sortOrder", () => {
    const model = deriveShotReportModel(sceneFixture(), { groupBy: "scene", excludedShotIds: [] })
    const named = model.groups.filter((g) => g.key !== "__no_set__")
    expect(named.map((g) => g.label)).toEqual(["Kitchen", "Bedroom"])
    expect(named[0]?.shots.map((s) => s.id)).toEqual(["inLaneA"])
    expect(named[1]?.shots.map((s) => s.id)).toEqual(["inLaneB"])
  })

  it("a missing laneId AND an orphaned laneId (lane doc no longer exists) both land in 'No set', ordered LAST", () => {
    const model = deriveShotReportModel(sceneFixture(), { groupBy: "scene", excludedShotIds: [] })
    const last = model.groups[model.groups.length - 1]
    expect(last?.label).toBe("No set")
    expect(last?.shots.map((s) => s.id).sort()).toEqual(["noLane", "orphanLane"])
    // "No set" is unconditionally last regardless of any sceneNumber comparison.
    expect(model.groups[model.groups.length - 1]?.key).toBe("__no_set__")
  })

  it("an orphaned laneId never crashes the derive (guards a deleted Set out from under an open report)", () => {
    expect(() => deriveShotReportModel(sceneFixture(), { groupBy: "scene", excludedShotIds: [] })).not.toThrow()
  })

  it("'No set' stays strictly LAST even against a real Set with no sceneNumber — proves the explicit last-place rule, not merely the Number.POSITIVE_INFINITY fallback, is load-bearing", () => {
    // A real lane with NO sceneNumber (undefined) gets the SAME Infinity
    // fallback "No set" gets, and the SAME sortOrder (0) — so only the
    // explicit "NO_SET_GROUP_KEY sorts last" branch (not the Infinity
    // fallback alone) stops "No set" (alphabetically "N") from sorting
    // ahead of "Zebra Set" (alphabetically "Z") on the tie-break. Deleting
    // the explicit branch reddens this while leaving the simpler
    // missing-laneId-only scene test above green.
    const d = data({
      shots: [
        shot({ id: "inZebra", shotNumber: "01", laneId: "zebra" }),
        shot({ id: "noLane", shotNumber: "02" }),
      ],
      lanes: [lane({ id: "zebra", name: "Zebra Set", sortOrder: 0 })],
    })
    const model = deriveShotReportModel(d, { groupBy: "scene", excludedShotIds: [] })
    expect(model.groups.map((g) => g.label)).toEqual(["Zebra Set", "No set"])
  })

  it("orders by Lane.sceneNumber even when it DISAGREES with Lane.sortOrder — proves sceneNumber is the primary key, not sortOrder", () => {
    // sceneFixture() above always has sceneNumber and sortOrder increasing
    // together, so a mutation that swapped the primary key for sortOrder
    // could ship undetected. Here they deliberately disagree: laneHigh has
    // the higher sceneNumber but the LOWER sortOrder.
    const d = data({
      shots: [
        shot({ id: "inHigh", shotNumber: "01", laneId: "laneHigh" }),
        shot({ id: "inLow", shotNumber: "02", laneId: "laneLow" }),
      ],
      lanes: [
        lane({ id: "laneHigh", name: "Scene Two", sceneNumber: 2, sortOrder: 0 }),
        lane({ id: "laneLow", name: "Scene One", sceneNumber: 1, sortOrder: 1 }),
      ],
    })
    const model = deriveShotReportModel(d, { groupBy: "scene", excludedShotIds: [] })
    // sceneNumber 1 ("Scene One") must lead despite its HIGHER sortOrder.
    expect(model.groups.map((g) => g.label)).toEqual(["Scene One", "Scene Two"])
  })

  it("a real Lane with a blank/whitespace name gets 'Unnamed Set', sorted by its real sceneNumber — NOT mislabeled 'No set'", () => {
    // Regression: `lane?.name || NO_SET_GROUP_LABEL` used to fall through on
    // an empty string (mapLane defaults a nameless doc to ""), mislabeling a
    // REAL Set "No set" while still sorting it by sceneNumber — producing
    // two differently-positioned groups that both read "No set" on screen.
    const d = data({
      shots: [
        shot({ id: "inBlank", shotNumber: "01", laneId: "blank" }),
        shot({ id: "inNamed", shotNumber: "02", laneId: "named" }),
        shot({ id: "trulyNoSet", shotNumber: "03" }),
      ],
      lanes: [
        lane({ id: "blank", name: "", sceneNumber: 1, sortOrder: 0 }),
        lane({ id: "named", name: "Kitchen", sceneNumber: 2, sortOrder: 1 }),
      ],
    })
    const model = deriveShotReportModel(d, { groupBy: "scene", excludedShotIds: [] })
    expect(model.groups.map((g) => g.label)).toEqual(["Unnamed Set", "Kitchen", "No set"])
    expect(model.groups.map((g) => g.key)).toEqual(["blank", "named", "__no_set__"])
    expect(model.groups[0]?.shots.map((s) => s.id)).toEqual(["inBlank"])
  })

  it("lanes not yet loaded (empty laneById) does NOT collapse real Set membership into 'No set'", () => {
    // Guard mirrors shotListFilters.ts's identical "only orphan-check once
    // lanes have loaded" rule. Without it, a lanes read still in flight (or
    // one that silently failed — useFirestoreCollection resolves
    // loading:false/data:[] on a snapshot error) would misclassify every
    // shot with a real laneId as "No set".
    const d = data({
      shots: [shot({ id: "s1", shotNumber: "01", laneId: "laneA" })],
      lanes: [], // lanes not loaded / failed — laneById is empty
    })
    const model = deriveShotReportModel(d, { groupBy: "scene", excludedShotIds: [] })
    expect(model.groups.map((g) => g.key)).toEqual(["laneA"])
    expect(model.groups[0]?.key).not.toBe("__no_set__")
  })
})

describe("DEFAULT_REPORT_CONFIG is a hard behavioral floor — a user who touches nothing gets byte-identical output", () => {
  it("produces the same shot order/grouping and the exact pre-filters/custom/scene caption text", () => {
    const d = data({
      productFamilies: FAMILIES,
      shots: [
        shot({ id: "w1", shotNumber: "01", looks: [{ id: "l", order: 0, products: [{ familyId: "fW" }] }] }),
        shot({ id: "m1", shotNumber: "02", looks: [{ id: "l", order: 0, products: [{ familyId: "fM" }] }] }),
      ],
    })
    const model = deriveShotReportModel(d, DEFAULT_REPORT_CONFIG)
    expect(model.groups.map((g) => g.key)).toEqual(["W", "M"])
    expect(model.groups.flatMap((g) => g.shots).map((s) => s.id)).toEqual(["w1", "m1"])
    // The caption text a screen/PDF actually renders is unchanged: no "grouped
    // by Set", no "filtered: ..." clause leaks in from the new optional fields
    // for a config that never touches filters/custom/scene.
    expect(formatOrderNote(model.order)).toBe("Sorted by shot #")
    expect(model.order.filterSummary).toBeNull()
  })
})
