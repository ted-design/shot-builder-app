/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

// ---- Mocks ----

const mockUpdateUserRole = vi.fn()

vi.mock("@/features/admin/lib/adminWrites", () => ({
  updateUserRole: (...args: unknown[]) => mockUpdateUserRole(...args),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}))

// Stub the follow-up dialog to isolate UserRoleSelect's wiring: does it open
// the dialog (with the right props) exactly when a project-scoped role is
// chosen? The dialog's own behavior (assignment picker, zero-membership
// warning, bulkAddProjectMembers write) is covered in
// RoleProjectAssignmentDialog.test.tsx.
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
import { UserRoleSelect } from "./UserRoleSelect"

const mockAuth = useAuth as unknown as { mockReturnValue: (v: unknown) => void }
const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
}

function renderSelect(overrides: Partial<React.ComponentProps<typeof UserRoleSelect>> = {}) {
  const defaults = {
    userId: "u1",
    userEmail: "user@example.com",
    currentRole: "producer" as const,
    clientId: "c1",
    disabled: false,
  }
  return render(<UserRoleSelect {...defaults} {...overrides} />)
}

describe("UserRoleSelect", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUpdateUserRole.mockResolvedValue(undefined)
    mockAuth.mockReturnValue({ user: { uid: "admin-1" } })
  })

  it("renders with current role displayed", () => {
    renderSelect({ currentRole: "producer" })
    expect(screen.getByRole("combobox")).toBeInTheDocument()
    expect(screen.getByText("Producer")).toBeInTheDocument()
  })

  it("renders as disabled when disabled prop is true", () => {
    renderSelect({ disabled: true })
    expect(screen.getByRole("combobox")).toBeDisabled()
  })

  it("renders all role options in the dropdown", () => {
    renderSelect()
    const trigger = screen.getByRole("combobox")
    fireEvent.click(trigger)
    // "Producer" appears twice: in the trigger value and as a list option
    expect(screen.getAllByText("Producer").length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText("Admin")).toBeInTheDocument()
    expect(screen.getByText("Crew")).toBeInTheDocument()
    expect(screen.getByText("Warehouse")).toBeInTheDocument()
    expect(screen.getByText("Viewer")).toBeInTheDocument()
  })

  it("calls updateUserRole when a different role is selected", async () => {
    renderSelect({ currentRole: "producer" })
    const trigger = screen.getByRole("combobox")
    fireEvent.click(trigger)
    fireEvent.click(screen.getByText("Crew"))

    await waitFor(() => {
      expect(mockUpdateUserRole).toHaveBeenCalledWith({
        userId: "u1",
        userEmail: "user@example.com",
        newRole: "crew",
        clientId: "c1",
      })
    })
  })

  it("shows success toast after role change", async () => {
    renderSelect({ currentRole: "producer" })
    fireEvent.click(screen.getByRole("combobox"))
    fireEvent.click(screen.getByText("Viewer"))

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(
        "Updated user@example.com to Viewer",
      )
    })
  })

  it("shows error toast when updateUserRole fails", async () => {
    mockUpdateUserRole.mockRejectedValue(new Error("permission-denied"))
    renderSelect({ currentRole: "producer" })
    fireEvent.click(screen.getByRole("combobox"))
    fireEvent.click(screen.getByText("Admin"))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("permission-denied")
    })
  })

  it("shows generic error message for non-Error rejections", async () => {
    mockUpdateUserRole.mockRejectedValue("unexpected")
    renderSelect({ currentRole: "producer" })
    fireEvent.click(screen.getByRole("combobox"))
    fireEvent.click(screen.getByText("Viewer"))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Failed to update role")
    })
  })

  it("does not call updateUserRole when same role is selected", async () => {
    renderSelect({ currentRole: "producer" })
    fireEvent.click(screen.getByRole("combobox"))
    // Re-select the already-active role
    const producerOptions = screen.getAllByText("Producer")
    fireEvent.click(producerOptions[producerOptions.length - 1]!)

    await waitFor(() => {
      expect(mockUpdateUserRole).not.toHaveBeenCalled()
    })
  })

  describe("project-assignment follow-up dialog", () => {
    it("opens the assignment dialog after changing an existing user to Crew", async () => {
      renderSelect({ currentRole: "producer", userEmail: "worker@example.com" })
      fireEvent.click(screen.getByRole("combobox"))
      fireEvent.click(screen.getByText("Crew"))

      await waitFor(() => {
        const dialog = screen.getByTestId("role-project-assignment-dialog")
        expect(dialog).toHaveAttribute("data-email", "worker@example.com")
        expect(dialog).toHaveAttribute("data-role", "crew")
      })
    })

    it("opens the assignment dialog after changing an existing user to Warehouse", async () => {
      renderSelect({ currentRole: "producer" })
      fireEvent.click(screen.getByRole("combobox"))
      fireEvent.click(screen.getByText("Warehouse"))

      await waitFor(() => {
        expect(screen.getByTestId("role-project-assignment-dialog")).toHaveAttribute(
          "data-role",
          "warehouse",
        )
      })
    })

    it("opens the assignment dialog after changing an existing user to Viewer", async () => {
      renderSelect({ currentRole: "producer" })
      fireEvent.click(screen.getByRole("combobox"))
      fireEvent.click(screen.getByText("Viewer"))

      await waitFor(() => {
        expect(screen.getByTestId("role-project-assignment-dialog")).toHaveAttribute(
          "data-role",
          "viewer",
        )
      })
    })

    it("does NOT open the assignment dialog when changed to Producer (org-wide access, no dialog needed)", async () => {
      renderSelect({ currentRole: "crew" })
      fireEvent.click(screen.getByRole("combobox"))
      fireEvent.click(screen.getByText("Producer"))

      await waitFor(() => {
        expect(mockUpdateUserRole).toHaveBeenCalled()
      })
      expect(screen.queryByTestId("role-project-assignment-dialog")).not.toBeInTheDocument()
    })

    it("does NOT open the assignment dialog when changed to Admin (org-wide access, no dialog needed)", async () => {
      renderSelect({ currentRole: "crew" })
      fireEvent.click(screen.getByRole("combobox"))
      fireEvent.click(screen.getByText("Admin"))

      await waitFor(() => {
        expect(mockUpdateUserRole).toHaveBeenCalled()
      })
      expect(screen.queryByTestId("role-project-assignment-dialog")).not.toBeInTheDocument()
    })

    it("does not open the dialog if updateUserRole fails", async () => {
      mockUpdateUserRole.mockRejectedValue(new Error("permission-denied"))
      renderSelect({ currentRole: "producer" })
      fireEvent.click(screen.getByRole("combobox"))
      fireEvent.click(screen.getByText("Crew"))

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalled()
      })
      expect(screen.queryByTestId("role-project-assignment-dialog")).not.toBeInTheDocument()
    })

    it("does not render the dialog when the signed-in user's uid is unavailable", async () => {
      // A dialog mounted with addedBy="" would let bulkAddProjectMembers
      // write with no attribution and no way to fail loudly first (the
      // Assign-button guard covers the disabled state; this covers not
      // showing the dialog at all when there's no admin uid to attribute
      // the write to).
      mockAuth.mockReturnValue({ user: null })
      renderSelect({ currentRole: "producer" })
      fireEvent.click(screen.getByRole("combobox"))
      fireEvent.click(screen.getByText("Crew"))

      await waitFor(() => {
        expect(mockUpdateUserRole).toHaveBeenCalled()
      })
      expect(screen.queryByTestId("role-project-assignment-dialog")).not.toBeInTheDocument()
    })
  })
})
