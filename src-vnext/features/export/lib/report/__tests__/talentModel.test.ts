import { describe, it, expect } from "vitest"
import { collectTalentImageCandidates, deriveTalentModel } from "../talentModel"
import { DEFAULT_HEADSHOT_CROP, DEFAULT_TALENT_CONFIG, neutralizeTalentConfigForFlag, type TalentConfig } from "../talentTypes"
import type { ExportData } from "../../../hooks/useExportData"
import type { Shot, TalentRecord } from "@/shared/types"

// Minimal factories — cast past required audit fields the model never reads.
function tal(over: Partial<TalentRecord> & { id: string }): TalentRecord {
  return { name: over.id, ...over } as unknown as TalentRecord
}
function shot(s: Partial<Shot> & { id: string }): Shot {
  return {
    title: "Shot",
    status: "complete",
    talent: [],
    talentIds: [],
    products: [],
    looks: [],
    sortOrder: 0,
    ...s,
  } as unknown as Shot
}
function data(over: Partial<ExportData>): ExportData {
  return {
    project: { id: "p1", name: "Q2-26 No. 3", clientId: "unbound-merino" } as ExportData["project"],
    shots: [],
    productFamilies: [],
    pulls: [],
    crew: [],
    talent: [],
    loading: false,
    ...over,
  }
}
function cfg(over: Partial<TalentConfig> = {}): TalentConfig {
  return { ...DEFAULT_TALENT_CONFIG, ...over }
}

function flat(model: ReturnType<typeof deriveTalentModel>) {
  return model.groups.flatMap((g) => g.items)
}
function find(model: ReturnType<typeof deriveTalentModel>, id: string) {
  return flat(model).find((i) => i.id === id)
}

const ROSTER = [
  tal({ id: "tA", name: "Ava Stone", gender: "female", agency: "Elite" }),
  tal({ id: "tB", name: "Ben Cole", gender: "male", agency: "Next" }),
]

describe("deriveTalentModel — scope", () => {
  it("in-shots: only talent slotted into non-deleted shots (not the flat library)", () => {
    const model = deriveTalentModel(
      data({
        talent: ROSTER,
        shots: [
          shot({ id: "s1", shotNumber: "01", talentIds: ["tA"] }),
          shot({ id: "gone", shotNumber: "02", deleted: true, talentIds: ["tB"] }),
        ],
      }),
      cfg(),
    )
    const ids = flat(model).map((i) => i.id)
    expect(ids).toContain("tA")
    expect(ids).not.toContain("tB") // only in a DELETED shot
    expect(model.project.talentCount).toBe(1)
  })

  it("in-shots: drops a soft-deleted talent even when still slotted into a live shot", () => {
    const model = deriveTalentModel(
      data({
        talent: [...ROSTER, tal({ id: "tDel", name: "Removed", deleted: true })],
        shots: [shot({ id: "s1", shotNumber: "01", talentIds: ["tA", "tDel"] })],
      }),
      cfg(),
    )
    const ids = flat(model).map((i) => i.id)
    expect(ids).toContain("tA")
    expect(ids).not.toContain("tDel")
  })

  it("project-attached: every non-deleted talent whose projectIds includes the project", () => {
    const model = deriveTalentModel(
      data({
        project: { id: "p1", name: "P", clientId: "c" } as ExportData["project"],
        talent: [
          tal({ id: "tA", name: "Ava", projectIds: ["p1"] }),
          tal({ id: "tB", name: "Ben", projectIds: ["other"] }),
          tal({ id: "tC", name: "Cy", projectIds: ["p1"], deleted: true }),
        ],
        // No shots — proves project-attached does NOT depend on shot membership.
        shots: [],
      }),
      cfg({ talentScope: "project-attached" }),
    )
    const ids = flat(model).map((i) => i.id)
    expect(ids).toEqual(["tA"])
    expect(ids).not.toContain("tB") // attached to a different project
    expect(ids).not.toContain("tC") // soft-deleted, dropped in this scope too
  })
})

