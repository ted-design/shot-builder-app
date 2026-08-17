// Phase 1 — v2 prefs backfill invocation + StrictMode safety + per-project
// isolation + dual-write, exercised through the REAL useShotListState hook
// (not just the pure migrateShotsPrefsV2 functions — see that module's own
// test file for the case-matrix/idempotency/rawSnapshot coverage). This
// file proves the useEffect WIRING in useShotListState.ts actually invokes
// the backfill, survives a React StrictMode double-invoke, and correctly
// scopes per (clientId, projectId) rather than firing once for the whole
// component lifetime.
import { StrictMode } from "react"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { act } from "react"
import { renderHook } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import type { ReactNode } from "react"
import { useShotListState } from "../useShotListState"
import { DEFAULT_FIELDS, type ShotsListFields } from "@/features/shots/lib/shotListFilters"
import { SHOT_TABLE_COLUMNS } from "@/features/shots/lib/shotTableColumns"
import type { TableColumnConfig } from "@/shared/types/table"
import * as prefsV2Module from "@/features/shots/lib/migrateShotsPrefsV2"
import {
  fieldsV1Key,
  tableV3Key,
  prefsV2Key,
  type ShotsPrefsV2,
} from "@/features/shots/lib/migrateShotsPrefsV2"

// Partial module mock: everything real except a call-counting wrapper around
// `backfillShotsPrefsV2`. The StrictMode test below asserts the INVOCATION
// COUNT (see its comment for why a state-based assertion cannot see the
// double-invoke). `vi.fn(actual.…)` keeps the real implementation, so every
// other test in this file exercises the genuine backfill.
vi.mock("@/features/shots/lib/migrateShotsPrefsV2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/shots/lib/migrateShotsPrefsV2")>()
  return { ...actual, backfillShotsPrefsV2: vi.fn(actual.backfillShotsPrefsV2) }
})

const PARAMS = {
  shots: [],
  reorderOptimistic: null,
  talentNameById: new Map<string, string>(),
  locationNameById: new Map<string, string>(),
  productNameById: new Map<string, string>(),
} as const

function readV2(clientId: string, projectId: string): ShotsPrefsV2 | null {
  const raw = window.localStorage.getItem(prefsV2Key(clientId, projectId))
  return raw ? (JSON.parse(raw) as ShotsPrefsV2) : null
}

function setup(clientId: string, projectId: string, strict = false) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[`/projects/${projectId}/shots`]}>{children}</MemoryRouter>
  )
  const wrapper = strict
    ? ({ children }: { children: ReactNode }) => (
        <StrictMode>
          <Wrapper>{children}</Wrapper>
        </StrictMode>
      )
    : Wrapper
  return renderHook(() => useShotListState({ ...PARAMS, clientId, projectId }), { wrapper })
}

beforeEach(() => {
  window.localStorage.clear()
  vi.mocked(prefsV2Module.backfillShotsPrefsV2).mockClear()
})

// House rule (`testing-discipline.md`): restores live in afterEach ONLY —
// `mockRestore`/`mockReset` erase `mock.calls`, so a restore between act and
// assert makes any spy assertion pass unconditionally.
afterEach(() => {
  vi.restoreAllMocks()
})

