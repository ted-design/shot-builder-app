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

import { toast } from "sonner"
import { UserRoleSelect } from "./UserRoleSelect"

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
})
