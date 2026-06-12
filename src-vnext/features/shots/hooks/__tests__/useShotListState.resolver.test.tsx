import { describe, it, expect, vi, beforeEach } from "vitest"
import { act } from "react"
import { renderHook } from "@testing-library/react"
import { MemoryRouter, useLocation } from "react-router-dom"
import type { ReactNode } from "react"
import { useShotListState, type ShotListSurfaceContext } from "../useShotListState"
import { normalizeRole } from "@/shared/lib/rbac"

// ---------------------------------------------------------------------------
// Phase 4 flag-ON integration — featureSurfaceResolver wired into
// useShotListState via the optional, additive `surfaceContext` param.
//
// Companion to useShotListState.surface.test.tsx (the flag-OFF
// characterization file). Proves:
//   - flag-on producers resolve the table default (never-customized only)
//   - flag-on is INERT for crew/warehouse/viewer (same resolution as legacy)
//   - precedence: URL > stored explicit choice > surface default, device
//     forcing last + non-destructive (zero setSearchParams writes)
//   - resolution is GATED on auth loading (surfaceContext === null → legacy,
//     no viewer-flash)
//   - flag-off with surfaceContext provided stays legacy (the flag gates)
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  isMobile: false,
  flagOn: true,
  setSearchParamsCalls: [] as unknown[][],
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => mocks.isMobile,
}))

vi.mock("@/shared/lib/flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib/flags")>()
  return {
    ...actual,
    isFeatureEnabled: (flag: keyof import("@/shared/lib/flags").FeatureFlags) =>
      flag === "featureSurfaceResolver" ? mocks.flagOn : actual.isFeatureEnabled(flag),
  }
})

// Wrap the REAL useSearchParams so every setter invocation is recorded
// (same pattern as the characterization file).
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

function setup(search = "", surfaceContext?: ShotListSurfaceContext | null) {
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
  const view = renderHook(() => useShotListState({ ...PARAMS, surfaceContext }), { wrapper })
  return { view, getSearch: () => currentSearch }
}

beforeEach(() => {
  mocks.isMobile = false
  mocks.flagOn = true
  mocks.setSearchParamsCalls.length = 0
  window.localStorage.clear()
})

