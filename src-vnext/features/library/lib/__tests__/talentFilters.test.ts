import { describe, it, expect } from "vitest"
import type { TalentRecord } from "@/shared/types"
import {
  filterTalent,
  extractUniqueAgencies,
  EMPTY_TALENT_FILTERS,
  type TalentSearchFilters,
} from "@/features/library/lib/talentFilters"

function makeTalent(overrides: Partial<TalentRecord> = {}): TalentRecord {
  return {
    id: overrides.id ?? "t1",
    name: overrides.name ?? "Jane Doe",
    gender: overrides.gender ?? null,
    agency: overrides.agency,
    email: overrides.email ?? null,
    measurements: overrides.measurements ?? null,
    castingSessions: overrides.castingSessions,
  } as TalentRecord
}

describe("filterTalent", () => {
  const talent: readonly TalentRecord[] = [
    makeTalent({ id: "1", name: "Alice Smith", gender: "Women", agency: "IMG" }),
    makeTalent({ id: "2", name: "Bob Jones", gender: "Men", agency: "Next" }),
    makeTalent({
      id: "3",
      name: "Carol White",
      gender: "Women",
      agency: "IMG",
      measurements: { height: '5\'9"', waist: 28 },
    }),
    makeTalent({
      id: "4",
      name: "Dave Brown",
      gender: "Men",
      agency: "DNA",
      castingSessions: [
        { id: "cs1", date: "2024-01-01", images: [] },
      ],
    }),
  ]

  it("returns all talent with empty filters", () => {
    const result = filterTalent(talent, EMPTY_TALENT_FILTERS)
    expect(result).toHaveLength(4)
  })

  it("filters by query (name)", () => {
    const filters: TalentSearchFilters = {
      ...EMPTY_TALENT_FILTERS,
      query: "alice",
    }
    const result = filterTalent(talent, filters)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe("1")
  })

  it("filters by query (agency)", () => {
    const filters: TalentSearchFilters = {
      ...EMPTY_TALENT_FILTERS,
      query: "img",
    }
    const result = filterTalent(talent, filters)
    expect(result).toHaveLength(2)
  })

  it("filters by gender", () => {
    const filters: TalentSearchFilters = {
      ...EMPTY_TALENT_FILTERS,
      gender: "women",
    }
    const result = filterTalent(talent, filters)
    expect(result).toHaveLength(2)
    expect(result.every((t) => t.gender === "Women")).toBe(true)
  })

  it("filters by agency", () => {
    const filters: TalentSearchFilters = {
      ...EMPTY_TALENT_FILTERS,
      agency: "IMG",
    }
    const result = filterTalent(talent, filters)
    expect(result).toHaveLength(2)
  })

  it("filters by measurement range", () => {
    const filters: TalentSearchFilters = {
      ...EMPTY_TALENT_FILTERS,
      measurementRanges: {
        waist: { min: 26, max: 30 },
      },
    }
    const result = filterTalent(talent, filters)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe("3")
  })

  it("excludes talent with unparseable measurement when range is set", () => {
    const filters: TalentSearchFilters = {
      ...EMPTY_TALENT_FILTERS,
      measurementRanges: {
        height: { min: 60, max: 75 },
      },
    }
    // Only Carol has height data; Alice and Bob have null measurements
    const result = filterTalent(talent, filters)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe("3")
  })

  it("skips range check when both min and max are null", () => {
    const filters: TalentSearchFilters = {
      ...EMPTY_TALENT_FILTERS,
      measurementRanges: {
        waist: { min: null, max: null },
      },
    }
    const result = filterTalent(talent, filters)
    expect(result).toHaveLength(4)
  })

  it("filters by hasCastingHistory = true", () => {
    const filters: TalentSearchFilters = {
      ...EMPTY_TALENT_FILTERS,
      hasCastingHistory: true,
    }
    const result = filterTalent(talent, filters)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe("4")
  })

  it("filters by hasCastingHistory = false", () => {
    const filters: TalentSearchFilters = {
      ...EMPTY_TALENT_FILTERS,
      hasCastingHistory: false,
    }
    const result = filterTalent(talent, filters)
    expect(result).toHaveLength(3)
  })

  it("combines multiple filters", () => {
    const filters: TalentSearchFilters = {
      ...EMPTY_TALENT_FILTERS,
      gender: "women",
      agency: "IMG",
    }
    const result = filterTalent(talent, filters)
    expect(result).toHaveLength(2)
  })

  it("does not mutate input array", () => {
    const copy = [...talent]
    filterTalent(talent, { ...EMPTY_TALENT_FILTERS, gender: "men" })
    expect(talent).toEqual(copy)
  })
})

describe("extractUniqueAgencies", () => {
  it("returns empty array for empty input", () => {
    expect(extractUniqueAgencies([])).toEqual([])
  })

  it("extracts and deduplicates agencies", () => {
    const talent: readonly TalentRecord[] = [
      makeTalent({ id: "1", agency: "IMG" }),
      makeTalent({ id: "2", agency: "Next" }),
      makeTalent({ id: "3", agency: "IMG" }),
      makeTalent({ id: "4" }),
    ]
    const result = extractUniqueAgencies(talent)
    expect(result).toEqual(["IMG", "Next"])
  })

  it("returns sorted results", () => {
    const talent: readonly TalentRecord[] = [
      makeTalent({ id: "1", agency: "Zebra" }),
      makeTalent({ id: "2", agency: "Alpha" }),
    ]
    const result = extractUniqueAgencies(talent)
    expect(result).toEqual(["Alpha", "Zebra"])
  })
})
