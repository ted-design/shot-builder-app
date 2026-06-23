import { describe, it, expect } from "vitest"
import { collectTalentImageCandidates, deriveTalentModel } from "../talentModel"
import { DEFAULT_TALENT_CONFIG, type TalentConfig } from "../talentTypes"
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

  it("onHold is true iff ANY appearance is on_hold (the one red); false otherwise", () => {
    const model = deriveTalentModel(
      data({
        talent: ROSTER,
        shots: [
          shot({ id: "s1", shotNumber: "01", status: "on_hold", talentIds: ["tA"] }),
          shot({ id: "s2", shotNumber: "02", status: "complete", talentIds: ["tA", "tB"] }),
        ],
      }),
      cfg({ groupBy: "none" }),
    )
    expect(find(model, "tA")?.onHold).toBe(true) // s1 is on_hold
    expect(find(model, "tB")?.onHold).toBe(false) // only in a complete shot
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
    expect(model.project.client).toBe("c")
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
