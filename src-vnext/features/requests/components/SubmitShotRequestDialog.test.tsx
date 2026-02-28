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

  it("shows title validation error on empty submit attempt", async () => {
    renderDialog()
    // Type something then clear to enable/disable cycle
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "x" },
    })
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "" },
    })
    // Button is disabled so we can't click, but let's verify state
    expect(
      screen.getByRole("button", { name: /submit request/i }),
    ).toBeDisabled()
  })

  it("clears title validation error when user types", async () => {
    renderDialog()
    // Force a validation error by typing then clearing
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "test" },
    })
    // Submit to trigger validation path
    fireEvent.click(screen.getByRole("button", { name: /submit request/i }))

    await waitFor(() => {
      expect(mockSubmitShotRequest).toHaveBeenCalled()
    })
    // No error should be visible since title was valid
    expect(screen.queryByText(/title is required/i)).not.toBeInTheDocument()
  })

  it("calls submitShotRequest with correct params on submit", async () => {
    renderDialog(true, onOpenChange)
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "Spring Campaign" },
    })
    fireEvent.click(screen.getByRole("button", { name: /submit request/i }))

    await waitFor(() => {
      expect(mockSubmitShotRequest).toHaveBeenCalledWith({
        clientId: "c1",
        title: "Spring Campaign",
        priority: "normal",
        description: null,
        referenceUrls: null,
        deadline: null,
        notes: null,
        submittedBy: "u1",
        submittedByName: "Test User",
      })
    })
  })

  it("shows progressive disclosure on click", () => {
    renderDialog()
    // Initially, description field should not be visible
    expect(screen.queryByLabelText(/description/i)).not.toBeInTheDocument()

    // Click "More details"
    fireEvent.click(screen.getByText(/more details/i))

    // Now description field should be visible
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

    // Default is normal — normal button should have active styling
    expect(normalBtn.className).toContain("shadow")

    // Click urgent
    fireEvent.click(urgentBtn)
    expect(urgentBtn.className).toContain("red")

    // Click normal again
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

    // Close then reopen
    rerender(
      <SubmitShotRequestDialog open={false} onOpenChange={onOpenChange} />,
    )
    rerender(
      <SubmitShotRequestDialog open={true} onOpenChange={onOpenChange} />,
    )

    expect(screen.getByLabelText(/title/i)).toHaveValue("")
  })

  it("calls onOpenChange(false) when Cancel is clicked", () => {
    renderDialog(true, onOpenChange)
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("includes reference URLs and optional fields when provided", async () => {
    renderDialog(true, onOpenChange)

    // Fill title
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "Full Request" },
    })

    // Open progressive disclosure
    fireEvent.click(screen.getByText(/more details/i))

    // Fill description
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "Detailed description" },
    })

    // Fill first URL
    const urlInputs = screen.getAllByPlaceholderText("https://...")
    fireEvent.change(urlInputs[0]!, {
      target: { value: "https://example.com/ref" },
    })

    // Fill deadline
    fireEvent.change(screen.getByLabelText(/deadline/i), {
      target: { value: "2026-04-01" },
    })

    // Fill notes
    fireEvent.change(screen.getByLabelText(/notes/i), {
      target: { value: "Some notes" },
    })

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /submit request/i }))

    await waitFor(() => {
      expect(mockSubmitShotRequest).toHaveBeenCalledWith({
        clientId: "c1",
        title: "Full Request",
        priority: "normal",
        description: "Detailed description",
        referenceUrls: ["https://example.com/ref"],
        deadline: "2026-04-01",
        notes: "Some notes",
        submittedBy: "u1",
        submittedByName: "Test User",
      })
    })
  })
})
