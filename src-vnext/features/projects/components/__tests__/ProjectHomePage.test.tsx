/// <reference types="@testing-library/jest-dom" />
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import type { Project } from "@/shared/types"

vi.mock("@/app/providers/ProjectScopeProvider", () => ({
  useProjectScope: () => ({ projectId: "p1", projectName: "Q2-26 No. 3" }),
}))

const mockUseProject = vi.fn()
vi.mock("@/features/projects/hooks/useProject", () => ({
  useProject: (id: string | null) => mockUseProject(id),
}))

vi.mock("@/shared/components/StatusBadge", () => ({
  StatusBadge: ({ label }: { readonly label: string }) => <span>{label}</span>,
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
  })

  it("renders the project name and status from useProject", () => {
    mockUseProject.mockReturnValue({ data: makeProject() })

    render(<ProjectHomePage />)

    expect(mockUseProject).toHaveBeenCalledWith("p1")
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Q2-26 No. 3")
    expect(screen.getByText("Active")).toBeInTheDocument()
  })

  it("renders a placeholder heading before the project loads", () => {
    mockUseProject.mockReturnValue({ data: undefined })

    render(<ProjectHomePage />)

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument()
    expect(screen.queryByText("Active")).not.toBeInTheDocument()
  })
})
