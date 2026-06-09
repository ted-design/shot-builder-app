import { describe, it, expect } from "vitest"
import { act } from "react"
import { renderHook } from "@testing-library/react"
import { MemoryRouter, useLocation } from "react-router-dom"
import type { ReactNode } from "react"
import { useShotListState } from "../useShotListState"
import type { MissingKey } from "@/features/shots/lib/shotListFilters"

// ---------------------------------------------------------------------------
// toggleMissing + clearMissingFilter round-trip through the URL `filters` param.
//
// The Missing inline filter is persisted exclusively as a single condition
// `missing.in:<keys>` in the URL (per the URL-as-state contract). This proves
// the convenience callbacks (toggleMissing / clearMissingFilter) write that
// param, that the derived `missingFilter` set reflects it, and that clearing
// removes the param entirely (param-absence, not `missing.in:`).
// ---------------------------------------------------------------------------

const PARAMS = {
  shots: [],
  reorderOptimistic: null,
  clientId: "test-client",
  projectId: "p1",
  talentNameById: new Map<string, string>(),
  locationNameById: new Map<string, string>(),
  productNameById: new Map<string, string>(),
} as const

/** Renders the hook AND a location probe so we can read the live URL search. */
function setup() {
  let search = ""
  function Probe() {
    search = useLocation().search
    return null
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={["/projects/p1/shots"]}>
      {children}
      <Probe />
    </MemoryRouter>
  )
  const view = renderHook(() => useShotListState({ ...PARAMS }), { wrapper })
  return {
    view,
    getSearch: () => search,
  }
}

function asArray(set: ReadonlySet<MissingKey>): MissingKey[] {
  return Array.from(set).sort()
}

describe("useShotListState — missing filter URL round-trip", () => {
  it("toggleMissing adds a key, persists it to the filters param, and reflects it in missingFilter", () => {
    const { view, getSearch } = setup()

    expect(asArray(view.result.current.missingFilter)).toEqual([])

    act(() => view.result.current.toggleMissing("products"))
    view.rerender()

    expect(asArray(view.result.current.missingFilter)).toEqual(["products"])
    const params = new URLSearchParams(getSearch())
    expect(params.get("filters")).toBe("missing.in:products")
  })

  it("toggleMissing accumulates multiple keys into one missing.in condition", () => {
    const { view, getSearch } = setup()

    act(() => view.result.current.toggleMissing("products"))
    view.rerender()
    act(() => view.result.current.toggleMissing("talent"))
    view.rerender()

    expect(asArray(view.result.current.missingFilter)).toEqual(["products", "talent"])
    const params = new URLSearchParams(getSearch())
    // A single condition carries both keys, comma-joined (order = toggle order).
    expect(params.get("filters")).toBe("missing.in:products,talent")
  })

  it("toggleMissing twice on the same key removes it (and drops the param when empty)", () => {
    const { view, getSearch } = setup()

    act(() => view.result.current.toggleMissing("location"))
    view.rerender()
    expect(asArray(view.result.current.missingFilter)).toEqual(["location"])

    act(() => view.result.current.toggleMissing("location"))
    view.rerender()

    expect(asArray(view.result.current.missingFilter)).toEqual([])
    const params = new URLSearchParams(getSearch())
    // Param-absence, NOT an empty `missing.in:` segment.
    expect(params.get("filters")).toBeNull()
  })

  it("clearMissingFilter removes the missing condition entirely", () => {
    const { view, getSearch } = setup()

    act(() => view.result.current.toggleMissing("image"))
    view.rerender()
    act(() => view.result.current.toggleMissing("talent"))
    view.rerender()
    expect(asArray(view.result.current.missingFilter)).toEqual(["image", "talent"])

    act(() => view.result.current.clearMissingFilter())
    view.rerender()

    expect(asArray(view.result.current.missingFilter)).toEqual([])
    const params = new URLSearchParams(getSearch())
    expect(params.get("filters")).toBeNull()
  })

  it("clearMissingFilter leaves a co-existing status condition untouched", () => {
    const { view, getSearch } = setup()

    act(() => view.result.current.toggleStatus("in_progress"))
    view.rerender()
    act(() => view.result.current.toggleMissing("products"))
    view.rerender()

    // Both conditions present.
    let params = new URLSearchParams(getSearch())
    expect(params.get("filters")).toContain("status.in:in_progress")
    expect(params.get("filters")).toContain("missing.in:products")

    act(() => view.result.current.clearMissingFilter())
    view.rerender()

    // Missing gone, status survives.
    expect(asArray(view.result.current.missingFilter)).toEqual([])
    expect(Array.from(view.result.current.statusFilter)).toEqual(["in_progress"])
    params = new URLSearchParams(getSearch())
    expect(params.get("filters")).toBe("status.in:in_progress")
  })
})