describe("useShotListState — v2 backfill wiring", () => {
  it("mounting the hook backfills v2 for the real clientId/projectId, and the hook still loads the card fields", () => {
    const nonDefault: ShotsListFields = { ...DEFAULT_FIELDS, notes: true, talent: false }
    window.localStorage.setItem(fieldsV1Key("c1", "p1"), JSON.stringify(nonDefault))

    const { result } = setup("c1", "p1")

    expect(result.current.fields).toEqual(nonDefault) // legacy read path, unchanged
    const v2 = readV2("c1", "p1")
    expect(v2?._mig.v2).toBe(true)
    expect(v2?.fields).toEqual(nonDefault)
  })

  it("StrictMode double-mount: backfill runs exactly ONCE, Store 1 not destructively touched", () => {
    const nonDefault: ShotsListFields = { ...DEFAULT_FIELDS, launch: true }
    window.localStorage.setItem(fieldsV1Key("c1", "p1"), JSON.stringify(nonDefault))
    const rawBefore = window.localStorage.getItem(fieldsV1Key("c1", "p1"))

    setup("c1", "p1", /* strict */ true)

    // The falsifiable half. A state assertion cannot see a StrictMode re-run
    // at all: the marker gate makes the second pass a no-op AND the [fields]
    // persist effect rewrites Store 1 with byte-identical content, so
    // "Store 1 unchanged" stays green even with BOTH re-run guards deleted.
    // The invocation count is the only thing that reddens. Read `mock.calls`
    // here, BEFORE any restore (afterEach owns that).
    expect(vi.mocked(prefsV2Module.backfillShotsPrefsV2)).toHaveBeenCalledTimes(1)
    expect(vi.mocked(prefsV2Module.backfillShotsPrefsV2)).toHaveBeenCalledWith("c1", "p1")

    // Store 1 must still be present and byte-identical — a destructive
    // re-run under StrictMode's mount->unmount->mount would have wiped it
    // the same way the retired migrateOldColumnPrefs bug did.
    expect(window.localStorage.getItem(fieldsV1Key("c1", "p1"))).toBe(rawBefore)
    const v2 = readV2("c1", "p1")!
    expect(v2._mig.v2).toBe(true)
    expect(v2.fields).toEqual(nonDefault)
  })

  it("per-project isolation: switching projectId prop backfills the NEW project too (not a single-fire ref)", () => {
    window.localStorage.setItem(fieldsV1Key("c1", "pA"), JSON.stringify({ ...DEFAULT_FIELDS, notes: true }))
    window.localStorage.setItem(fieldsV1Key("c1", "pB"), JSON.stringify({ ...DEFAULT_FIELDS, launch: true }))

    const Wrapper = ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={["/projects/pA/shots"]}>{children}</MemoryRouter>
    )
    const { result, rerender } = renderHook(
      (props: { projectId: string }) => useShotListState({ ...PARAMS, clientId: "c1", projectId: props.projectId }),
      { wrapper: Wrapper, initialProps: { projectId: "pA" } },
    )

    expect(readV2("c1", "pA")?._mig.v2).toBe(true)
    expect(readV2("c1", "pB")).toBeNull() // not yet backfilled

    rerender({ projectId: "pB" })

    expect(result.current.fields.launch).toBe(true)
    expect(readV2("c1", "pB")?._mig.v2).toBe(true)
    expect(readV2("c1", "pB")?.fields.launch).toBe(true)
    // Project A's v2 blob is untouched by switching away from it.
    expect(readV2("c1", "pA")?.fields.notes).toBe(true)
  })

  it("dual-write: setFields updates v2.fields via the wrapped setter", () => {
    const { result } = setup("c1", "p1")

    act(() => result.current.setFields({ ...DEFAULT_FIELDS, samples: true }))

    expect(readV2("c1", "p1")?.fields.samples).toBe(true)
    // Legacy key still the one written too — dual-write, not a read-flip.
    const legacy = JSON.parse(window.localStorage.getItem(fieldsV1Key("c1", "p1"))!) as ShotsListFields
    expect(legacy.samples).toBe(true)
  })

  it("dual-write: setViewMode updates v2.view via the mirror", () => {
    const { result } = setup("c1", "p1")

    act(() => result.current.setViewMode("table"))

    expect(readV2("c1", "p1")?.view).toBe("table")
  })
})

// ---------------------------------------------------------------------------
// F1 — MOUNT-ECHO CLOBBER. The v2 fields mirror must fire on a WRITE, never
// as an echo of the hook's mount-time card state. Every fixture below is a
// PERSISTED BLOB seeded before render (never the empty/seed path), and every
// assertion reads v2 AFTER mount with no user interaction at all: whatever
// the backfill computed must still be there.
//
// The card `fields` state is derived from Store 1 alone, so on any project
// where Store 3 disagrees with Store 1 (or Store 1 is absent entirely) a
// mount-time mirror silently overwrites the backfill's answer with the card's.
// ---------------------------------------------------------------------------

/** Store 3's own default visibility, projected onto field keys. Differs from
 *  DEFAULT_FIELDS on exactly notes/links/updated — which is what makes the
 *  echo visible. Written as a literal (not re-derived through the module
 *  under test) so a wrong projection cannot satisfy both sides. */
const FIELDS_FROM_DEFAULT_COLUMNS: ShotsListFields = {
  ...DEFAULT_FIELDS,
  notes: true,
  links: true,
  updated: true,
}

function seedTableV3(clientId: string, projectId: string, cols: readonly TableColumnConfig[]): string {
  const raw = JSON.stringify(cols)
  window.localStorage.setItem(tableV3Key(clientId, projectId), raw)
  return raw
}

