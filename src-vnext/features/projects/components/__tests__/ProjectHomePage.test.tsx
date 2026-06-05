/// <reference types="@testing-library/jest-dom" />
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { Project } from "@/shared/types"

vi.mock("@/app/providers/ProjectScopeProvider", () => ({
  useProjectScope: () => ({ projectId: "p1", projectName: "Q2-26 No. 3" }),
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ clientId: "c1" }),
}))

const mockUseProject = vi.fn()
vi.mock("@/features/projects/hooks/useProject", () => ({
  useProject: (id: string | null) => mockUseProject(id),
}))

// Data hooks — default to empty collections; the page orchestrates them.
const mockUseShots = vi.fn(() => ({ data: [] }))
const mockUseLanes = vi.fn(() => ({ data: [] }))
const mockUseCastingBoard = vi.fn(() => ({ entries: [] }))
const mockUsePulls = vi.fn(() => ({ data: [] }))
const mockUseSchedules = vi.fn(() => ({ data: [] }))
const mockUseScheduleEntries = vi.fn(() => ({ data: [] }))

vi.mock("@/features/shots/hooks/useShots", () => ({ useShots: () => mockUseShots() }))
vi.mock("@/features/shots/hooks/useLanes", () => ({ useLanes: () => mockUseLanes() }))
vi.mock("@/features/casting/hooks/useCastingBoard", () => ({
  useCastingBoard: (...args: unknown[]) => mockUseCastingBoard(...(args as [])),
}))
vi.mock("@/features/pulls/hooks/usePulls", () => ({ usePulls: () => mockUsePulls() }))
vi.mock("@/features/schedules/hooks/useSchedules", () => ({
  useSchedules: (...args: unknown[]) => mockUseSchedules(...(args as [])),
}))
vi.mock("@/features/schedules/hooks/useScheduleEntries", () => ({
  useScheduleEntries: (...args: unknown[]) => mockUseScheduleEntries(...(args as [])),
}))

// Leaf section components — stubbed so this test stays focused on the page's
// orchestration (prop wiring), not each section's internals.
vi.mock("@/features/projects/components/home/ProjectHero", () => ({
  ProjectHero: ({ project }: { project: Project }) => (
    <div data-testid="project-hero">
      <h1>{project.name}</h1>
      <span>{project.status}</span>
    </div>
  ),
}))
vi.mock("@/features/projects/components/home/StatusLedger", () => ({
  StatusLedger: ({ rows }: { rows: readonly unknown[] }) => (
    <div data-testid="status-ledger" data-rows={rows.length} />
  ),
}))
vi.mock("@/features/projects/components/home/NextActionBar", () => ({
  NextActionBar: ({ action }: { action: { label: string } | null }) =>
    action ? <div data-testid="next-action">{action.label}</div> : null,
}))
vi.mock("@/features/projects/components/home/CrewRoster", () => ({
  CrewRoster: () => <div data-testid="crew-roster" />,
}))
vi.mock("@/features/projects/components/home/ProductsInShoot", () => ({
  ProductsInShoot: () => <div data-testid="products-in-shoot" />,
}))
vi.mock("@/features/projects/components/home/BriefCard", () => ({
  BriefCard: () => <div data-testid="brief-card" />,
}))
vi.mock("@/features/projects/components/home/ShootDaySchedule", () => ({
  ShootDaySchedule: () => <div data-testid="shoot-day-schedule" />,
}))

import ProjectHomePage from "@/features/projects/components/ProjectHomePage"

function makeProject(overrides: Partial<Project> = {}): Partial<Project> {
  return {
    id: "p1",
    name: "Q2-26 No. 3",
    clientId: "c1",
    status: "active",
    shootDates: ["2026-06-09"],
    ...overrides,
  }
}

describe("ProjectHomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseShots.mockReturnValue({ data: [] })
    mockUseLanes.mockReturnValue({ data: [] })
    mockUseCastingBoard.mockReturnValue({ entries: [] })
    mockUsePulls.mockReturnValue({ data: [] })
    mockUseSchedules.mockReturnValue({ data: [] })
    mockUseScheduleEntries.mockReturnValue({ data: [] })
  })

  it("renders the hero, ledger and secondary sections once the project loads", () => {
    mockUseProject.mockReturnValue({ data: makeProject(), loading: false })

    render(<ProjectHomePage />)

    expect(mockUseProject).toHaveBeenCalledWith("p1")
    expect(screen.getByTestId("project-hero")).toBeInTheDocument()
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Q2-26 No. 3")
    expect(screen.getByTestId("crew-roster")).toBeInTheDocument()
    expect(screen.getByTestId("products-in-shoot")).toBeInTheDocument()
    expect(screen.getByTestId("brief-card")).toBeInTheDocument()
    expect(screen.getByTestId("shoot-day-schedule")).toBeInTheDocument()
  })

  it("builds the five-stage ledger from the project's data", () => {
    mockUseProject.mockReturnValue({ data: makeProject(), loading: false })

    render(<ProjectHomePage />)

    expect(screen.getByTestId("status-ledger")).toHaveAttribute("data-rows", "5")
  })

  it("surfaces a next action for an empty project (no call sheet yet)", () => {
    mockUseProject.mockReturnValue({ data: makeProject(), loading: false })

    render(<ProjectHomePage />)

    // Priority order lands on the call-sheet gap before the shot-list gap.
    expect(screen.getByTestId("next-action")).toHaveTextContent("unsent-callsheet")
  })

  it("shows the loading skeleton before the project loads", () => {
    mockUseProject.mockReturnValue({ data: undefined, loading: true })

    render(<ProjectHomePage />)

    expect(screen.getByTestId("project-home-loading")).toBeInTheDocument()
    expect(screen.queryByTestId("project-hero")).not.toBeInTheDocument()
  })
})
