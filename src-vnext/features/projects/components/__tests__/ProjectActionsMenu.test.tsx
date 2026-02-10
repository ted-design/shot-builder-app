/// <reference types="@testing-library/jest-dom" />
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Timestamp } from "firebase/firestore"
import type { Project, Role } from "@/shared/types"

let mockRole: Role = "producer"

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ role: mockRole, clientId: "c1" }),
}))

vi.mock("@/features/projects/lib/updateProject", () => ({
  updateProjectField: vi.fn(),
  softDeleteProject: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { ProjectActionsMenu } from "@/features/projects/components/ProjectActionsMenu"

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

describe("ProjectActionsMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("shows delete for producer role", async () => {
    mockRole = "producer"
    const user = userEvent.setup()

    render(<ProjectActionsMenu project={makeProject()} onEdit={() => undefined} />)
    await user.click(screen.getByTitle("Project actions"))

    expect(screen.getByText("Delete…")).toBeInTheDocument()
  })

  it("hides actions for viewer role", () => {
    mockRole = "viewer"

    render(<ProjectActionsMenu project={makeProject()} onEdit={() => undefined} />)

    expect(screen.queryByTitle("Project actions")).not.toBeInTheDocument()
  })
})
