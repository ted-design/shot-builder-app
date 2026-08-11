/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

// ---- Mocks ----

const mockDeactivateUser = vi.fn()
const mockReactivateUser = vi.fn()
const mockBulkAddProjectMembers = vi.fn()

vi.mock("@/features/admin/lib/adminWrites", () => ({
  deactivateUser: (...args: unknown[]) => mockDeactivateUser(...args),
  reactivateUser: (...args: unknown[]) => mockReactivateUser(...args),
  bulkAddProjectMembers: (...args: unknown[]) => mockBulkAddProjectMembers(...args),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}))

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

vi.mock("firebase/firestore", () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  serverTimestamp: vi.fn(),
}))

// Stub the follow-up dialog to isolate UserDetailPanel's wiring: does the
// REACTIVATE handler open it (with the right props) exactly when the role
// picked in the reactivate Select is project-scoped? The dialog's own
// behavior (assignment picker, zero-membership warning, bulkAddProjectMembers
// write) is covered in RoleProjectAssignmentDialog.test.tsx.
vi.mock("./RoleProjectAssignmentDialog", () => ({
  RoleProjectAssignmentDialog: ({
    open,
    userEmail,
    newRole,
  }: {
    readonly open: boolean
    readonly userEmail: string
    readonly newRole: string
  }) =>
    open ? (
      <div data-testid="role-project-assignment-dialog" data-email={userEmail} data-role={newRole}>
        AssignDialog
      </div>
    ) : null,
}))

import { useAuth } from "@/app/providers/AuthProvider"
import { toast } from "sonner"
import { UserDetailPanel } from "./UserDetailPanel"

const mockAuth = useAuth as unknown as { mockReturnValue: (v: unknown) => void }
const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
}

function renderPanel(overrides: Partial<React.ComponentProps<typeof UserDetailPanel>> = {}) {
  const defaults = {
    userId: "u1",
    email: "worker@example.com",
    displayName: "Worker One",
    role: "crew" as const,
    clientId: "c1",
    isSelf: false,
    isPending: false,
    isDeactivated: true,
    lastSignIn: "Never",
    projectMemberships: [],
  }
  return render(<UserDetailPanel {...defaults} {...overrides} />)
}

describe("UserDetailPanel reactivate flow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockDeactivateUser.mockResolvedValue(undefined)
    mockReactivateUser.mockResolvedValue(undefined)
    mockAuth.mockReturnValue({ user: { uid: "admin-1" } })
  })

  async function reactivateAs(roleLabelText: string) {
    fireEvent.click(screen.getByRole("button", { name: /reactivate user/i }))
    // Role select defaults to the user's prior role (the `role` prop), which
    // can equal roleLabelText — the trigger's own value then duplicates the
    // dropdown option's text. Click the LAST match (the option, per the
    // Select portal render order) the same way UserRoleSelect.test.tsx's
    // "does not call updateUserRole when same role is selected" test does.
    fireEvent.click(screen.getByRole("combobox"))
    const options = screen.getAllByText(roleLabelText)
    fireEvent.click(options[options.length - 1]!)
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }))
    await waitFor(() => {
      expect(mockReactivateUser).toHaveBeenCalled()
    })
  }

  it("opens the assignment dialog after reactivating as Crew (project-scoped, zero access otherwise)", async () => {
    // deactivateUser deletes every project member doc for this user
    // (functions/index.js handleDeactivateUser); reactivateUser only
    // restores the Auth claim. Reactivating as crew with no follow-up
    // guarantees the user can see nothing.
    renderPanel({ role: "crew", isDeactivated: true })
    await reactivateAs("Crew")

    await waitFor(() => {
      const dialog = screen.getByTestId("role-project-assignment-dialog")
      expect(dialog).toHaveAttribute("data-email", "worker@example.com")
      expect(dialog).toHaveAttribute("data-role", "crew")
    })
  })

  it("opens the assignment dialog after reactivating as Warehouse", async () => {
    renderPanel({ role: "warehouse", isDeactivated: true })
    await reactivateAs("Warehouse")

    await waitFor(() => {
      expect(screen.getByTestId("role-project-assignment-dialog")).toHaveAttribute(
        "data-role",
        "warehouse",
      )
    })
  })

  it("opens the assignment dialog after reactivating as Viewer", async () => {
    renderPanel({ role: "viewer", isDeactivated: true })
    await reactivateAs("Viewer")

    await waitFor(() => {
      expect(screen.getByTestId("role-project-assignment-dialog")).toHaveAttribute(
        "data-role",
        "viewer",
      )
    })
  })

  it("does NOT open the assignment dialog when reactivated as Producer (org-wide access, no dialog needed)", async () => {
    renderPanel({ role: "producer", isDeactivated: true })
    await reactivateAs("Producer")
    expect(screen.queryByTestId("role-project-assignment-dialog")).not.toBeInTheDocument()
  })

  it("does NOT open the assignment dialog when reactivated as Admin (org-wide access, no dialog needed)", async () => {
    renderPanel({ role: "admin", isDeactivated: true })
    await reactivateAs("Admin")
    expect(screen.queryByTestId("role-project-assignment-dialog")).not.toBeInTheDocument()
  })

  it("does not open the dialog if reactivateUser fails", async () => {
    mockReactivateUser.mockRejectedValue(new Error("permission-denied"))
    renderPanel({ role: "crew", isDeactivated: true })

    fireEvent.click(screen.getByRole("button", { name: /reactivate user/i }))
    fireEvent.click(screen.getByRole("combobox"))
    const options = screen.getAllByText("Crew")
    fireEvent.click(options[options.length - 1]!)
    fireEvent.click(screen.getByRole("button", { name: /confirm/i }))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalled()
    })
    expect(screen.queryByTestId("role-project-assignment-dialog")).not.toBeInTheDocument()
  })

  it("does not render the dialog when the signed-in admin's uid is unavailable", async () => {
    mockAuth.mockReturnValue({ user: null })
    renderPanel({ role: "crew", isDeactivated: true })
    await reactivateAs("Crew")
    expect(screen.queryByTestId("role-project-assignment-dialog")).not.toBeInTheDocument()
  })
})
