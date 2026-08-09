/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

// ---- Mocks ----

const mockBulkAddProjectMembers = vi.fn()

vi.mock("@/features/admin/lib/adminWrites", () => ({
  bulkAddProjectMembers: (...args: unknown[]) => mockBulkAddProjectMembers(...args),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

// The dialog looks up the target user's existing project memberships itself
// (one getDoc per active project, against the member doc path — see
// projectMemberDocPath: [..., "projects", projectId, "members", userId]).
// Tests drive which project ids come back "already assigned" via
// memberDocState.existingMemberDocIds; default is empty, matching a
// brand-new project-scoped role with zero prior access.
const memberDocState = vi.hoisted(() => ({
  existingMemberDocIds: new Set<string>(),
}))

vi.mock("firebase/firestore", () => ({
  doc: (...args: unknown[]) => ({ __pathArgs: args }),
  getDoc: async (ref: { __pathArgs: unknown[] }) => {
    // __pathArgs = [db, "clients", clientId, "projects", projectId, "members", userId]
    const projectId = ref.__pathArgs[ref.__pathArgs.length - 3] as string
    return { exists: () => memberDocState.existingMemberDocIds.has(projectId) }
  },
}))

// Two fake active projects, p1 + p2, so tests can distinguish "existing"
// from "newly assignable" without a live project list.
vi.mock("@/features/projects/hooks/useProjects", () => ({
  useProjects: () => ({
    data: [
      { id: "p1", name: "Project One" },
      { id: "p2", name: "Project Two" },
    ],
    loading: false,
    error: null,
  }),
}))

// Stand in for the real picker with a minimal control surface: one fake
// project (p1) that can be toggled on/off, plus the existingProjectIds prop
// surfaced as text so tests can assert the dialog wired it through.
vi.mock("./ProjectAssignmentPicker", () => ({
  ProjectAssignmentPicker: ({
    assignments,
    onChange,
    existingProjectIds,
  }: {
    assignments: readonly { projectId: string; projectName: string; role: string }[]
    onChange: (a: readonly { projectId: string; projectName: string; role: string }[]) => void
    existingProjectIds?: ReadonlySet<string>
  }) => (
    <>
      <button
        type="button"
        onClick={() => {
          if (assignments.some((a) => a.projectId === "p1")) {
            onChange(assignments.filter((a) => a.projectId !== "p1"))
          } else {
            onChange([...assignments, { projectId: "p1", projectName: "Project One", role: "crew" }])
          }
        }}
      >
        toggle-project-one
      </button>
      <div data-testid="existing-project-ids">
        {existingProjectIds ? [...existingProjectIds].sort().join(",") : "undefined"}
      </div>
    </>
  ),
}))

import { toast } from "sonner"
import { RoleProjectAssignmentDialog } from "./RoleProjectAssignmentDialog"

const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
}

function renderDialog(overrides: Partial<React.ComponentProps<typeof RoleProjectAssignmentDialog>> = {}) {
  const onOpenChange = vi.fn()
  const defaults = {
    open: true,
    onOpenChange,
    userId: "u1",
    userEmail: "crew@example.com",
    newRole: "crew" as const,
    clientId: "c1",
    addedBy: "admin-1",
  }
  const utils = render(<RoleProjectAssignmentDialog {...defaults} {...overrides} />)
  return { onOpenChange, ...utils }
}

describe("RoleProjectAssignmentDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBulkAddProjectMembers.mockResolvedValue(undefined)
    memberDocState.existingMemberDocIds = new Set()
  })

  it("renders the project picker and mentions the target user + new role", () => {
    renderDialog({ userEmail: "crew@example.com", newRole: "crew" })
    expect(screen.getAllByText(/crew@example.com/).length).toBeGreaterThan(0)
    expect(screen.getByText("toggle-project-one")).toBeInTheDocument()
  })

  it("shows the zero-membership warning when no projects are selected and the user has no existing memberships", async () => {
    renderDialog({ userEmail: "crew@example.com" })
    await waitFor(() => {
      expect(screen.getByText(/crew@example.com can't see any projects yet/)).toBeInTheDocument()
    })
  })

  it("hides the zero-membership warning once a project is selected", async () => {
    renderDialog()
    await waitFor(() => {
      expect(screen.getByText(/can't see any projects yet/)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText("toggle-project-one"))
    expect(screen.queryByText(/can't see any projects yet/)).not.toBeInTheDocument()
  })

  it("passes the target user's existing project memberships to the picker as existingProjectIds", async () => {
    memberDocState.existingMemberDocIds = new Set(["p2"])
    renderDialog()
    await waitFor(() => {
      expect(screen.getByTestId("existing-project-ids")).toHaveTextContent("p2")
    })
  })

  it("never shows the zero-access warning for a user who already has project memberships, even skipping", async () => {
    memberDocState.existingMemberDocIds = new Set(["p1", "p2"])
    renderDialog({ userEmail: "crew@example.com" })
    await waitFor(() => {
      expect(screen.getByTestId("existing-project-ids")).toHaveTextContent("p1,p2")
    })
    expect(screen.queryByText(/can't see any projects yet/)).not.toBeInTheDocument()
  })

  it("mentions the existing membership count in the intro copy instead of asserting zero access", async () => {
    memberDocState.existingMemberDocIds = new Set(["p1", "p2"])
    renderDialog({ userEmail: "crew@example.com" })
    await waitFor(() => {
      expect(screen.getByText(/they're already on 2 projects/)).toBeInTheDocument()
    })
  })

  it("disables the Assign button until a project is selected", () => {
    renderDialog()
    expect(screen.getByRole("button", { name: /^assign$/i })).toBeDisabled()
    fireEvent.click(screen.getByText("toggle-project-one"))
    expect(screen.getByRole("button", { name: /assign \(1\)/i })).toBeEnabled()
  })

  it("calls bulkAddProjectMembers with the same write path the invite flow uses", async () => {
    const { onOpenChange } = renderDialog({
      userId: "u1",
      addedBy: "admin-1",
      clientId: "c1",
    })
    fireEvent.click(screen.getByText("toggle-project-one"))
    fireEvent.click(screen.getByRole("button", { name: /assign \(1\)/i }))

    await waitFor(() => {
      expect(mockBulkAddProjectMembers).toHaveBeenCalledWith({
        assignments: [{ projectId: "p1", projectName: "Project One", role: "crew" }],
        userId: "u1",
        addedBy: "admin-1",
        clientId: "c1",
      })
      expect(mockToast.success).toHaveBeenCalledWith("Added crew@example.com to 1 project")
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it("closes without writing when Skip is clicked", () => {
    const { onOpenChange } = renderDialog()
    fireEvent.click(screen.getByRole("button", { name: /skip/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(mockBulkAddProjectMembers).not.toHaveBeenCalled()
  })

  it("shows an error toast when the write fails", async () => {
    mockBulkAddProjectMembers.mockRejectedValue(new Error("permission-denied"))
    renderDialog()
    fireEvent.click(screen.getByText("toggle-project-one"))
    fireEvent.click(screen.getByRole("button", { name: /assign \(1\)/i }))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("permission-denied")
    })
  })

  it("resets assignments when reopened", () => {
    const { rerender } = renderDialog({ open: true })
    fireEvent.click(screen.getByText("toggle-project-one"))
    expect(screen.getByRole("button", { name: /assign \(1\)/i })).toBeEnabled()

    rerender(
      <RoleProjectAssignmentDialog
        open={false}
        onOpenChange={vi.fn()}
        userId="u1"
        userEmail="crew@example.com"
        newRole="crew"
        clientId="c1"
        addedBy="admin-1"
      />,
    )
    rerender(
      <RoleProjectAssignmentDialog
        open={true}
        onOpenChange={vi.fn()}
        userId="u1"
        userEmail="crew@example.com"
        newRole="crew"
        clientId="c1"
        addedBy="admin-1"
      />,
    )

    expect(screen.getByRole("button", { name: /^assign$/i })).toBeDisabled()
  })
})