describe("deriveTalentModel — appearances", () => {
  it("one entry per shot the talent is in, sorted by shot number, with each shot's status", () => {
    const model = deriveTalentModel(
      data({
        talent: ROSTER,
        shots: [
          shot({ id: "s10", shotNumber: "10", status: "todo", talentIds: ["tA"], looks: [{ id: "l", order: 0, products: [] }] }),
          shot({ id: "s2", shotNumber: "2", status: "complete", talentIds: ["tA"], looks: [{ id: "l", order: 0, products: [] }] }),
        ],
      }),
      cfg(),
    )
    const appears = find(model, "tA")?.appears ?? []
    expect(appears.map((a) => `${a.number}:${a.status}`)).toEqual(["2:complete", "10:todo"])
  })

  it("a talent in two looks of one shot yields ONE appearance carrying both look labels", () => {
    const model = deriveTalentModel(
      data({
        talent: ROSTER,
        shots: [
          shot({
            id: "s1", shotNumber: "01", talentIds: ["tA"],
            looks: [
              { id: "l0", order: 0, products: [] },
              { id: "l1", order: 1, label: "Alt A", products: [] },
            ],
          }),
        ],
      }),
      cfg(),
    )
    const appears = find(model, "tA")?.appears ?? []
    expect(appears.length).toBe(1) // one shot, not two looks
    expect(appears[0]?.looks).toEqual(["Primary", "Alt A"]) // all the shot's looks, ordered
    expect(appears[0]?.title).toBe("Shot")
  })

  it("dedupes repeated look labels within a shot", () => {
    const model = deriveTalentModel(
      data({
        talent: ROSTER,
        shots: [
          shot({
            id: "s1", shotNumber: "01", talentIds: ["tA"],
            looks: [
              { id: "l0", order: 0, label: "Primary", products: [] },
              { id: "l1", order: 1, label: "Primary", products: [] },
            ],
          }),
        ],
      }),
      cfg(),
    )
    expect(find(model, "tA")?.appears[0]?.looks).toEqual(["Primary"])
  })
})

describe("deriveTalentModel — R3 status filter", () => {
  it("drops a talent whose ONLY appearance is a hidden status", () => {
    const model = deriveTalentModel(
      data({
        talent: ROSTER,
        shots: [
          shot({ id: "s1", shotNumber: "01", status: "todo", talentIds: ["tA"] }),
          shot({ id: "s2", shotNumber: "02", status: "complete", talentIds: ["tB"] }),
        ],
      }),
      cfg({ groupBy: "none", hiddenStatuses: ["todo"] }),
    )
    const ids = flat(model).map((i) => i.id)
    expect(ids).toEqual(["tB"]) // tA only in a todo shot
    expect(model.project.talentCount).toBe(1)
  })

  it("keeps a talent who also appears in a visible-status shot (drop-only; full appears retained)", () => {
    const model = deriveTalentModel(
      data({
        talent: ROSTER,
        shots: [
          shot({ id: "s2", shotNumber: "2", status: "complete", talentIds: ["tA"] }),
          shot({ id: "s10", shotNumber: "10", status: "todo", talentIds: ["tA"] }),
        ],
      }),
      cfg({ groupBy: "none", hiddenStatuses: ["todo"] }),
    )
    const e = find(model, "tA")
    expect(e).toBeDefined()
    // Phase-A drop-only rule: survivors keep EVERY appearance, incl. the hidden-status one.
    expect(e?.appears.map((a) => `${a.number}:${a.status}`)).toEqual(["2:complete", "10:todo"])
  })

  it("an omitted hiddenStatuses is byte-identical to [] — nothing dropped", () => {
    const d = data({
      talent: ROSTER,
      shots: [shot({ id: "s1", shotNumber: "01", status: "todo", talentIds: ["tA"] })],
    })
    expect(flat(deriveTalentModel(d, cfg({ groupBy: "none" }))).map((i) => i.id)).toEqual(["tA"])
    expect(flat(deriveTalentModel(d, cfg({ groupBy: "none", hiddenStatuses: [] }))).map((i) => i.id)).toEqual(["tA"])
  })

  it("does NOT drop a project-attached never-shot talent under a status filter (appears.length === 0 guard)", () => {
    const model = deriveTalentModel(
      data({
        project: { id: "p1", name: "P", clientId: "c" } as ExportData["project"],
        talent: [
          tal({ id: "tA", name: "Ava", projectIds: ["p1"] }),
          tal({ id: "tB", name: "Ben", projectIds: ["p1"] }),
        ],
        shots: [shot({ id: "s1", shotNumber: "01", status: "on_hold", talentIds: ["tB"] })],
      }),
      cfg({ talentScope: "project-attached", groupBy: "none", hiddenStatuses: ["on_hold"] }),
    )
    const ids = flat(model).map((i) => i.id)
    expect(ids).toContain("tA") // never in a shot -> survives the status filter
    expect(ids).not.toContain("tB") // appeared only in an on_hold shot -> dropped
  })
})

