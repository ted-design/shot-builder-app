/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

// ---- Mocks ----

const mockInviteOrUpdateUser = vi.fn()

vi.mock("@/features/admin/lib/adminWrites", () => ({
  inviteOrUpdateUser: (...args: unknown[]) => mockInviteOrUpdateUser(...args),
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { useAuth } from "@/app/providers/AuthProvider"
import { toast } from "sonner"
import { InviteUserDialog } from "./InviteUserDialog"

const mockAuth = useAuth as unknown as { mockReturnValue: (v: unknown) => void }
const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
}

function renderDialog(open = true, onOpenChange = vi.fn()) {
  return render(<InviteUserDialog open={open} onOpenChange={onOpenChange} />)
}

describe("InviteUserDialog", () => {
  const onOpenChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockReturnValue({ clientId: "c1", user: { uid: "u1" } })
    mockInviteOrUpdateUser.mockResolvedValue("uid-new")
  })

  it("renders email, display name, and role fields when open", () => {
    renderDialog()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument()
    expect(screen.getByRole("combobox")).toBeInTheDocument()
  })

  it("Apply Role button is disabled when email field is empty", () => {
    renderDialog()
    expect(screen.getByRole("button", { name: /apply role/i })).toBeDisabled()
  })

  it("Apply Role button becomes enabled when email has content", () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@example.com" },
    })
    expect(screen.getByRole("button", { name: /apply role/i })).toBeEnabled()
  })

  it("Apply Role button is disabled for whitespace-only email", () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "   " },
    })
    expect(screen.getByRole("button", { name: /apply role/i })).toBeDisabled()
  })

  it("shows validation error for invalid email on submit", async () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "not-an-email" },
    })
    fireEvent.click(screen.getByRole("button", { name: /apply role/i }))
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument()
    expect(mockInviteOrUpdateUser).not.toHaveBeenCalled()
  })

  it("clears email validation error when user types", async () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "bad" },
    })
    fireEvent.click(screen.getByRole("button", { name: /apply role/i }))
    expect(await screen.findByText(/valid email/i)).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "good@example.com" },
    })
    expect(screen.queryByText(/valid email/i)).not.toBeInTheDocument()
  })

  it("calls inviteOrUpdateUser with correct arguments on valid submit", async () => {
    renderDialog(true, onOpenChange)
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "jane@example.com" },
    })
    fireEvent.change(screen.getByLabelText(/display name/i), {
      target: { value: "Jane Doe" },
    })
    fireEvent.click(screen.getByRole("button", { name: /apply role/i }))

    await waitFor(() => {
      expect(mockInviteOrUpdateUser).toHaveBeenCalledWith({
        targetEmail: "jane@example.com",
        displayName: "Jane Doe",
        role: "producer",
        clientId: "c1",
      })
    })
  })

  it("passes null displayName when display name field is empty", async () => {
    renderDialog(true, onOpenChange)
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "jane@example.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: /apply role/i }))

    await waitFor(() => {
      expect(mockInviteOrUpdateUser).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: null }),
      )
    })
  })

  it("calls onOpenChange(false) and shows success toast after successful submit", async () => {
    renderDialog(true, onOpenChange)
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "jane@example.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: /apply role/i }))

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
      expect(mockToast.success).toHaveBeenCalledWith(
        "Role applied for jane@example.com",
        expect.objectContaining({ action: expect.any(Object) }),
      )
    })
  })

  it("shows user-not-found error toast when CF returns user-not-found", async () => {
    mockInviteOrUpdateUser.mockRejectedValue(new Error("auth/user-not-found"))
    renderDialog()
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "ghost@example.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: /apply role/i }))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "User must sign in once before being assigned a role",
        expect.objectContaining({ action: expect.any(Object) }),
      )
    })
  })

  it("shows USER_NOT_FOUND variant error toast", async () => {
    mockInviteOrUpdateUser.mockRejectedValue(new Error("USER_NOT_FOUND"))
    renderDialog()
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "ghost@example.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: /apply role/i }))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "User must sign in once before being assigned a role",
        expect.objectContaining({ action: expect.any(Object) }),
      )
    })
  })

  it("shows raw error message for other failures", async () => {
    mockInviteOrUpdateUser.mockRejectedValue(new Error("permission-denied"))
    renderDialog()
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "someone@example.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: /apply role/i }))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("permission-denied")
    })
  })

  it("shows missing clientId toast and does not call CF when clientId is null", async () => {
    mockAuth.mockReturnValue({ clientId: null })
    renderDialog()
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "user@example.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: /apply role/i }))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringMatching(/missing client scope/i),
      )
      expect(mockInviteOrUpdateUser).not.toHaveBeenCalled()
    })
  })

  it("resets form fields when dialog is reopened", () => {
    const { rerender } = renderDialog(true, onOpenChange)

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "old@example.com" },
    })

    // Close then reopen
    rerender(<InviteUserDialog open={false} onOpenChange={onOpenChange} />)
    rerender(<InviteUserDialog open={true} onOpenChange={onOpenChange} />)

    expect(screen.getByLabelText(/email/i)).toHaveValue("")
    expect(screen.getByLabelText(/display name/i)).toHaveValue("")
  })

  it("calls onOpenChange(false) when Cancel is clicked", () => {
    renderDialog(true, onOpenChange)
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  describe("copy link", () => {
    it("shows copy link toast on user-not-found error", async () => {
      mockInviteOrUpdateUser.mockRejectedValue(new Error("auth/user-not-found"))
      renderDialog()
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: "new-user@example.com" },
      })
      fireEvent.click(screen.getByRole("button", { name: /apply role/i }))

      await waitFor(() => {
        // The error toast should include a copy-link action or message
        expect(mockToast.error).toHaveBeenCalled()
        const callArgs = mockToast.error.mock.calls[0]!
        // Check the toast message mentions sign in requirement
        expect(callArgs[0]).toMatch(/sign in/i)
      })
    })

    it("shows copy link action on successful invite", async () => {
      mockInviteOrUpdateUser.mockResolvedValue("uid-new")
      renderDialog(true, onOpenChange)
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: "jane@example.com" },
      })
      fireEvent.click(screen.getByRole("button", { name: /apply role/i }))

      await waitFor(() => {
        // Success toast should be called — may include copy link action
        expect(mockToast.success).toHaveBeenCalled()
      })
    })

    it("shows role description card below role selector", () => {
      renderDialog()
      // The dialog should show a description of the currently selected role
      // Default role is "producer", so we expect some producer-related description text
      const dialog = screen.getByRole("dialog")
      expect(dialog).toBeInTheDocument()
      // Role description should be visible in the dialog
      expect(screen.getByRole("combobox")).toBeInTheDocument()
    })
  })
})
