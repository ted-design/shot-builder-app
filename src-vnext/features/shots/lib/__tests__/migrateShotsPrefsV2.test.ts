// Phase 1 — three-store localStorage preference consolidation (shots build
// plan §Phase 1). Every test seeds a PERSISTED-BLOB fixture directly into
// localStorage before calling the module — never the empty/seed path (the
// old destructive migration's bug was invisible from an empty origin).
import { describe, it, expect, beforeEach } from "vitest"
import {
  backfillShotsPrefsV2,
  fieldsDelta,
  mirrorFieldsPatchToV2,
  mirrorViewToV2,
  mirrorColumnWidthToV2,
  mirrorColumnOrderToV2,
  mirrorColumnVisibilityToV2,
  resetColumnPrefsInV2,
  resolveViewV2FromRaw,
  fieldsV1Key,
  viewV1Key,
  tableV3Key,
  prefsV2Key,
  type ShotsPrefsV2,
} from "../migrateShotsPrefsV2"
import { DEFAULT_FIELDS, type ShotsListFields } from "../shotListFilters"
import { SHOT_TABLE_COLUMNS } from "../shotTableColumns"
import type { TableColumnConfig } from "@/shared/types/table"

const CLIENT = "c1"
const PROJECT = "p1"

function readV2(): ShotsPrefsV2 | null {
  const raw = window.localStorage.getItem(prefsV2Key(CLIENT, PROJECT))
  return raw ? (JSON.parse(raw) as ShotsPrefsV2) : null
}

function seedFieldsV1(fields: Partial<ShotsListFields>): void {
  window.localStorage.setItem(fieldsV1Key(CLIENT, PROJECT), JSON.stringify(fields))
}

function seedViewV1(view: string): void {
  window.localStorage.setItem(viewV1Key(CLIENT, PROJECT), view)
}

function seedTableV3(cols: readonly TableColumnConfig[]): void {
  window.localStorage.setItem(tableV3Key(CLIENT, PROJECT), JSON.stringify(cols))
}

/** A full, non-default TableColumnConfig[] fixture — every visibility flip
 *  from SHOT_TABLE_COLUMNS' defaults, plus distinct widths/orders so the
 *  sidecar-capture assertions aren't accidentally satisfied by defaults. */
function nonDefaultTableV3(): readonly TableColumnConfig[] {
  return SHOT_TABLE_COLUMNS.map((col, idx) => ({
    ...col,
    visible: col.pinned ? true : !col.visible,
    width: col.width + 10,
    order: idx,
  }))
}

beforeEach(() => {
  window.localStorage.clear()
})

// ---------------------------------------------------------------------------
// Anchor test — the one that would have caught the live destructive-delete
// bug. Mutation target is the LIVE backfill pass (not the retired
// ShotsTable.tsx:66 line — restoring that line stays green and proves
// nothing, since its call site no longer exists).
// ---------------------------------------------------------------------------