describe("deriveTalentModel — entry field resolution", () => {
  it("name via buildDisplayName, gender label, agency/contact; blank gender -> null label", () => {
    const model = deriveTalentModel(
      data({
        talent: [
          tal({
            id: "tA", name: "", firstName: "Ada", lastName: "Lin",
            gender: "women", agency: "  Elite  ", email: " ada@x.co ", phone: "555", url: "ada.co",
          }),
          tal({ id: "tB", name: "Blank", gender: "" }),
        ],
        shots: [shot({ id: "s1", shotNumber: "01", talentIds: ["tA", "tB"] })],
      }),
      cfg({ groupBy: "none" }),
    )
    expect(find(model, "tA")).toMatchObject({
      name: "Ada Lin", // composed from first+last when name is blank
      genderLabel: "Female",
      agency: "Elite", // trimmed
      email: "ada@x.co",
      phone: "555",
      web: "ada.co",
    })
    // blank fields normalize to null, not ""
    expect(find(model, "tB")).toMatchObject({ genderLabel: null, agency: null, email: null, phone: null, web: null })
  })

  it("headshot candidate follows headshotUrl -> imageUrl -> headshotPath order", () => {
    const model = deriveTalentModel(
      data({
        talent: [
          tal({ id: "tU", name: "U", headshotUrl: "url.jpg", imageUrl: "img.jpg", headshotPath: "path.jpg" }),
          tal({ id: "tI", name: "I", imageUrl: "img.jpg", headshotPath: "path.jpg" }),
          tal({ id: "tP", name: "P", headshotPath: "path.jpg" }),
          tal({ id: "tN", name: "N" }),
        ],
        shots: [shot({ id: "s1", shotNumber: "01", talentIds: ["tU", "tI", "tP", "tN"] })],
      }),
      cfg({ groupBy: "none" }),
    )
    expect(find(model, "tU")?.headshot).toBe("url.jpg")
    expect(find(model, "tI")?.headshot).toBe("img.jpg")
    expect(find(model, "tP")?.headshot).toBe("path.jpg")
    expect(find(model, "tN")?.headshot).toBeNull()
  })

  it("measurements resolve as ordered, labeled fit specs for the gender", () => {
    const model = deriveTalentModel(
      data({
        talent: [tal({ id: "tA", name: "Ava", gender: "women", measurements: { waist: 25, height: 67 } })],
        shots: [shot({ id: "s1", shotNumber: "01", talentIds: ["tA"] })],
      }),
      cfg({ groupBy: "none" }),
    )
    // women preferred order puts Height before Waist; height formats as ft'in"
    expect(find(model, "tA")?.measurements).toEqual([
      { label: "Height", value: `5'7"` },
      { label: "Waist", value: `25"` },
    ])
  })

  it("flags excluded talent from config.excludedTalentIds", () => {
    const model = deriveTalentModel(
      data({
        talent: ROSTER,
        shots: [shot({ id: "s1", shotNumber: "01", talentIds: ["tA", "tB"] })],
      }),
      cfg({ groupBy: "none", excludedTalentIds: ["tB"] }),
    )
    expect(find(model, "tA")?.excluded).toBe(false)
    expect(find(model, "tB")?.excluded).toBe(true)
  })
})

