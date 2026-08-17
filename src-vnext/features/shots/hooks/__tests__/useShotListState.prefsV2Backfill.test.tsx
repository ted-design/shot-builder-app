// Phase 1 — v2 prefs backfill invocation + StrictMode safety + per-project
// isolation + dual-write, exercised through the REAL useShotListState hook
// (not just the pure migrateShotsPrefsV2 functions — see that module's own
// test file for the case-matrix/idempotency/rawSnapshot coverage). This
// file proves the useEffect WIRING in useShotListState.ts actually invokes
// the backfill, survives a React StrictMode double-invoke, and correctly
// scopes per (clientId, projectId) rather than firing once for the whole
// component lifetime.
import { StrictMode } from "react"
import { describe, it, expect, beforeEach } from "vitest"
import { act } from "react"
import { renderHook } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import type { ReactNode } from "react"
import { useShotListState } from "../useShotListState"
import { DEFAULT_FIELDS, type ShotsListFields } from "@/features/shots/lib/shotListFilters"
import { fieldsV1Key, prefsV2Key, type ShotsPrefsV2 } from "@/features/shots/lib/migrateShotsPrefsV2"

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

  it("StrictMode double-mount: single effective backfill, Store 1 not destructively touched", () => {
    const nonDefault: ShotsListFields = { ...DEFAULT_FIELDS, launch: true }
    window.localStorage.setItem(fieldsV1Key("c1", "p1"), JSON.stringify(nonDefault))
    const rawBefore = window.localStorage.getItem(fieldsV1Key("c1", "p1"))

    setup("c1", "p1", /* strict */ true)

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

  it("dual-write: setFields updates v2.fields via the [fields] persist effect", () => {
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
