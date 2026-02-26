import { describe, it, expect } from "vitest"
import { Timestamp } from "firebase/firestore"
import type { Shot, ShotFirestoreStatus } from "@/shared/types"
import {
  sortShots,
  filterByStatus,
  filterByQuery,
  filterByMissing,
  filterByTalent,
  filterByLocation,
  filterByTag,
  parseCsv,
  formatUpdatedAt,
  applyFiltersAndSort,
  computeInsights,
  groupShots,
  STATUS_ORDER,
  STATUS_LABELS,
  SORT_LABELS,
  DEFAULT_FIELDS,
} from "./shotListFilters"

function ts(ms: number): Timestamp {
  return Timestamp.fromMillis(ms)
}

function makeShot(overrides: Partial<Shot> = {}): Shot {
  const now = ts(Date.now())
  return {
    id: overrides.id ?? "s1",
    title: overrides.title ?? "Shot",
    projectId: "p1",
    clientId: "c1",
    status: overrides.status ?? "todo",
    talent: overrides.talent ?? [],
    talentIds: overrides.talentIds,
    products: overrides.products ?? [],
    locationId: overrides.locationId,
    locationName: overrides.locationName,
    sortOrder: overrides.sortOrder ?? 0,
    shotNumber: overrides.shotNumber,
    description: overrides.description,
    notes: overrides.notes,
    notesAddendum: overrides.notesAddendum,
    date: overrides.date,
    heroImage: overrides.heroImage,
    tags: overrides.tags,
    deleted: overrides.deleted,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    createdBy: "u1",
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("constants", () => {
  it("STATUS_ORDER covers all statuses", () => {
    expect(Object.keys(STATUS_ORDER)).toEqual(["todo", "in_progress", "on_hold", "complete"])
  })

  it("STATUS_LABELS covers all statuses", () => {
    expect(STATUS_LABELS.todo).toBe("Draft")
    expect(STATUS_LABELS.complete).toBe("Shot")
  })

  it("SORT_LABELS covers all sort keys", () => {
    expect(SORT_LABELS.custom).toBe("Custom Order")
    expect(SORT_LABELS.name).toBe("Name")
  })

  it("DEFAULT_FIELDS has expected defaults", () => {
    expect(DEFAULT_FIELDS.heroThumb).toBe(true)
    expect(DEFAULT_FIELDS.notes).toBe(false)
    expect(DEFAULT_FIELDS.updated).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// parseCsv
// ---------------------------------------------------------------------------

describe("parseCsv", () => {
  it("returns empty array for null", () => {
    expect(parseCsv(null)).toEqual([])
  })

  it("returns empty array for empty string", () => {
    expect(parseCsv("")).toEqual([])
  })

  it("splits comma-separated values and trims whitespace", () => {
    expect(parseCsv(" a , b , c ")).toEqual(["a", "b", "c"])
  })

  it("filters empty tokens", () => {
    expect(parseCsv("a,,b,")).toEqual(["a", "b"])
  })
})

// ---------------------------------------------------------------------------
// sortShots
// ---------------------------------------------------------------------------

describe("sortShots", () => {
  it("returns original array for custom sort", () => {
    const shots = [makeShot({ id: "b" }), makeShot({ id: "a" })]
    const result = sortShots(shots, "custom", "asc")
    expect(result).toBe(shots)
  })

  it("sorts by name ascending", () => {
    const shots = [
      makeShot({ id: "b", title: "Bravo" }),
      makeShot({ id: "a", title: "Alpha" }),
    ]
    const result = sortShots(shots, "name", "asc")
    expect(result.map((s) => s.id)).toEqual(["a", "b"])
  })

  it("sorts by name descending", () => {
    const shots = [
      makeShot({ id: "a", title: "Alpha" }),
      makeShot({ id: "b", title: "Bravo" }),
    ]
    const result = sortShots(shots, "name", "desc")
    expect(result.map((s) => s.id)).toEqual(["b", "a"])
  })

  it("sorts by status order", () => {
    const shots = [
      makeShot({ id: "c", status: "complete", title: "C" }),
      makeShot({ id: "a", status: "todo", title: "A" }),
      makeShot({ id: "b", status: "in_progress", title: "B" }),
    ]
    const result = sortShots(shots, "status", "asc")
    expect(result.map((s) => s.id)).toEqual(["a", "b", "c"])
  })

  it("sorts by date with nulls last", () => {
    const shots = [
      makeShot({ id: "nodate", title: "No Date" }),
      makeShot({ id: "early", title: "Early", date: ts(1000) }),
      makeShot({ id: "late", title: "Late", date: ts(2000) }),
    ]
    const result = sortShots(shots, "date", "asc")
    expect(result.map((s) => s.id)).toEqual(["early", "late", "nodate"])
  })

  it("sorts by created descending", () => {
    const shots = [
      makeShot({ id: "old", createdAt: ts(1000) }),
      makeShot({ id: "new", createdAt: ts(2000) }),
    ]
    const result = sortShots(shots, "created", "desc")
    expect(result.map((s) => s.id)).toEqual(["new", "old"])
  })

  it("sorts by updated ascending", () => {
    const shots = [
      makeShot({ id: "new", updatedAt: ts(2000) }),
      makeShot({ id: "old", updatedAt: ts(1000) }),
    ]
    const result = sortShots(shots, "updated", "asc")
    expect(result.map((s) => s.id)).toEqual(["old", "new"])
  })

  it("does not mutate the original array", () => {
    const shots = [
      makeShot({ id: "b", title: "Bravo" }),
      makeShot({ id: "a", title: "Alpha" }),
    ]
    const original = [...shots]
    sortShots(shots, "name", "asc")
    expect(shots.map((s) => s.id)).toEqual(original.map((s) => s.id))
  })
})

// ---------------------------------------------------------------------------
// filterByStatus
// ---------------------------------------------------------------------------

describe("filterByStatus", () => {
  const shots = [
    makeShot({ id: "a", status: "todo" }),
    makeShot({ id: "b", status: "complete" }),
    makeShot({ id: "c", status: "on_hold" }),
  ]

  it("returns all shots when filter set is empty", () => {
    expect(filterByStatus(shots, new Set())).toBe(shots)
  })

  it("filters to matching statuses", () => {
    const result = filterByStatus(shots, new Set<ShotFirestoreStatus>(["todo", "complete"]))
    expect(result.map((s) => s.id)).toEqual(["a", "b"])
  })
})

// ---------------------------------------------------------------------------
// filterByQuery
// ---------------------------------------------------------------------------

describe("filterByQuery", () => {
  const shots = [
    makeShot({ id: "a", title: "Alpha Shot", shotNumber: "A-001", description: "Aerial view" }),
    makeShot({ id: "b", title: "Bravo Shot", shotNumber: "B-002", description: "Ground level" }),
  ]

  it("returns all shots for empty query", () => {
    expect(filterByQuery(shots, "")).toBe(shots)
    expect(filterByQuery(shots, "  ")).toBe(shots)
  })

  it("matches by title case-insensitive", () => {
    const result = filterByQuery(shots, "alpha")
    expect(result.map((s) => s.id)).toEqual(["a"])
  })

  it("matches by shot number", () => {
    const result = filterByQuery(shots, "B-002")
    expect(result.map((s) => s.id)).toEqual(["b"])
  })

  it("matches by description", () => {
    const result = filterByQuery(shots, "aerial")
    expect(result.map((s) => s.id)).toEqual(["a"])
  })
})

// ---------------------------------------------------------------------------
// filterByMissing
// ---------------------------------------------------------------------------

describe("filterByMissing", () => {
  it("returns all shots when missing set is empty", () => {
    const shots = [makeShot()]
    expect(filterByMissing(shots, new Set())).toBe(shots)
  })

  it("filters shots missing products", () => {
    const shots = [
      makeShot({ id: "with", products: [{ familyId: "f1", familyName: "Jacket" }] }),
      makeShot({ id: "without", products: [] }),
    ]
    const result = filterByMissing(shots, new Set(["products"] as const))
    expect(result.map((s) => s.id)).toEqual(["without"])
  })

  it("filters shots missing talent", () => {
    const shots = [
      makeShot({ id: "with", talent: ["t1"] }),
      makeShot({ id: "without", talent: [] }),
    ]
    const result = filterByMissing(shots, new Set(["talent"] as const))
    expect(result.map((s) => s.id)).toEqual(["without"])
  })

  it("filters shots missing location", () => {
    const shots = [
      makeShot({ id: "with", locationId: "loc1" }),
      makeShot({ id: "without" }),
    ]
    const result = filterByMissing(shots, new Set(["location"] as const))
    expect(result.map((s) => s.id)).toEqual(["without"])
  })

  it("filters shots missing image", () => {
    const shots = [
      makeShot({ id: "with", heroImage: { path: "p", downloadURL: "u" } }),
      makeShot({ id: "without" }),
    ]
    const result = filterByMissing(shots, new Set(["image"] as const))
    expect(result.map((s) => s.id)).toEqual(["without"])
  })

  it("treats heroImage.path as present", () => {
    const shots = [
      makeShot({ id: "path-only", heroImage: { path: "shots/hero.webp", downloadURL: "" } }),
      makeShot({ id: "missing" }),
    ]
    const result = filterByMissing(shots, new Set(["image"] as const))
    expect(result.map((s) => s.id)).toEqual(["missing"])
  })
})

// ---------------------------------------------------------------------------
// filterByTalent
// ---------------------------------------------------------------------------

describe("filterByTalent", () => {
  const shots = [
    makeShot({ id: "a", talent: ["t1"] }),
    makeShot({ id: "b", talent: ["t2"] }),
    makeShot({ id: "c", talentIds: ["t1", "t2"] }),
  ]

  it("returns all shots for empty talent id", () => {
    expect(filterByTalent(shots, "")).toBe(shots)
  })

  it("filters by talent id", () => {
    const result = filterByTalent(shots, "t1")
    expect(result.map((s) => s.id)).toEqual(["a", "c"])
  })

  it("prefers talentIds over talent", () => {
    const shots2 = [makeShot({ id: "x", talent: ["t1"], talentIds: ["t3"] })]
    const result = filterByTalent(shots2, "t3")
    expect(result.map((s) => s.id)).toEqual(["x"])
  })
})

// ---------------------------------------------------------------------------
// filterByLocation
// ---------------------------------------------------------------------------

describe("filterByLocation", () => {
  const shots = [
    makeShot({ id: "a", locationId: "loc1" }),
    makeShot({ id: "b", locationId: "loc2" }),
    makeShot({ id: "c" }),
  ]

  it("returns all shots for empty location id", () => {
    expect(filterByLocation(shots, "")).toBe(shots)
  })

  it("filters by location id", () => {
    const result = filterByLocation(shots, "loc1")
    expect(result.map((s) => s.id)).toEqual(["a"])
  })
})

// ---------------------------------------------------------------------------
// filterByTag
// ---------------------------------------------------------------------------

describe("filterByTag", () => {
  const shots = [
    makeShot({ id: "a", tags: [{ id: "t1", label: "Video", color: "#333" }] }),
    makeShot({ id: "b", tags: [{ id: "t2", label: "Photo", color: "#444" }] }),
    makeShot({ id: "c", tags: [] }),
  ]

  it("returns all shots for empty tag set", () => {
    expect(filterByTag(shots, new Set())).toBe(shots)
  })

  it("filters by tag id (OR logic)", () => {
    const result = filterByTag(shots, new Set(["t1", "t2"]))
    expect(result.map((s) => s.id)).toEqual(["a", "b"])
  })
})

// ---------------------------------------------------------------------------
// formatUpdatedAt
// ---------------------------------------------------------------------------

describe("formatUpdatedAt", () => {
  it("returns em-dash when updatedAt has no toMillis", () => {
    const shot = { ...makeShot(), updatedAt: null as unknown as Timestamp }
    expect(formatUpdatedAt(shot)).toBe("\u2014")
  })

  it("formats a valid timestamp", () => {
    const shot = makeShot({ updatedAt: ts(new Date("2026-02-15T12:00:00Z").getTime()) })
    const result = formatUpdatedAt(shot)
    expect(result).toMatch(/Feb/)
    expect(result).toMatch(/15/)
  })
})

// ---------------------------------------------------------------------------
// applyFiltersAndSort
// ---------------------------------------------------------------------------

describe("applyFiltersAndSort", () => {
  it("applies all filters and sorts", () => {
    const shots = [
      makeShot({ id: "b", title: "Bravo", status: "todo" }),
      makeShot({ id: "a", title: "Alpha", status: "todo" }),
      makeShot({ id: "c", title: "Charlie", status: "complete" }),
    ]

    const result = applyFiltersAndSort(shots, {
      statusFilter: new Set<ShotFirestoreStatus>(["todo"]),
      missingFilter: new Set(),
      talentId: "",
      locationId: "",
      tagFilter: new Set(),
      productFamilyId: "",
      query: "",
      sortKey: "name",
      sortDir: "asc",
    })

    expect(result.map((s) => s.id)).toEqual(["a", "b"])
  })
})

// ---------------------------------------------------------------------------
// computeInsights
// ---------------------------------------------------------------------------

describe("computeInsights", () => {
  it("counts status and missing fields", () => {
    const shots = [
      makeShot({ id: "a", status: "todo", products: [] }),
      makeShot({ id: "b", status: "todo", products: [{ familyId: "f1" }] }),
      makeShot({ id: "c", status: "complete", products: [], locationId: "loc1" }),
    ]

    const { statusCounts, missingCounts } = computeInsights(shots)

    expect(statusCounts.todo).toBe(2)
    expect(statusCounts.complete).toBe(1)
    expect(statusCounts.in_progress).toBe(0)
    expect(missingCounts.products).toBe(2)
    expect(missingCounts.location).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// groupShots
// ---------------------------------------------------------------------------

describe("groupShots", () => {
  const lookups = {
    talentNameById: new Map([["t1", "Jane"], ["t2", "Bob"]]),
    locationNameById: new Map([["loc1", "Studio A"]]),
  }

  it("returns null for none grouping", () => {
    expect(groupShots([], "none", lookups)).toBeNull()
  })

  it("groups by status in canonical order", () => {
    const shots = [
      makeShot({ id: "a", status: "complete" }),
      makeShot({ id: "b", status: "todo" }),
      makeShot({ id: "c", status: "todo" }),
    ]
    const groups = groupShots(shots, "status", lookups)
    expect(groups).not.toBeNull()
    expect(groups!.map((g) => g.key)).toEqual(["todo", "complete"])
    expect(groups![0]!.shots.length).toBe(2)
  })

  it("groups by date with no-date last", () => {
    const shots = [
      makeShot({ id: "a", date: ts(new Date("2026-02-05T00:00:00Z").getTime()) }),
      makeShot({ id: "b" }),
    ]
    const groups = groupShots(shots, "date", lookups)
    expect(groups).not.toBeNull()
    expect(groups![groups!.length - 1]!.label).toBe("No date")
  })

  it("groups by talent with unassigned first", () => {
    const shots = [
      makeShot({ id: "a", talent: ["t1"] }),
      makeShot({ id: "b", talent: [] }),
    ]
    const groups = groupShots(shots, "talent", lookups)
    expect(groups).not.toBeNull()
    expect(groups![0]!.label).toBe("Unassigned")
    expect(groups![1]!.label).toBe("Jane")
  })

  it("groups by location with unassigned first", () => {
    const shots = [
      makeShot({ id: "a", locationId: "loc1" }),
      makeShot({ id: "b" }),
    ]
    const groups = groupShots(shots, "location", lookups)
    expect(groups).not.toBeNull()
    expect(groups![0]!.label).toBe("Unassigned")
    expect(groups![1]!.label).toBe("Studio A")
  })

  it("skips empty status groups", () => {
    const shots = [makeShot({ id: "a", status: "todo" })]
    const groups = groupShots(shots, "status", lookups)
    expect(groups!.length).toBe(1)
    expect(groups![0]!.key).toBe("todo")
  })
})