describe("deriveTalentModel — grouping", () => {
  const styled = () =>
    data({
      talent: [
        tal({ id: "tF", name: "Zoe", gender: "female", agency: "Elite" }),
        tal({ id: "tM", name: "Adam", gender: "male", agency: "Next" }),
        tal({ id: "tNB", name: "Max", gender: "non-binary", agency: "Elite" }),
        tal({ id: "tBlank", name: "Casey", gender: "", agency: "" }),
      ],
      shots: [shot({ id: "s1", shotNumber: "01", talentIds: ["tF", "tM", "tNB", "tBlank"] })],
    })

  it("group-by none: one flat 'All talent' group, alpha by display name", () => {
    const model = deriveTalentModel(styled(), cfg({ groupBy: "none" }))
    expect(model.groups).toHaveLength(1)
    expect(model.groups[0]?.key).toBe("all")
    expect(model.groups[0]?.label).toBe("All talent")
    expect(model.groups[0]?.items.map((i) => i.name)).toEqual(["Adam", "Casey", "Max", "Zoe"])
  })

  it("group-by gender: lead order Female/Male/Non-binary, blank gender -> 'Unresolved' (never dropped, last)", () => {
    const model = deriveTalentModel(styled(), cfg({ groupBy: "gender" }))
    expect(model.groups.map((g) => g.label)).toEqual(["Female", "Male", "Non-binary", "Unresolved"])
    expect(model.groups.find((g) => g.label === "Unresolved")?.items.map((i) => i.id)).toEqual(["tBlank"])
    // items within a group are alpha by name
    expect(model.groups[0]?.items.map((i) => i.name)).toEqual(["Zoe"])
  })

  it("group-by agency: alpha agencies, blank agency -> 'No agency' bucket (last); counts per group", () => {
    const model = deriveTalentModel(styled(), cfg({ groupBy: "agency" }))
    expect(model.groups.map((g) => g.label)).toEqual(["Elite", "Next", "No agency"])
    const elite = model.groups.find((g) => g.label === "Elite")
    expect(elite?.count).toBe(2)
    expect(elite?.items.map((i) => i.name)).toEqual(["Max", "Zoe"]) // alpha within group
    expect(model.groups.find((g) => g.label === "No agency")?.items.map((i) => i.id)).toEqual(["tBlank"])
  })
})

describe("deriveTalentModel — R5 order-by (Phase B)", () => {
  const styled = () =>
    data({
      talent: [
        tal({ id: "T1", name: "Xander", agency: "Elite" }),
        tal({ id: "T2", name: "Amy", agency: "Next" }),
        tal({ id: "T3", name: "Bea", agency: "Elite" }),
      ],
      shots: [shot({ id: "s1", shotNumber: "01", talentIds: ["T1", "T2", "T3"] })],
    })

  it("sortBy 'agency' asc: agencyBucketSort (Elite<Next), name tie-break within an agency", () => {
    const model = deriveTalentModel(styled(), cfg({ groupBy: "none", sortBy: "agency", sortDir: "asc" }))
    // Elite group tie-broken Bea(T3) < Xander(T1), then Next (T2)
    expect(flat(model).map((i) => i.id)).toEqual(["T3", "T1", "T2"])
  })

  it("default sortBy 'name' reproduces the legacy alpha-by-name order (Amy, Bea, Xander)", () => {
    const model = deriveTalentModel(styled(), cfg({ groupBy: "none", sortBy: "name", sortDir: "asc" }))
    expect(flat(model).map((i) => i.name)).toEqual(["Amy", "Bea", "Xander"])
    expect(flat(model).map((i) => i.id)).toEqual(["T2", "T3", "T1"])
  })

  it("an absent sortBy is byte-identical to the legacy name order", () => {
    const legacy = deriveTalentModel(styled(), { groupBy: "none", talentScope: "in-shots", excludedTalentIds: [] })
    expect(flat(legacy).map((i) => i.name)).toEqual(["Amy", "Bea", "Xander"])
  })
})

describe("deriveTalentModel — project block & image candidates", () => {
  it("dateRange + talentCount surface on the project block", () => {
    const model = deriveTalentModel(
      data({
        project: { id: "p1", name: "P", clientId: "c", shootDates: ["2026-06-04", "2026-06-02"] } as ExportData["project"],
        talent: ROSTER,
        shots: [shot({ id: "s1", shotNumber: "01", talentIds: ["tA", "tB"] })],
      }),
      cfg(),
    )
    expect(model.project.dateRange).toBe("Jun 2–4, 2026")
    expect(model.project.talentCount).toBe(2)
    expect(model.project.client).toBe("C")
  })

  it("collectTalentImageCandidates returns each unique headshot candidate once", () => {
    const model = deriveTalentModel(
      data({
        talent: [
          tal({ id: "tA", name: "A", headshotUrl: "shared.jpg" }),
          tal({ id: "tB", name: "B", headshotUrl: "shared.jpg" }),
          tal({ id: "tC", name: "C", headshotUrl: "other.jpg" }),
          tal({ id: "tD", name: "D" }), // no headshot
        ],
        shots: [shot({ id: "s1", shotNumber: "01", talentIds: ["tA", "tB", "tC", "tD"] })],
      }),
      cfg({ groupBy: "none" }),
    )
    expect([...collectTalentImageCandidates(model)].sort()).toEqual(["other.jpg", "shared.jpg"])
  })
})

