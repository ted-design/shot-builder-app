/// <reference types="@testing-library/jest-dom" />
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import { Timestamp } from "firebase/firestore"
import type { Project } from "@/shared/types"

const mockNavigate = vi.fn()

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("@/features/projects/components/ProjectActionsMenu", () => ({
  ProjectActionsMenu: ({ onActionInteraction }: { readonly onActionInteraction?: () => void }) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onActionInteraction?.()
      }}
    >
      Actions
    </button>
  ),
}))

import { ProjectCard } from "@/features/projects/components/ProjectCard"

function makeProject(overrides: Partial<Project> = {}): Project {
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

describe("ProjectCard", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("navigates on normal card click", () => {
    render(<ProjectCard project={makeProject({ id: "p123", name: "Alpha" })} />)

    fireEvent.click(screen.getByText("Alpha"))

    expect(mockNavigate).toHaveBeenCalledWith("/projects/p123/shots")
  })

  it("suppresses immediate navigation after actions interaction", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-02-09T12:00:00.000Z"))

    render(
      <ProjectCard
        project={makeProject({ id: "p999", name: "Sample Project (TEST)" })}
        showActions
        onEdit={() => undefined}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Actions" }))
    fireEvent.click(screen.getByText("Sample Project (TEST)"))

    expect(mockNavigate).not.toHaveBeenCalled()

    vi.advanceTimersByTime(900)
    fireEvent.click(screen.getByText("Sample Project (TEST)"))

    expect(mockNavigate).toHaveBeenCalledWith("/projects/p999/shots")

    vi.useRealTimers()
  })
})
