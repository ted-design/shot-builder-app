import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { SidebarNavItem } from "./SidebarNavItem"
import type { NavItem } from "./nav-config"

// Mock tooltip to avoid Radix portal issues in jsdom
vi.mock("@/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}))

const dashboardItem: NavItem = {
  label: "Dashboard",
  to: "/projects",
  iconName: "layout-grid",
}

const shotsItem: NavItem = {
  label: "Shots",
  to: "/projects/p1/shots",
  iconName: "camera",
  surfaceBadge: "Limited",
}

function renderWithRouter(ui: React.ReactElement, initialEntries = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>,
  )
}

describe("SidebarNavItem", () => {
  it("renders label when not collapsed", () => {
    renderWithRouter(
      <SidebarNavItem item={dashboardItem} collapsed={false} />,
    )
    expect(screen.getByText("Dashboard")).toBeInTheDocument()
  })

  it("hides label span when collapsed (only shows in tooltip)", () => {
    renderWithRouter(
      <SidebarNavItem item={dashboardItem} collapsed={true} />,
    )
    // The label text only appears inside the tooltip, not as a visible span in the link
    const tooltip = screen.getByTestId("tooltip-content")
    expect(tooltip).toHaveTextContent("Dashboard")
    // No separate span with the label inside the link
    const link = screen.getByRole("link")
    expect(link.querySelector("span.truncate")).toBeNull()
  })

  it("shows tooltip content when collapsed", () => {
    renderWithRouter(
      <SidebarNavItem item={dashboardItem} collapsed={true} />,
    )
    expect(screen.getByTestId("tooltip-content")).toHaveTextContent("Dashboard")
  })

  it("applies active bar when route matches", () => {
    const { container } = renderWithRouter(
      <SidebarNavItem item={dashboardItem} collapsed={false} />,
      ["/projects"],
    )
    // Active bar is an absolute-positioned span with the indicator background
    const activeBar = container.querySelector(
      ".bg-\\[var\\(--color-sidebar-indicator\\)\\]",
    )
    expect(activeBar).toBeInTheDocument()
  })

  it("does not apply active bar when route does not match", () => {
    const { container } = renderWithRouter(
      <SidebarNavItem item={dashboardItem} collapsed={false} />,
      ["/products"],
    )
    const activeBar = container.querySelector(
      ".bg-\\[var\\(--color-sidebar-indicator\\)\\]",
    )
    expect(activeBar).not.toBeInTheDocument()
  })

  it("shows surface badge when showBadge is true", () => {
    renderWithRouter(
      <SidebarNavItem
        item={shotsItem}
        collapsed={false}
        showBadge={true}
      />,
    )
    expect(screen.getByText("Limited")).toBeInTheDocument()
  })

  it("hides surface badge when showBadge is false", () => {
    renderWithRouter(
      <SidebarNavItem
        item={shotsItem}
        collapsed={false}
        showBadge={false}
      />,
    )
    expect(screen.queryByText("Limited")).not.toBeInTheDocument()
  })

  it("calls onNavigate when clicked", () => {
    const onNavigate = vi.fn()
    renderWithRouter(
      <SidebarNavItem
        item={dashboardItem}
        collapsed={false}
        onNavigate={onNavigate}
      />,
    )
    const link = screen.getByText("Dashboard")
    fireEvent.click(link)
    expect(onNavigate).toHaveBeenCalledTimes(1)
  })
})
