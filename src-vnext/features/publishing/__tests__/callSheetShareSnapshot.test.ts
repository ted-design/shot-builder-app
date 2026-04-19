// @vitest-environment node
/**
 * Unit tests for `functions/src/callSheetShareSnapshot.js` (Phase 3
 * publishing). Exercised via `require` against the CommonJS module — no
 * emulator needed; the builder is pure and input-agnostic.
 */

import { describe, expect, it } from "vitest"
import { createRequire } from "node:module"
import { resolve } from "node:path"

const require = createRequire(import.meta.url)
const snapshotModule = require(
  resolve(__dirname, "../../../../functions/src/callSheetShareSnapshot.js"),
) as {
  buildCallSheetShareSnapshot: (input: unknown) => Record<string, unknown>
  buildSections: (config: unknown) => unknown[]
  buildDayDetailsSnapshot: (dayDetails: unknown) => unknown
  buildScheduleSnapshot: (input: unknown) => unknown
  buildTalentCalls: (calls: unknown, roster: unknown) => unknown[]
  buildCrewCalls: (calls: unknown, roster: unknown) => unknown[]
  buildClientCalls: (calls: unknown) => unknown[]
  buildLocations: (locations: unknown) => unknown[]
  buildBrand: (project: unknown) => unknown
}

describe("buildSections", () => {
  it("drops invisible sections", () => {
    const result = snapshotModule.buildSections({
      sections: [
        { key: "a", type: "t", title: "A", visible: true, fields: [] },
        { key: "b", type: "t", title: "B", visible: false, fields: [] },
      ],
    })
    expect(result).toHaveLength(1)
    expect((result[0] as { key: string }).key).toBe("a")
  })

  it("normalizes missing titles to null", () => {
    const [section] = snapshotModule.buildSections({
      sections: [{ key: "k", type: "t", visible: true, fields: [] }],
    }) as Array<{ title: unknown }>
    expect(section.title).toBeNull()
  })

  it("returns empty array when config has no sections", () => {
    expect(snapshotModule.buildSections({})).toEqual([])
    expect(snapshotModule.buildSections(null)).toEqual([])
  })

  it("preserves fields key/value shape", () => {
    const result = snapshotModule.buildSections({
      sections: [{
        key: "s1",
        type: "notes",
        title: "Notes",
        visible: true,
        fields: [{ key: "f1", value: "hello" }, { key: "f2", value: 42 }],
      }],
    }) as Array<{ fields: Array<{ key: string; value: unknown }> }>
    expect(result[0].fields).toEqual([
      { key: "f1", value: "hello" },
      { key: "f2", value: 42 },
    ])
  })
})

describe("buildDayDetailsSnapshot", () => {
  it("normalizes empty strings to null", () => {
    const result = snapshotModule.buildDayDetailsSnapshot({
      generalCallTime: "",
      sunrise: "6:20 AM",
      sunset: "",
      weatherSummary: "Sunny",
      notes: null,
    })
    expect(result).toEqual({
      generalCallTime: null,
      sunrise: "6:20 AM",
      sunset: null,
      weatherSummary: "Sunny",
      notes: null,
    })
  })

  it("returns null when dayDetails is missing", () => {
    expect(snapshotModule.buildDayDetailsSnapshot(null)).toBeNull()
  })
})

describe("buildScheduleSnapshot", () => {
  it("resolves trackLabel from trackId lookup when missing", () => {
    const result = snapshotModule.buildScheduleSnapshot({
      tracks: [{ id: "t1", label: "1st Unit" }],
      entries: [{ id: "e1", title: "Block A", trackId: "t1" }],
    }) as { entries: Array<{ trackLabel: string | null }> }
    expect(result.entries[0].trackLabel).toBe("1st Unit")
  })

  it("prefers explicit trackLabel over trackId lookup", () => {
    const result = snapshotModule.buildScheduleSnapshot({
      tracks: [{ id: "t1", label: "1st Unit" }],
      entries: [{ id: "e1", title: "Block A", trackId: "t1", trackLabel: "Custom Label" }],
    }) as { entries: Array<{ trackLabel: string | null }> }
    expect(result.entries[0].trackLabel).toBe("Custom Label")
  })

  it("returns null when neither tracks nor entries are present", () => {
    expect(snapshotModule.buildScheduleSnapshot({})).toBeNull()
  })
})

describe("buildCrewCalls — private-by-default phone/email", () => {
  it("omits phone when showPhone=false", () => {
    const [crew] = snapshotModule.buildCrewCalls(
      [{ crewMemberId: "c1", name: "Taylor", showPhone: false, showEmail: false, phone: "555" }],
      [],
    ) as Array<{ phone: string | null }>
    expect(crew.phone).toBeNull()
  })

  it("includes phone when showPhone=true", () => {
    const [crew] = snapshotModule.buildCrewCalls(
      [{ crewMemberId: "c1", name: "Taylor", showPhone: true, showEmail: false, phone: "555-1234" }],
      [],
    ) as Array<{ phone: string | null }>
    expect(crew.phone).toBe("555-1234")
  })

  it("defaults showPhone/showEmail to false when the field is absent", () => {
    const [crew] = snapshotModule.buildCrewCalls(
      [{ crewMemberId: "c1", name: "Taylor", phone: "555", email: "t@x.com" }],
      [],
    ) as Array<{ showPhone: boolean; showEmail: boolean; phone: unknown; email: unknown }>
    expect(crew.showPhone).toBe(false)
    expect(crew.showEmail).toBe(false)
    expect(crew.phone).toBeNull()
    expect(crew.email).toBeNull()
  })

  it("fills missing name from roster", () => {
    const [crew] = snapshotModule.buildCrewCalls(
      [{ crewMemberId: "c1", showPhone: false, showEmail: false }],
      [{ id: "c1", name: "Roster Name", roleLabel: "Gaffer" }],
    ) as Array<{ name: string; roleLabel: string | null }>
    expect(crew.name).toBe("Roster Name")
    expect(crew.roleLabel).toBe("Gaffer")
  })
})