describe("useShotListState — featureSurfaceResolver flag-ON integration", () => {
  it("never-customized producer on desktop resolves the table default (surface-default provenance)", () => {
    const { view, getSearch } = setup("", { role: "producer", device: "desktop" })

    expect(view.result.current.viewMode).toBe("table")
    expect(view.result.current.groupKey).toBe("none")
    expect(view.result.current.surface).toBe("plan-build")
    expect(view.result.current.viewSource).toBe("surface-default")
    // Pure derivation — zero writes, URL untouched.
    view.rerender()
    expect(mocks.setSearchParamsCalls).toHaveLength(0)
    expect(getSearch()).toBe("")
  })

  it("producer who explicitly chose cards (stored :view:v1='card') KEEPS cards", () => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, "card")
    const { view } = setup("", { role: "producer", device: "desktop" })

    expect(view.result.current.viewMode).toBe("card")
    expect(view.result.current.viewSource).toBe("stored")
  })

  it("URL param beats the stored choice (precedence: url > stored > surface default)", () => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, "table")
    const { view } = setup("?view=card", { role: "producer", device: "desktop" })

    expect(view.result.current.viewMode).toBe("card")
    expect(view.result.current.viewSource).toBe("url")
  })

  it("flag-on is INERT for crew/warehouse/viewer: resolution identical to legacy (card default)", () => {
    const cases = [
      { role: "crew", surface: "shoot" },
      { role: "warehouse", surface: "review-warehouse" },
      { role: "viewer", surface: "review-client" },
    ] as const

    for (const { role, surface } of cases) {
      window.localStorage.clear()
      const { view } = setup("", { role, device: "desktop" })
      expect(view.result.current.viewMode).toBe("card")
      expect(view.result.current.groupKey).toBe("none")
      expect(view.result.current.surface).toBe(surface)
      view.unmount()
    }
  })

  it("mobile forcing stays override-without-erase under flag-on: latent ?view=table&group=status survive, zero writes", () => {
    mocks.isMobile = true
    const { view, getSearch } = setup("?view=table&group=status", { role: "producer", device: "mobile" })
    view.rerender()

    expect(view.result.current.viewMode).toBe("card")
    expect(view.result.current.groupKey).toBe("none")
    expect(view.result.current.viewSource).toBe("device-forced")

    const params = new URLSearchParams(getSearch())
    expect(params.get("view")).toBe("table")
    expect(params.get("group")).toBe("status")
    expect(mocks.setSearchParamsCalls).toHaveLength(0)
  })

  it("GATES on auth loading: surfaceContext null → legacy resolution, no surface (no viewer-flash)", () => {
    const { view } = setup("", null)

    // Legacy default (card), NOT the producer table default and NOT a
    // viewer-surface resolution from AuthProvider's 'viewer' loading fallback.
    expect(view.result.current.viewMode).toBe("card")
    expect(view.result.current.surface).toBeUndefined()
    expect(view.result.current.viewSource).toBeUndefined()
  })

  it("flag-OFF with surfaceContext provided stays byte-identical legacy (flag gates the resolver)", () => {
    mocks.flagOn = false
    const { view, getSearch } = setup("", { role: "producer", device: "desktop" })
    view.rerender()

    expect(view.result.current.viewMode).toBe("card") // legacy default, no table flip
    expect(view.result.current.groupKey).toBe("none")
    expect(view.result.current.surface).toBeUndefined()
    expect(view.result.current.viewSource).toBeUndefined()
    expect(mocks.setSearchParamsCalls).toHaveLength(0)
    expect(getSearch()).toBe("")
  })

  it("legacy 'wardrobe' claim (normalized) lands on review-warehouse, not the viewer surface", () => {
    const { view } = setup("", { role: normalizeRole("wardrobe"), device: "desktop" })

    expect(view.result.current.surface).toBe("review-warehouse")
    expect(view.result.current.viewMode).toBe("card") // inert: card, same as legacy
  })

  // ── 5e-III View-as preview: previewActive suppresses url/stored rungs ──────

  it("previewActive suppresses a stored 'table' choice: crew preview resolves the shoot surface (card), not the previewer's table", () => {
    // The previewing producer has explicitly chosen 'table' for their own
    // plan-build view. Under preview (previewActive) that stored choice must NOT
    // outrank the previewed shoot surface default — otherwise the shell is
    // masked by the previewer's own 'table'.
    window.localStorage.setItem(VIEW_STORAGE_KEY, "table")
    const { view, getSearch } = setup("", {
      role: "crew",
      device: "desktop",
      previewActive: true,
    })

    expect(view.result.current.surface).toBe("shoot")
    expect(view.result.current.viewMode).toBe("card") // stored 'table' suppressed
    expect(view.result.current.groupKey).toBe("none")

    // Still a pure derivation under preview — zero URL writes, zero localStorage
    // writes (the stored key is untouched, NOT cleared).
    view.rerender()
    expect(mocks.setSearchParamsCalls).toHaveLength(0)
    expect(getSearch()).toBe("")
    expect(window.localStorage.getItem(VIEW_STORAGE_KEY)).toBe("table")
  })

  it("setViewMode still writes URL + localStorage identically under flag-on (setters untouched)", () => {
    const { view, getSearch } = setup("", { role: "producer", device: "desktop" })

    expect(view.result.current.viewMode).toBe("table")
    // Producer explicitly switches to cards…
    act(() => view.result.current.setViewMode("card"))
    view.rerender()

    expect(new URLSearchParams(getSearch()).get("view")).toBe("card")
    expect(window.localStorage.getItem(VIEW_STORAGE_KEY)).toBe("card")
    expect(view.result.current.viewMode).toBe("card")
    expect(view.result.current.viewSource).toBe("url")
    // Exactly the one explicit user write — nothing from resolution itself.
    expect(mocks.setSearchParamsCalls).toHaveLength(1)
  })
})