describe("deriveTalentModel — group-by status (O2)", () => {
  // tA appears in a complete AND a todo shot; tB only in a complete shot.
  const mixed = () =>
    data({
      talent: ROSTER,
      shots: [
        shot({ id: "s1", shotNumber: "01", status: "complete", talentIds: ["tA"], looks: [{ id: "l", order: 0, products: [] }] }),
        shot({ id: "s2", shotNumber: "02", status: "todo", talentIds: ["tA"], looks: [{ id: "l", order: 0, products: [] }] }),
        shot({ id: "s3", shotNumber: "03", status: "complete", talentIds: ["tB"], looks: [{ id: "l", order: 0, products: [] }] }),
      ],
    })

  it("buckets each talent by their MOST-OUTSTANDING appearance; one bucket per talent, status-ordered", () => {
    const model = deriveTalentModel(mixed(), cfg({ groupBy: "status" }))
    // tA (complete+todo) → Draft; tB (complete only) → Shot. todo precedes complete.
    expect(model.groups.map((g) => g.key)).toEqual(["todo", "complete"])
    expect(model.groups.map((g) => g.label)).toEqual(["Draft", "Shot"]) // canonical labels (statusMappings.ts)
    expect(model.groups.map((g) => g.items.map((i) => i.id))).toEqual([["tA"], ["tB"]])
    expect(flat(model).map((i) => i.id).sort()).toEqual(["tA", "tB"])
  })

  it("preserves the R5 within-bucket order (order-by name, desc)", () => {
    const roster = [
      tal({ id: "t1", name: "Aaron", gender: "male", agency: "X" }),
      tal({ id: "t2", name: "Zed", gender: "male", agency: "X" }),
    ]
    const d = data({
      talent: roster,
      shots: [
        shot({ id: "s1", shotNumber: "01", status: "todo", talentIds: ["t1"], looks: [{ id: "l", order: 0, products: [] }] }),
        shot({ id: "s2", shotNumber: "02", status: "todo", talentIds: ["t2"], looks: [{ id: "l", order: 0, products: [] }] }),
      ],
    })
    const model = deriveTalentModel(d, cfg({ groupBy: "status", sortBy: "name", sortDir: "desc" }))
    expect(model.groups).toHaveLength(1)
    expect(model.groups[0]?.key).toBe("todo")
    expect(model.groups[0]?.items.map((i) => i.name)).toEqual(["Zed", "Aaron"])
  })

  it("puts project-attached talent with no appearances in a trailing 'No shots' bucket", () => {
    const d = data({
      talent: [
        tal({ id: "tA", name: "Ava Stone", gender: "female", agency: "Elite", projectIds: ["p1"] }),
        tal({ id: "tZ", name: "Zoe Never", gender: "female", agency: "Next", projectIds: ["p1"] }),
      ],
      shots: [shot({ id: "s1", shotNumber: "01", status: "todo", talentIds: ["tA"], looks: [{ id: "l", order: 0, products: [] }] })],
    })
    const model = deriveTalentModel(d, cfg({ talentScope: "project-attached", groupBy: "status" }))
    const last = model.groups[model.groups.length - 1]
    expect(model.groups[0]?.key).toBe("todo") // real-status buckets first
    expect(last?.label).toBe("No shots")
    expect(last?.items.map((i) => i.id)).toEqual(["tZ"])
  })

  it("flag-off: the real neutralizer clamps a persisted 'status' + sort back to legacy name order (byte-identical)", () => {
    const d = mixed()
    const persisted = cfg({ groupBy: "status", sortBy: "agency", sortDir: "desc", hiddenStatuses: ["todo"] })
    const neutralized = neutralizeTalentConfigForFlag(persisted, false)
    expect(deriveTalentModel(d, neutralized)).toEqual(deriveTalentModel(d, DEFAULT_TALENT_CONFIG))
    expect(neutralizeTalentConfigForFlag(persisted, true)).toBe(persisted) // flag-on = identity
  })
})

