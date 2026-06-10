import { describe, it, expect, vi, beforeEach } from "vitest"
import { renderHook } from "@testing-library/react"
import { MemoryRouter, useLocation } from "react-router-dom"
import type { ReactNode } from "react"
import { useShotListState } from "../useShotListState"

// ---------------------------------------------------------------------------
// CHARACTERIZATION TESTS — Phase 4 first commit (build spec §Test plan item 1).
//
// These pin TODAY's view/group resolution behavior in useShotListState BEFORE
// the resolveSurface refactor. They describe current trunk behavior, not the
// future API:
//
//   1. Mobile forcing: isMobile=true forces viewMode 'card' + groupKey 'none'
//      regardless of ?view=table&group=status (useShotListState.ts:269-282).
//   2. Override-without-erase: that forcing is a pure derivation — the latent
//      URL params survive untouched (no setSearchParams write).
//   3. Desktop respects URL: isMobile=false + ?view=table&group=status
//      resolves table/status.
//   4. Stored view: localStorage `sb:shots:list:{clientId}:{projectId}:view:v1`
//      = 'table' is the no-URL-param default on desktop; mobile still forces
//      card.
//   5. Zero mount writes: mounting with clean modern params performs NO
//      setSearchParams call. The legacy-param migration
//      (useShotListState.ts:149-160) is the ONLY allowlisted mount write,
//      pinned by its own test below.
// ---------------------------------------------------------------------------

// Mutable controls referenced by hoisted module mocks.
const mocks = vi.hoisted(() => ({
  isMobile: false,
  setSearchParamsCalls: [] as unknown[][],
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => mocks.isMobile,
}))

// Wrap the REAL useSearchParams so every setter invocation is recorded.
// The setter identity is memoized per underlying setter so hook effect
// dependency behavior matches production.
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>()
  const { useMemo } = await import("react")
  const useSearchParamsSpy: typeof actual.useSearchParams = (...hookArgs) => {
    const [params, setParams] = actual.useSearchParams(...hookArgs)
    const wrapped = useMemo(() => {
      const fn: typeof setParams = (...args) => {
        mocks.setSearchParamsCalls.push(args)
        return setParams(...args)
      }
      return fn
    }, [setParams])
    return [params, wrapped]
  }
  return { ...actual, useSearchParams: useSearchParamsSpy }
})

const PARAMS = {
  shots: [],
  reorderOptimistic: null,
  clientId: "test-client",
  projectId: "p1",
  talentNameById: new Map<string, string>(),
  locationNameById: new Map<string, string>(),
  productNameById: new Map<string, string>(),
} as const

const VIEW_STORAGE_KEY = "sb:shots:list:test-client:p1:view:v1"

/** Renders the hook AND a location probe so we can read the live URL search. */
function setup(search = "") {
  let currentSearch = ""
  function Probe() {
    currentSearch = useLocation().search
    return null
  }
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[`/projects/p1/shots${search}`]}>
      {children}
      <Probe />
    </MemoryRouter>
  )
  const view = renderHook(() => useShotListState({ ...PARAMS }), { wrapper })
  return {
    view,
    getSearch: () => currentSearch,
  }
}

beforeEach(() => {
  mocks.isMobile = false
  mocks.setSearchParamsCalls.length = 0
  window.localStorage.clear()
})

describe("useShotListState — surface characterization (pre-resolveSurface)", () => {
  it("mobile forces viewMode 'card' and groupKey 'none' even with ?view=table&group=status", () => {
    mocks.isMobile = true
    const { view } = setup("?view=table&group=status")

    expect(view.result.current.viewMode).toBe("card")
    expect(view.result.current.groupKey).toBe("none")
  })

  it("mobile forcing is override-without-erase: latent ?view=table&group=status survive with zero writes", () => {
    mocks.isMobile = true
    const { view, getSearch } = setup("?view=table&group=status")
    view.rerender()

    // The forced card/none derivation never touched the URL...
    const params = new URLSearchParams(getSearch())
    expect(params.get("view")).toBe("table")
    expect(params.get("group")).toBe("status")
    // ...and no setSearchParams write of any kind occurred.
    expect(mocks.setSearchParamsCalls).toHaveLength(0)
  })

  it("desktop respects URL: ?view=table&group=status resolves table/status", () => {
    mocks.isMobile = false
    const { view } = setup("?view=table&group=status")

    expect(view.result.current.viewMode).toBe("table")
    expect(view.result.current.groupKey).toBe("status")
  })

  it("stored view 'table' (localStorage :view:v1) is the default on desktop when no ?view param", () => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, "table")
    mocks.isMobile = false
    const { view } = setup()

    expect(view.result.current.viewMode).toBe("table")
  })

  it("stored view 'table' is still forced to 'card' on mobile", () => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, "table")
    mocks.isMobile = true
    const { view } = setup()

    expect(view.result.current.viewMode).toBe("card")
  })

  it("mounting with clean modern params performs ZERO setSearchParams writes", () => {
    mocks.isMobile = false
    const { view, getSearch } = setup("?view=table&group=status&filters=missing.in:products&q=hello&sort=name")
    view.rerender()

    expect(mocks.setSearchParamsCalls).toHaveLength(0)
    // URL byte-identical to what we mounted with.
    const params = new URLSearchParams(getSearch())
    expect(params.get("view")).toBe("table")
    expect(params.get("group")).toBe("status")
    expect(params.get("filters")).toBe("missing.in:products")
    expect(params.get("q")).toBe("hello")
    expect(params.get("sort")).toBe("name")
  })

  it("mounting with no params at all performs ZERO setSearchParams writes", () => {
    const { view, getSearch } = setup()
    view.rerender()

    expect(mocks.setSearchParamsCalls).toHaveLength(0)
    expect(getSearch()).toBe("")
  })

  it("ALLOWLISTED EXCEPTION: legacy flat params migrate to `filters` in exactly one replace-write on mount", () => {
    const { view, getSearch } = setup("?status=todo,in_progress&missing=products")
    view.rerender()

    // Exactly one write — the legacy migration (useShotListState.ts:149-160).
    expect(mocks.setSearchParamsCalls).toHaveLength(1)
    const [, options] = mocks.setSearchParamsCalls[0] as [unknown, { replace?: boolean }]
    expect(options?.replace).toBe(true)

    // Legacy params consumed, single consolidated `filters` param written.
    const params = new URLSearchParams(getSearch())
    expect(params.get("status")).toBeNull()
    expect(params.get("missing")).toBeNull()
    expect(params.get("filters")).toBe("status.in:todo,in_progress;missing.in:products")

    // The migrated conditions are live in hook state.
    expect(Array.from(view.result.current.statusFilter).sort()).toEqual(["in_progress", "todo"])
    expect(Array.from(view.result.current.missingFilter)).toEqual(["products"])
  })
})
