/// <reference types="@testing-library/jest-dom" />
import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, act } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { Timestamp } from "firebase/firestore"
import type { Project } from "@/shared/types"

const mockGetCountFromServer = vi.fn()
const mockNavigate = vi.fn()

vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual<typeof import("firebase/firestore")>("firebase/firestore")
  return {
    ...actual,
    collection: vi.fn((...args: unknown[]) => ({ __col: args.join("/") })),
    query: vi.fn((...args: unknown[]) => ({ __query: args })),
    where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
    getCountFromServer: (...args: unknown[]) => mockGetCountFromServer(...args),
  }
})

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom")
  return { ...actual, useNavigate: () => mockNavigate }
})

let mockAuth = { clientId: "c1", role: "producer" as const, user: { uid: "u1", email: null, displayName: null, photoURL: null } }
vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => mockAuth,
}))

const mockDuplicateProject = vi.fn()
vi.mock("@/features/projects/lib/duplicateProject", async () => {
  const actual = await vi.importActual<typeof import("@/features/projects/lib/duplicateProject")>(
    "@/features/projects/lib/duplicateProject",
  )
  return {
    ...actual,
    duplicateProject: (...args: unknown[]) => mockDuplicateProject(...args),
  }
})

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { DuplicateProjectDialog } from "@/features/projects/components/DuplicateProjectDialog"
import { DuplicateProjectPartialFailureError } from "@/features/projects/lib/duplicateProject"

function makeProject(overrides: Partial<Project> = {}): Project {
  const now = Timestamp.fromMillis(Date.now())
  return {
    id: overrides.id ?? "p1",
    name: overrides.name ?? "Q4 Shoot",
    clientId: overrides.clientId ?? "c1",
    status: overrides.status ?? "active",
    shootDates: overrides.shootDates ?? [],
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  }
}

describe("DuplicateProjectDialog", () => {
  const onOpenChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth = { clientId: "c1", role: "producer", user: { uid: "u1", email: null, displayName: null, photoURL: null } }
    mockGetCountFromServer.mockResolvedValue({ data: () => ({ count: 3 }) })
  })

  function renderDialog(project: Project = makeProject()) {
    return render(
      <MemoryRouter>
        <DuplicateProjectDialog project={project} open={true} onOpenChange={onOpenChange} />
      </MemoryRouter>,
    )
  }

  it("prefills the name as «{name} (Copy)»", () => {
    renderDialog(makeProject({ name: "Q4 Shoot" }))
    expect(screen.getByLabelText("New project name")).toHaveValue("Q4 Shoot (Copy)")
  })

  it("shows source counts once loaded", async () => {
    renderDialog()
    await waitFor(() => {
      expect(screen.getByText(/3 sets, 3 shots will be copied\./)).toBeInTheDocument()
    })
  })

  it("calls duplicateProject with the trimmed name and navigates to the new project on success", async () => {
    mockDuplicateProject.mockResolvedValue({ newProjectId: "new-p1", laneCount: 2, shotCount: 5 })
    renderDialog(makeProject({ id: "src-1", name: "Q4 Shoot" }))

    screen.getByRole("button", { name: "Duplicate" }).click()

    await waitFor(() => {
      expect(mockDuplicateProject).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: "c1",
          sourceProjectId: "src-1",
          newName: "Q4 Shoot (Copy)",
          role: "producer",
        }),
      )
    })
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/projects/new-p1/shots")
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("surfaces a DuplicateProjectPartialFailureError message inline and does NOT navigate", async () => {
    mockDuplicateProject.mockRejectedValue(
      new DuplicateProjectPartialFailureError("Only 3 of 10 shots landed.", {
        newProjectId: "partial-p1",
        lanesWritten: 1,
        shotsWritten: 3,
      }),
    )
    renderDialog()

    screen.getByRole("button", { name: "Duplicate" }).click()

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Only 3 of 10 shots landed.")
    })
    expect(mockNavigate).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
  })

  it("guards against double-submit: re-entering handleDuplicate while a submit is in flight calls duplicateProject once", async () => {
    let resolveDuplicate!: (val: unknown) => void
    mockDuplicateProject.mockReturnValue(new Promise((r) => { resolveDuplicate = r }))
    renderDialog(makeProject({ id: "src-1", name: "Q4 Shoot" }))

    const button = screen.getByRole("button", { name: "Duplicate" })
    // A second `fireEvent.click`/`.click()` on the SAME button cannot
    // falsify the internal `saving` check: React reads `disabled` off the
    // fiber's own memoized props at event-dispatch time (not the live DOM
    // attribute), and setSaving(true) commits synchronously on discrete
    // click events — so a disabled button never re-dispatches to the
    // handler at all, guard or no guard (verified empirically). To test
    // the guard actually WRITTEN in handleDuplicate, invoke its onClick
    // prop directly a second time — exactly the scenario the internal
    // check defends: a re-entrant call while a submit is already in
    // flight, bypassing the disabled button entirely.
    const getOnClick = (): (() => void) => {
      const propsKey = Object.keys(button).find((k) => k.startsWith("__reactProps$"))!
      return (button as unknown as Record<string, { onClick: () => void }>)[propsKey]!.onClick
    }

    act(() => getOnClick()())
    await waitFor(() => expect(mockDuplicateProject).toHaveBeenCalledTimes(1))

    // Re-query onClick: the closure now reflects the COMMITTED saving=true
    // from the first call.
    act(() => getOnClick()())
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(mockDuplicateProject).toHaveBeenCalledTimes(1)
    resolveDuplicate({ newProjectId: "new-p1", laneCount: 0, shotCount: 0 })
  })

  it("disables Duplicate when the name is blank", async () => {
    renderDialog()
    const input = screen.getByLabelText("New project name")
    const button = screen.getByRole("button", { name: "Duplicate" }) as HTMLButtonElement
    expect(button.disabled).toBe(false)

    const user = await import("@testing-library/user-event")
    await user.default.clear(input)
    expect((screen.getByRole("button", { name: "Duplicate" }) as HTMLButtonElement).disabled).toBe(true)
  })
})