describe("deriveTalentModel — layout density (Phase C, R4)", () => {
  const withHold = () =>
    data({
      talent: ROSTER,
      shots: [shot({ id: "s1", shotNumber: "01", status: "on_hold", talentIds: ["tA"] })],
    })

  it("flag-on: config.layout folds onto the model (detail | contact-sheet)", () => {
    const d = withHold()
    expect(deriveTalentModel(d, cfg({ layout: "contact-sheet" })).layout).toBe("contact-sheet")
    expect(deriveTalentModel(d, cfg({ layout: "detail" })).layout).toBe("detail")
  })

  it("an absent layout folds onto the model as 'detail' (forward-compat default)", () => {
    const d = withHold()
    const legacy = deriveTalentModel(d, { groupBy: "none", talentScope: "in-shots", excludedTalentIds: [] })
    expect(legacy.layout).toBe("detail")
  })

  it("flag-off: a persisted contact-sheet layout neutralizes back to 'detail' (byte-identical model)", () => {
    const d = withHold()
    const persisted = cfg({ layout: "contact-sheet" })
    const neutralized = neutralizeTalentConfigForFlag(persisted, false)
    const off = deriveTalentModel(d, neutralized)
    expect(off.layout).toBe("detail")
    // Byte-identity: the whole model equals the default-config model (layout stripped).
    expect(off).toEqual(deriveTalentModel(d, DEFAULT_TALENT_CONFIG))
    // Flag-on leaves a persisted layout intact.
    expect(deriveTalentModel(d, neutralizeTalentConfigForFlag(persisted, true)).layout).toBe("contact-sheet")
  })
})

describe("deriveTalentModel — adjustable headshot crop (Phase C, R4 part 2)", () => {
  const withTwo = () =>
    data({
      talent: ROSTER,
      shots: [shot({ id: "s1", shotNumber: "01", talentIds: ["tA", "tB"] })],
    })

  it("an absent headshotCrops folds the DEFAULT crop {scale:1,x:.5,y:.5} onto every entry", () => {
    const model = deriveTalentModel(withTwo(), cfg({ groupBy: "none" }))
    expect(find(model, "tA")?.crop).toEqual(DEFAULT_HEADSHOT_CROP)
    expect(find(model, "tB")?.crop).toEqual({ scale: 1, x: 0.5, y: 0.5 })
  })

  it("flag-on: a per-talent headshotCrops entry folds onto that entry's crop; others stay default", () => {
    const crop = { scale: 1.8, x: 0.25, y: 0.1 }
    const model = deriveTalentModel(withTwo(), cfg({ groupBy: "none", headshotCrops: { tA: crop } }))
    expect(find(model, "tA")?.crop).toEqual(crop)
    expect(find(model, "tB")?.crop).toEqual(DEFAULT_HEADSHOT_CROP) // no override -> default
  })

  it("flag-off: the neutralizer clamps headshotCrops to {} so every entry's crop is the default (byte-identical)", () => {
    const d = withTwo()
    const persisted = cfg({ groupBy: "none", headshotCrops: { tA: { scale: 2, x: 0.9, y: 0.05 } } })
    const neutralized = neutralizeTalentConfigForFlag(persisted, false)
    const off = deriveTalentModel(d, neutralized)
    expect(find(off, "tA")?.crop).toEqual(DEFAULT_HEADSHOT_CROP)
    // Whole model equals the default-config model — the crop leaves no trace flag-off.
    expect(off).toEqual(deriveTalentModel(d, DEFAULT_TALENT_CONFIG))
    // Flag-on leaves a persisted crop intact.
    expect(find(deriveTalentModel(d, neutralizeTalentConfigForFlag(persisted, true)), "tA")?.crop).toEqual({
      scale: 2,
      x: 0.9,
      y: 0.05,
    })
  })
})