describe("buildTalentCalls", () => {
  it("resolves name from roster when call lacks a name", () => {
    const [talent] = snapshotModule.buildTalentCalls(
      [{ talentId: "t1" }],
      [{ id: "t1", name: "Alex" }],
    ) as Array<{ name: string; talentId: string | null }>
    expect(talent.name).toBe("Alex")
    expect(talent.talentId).toBe("t1")
  })

  it("returns empty array when calls input is falsy", () => {
    expect(snapshotModule.buildTalentCalls(null, null)).toEqual([])
  })
})

describe("buildLocations", () => {
  it("keeps lat/lng as numbers and nulls invalid values", () => {
    const [loc] = snapshotModule.buildLocations([
      { id: "l1", label: "Studio A", latitude: 43.65, longitude: "invalid" },
    ]) as Array<{ latitude: unknown; longitude: unknown }>
    expect(loc.latitude).toBe(43.65)
    expect(loc.longitude).toBeNull()
  })
})

describe("buildBrand", () => {
  it("reads from project.brand when present", () => {
    expect(
      snapshotModule.buildBrand({ brand: { logoUrl: "u", primaryColor: "#fff" } }),
    ).toEqual({ logoUrl: "u", primaryColor: "#fff" })
  })

  it("falls back to top-level project fields", () => {
    expect(
      snapshotModule.buildBrand({ logoUrl: "u", primaryColor: "#fff" }),
    ).toEqual({ logoUrl: "u", primaryColor: "#fff" })
  })

  it("returns null members when absent", () => {
    expect(snapshotModule.buildBrand({})).toEqual({
      logoUrl: null,
      primaryColor: null,
    })
  })
})

describe("buildCallSheetShareSnapshot — integration", () => {
  it("assembles a minimal well-formed snapshot", () => {
    const result = snapshotModule.buildCallSheetShareSnapshot({
      title: "Day 3 — 1st Unit",
      shootDate: null,
      config: {
        sections: [
          { key: "intro", type: "header", title: "Welcome", visible: true, fields: [] },
        ],
      },
      dayDetails: { generalCallTime: "7:00 AM" },
      schedule: {
        tracks: [{ id: "t1", label: "1st Unit" }],
        entries: [{ id: "e1", title: "Block A", trackId: "t1" }],
      },
      talentCalls: [{ talentId: "tal1", name: "Alex", callTime: "7:00 AM" }],
      crewCalls: [{ crewMemberId: "c1", name: "Taylor", showPhone: false, showEmail: false }],
      clientCalls: [{ id: "cli1", name: "Client A" }],
      locations: [{ id: "loc1", label: "Studio A" }],
      talentRoster: [{ id: "tal1", name: "Alex" }],
      crewRoster: [{ id: "c1", name: "Taylor" }],
      project: { name: "Unboundmerino FW26", brand: { logoUrl: "u", primaryColor: "#000" } },
      client: { name: "Unboundmerino" },
    })

    expect(result.title).toBe("Day 3 — 1st Unit")
    expect(Array.isArray(result.sections)).toBe(true)
    expect((result.sections as unknown[])).toHaveLength(1)
    expect(result.projectName).toBe("Unboundmerino FW26")
    expect(result.clientName).toBe("Unboundmerino")
    expect((result.brand as { logoUrl: string }).logoUrl).toBe("u")
    expect((result.talentCalls as unknown[])).toHaveLength(1)
    expect((result.crewCalls as Array<{ phone: unknown }>)[0].phone).toBeNull()
  })

  it("does not mutate the input arrays", () => {
    const input = {
      title: "T",
      config: { sections: [{ key: "a", type: "t", visible: true, fields: [] }] },
      talentCalls: [{ talentId: "t1", name: "Alex" }],
      crewCalls: [],
      clientCalls: [],
      locations: [],
      talentRoster: [],
      crewRoster: [],
      project: { name: "P" },
      client: { name: "C" },
    }
    const sectionsBefore = input.config.sections
    const talentBefore = input.talentCalls
    snapshotModule.buildCallSheetShareSnapshot(input)
    expect(input.config.sections).toBe(sectionsBefore)
    expect(input.talentCalls).toBe(talentBefore)
    expect(input.talentCalls[0]).toEqual({ talentId: "t1", name: "Alex" })
  })

  it("tolerates null/undefined for all optional fields", () => {
    const result = snapshotModule.buildCallSheetShareSnapshot({
      title: null,
      config: null,
      dayDetails: null,
      schedule: null,
      talentCalls: null,
      crewCalls: null,
      clientCalls: null,
      locations: null,
      talentRoster: null,
      crewRoster: null,
      project: null,
      client: null,
    })
    expect(result.title).toBe("Call Sheet")
    expect(result.sections).toEqual([])
    expect(result.dayDetails).toBeNull()
    expect(result.schedule).toBeNull()
    expect(result.talentCalls).toEqual([])
    expect(result.crewCalls).toEqual([])
    expect(result.projectName).toBe("")
    expect(result.clientName).toBe("")
  })
})