describe("backfillShotsPrefsV2 — anchor test (SI-3)", () => {
  it("card-only fixture: Store 1 (:fields:v1) is STILL readable and byte-equal after backfill runs", () => {
    const nonDefault: ShotsListFields = { ...DEFAULT_FIELDS, notes: true, launch: true, talent: false }
    seedFieldsV1(nonDefault)
    const rawBefore = window.localStorage.getItem(fieldsV1Key(CLIENT, PROJECT))

    backfillShotsPrefsV2(CLIENT, PROJECT)

    const rawAfter = window.localStorage.getItem(fieldsV1Key(CLIENT, PROJECT))
    expect(rawAfter).toBe(rawBefore) // still present, byte-identical — NOT deleted
    expect(JSON.parse(rawAfter!)).toEqual(nonDefault)

    // And the backfill actually carried those fields into v2, so a future
    // read-flip (Phase 2) loads the SAME prefs the card was showing.
    const v2 = readV2()
    expect(v2?.fields).toEqual(nonDefault)
    expect(v2?._mig.v2).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Case matrix (build plan §1.2A)
// ---------------------------------------------------------------------------

describe("backfillShotsPrefsV2 — case matrix", () => {
  it("card Store 1 only: fields copied verbatim, columns = defaults (empty sidecar), Store 1 preserved", () => {
    const fields: ShotsListFields = { ...DEFAULT_FIELDS, description: false, readiness: false }
    seedFieldsV1(fields)

    backfillShotsPrefsV2(CLIENT, PROJECT)

    const v2 = readV2()!
    expect(v2.fields).toEqual(fields)
    expect(v2.columns).toEqual({})
    expect(v2.view).toBeNull()
    expect(v2._mig.v2).toBe(true)
    expect(window.localStorage.getItem(fieldsV1Key(CLIENT, PROJECT))).not.toBeNull()
    expect(window.localStorage.getItem(tableV3Key(CLIENT, PROJECT))).toBeNull()
  })

  it("table Store 3 only: fields projected via columnKeyToFieldKey, columns = Store 3 sidecar", () => {
    const cols = nonDefaultTableV3()
    seedTableV3(cols)

    backfillShotsPrefsV2(CLIENT, PROJECT)

    const v2 = readV2()!
    // Every non-pinned column's flipped visibility should show up in fields.
    const dateCol = cols.find((c) => c.key === "date")!
    expect(v2.fields.date).toBe(dateCol.visible)
    const talentCol = cols.find((c) => c.key === "talent")!
    expect(v2.fields.talent).toBe(talentCol.visible)
    // Card-only fields have no column counterpart — fall back to defaults.
    expect(v2.fields.description).toBe(DEFAULT_FIELDS.description)
    expect(v2.fields.readiness).toBe(DEFAULT_FIELDS.readiness)
    // Geometry carried verbatim.
    expect(v2.columns.date).toEqual({ width: dateCol.width, order: dateCol.order })
    expect(v2.columns.talent).toEqual({ width: talentCol.width, order: talentCol.order })
    expect(v2._mig.v2).toBe(true)
  })

  it("BOTH present, DISAGREEING on ≥2 overlapping keys: OR-union result exactly", () => {
    // Store 1: talent visible, date hidden.
    // Store 3: talent hidden, date visible.
    // Union must show BOTH visible (visible in EITHER store).
    const fields: ShotsListFields = { ...DEFAULT_FIELDS, talent: true, date: false, description: false }
    seedFieldsV1(fields)
    const cols = SHOT_TABLE_COLUMNS.map((col) => {
      if (col.key === "talent") return { ...col, visible: false }
      if (col.key === "date") return { ...col, visible: true }
      return col
    })
    seedTableV3(cols)

    backfillShotsPrefsV2(CLIENT, PROJECT)

    const v2 = readV2()!
    expect(v2.fields.talent).toBe(true) // visible in Store 1 -> union true
    expect(v2.fields.date).toBe(true) // visible in Store 3 -> union true
    // Card-only field: Store 1 alone, not union'd against anything.
    expect(v2.fields.description).toBe(false)
    // Geometry from Store 3.
    const dateCol = cols.find((c) => c.key === "date")!
    expect(v2.columns.date).toEqual({ width: dateCol.width, order: dateCol.order })
    expect(window.localStorage.getItem(fieldsV1Key(CLIENT, PROJECT))).not.toBeNull()
    expect(window.localStorage.getItem(tableV3Key(CLIENT, PROJECT))).not.toBeNull()
  })

  it("BOTH present, a key hidden in BOTH stores stays hidden (union is not always true)", () => {
    const fields: ShotsListFields = { ...DEFAULT_FIELDS, reqs: false }
    seedFieldsV1(fields)
    const cols = SHOT_TABLE_COLUMNS.map((col) => (col.key === "reqs" ? { ...col, visible: false } : col))
    seedTableV3(cols)

    backfillShotsPrefsV2(CLIENT, PROJECT)

    expect(readV2()!.fields.reqs).toBe(false)
  })

  it("NEITHER present: defaults written, empty rawSnapshot, marker stamped (no-match stamp)", () => {
    backfillShotsPrefsV2(CLIENT, PROJECT)

    const v2 = readV2()!
    expect(v2.fields).toEqual(DEFAULT_FIELDS)
    expect(v2.columns).toEqual({})
    expect(v2.view).toBeNull()
    expect(v2.rawSnapshot).toEqual({ fieldsV1: null, tableV3: null, viewV1: null })
    expect(v2._mig.v2).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// rawSnapshot capture (build plan §1.3d)
// ---------------------------------------------------------------------------

describe("backfillShotsPrefsV2 — rawSnapshot capture", () => {
  it("captures the raw legacy strings on first write, across all three stores", () => {
    const fields: ShotsListFields = { ...DEFAULT_FIELDS, tags: false }
    seedFieldsV1(fields)
    seedViewV1("table")
    const cols = nonDefaultTableV3()
    seedTableV3(cols)

    backfillShotsPrefsV2(CLIENT, PROJECT)

    const v2 = readV2()!
    expect(v2.rawSnapshot).toEqual({
      fieldsV1: JSON.stringify(fields),
      tableV3: JSON.stringify(cols),
      viewV1: "table",
    })
  })
})

// ---------------------------------------------------------------------------
// Idempotency (build plan §1.3a, §1.5)
// ---------------------------------------------------------------------------

describe("backfillShotsPrefsV2 — idempotency", () => {
  it("running twice produces a byte-identical v2 blob, no duplicated columns", () => {
    seedFieldsV1({ ...DEFAULT_FIELDS, notes: true })
    seedTableV3(nonDefaultTableV3())

    backfillShotsPrefsV2(CLIENT, PROJECT)
    const firstRaw = window.localStorage.getItem(prefsV2Key(CLIENT, PROJECT))

    backfillShotsPrefsV2(CLIENT, PROJECT)
    const secondRaw = window.localStorage.getItem(prefsV2Key(CLIENT, PROJECT))

    expect(secondRaw).toBe(firstRaw)
    expect(Object.keys(JSON.parse(secondRaw!).columns).length).toBe(
      Object.keys(JSON.parse(firstRaw!).columns).length,
    )
  })

  it("a second run never re-derives over a live user edit (marker gate short-circuits)", () => {
    seedFieldsV1({ ...DEFAULT_FIELDS })
    backfillShotsPrefsV2(CLIENT, PROJECT)

    // Simulate a user edit landing in v2 between two backfill invocations
    // (e.g. via a dual-write mirror) — the marker MUST protect it.
    mirrorFieldsPatchToV2(CLIENT, PROJECT, { notes: true })

    backfillShotsPrefsV2(CLIENT, PROJECT)

    expect(readV2()!.fields.notes).toBe(true) // edit survived
  })
})

// ---------------------------------------------------------------------------
// View reader semantics (build plan §1.5) — NOT through resolveSurface. This
// guards the null-preserving contract the backfill's `view` field needs
// (mirrors useShotListState's resolver reader `storedExplicitView`, which is
// untouched by Phase 1 and not exported — this is a standalone, directly
// testable copy of the same contract, owned by this module).
// ---------------------------------------------------------------------------

describe("resolveViewV2FromRaw — null-preserving view reader", () => {
  it("returns null for an absent (never-stored) value — preserves 'unset', does NOT collapse to card", () => {
    expect(resolveViewV2FromRaw(null)).toBeNull()
  })

  it("returns 'table' for a stored 'table'", () => {
    expect(resolveViewV2FromRaw("table")).toBe("table")
  })

  it("returns 'card' for a stored 'card' and for the legacy 'gallery'/'visual' aliases", () => {
    expect(resolveViewV2FromRaw("card")).toBe("card")
    expect(resolveViewV2FromRaw("gallery")).toBe("card")
    expect(resolveViewV2FromRaw("visual")).toBe("card")
  })

  it("backfill NEITHER-store case: v2.view is null, not 'card' — proves preservation end-to-end", () => {
    backfillShotsPrefsV2(CLIENT, PROJECT)
    expect(readV2()!.view).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Dual-write mirrors (build plan §1.2B) — each proves the mirror lands in v2
// WITHOUT touching (or requiring) the legacy key, and preserves whatever
// `_mig` marker state already existed.
// ---------------------------------------------------------------------------

describe("dual-write mirrors", () => {
  it("mirrorFieldsPatchToV2 updates v2.fields and preserves the existing _mig marker", () => {
    backfillShotsPrefsV2(CLIENT, PROJECT) // establishes _mig.v2: true baseline
    mirrorFieldsPatchToV2(CLIENT, PROJECT, { samples: true })

    const v2 = readV2()!
    expect(v2.fields.samples).toBe(true)
    expect(v2._mig.v2).toBe(true)
  })

  it("mirrorFieldsPatchToV2 before any backfill still writes a usable v2 blob (does not claim _mig.v2)", () => {
    mirrorFieldsPatchToV2(CLIENT, PROJECT, { notes: true })

    const v2 = readV2()!
    expect(v2.fields.notes).toBe(true)
    expect(v2._mig.v2).toBe(false)
  })

  it("mirrorViewToV2 updates v2.view without touching Store 2", () => {
    backfillShotsPrefsV2(CLIENT, PROJECT)
    mirrorViewToV2(CLIENT, PROJECT, "table")

    expect(readV2()!.view).toBe("table")
    expect(window.localStorage.getItem(viewV1Key(CLIENT, PROJECT))).toBeNull()
  })

  it("mirrorColumnWidthToV2 sets width, preserves prior order for that key", () => {
    backfillShotsPrefsV2(CLIENT, PROJECT)
    mirrorColumnOrderToV2(CLIENT, PROJECT, ["talent", "date"]) // date gets order 1
    mirrorColumnWidthToV2(CLIENT, PROJECT, "date", 321)

    expect(readV2()!.columns.date).toEqual({ width: 321, order: 1 })
  })

  it("mirrorColumnWidthToV2 falls back to the SHOT_TABLE_COLUMNS default order when no prior geometry exists", () => {
    backfillShotsPrefsV2(CLIENT, PROJECT)
    mirrorColumnWidthToV2(CLIENT, PROJECT, "talent", 999)

    const talentDefault = SHOT_TABLE_COLUMNS.find((c) => c.key === "talent")!
    expect(readV2()!.columns.talent).toEqual({ width: 999, order: talentDefault.order })
  })

  it("mirrorColumnOrderToV2 sets order per key by index, preserves prior widths", () => {
    backfillShotsPrefsV2(CLIENT, PROJECT)
    mirrorColumnWidthToV2(CLIENT, PROJECT, "date", 500)

    mirrorColumnOrderToV2(CLIENT, PROJECT, ["talent", "date", "notes"])

    const v2 = readV2()!
    expect(v2.columns.talent!.order).toBe(0)
    expect(v2.columns.date).toEqual({ width: 500, order: 1 })
    expect(v2.columns.notes!.order).toBe(2)
  })

  it("mirrorColumnVisibilityToV2 sets the mapped field, not the columns sidecar", () => {
    backfillShotsPrefsV2(CLIENT, PROJECT)
    mirrorColumnVisibilityToV2(CLIENT, PROJECT, "date", false)

    const v2 = readV2()!
    expect(v2.fields.date).toBe(false)
    expect(v2.columns.date).toBeUndefined()
  })

  it("mirrorColumnVisibilityToV2 is a no-op for pinned columns (shot/shotNumber — no field counterpart)", () => {
    backfillShotsPrefsV2(CLIENT, PROJECT)
    const before = readV2()

    mirrorColumnVisibilityToV2(CLIENT, PROJECT, "shot", false)
    mirrorColumnVisibilityToV2(CLIENT, PROJECT, "shotNumber", false)

    expect(readV2()).toEqual(before)
  })
})

// ---------------------------------------------------------------------------
// No sweeps in Phase 1 (build plan §1.3g) — every dual-write / backfill path
// above leaves Store 1/2/3 untouched when they existed; this suite adds one
// more explicit end-to-end check across all three at once.
// ---------------------------------------------------------------------------

describe("no sweeps", () => {
  it("all three legacy keys survive a full backfill + dual-write cycle", () => {
    seedFieldsV1({ ...DEFAULT_FIELDS })
    seedViewV1("card")
    seedTableV3(nonDefaultTableV3())

    backfillShotsPrefsV2(CLIENT, PROJECT)
    mirrorFieldsPatchToV2(CLIENT, PROJECT, { notes: true })
    mirrorViewToV2(CLIENT, PROJECT, "table")
    mirrorColumnWidthToV2(CLIENT, PROJECT, "date", 200)

    expect(window.localStorage.getItem(fieldsV1Key(CLIENT, PROJECT))).not.toBeNull()
    expect(window.localStorage.getItem(viewV1Key(CLIENT, PROJECT))).not.toBeNull()
    expect(window.localStorage.getItem(tableV3Key(CLIENT, PROJECT))).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// F3 — per-key patch semantics. `fieldsDelta` + `mirrorFieldsPatchToV2` are
// what let the card and table surfaces share one blob: each writes only the
// keys its own action changed, last write wins per key.
// ---------------------------------------------------------------------------

describe("fieldsDelta", () => {
  it("returns only the changed keys, with their NEW values", () => {
    const prev: ShotsListFields = { ...DEFAULT_FIELDS }
    const next: ShotsListFields = { ...DEFAULT_FIELDS, notes: true, talent: false }

    expect(fieldsDelta(prev, next)).toEqual({ notes: true, talent: false })
  })

  it("returns an empty patch for an unchanged object", () => {
    expect(fieldsDelta({ ...DEFAULT_FIELDS }, { ...DEFAULT_FIELDS })).toEqual({})
  })
})

describe("mirrorFieldsPatchToV2 — per-key patch, not whole-object replace", () => {
  it("leaves untouched keys alone (a card write cannot resurrect a table-hidden column)", () => {
    backfillShotsPrefsV2(CLIENT, PROJECT)
    mirrorColumnVisibilityToV2(CLIENT, PROJECT, "tags", false)

    mirrorFieldsPatchToV2(CLIENT, PROJECT, { description: false })

    const v2 = readV2()!
    expect(v2.fields.description).toBe(false)
    expect(v2.fields.tags).toBe(false) // NOT reverted to the card's idea of it
  })

  it("an empty patch writes nothing at all", () => {
    backfillShotsPrefsV2(CLIENT, PROJECT)
    const before = window.localStorage.getItem(prefsV2Key(CLIENT, PROJECT))

    mirrorFieldsPatchToV2(CLIENT, PROJECT, {})

    expect(window.localStorage.getItem(prefsV2Key(CLIENT, PROJECT))).toBe(before)
  })
})

// ---------------------------------------------------------------------------
// F2 — column reset (ShotsTable's `handleResetColumns` seam).
// ---------------------------------------------------------------------------

describe("resetColumnPrefsInV2", () => {
  it("clears geometry and returns COLUMN-domain fields to the column defaults", () => {
    seedTableV3(nonDefaultTableV3())
    backfillShotsPrefsV2(CLIENT, PROJECT)
    expect(Object.keys(readV2()!.columns).length).toBeGreaterThan(0)

    resetColumnPrefsInV2(CLIENT, PROJECT)

    const v2 = readV2()!
    expect(v2.columns).toEqual({})
    // Spelled out rather than re-derived from SHOT_TABLE_COLUMNS: three of
    // these (notes/links/updated) differ from DEFAULT_FIELDS, which is exactly
    // the mistake a reset that reached for DEFAULT_FIELDS would make.
    expect(v2.fields).toMatchObject({
      heroThumb: true,
      date: true,
      notes: true,
      location: true,
      products: true,
      links: true,
      talent: true,
      tags: true,
      launch: false,
      reqs: false,
      samples: false,
      updated: true,
      scene: false,
    })
  })

  it("does NOT touch card-only fields (description/readiness/shotNumber)", () => {
    backfillShotsPrefsV2(CLIENT, PROJECT)
    mirrorFieldsPatchToV2(CLIENT, PROJECT, { description: false, readiness: false, shotNumber: false })

    resetColumnPrefsInV2(CLIENT, PROJECT)

    const v2 = readV2()!
    expect(v2.fields.description).toBe(false)
    expect(v2.fields.readiness).toBe(false)
    expect(v2.fields.shotNumber).toBe(false)
  })

  it("preserves the marker, view and rawSnapshot", () => {
    seedFieldsV1({ ...DEFAULT_FIELDS })
    seedViewV1("table")
    backfillShotsPrefsV2(CLIENT, PROJECT)
    const before = readV2()!

    resetColumnPrefsInV2(CLIENT, PROJECT)

    const v2 = readV2()!
    expect(v2._mig.v2).toBe(true)
    expect(v2.view).toBe("table")
    expect(v2.rawSnapshot).toEqual(before.rawSnapshot)
  })
})

// ---------------------------------------------------------------------------
// F4 — a CORRUPT v2 blob must not be read-modify-written by any mirror. Doing
// so rewrites it with `_mig.v2: false` and `rawSnapshot: null`, destroying the
// marker AND the only recovery copy of the legacy stores. Mirrors skip; the
// next mount's backfill rebuilds from the (still authoritative) legacy stores.
// ---------------------------------------------------------------------------

describe("corrupt v2 blob", () => {
  const CORRUPT = '{"fields":{"notes":true},'

  function seedCorrupt(raw: string): void {
    window.localStorage.setItem(prefsV2Key(CLIENT, PROJECT), raw)
  }

  it.each([
    ["unparseable", CORRUPT],
    ["an array", '[{"key":"date"}]'],
    ["a JSON null", "null"],
    ["a JSON string", '"nope"'],
  ])("every mirror writes NOTHING when the blob is %s", (_label, raw) => {
    seedCorrupt(raw)

    mirrorFieldsPatchToV2(CLIENT, PROJECT, { notes: true })
    mirrorViewToV2(CLIENT, PROJECT, "table")
    mirrorColumnWidthToV2(CLIENT, PROJECT, "date", 321)
    mirrorColumnOrderToV2(CLIENT, PROJECT, ["talent", "date"])
    mirrorColumnVisibilityToV2(CLIENT, PROJECT, "date", false)
    resetColumnPrefsInV2(CLIENT, PROJECT)

    expect(window.localStorage.getItem(prefsV2Key(CLIENT, PROJECT))).toBe(raw)
  })

  it("the NEXT backfill rebuilds it from the legacy stores (corrupt reads as unstamped)", () => {
    const fields: ShotsListFields = { ...DEFAULT_FIELDS, launch: true }
    seedFieldsV1(fields)
    seedCorrupt(CORRUPT)

    backfillShotsPrefsV2(CLIENT, PROJECT)

    const v2 = readV2()!
    expect(v2._mig.v2).toBe(true)
    expect(v2.fields).toEqual(fields)
    expect(v2.rawSnapshot?.fieldsV1).toBe(JSON.stringify(fields))
  })

  it("an ABSENT blob is not corrupt — mirrors still write it (that distinction is the point)", () => {
    mirrorFieldsPatchToV2(CLIENT, PROJECT, { notes: true })

    expect(readV2()!.fields.notes).toBe(true)
  })
})
