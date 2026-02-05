/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { Timestamp } from "firebase/firestore"
import type { Project } from "@/shared/types"

vi.mock("@/features/projects/hooks/useProjects", () => ({
  useProjects: vi.fn(),
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ role: "producer" }),
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => false,
}))

vi.mock("@/features/projects/components/ProjectCard", () => ({
  ProjectCard: ({ project }: { readonly project: Project }) => (
    <div data-testid="project-card">{project.name}</div>
  ),
}))

vi.mock("@/features/projects/components/CreateProjectDialog", () => ({
  CreateProjectDialog: () => null,
}))

vi.mock("@/features/projects/components/EditProjectDialog", () => ({
  EditProjectDialog: () => null,
}))

import { useProjects } from "@/features/projects/hooks/useProjects"
import ProjectDashboard from "@/features/projects/components/ProjectDashboard"

function makeProject(overrides: Partial<Project>): Project {
  const now = Timestamp.fromMillis(Date.now())
  return {
    id: overrides.id ?? "p1",
    name: overrides.name ?? "Project",
    clientId: overrides.clientId ?? "c1",
    status: overrides.status ?? "active",
    shootDates: overrides.shootDates ?? [],
    notes: overrides.notes,
    briefUrl: overrides.briefUrl,
    deletedAt: overrides.deletedAt,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  }
}

function renderPage(initialEntry: string) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/projects" element={<ProjectDashboard />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe("ProjectDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("defaults to Active filter (hides archived/completed)", () => {
    ;(useProjects as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [
        makeProject({ id: "a", name: "Alpha", status: "active" }),
        makeProject({ id: "b", name: "Bravo", status: "archived" }),
        makeProject({ id: "c", name: "Charlie", status: "completed" }),
      ],
      loading: false,
      error: null,
    })

    renderPage("/projects")

    expect(screen.getByText("Alpha")).toBeInTheDocument()
    expect(screen.queryByText("Bravo")).not.toBeInTheDocument()
    expect(screen.queryByText("Charlie")).not.toBeInTheDocument()
  })

  it("supports filter=archived via URL", () => {
    ;(useProjects as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [
        makeProject({ id: "a", name: "Alpha", status: "active" }),
        makeProject({ id: "b", name: "Bravo", status: "archived" }),
      ],
      loading: false,
      error: null,
    })

    renderPage("/projects?filter=archived")

    expect(screen.queryByText("Alpha")).not.toBeInTheDocument()
    expect(screen.getByText("Bravo")).toBeInTheDocument()
  })

  it("filters by q against name/notes", () => {
    ;(useProjects as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [
        makeProject({ id: "a", name: "Spring Campaign", notes: "Wardrobe focus" }),
        makeProject({ id: "b", name: "Holiday", notes: "Studio" }),
      ],
      loading: false,
      error: null,
    })

    renderPage("/projects?filter=all&q=wardrobe")

    expect(screen.getByText("Spring Campaign")).toBeInTheDocument()
    expect(screen.queryByText("Holiday")).not.toBeInTheDocument()
  })

  it("sorts by name when sort=name", () => {
    ;(useProjects as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [
        makeProject({ id: "a", name: "Zulu", status: "active" }),
        makeProject({ id: "b", name: "Alpha", status: "active" }),
        makeProject({ id: "c", name: "Bravo", status: "active" }),
      ],
      loading: false,
      error: null,
    })

    renderPage("/projects?sort=name")

    const cards = screen.getAllByTestId("project-card")
    expect(cards.map((c) => c.textContent)).toEqual(["Alpha", "Bravo", "Zulu"])
  })

  it("always hides deleted projects", () => {
    ;(useProjects as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [
        makeProject({ id: "a", name: "Visible", status: "active" }),
        makeProject({ id: "b", name: "Deleted", status: "active", deletedAt: Timestamp.fromMillis(Date.now()) }),
      ],
      loading: false,
      error: null,
    })

    renderPage("/projects?filter=all")

    expect(screen.getByText("Visible")).toBeInTheDocument()
    expect(screen.queryByText("Deleted")).not.toBeInTheDocument()
  })
})

