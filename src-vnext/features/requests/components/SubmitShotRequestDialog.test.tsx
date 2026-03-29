/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"

// ---- Mocks ----

const mockSubmitShotRequest = vi.fn()

vi.mock("@/features/requests/lib/requestWrites", () => ({
  submitShotRequest: (...args: unknown[]) => mockSubmitShotRequest(...args),
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => false,
  useIsDesktop: () => true,
  useIsTablet: () => false,
  useMediaQuery: () => true,
}))

// Mock RecipientPicker to avoid Firestore dependency in dialog tests
vi.mock("@/features/requests/components/RecipientPicker", () => ({
  RecipientPicker: ({ onChange }: { onChange: (uids: string[]) => void }) => (
    <div data-testid="recipient-picker">
      <button
        type="button"
        onClick={() => onChange(["uid-admin"])}
        data-testid="select-admin"
      >
        Select Admin
      </button>
    </div>
  ),
}))

// Mock ReferenceInput to avoid Storage dependency in dialog tests
vi.mock("@/features/requests/components/ReferenceInput", () => ({
  ReferenceInput: () => <div data-testid="reference-input" />,
}))

// Mock useProductFamilies to avoid Firestore dependency
vi.mock("@/features/products/hooks/useProducts", () => ({
  useProductFamilies: () => ({ data: [], loading: false }),
}))

import { useAuth } from "@/app/providers/AuthProvider"
import { toast } from "sonner"
import { SubmitShotRequestDialog } from "./SubmitShotRequestDialog"

const mockAuth = useAuth as unknown as { mockReturnValue: (v: unknown) => void }
const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
}

function renderDialog(open = true, onOpenChange = vi.fn()) {
  return render(
    <SubmitShotRequestDialog open={open} onOpenChange={onOpenChange} />,
  )
}

describe("SubmitShotRequestDialog", () => {
  const onOpenChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth.mockReturnValue({
      clientId: "c1",
      user: { uid: "u1", displayName: "Test User" },
      role: "admin",
    })
    mockSubmitShotRequest.mockResolvedValue("req-1")
  })

  it("renders dialog with title input and submit button", () => {
    renderDialog()
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: /submit request/i }),
    ).toBeInTheDocument()
  })

  it("submit button is disabled when title is empty", () => {
    renderDialog()
    expect(
      screen.getByRole("button", { name: /submit request/i }),
    ).toBeDisabled()
  })

  it("submit button becomes enabled when title has content", () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "Hero Shots" },
    })
    expect(
      screen.getByRole("button", { name: /submit request/i }),
    ).toBeEnabled()
  })

  it("submit button is disabled for whitespace-only title", () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "   " },
    })
    expect(
      screen.getByRole("button", { name: /submit request/i }),
    ).toBeDisabled()
  })

  it("clears title validation error when user types", async () => {
    renderDialog()
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "test" },
    })
    fireEvent.click(screen.getByRole("button", { name: /submit request/i }))

    await waitFor(() => {
      expect(mockSubmitShotRequest).toHaveBeenCalled()
    })
    expect(screen.queryByText(/title is required/i)).not.toBeInTheDocument()
  })

  it("calls submitShotRequest with correct core params on submit", async () => {
    renderDialog(true, onOpenChange)
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "Spring Campaign" },
    })
    fireEvent.click(screen.getByRole("button", { name: /submit request/i }))

    await waitFor(() => {
      expect(mockSubmitShotRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: "c1",
          title: "Spring Campaign",
          priority: "normal",
          description: null,
          referenceUrls: null,
          deadline: null,
          notes: null,
          submittedBy: "u1",
          submittedByName: "Test User",
          notifyUserIds: null,
        }),
      )
    })
  })

  it("includes notifyUserIds from RecipientPicker when selected", async () => {
    renderDialog(true, onOpenChange)

    // Select admin via the mocked picker
    fireEvent.click(screen.getByTestId("select-admin"))

    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "Notify Test" },
    })
    fireEvent.click(screen.getByRole("button", { name: /submit request/i }))

    await waitFor(() => {
      expect(mockSubmitShotRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          notifyUserIds: ["uid-admin"],
        }),
      )
    })
  })

  it("shows progressive disclosure on click", () => {
    renderDialog()
    expect(screen.queryByLabelText(/description/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(/more details/i))
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument()
  })

  it("closes dialog after successful submission", async () => {
    renderDialog(true, onOpenChange)
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "Test Request" },
    })
    fireEvent.click(screen.getByRole("button", { name: /submit request/i }))

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
      expect(mockToast.success).toHaveBeenCalledWith("Shot request submitted")
    })
  })

  it("priority toggle changes between normal and urgent", () => {
    renderDialog()
    const urgentBtn = screen.getByRole("button", { name: /urgent/i })
    const normalBtn = screen.getByRole("button", { name: /normal/i })

    expect(normalBtn.className).toContain("shadow")

    fireEvent.click(urgentBtn)
    expect(urgentBtn.className).toContain("red")

    fireEvent.click(normalBtn)
    expect(normalBtn.className).toContain("shadow")
  })

  it("submits with urgent priority when selected", async () => {
    renderDialog(true, onOpenChange)
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "Urgent Request" },
    })
    fireEvent.click(screen.getByRole("button", { name: /urgent/i }))
    fireEvent.click(screen.getByRole("button", { name: /submit request/i }))

    await waitFor(() => {
      expect(mockSubmitShotRequest).toHaveBeenCalledWith(
        expect.objectContaining({ priority: "urgent" }),
      )
    })
  })

  it("shows error toast on submission failure", async () => {
    mockSubmitShotRequest.mockRejectedValue(new Error("permission-denied"))
    renderDialog()
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "Failing Request" },
    })
    fireEvent.click(screen.getByRole("button", { name: /submit request/i }))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("permission-denied")
    })
  })

  it("shows missing clientId toast when clientId is null", async () => {
    mockAuth.mockReturnValue({
      clientId: null,
      user: { uid: "u1", displayName: "Test User" },
    })
    renderDialog()
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "Test" },
    })
    fireEvent.click(screen.getByRole("button", { name: /submit request/i }))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        expect.stringMatching(/must be signed in/i),
      )
      expect(mockSubmitShotRequest).not.toHaveBeenCalled()
    })
  })

  it("resets form fields when dialog is reopened", () => {
    const { rerender } = renderDialog(true, onOpenChange)

    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "Old Title" },
    })

    rerender(<SubmitShotRequestDialog open={false} onOpenChange={onOpenChange} />)
    rerender(<SubmitShotRequestDialog open={true} onOpenChange={onOpenChange} />)

    expect(screen.getByLabelText(/title/i)).toHaveValue("")
  })

  it("calls onOpenChange(false) when Cancel is clicked", () => {
    renderDialog(true, onOpenChange)
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("renders RecipientPicker inside the dialog", () => {
    renderDialog()
    expect(screen.getByTestId("recipient-picker")).toBeInTheDocument()
  })
})
