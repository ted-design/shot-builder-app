import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { ResponsiveDialog } from "./ResponsiveDialog"

// Mock useMediaQuery to control isMobile
const mockUseIsMobile = vi.fn(() => false)

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => mockUseIsMobile(),
  useIsDesktop: () => !mockUseIsMobile(),
  useIsTablet: () => false,
  useMediaQuery: () => false,
}))

describe("ResponsiveDialog", () => {
  beforeEach(() => {
    mockUseIsMobile.mockReturnValue(false)
  })

  it("renders Dialog on desktop", () => {
    mockUseIsMobile.mockReturnValue(false)
    render(
      <ResponsiveDialog open title="Test Title" onOpenChange={() => {}}>
        <p>Dialog content</p>
      </ResponsiveDialog>,
    )
    // Title appears in both DialogTitle and sr-only DialogDescription
    expect(screen.getAllByText("Test Title").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Dialog content")).toBeInTheDocument()
  })

  it("renders Sheet on mobile", () => {
    mockUseIsMobile.mockReturnValue(true)
    render(
      <ResponsiveDialog open title="Mobile Title" onOpenChange={() => {}}>
        <p>Sheet content</p>
      </ResponsiveDialog>,
    )
    // Title appears in both SheetTitle and sr-only SheetDescription
    expect(screen.getAllByText("Mobile Title").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Sheet content")).toBeInTheDocument()
  })

  it("renders footer when provided", () => {
    render(
      <ResponsiveDialog
        open
        title="With Footer"
        onOpenChange={() => {}}
        footer={<button>Save</button>}
      >
        <p>Body</p>
      </ResponsiveDialog>,
    )
    expect(screen.getByText("Save")).toBeInTheDocument()
  })

  it("renders footer on mobile too", () => {
    mockUseIsMobile.mockReturnValue(true)
    render(
      <ResponsiveDialog
        open
        title="Mobile Footer"
        onOpenChange={() => {}}
        footer={<button>Submit</button>}
      >
        <p>Body</p>
      </ResponsiveDialog>,
    )
    expect(screen.getByText("Submit")).toBeInTheDocument()
  })

  it("does not render when closed", () => {
    render(
      <ResponsiveDialog open={false} title="Hidden" onOpenChange={() => {}}>
        <p>Hidden content</p>
      </ResponsiveDialog>,
    )
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument()
    expect(screen.queryByText("Hidden content")).not.toBeInTheDocument()
  })

  it("renders sr-only description on desktop", () => {
    mockUseIsMobile.mockReturnValue(false)
    render(
      <ResponsiveDialog
        open
        title="Described"
        description="Accessible description"
        onOpenChange={() => {}}
      >
        <p>Content</p>
      </ResponsiveDialog>,
    )
    const desc = screen.getByText("Accessible description")
    expect(desc).toBeInTheDocument()
    expect(desc).toHaveClass("sr-only")
  })

  it("renders sr-only description on mobile", () => {
    mockUseIsMobile.mockReturnValue(true)
    render(
      <ResponsiveDialog
        open
        title="Described"
        description="Mobile accessible description"
        onOpenChange={() => {}}
      >
        <p>Content</p>
      </ResponsiveDialog>,
    )
    const desc = screen.getByText("Mobile accessible description")
    expect(desc).toBeInTheDocument()
    expect(desc).toHaveClass("sr-only")
  })
})
