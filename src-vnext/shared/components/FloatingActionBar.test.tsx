import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { FloatingActionBar } from "./FloatingActionBar"

const mockUseIsDesktop = vi.fn(() => false)
const mocks = vi.hoisted(() => ({
  surface: "plan-build" as string | null,
  shootFlag: false,
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => !mockUseIsDesktop(),
  useIsDesktop: () => mockUseIsDesktop(),
  useIsTablet: () => false,
  useMediaQuery: () => false,
}))

// The component consults the resolved surface only to suppress itself on the
// Shoot shell (5e-II eyeball finding: the FAB overlapped the shell's sticky
// bottom status bar). Mock the hook directly — this chrome unit test renders
// without auth/role providers.
vi.mock("@/features/shots/hooks/useResolvedSurface", () => ({
  useResolvedSurface: () => ({
    surface: mocks.surface,
    affordances: null,
    chrome: null,
    resolving: false,
  }),
}))

vi.mock("@/shared/lib/flags", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib/flags")>()
  return {
    ...actual,
    isFeatureEnabled: (flag: string) =>
      flag === "featureShootSurface"
        ? mocks.shootFlag
        : actual.isFeatureEnabled(flag as never),
  }
})

function renderFab(route: string) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <FloatingActionBar />
    </MemoryRouter>,
  )
}

describe("FloatingActionBar", () => {
  beforeEach(() => {
    mockUseIsDesktop.mockReturnValue(false)
    mocks.surface = "plan-build"
    mocks.shootFlag = false
  })

  it("renders on shot list route for mobile", () => {
    renderFab("/projects/p1/shots")
    expect(screen.getByTestId("fab")).toBeInTheDocument()
    expect(screen.getByTestId("fab-main")).toBeInTheDocument()
  })

  it("renders on shot detail route for mobile", () => {
    renderFab("/projects/p1/shots/s1")
    expect(screen.getByTestId("fab")).toBeInTheDocument()
  })

  it("does NOT render on desktop", () => {
    mockUseIsDesktop.mockReturnValue(true)
    renderFab("/projects/p1/shots")
    expect(screen.queryByTestId("fab")).not.toBeInTheDocument()
  })

  it("does NOT render on non-matching routes", () => {
    renderFab("/projects")
    expect(screen.queryByTestId("fab")).not.toBeInTheDocument()
  })

  it("does NOT render on pull routes", () => {
    renderFab("/projects/p1/pulls")
    expect(screen.queryByTestId("fab")).not.toBeInTheDocument()
  })

  describe("Shoot shell suppression (5e-II)", () => {
    it("suppresses itself on the Shoot surface (flag on)", () => {
      mocks.shootFlag = true
      mocks.surface = "shoot"
      renderFab("/projects/p1/shots")
      expect(screen.queryByTestId("fab")).not.toBeInTheDocument()
    })

    it("still renders for plan-build surfaces with the flag on", () => {
      mocks.shootFlag = true
      renderFab("/projects/p1/shots")
      expect(screen.getByTestId("fab")).toBeInTheDocument()
    })

    it("does NOT suppress while the flag is off, even if the surface resolves shoot", () => {
      mocks.surface = "shoot"
      renderFab("/projects/p1/shots")
      expect(screen.getByTestId("fab")).toBeInTheDocument()
    })
  })
})