describe("useShotListState — v2 fields survive mount (no mount-echo clobber)", () => {
  it("(a) Store 3 present with DEFAULT columns, NO Store 1: v2.fields keeps the column-derived projection", () => {
    // The shape the retired destructive migration left behind: it forked
    // Store 1 into Store 3 and then deleted Store 1.
    const rawTable = seedTableV3("c1", "p1", SHOT_TABLE_COLUMNS)

    setup("c1", "p1")

    const v2 = readV2("c1", "p1")!
    expect(v2.fields).toEqual(FIELDS_FROM_DEFAULT_COLUMNS)
    expect(v2.fields).not.toEqual(DEFAULT_FIELDS) // the mount-echo's wrong answer

    // T4 — nothing on the write path touches geometry or the recovery
    // snapshot, so both must survive mount untouched as well.
    expect(v2.columns.date).toEqual({ width: 120, order: 3 })
    expect(Object.keys(v2.columns).length).toBe(SHOT_TABLE_COLUMNS.length)
    expect(v2.rawSnapshot).toEqual({ fieldsV1: null, tableV3: rawTable, viewV1: null })
  })

  it("(b) table-only user who hid `tags`: v2.fields.tags stays false after mount", () => {
    const cols = SHOT_TABLE_COLUMNS.map((c) => (c.key === "tags" ? { ...c, visible: false } : c))
    seedTableV3("c1", "p1", cols)

    setup("c1", "p1")

    const v2 = readV2("c1", "p1")!
    expect(v2.fields.tags).toBe(false)
    expect(v2.fields).toEqual({ ...FIELDS_FROM_DEFAULT_COLUMNS, tags: false })
  })

  it("(c) BOTH stores present and disagreeing: the OR-union survives mount, not Store 1 alone", () => {
    // Store 1: talent visible, date hidden.  Store 3: talent hidden, date visible.
    const store1: ShotsListFields = { ...DEFAULT_FIELDS, talent: true, date: false, description: false }
    window.localStorage.setItem(fieldsV1Key("c1", "p1"), JSON.stringify(store1))
    const cols = SHOT_TABLE_COLUMNS.map((c) => {
      if (c.key === "talent") return { ...c, visible: false }
      if (c.key === "date") return { ...c, visible: true }
      return c
    })
    seedTableV3("c1", "p1", cols)

    const { result } = setup("c1", "p1")

    // The card surface still reads Store 1 verbatim (no read flips this phase).
    expect(result.current.fields.date).toBe(false)

    const v2 = readV2("c1", "p1")!
    expect(v2.fields.date).toBe(true) // visible in Store 3 -> union true
    expect(v2.fields.talent).toBe(true) // visible in Store 1 -> union true
    expect(v2.fields.notes).toBe(true) // column default true, Store 1 false -> union true
    expect(v2.fields.description).toBe(false) // card-only: Store 1 alone
  })
})

// ---------------------------------------------------------------------------
// F3 — FIELDS OWNERSHIP. Each mirror patches ONLY the keys its own action
// changed; last write wins per key. A card-field toggle must not resurrect a
// column the user hid from the table popover, and vice versa.
// ---------------------------------------------------------------------------

describe("useShotListState — per-key field mirroring", () => {
  it("a card toggle patches only the changed key, leaving a table-hidden column hidden in v2", () => {
    seedTableV3("c1", "p1", SHOT_TABLE_COLUMNS)
    const { result } = setup("c1", "p1")

    // Simulate the table popover having hidden `tags` (ShotsTable's own
    // visibility mirror — same v2 blob, different surface).
    act(() => {
      prefsV2Module.mirrorColumnVisibilityToV2("c1", "p1", "tags", false)
    })
    expect(readV2("c1", "p1")!.fields.tags).toBe(false)

    // Now a CARD field toggle, built the way ShotListDisplaySheet builds it.
    act(() => result.current.setFields({ ...result.current.fields, description: false }))

    const v2 = readV2("c1", "p1")!
    expect(v2.fields.description).toBe(false) // the key the user changed
    expect(v2.fields.tags).toBe(false) // NOT resurrected by the card write
    expect(v2.fields.notes).toBe(true) // column-derived value preserved
  })

  it("last-write-wins per key: a later table toggle overrides the card's value for that key", () => {
    const { result } = setup("c1", "p1")

    act(() => result.current.setFields({ ...result.current.fields, talent: true }))
    act(() => {
      prefsV2Module.mirrorColumnVisibilityToV2("c1", "p1", "talent", false)
    })

    expect(readV2("c1", "p1")!.fields.talent).toBe(false)
  })
})
