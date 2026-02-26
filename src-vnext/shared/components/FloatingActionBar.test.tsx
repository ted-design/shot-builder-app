import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { FloatingActionBar } from "./FloatingActionBar"

const mockUseIsDesktop = vi.fn(() => false)

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => !mockUseIsDesktop(),
  useIsDesktop: () => mockUseIsDesktop(),
  useIsTablet: () => false,
  useMediaQuery: () => false,
}))

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
})
