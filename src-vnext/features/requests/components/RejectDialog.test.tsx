/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { Timestamp } from "firebase/firestore"
import type { ShotRequest } from "@/shared/types"

// ---- Mocks ----

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    user: { uid: "u1", displayName: "Test Admin", email: "admin@example.com", photoURL: null },
    clientId: "c1",
    role: "admin",
  }),
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => false,
  useIsDesktop: () => true,
  useIsTablet: () => false,
  useMediaQuery: () => true,
}))

const mockTriageRejectRequest = vi.fn()
vi.mock("@/features/requests/lib/requestWrites", () => ({
  triageRejectRequest: (...args: unknown[]) => mockTriageRejectRequest(...args),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { toast } from "sonner"
import { RejectDialog } from "./RejectDialog"

const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
}

function makeRequest(): ShotRequest {
  return {
    id: "r1",
    clientId: "c1",
    status: "submitted",
    priority: "normal",
    title: "Need product shots",
    description: null,
    referenceUrls: null,
    deadline: null,
    notes: null,
    submittedBy: "u2",
    submittedByName: "Bob",
    submittedAt: Timestamp.fromMillis(Date.now() - 3600000),
    updatedAt: Timestamp.fromMillis(Date.now()),
    triagedBy: null,
    triagedAt: null,
    absorbedIntoProjectId: null,
    absorbedAsShotId: null,
    rejectionReason: null,
  }
}

describe("RejectDialog", () => {
  const onOpenChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockTriageRejectRequest.mockResolvedValue(undefined)
  })

  it("renders request summary when open", () => {
    render(
      <RejectDialog open={true} onOpenChange={onOpenChange} request={makeRequest()} />,
    )
    expect(screen.getByText("Need product shots")).toBeInTheDocument()
    expect(screen.getByText(/Bob/)).toBeInTheDocument()
  })

  it("renders reason textarea", () => {
    render(
      <RejectDialog open={true} onOpenChange={onOpenChange} request={makeRequest()} />,
    )
    expect(screen.getByLabelText(/reason/i)).toBeInTheDocument()
  })

  it("calls onOpenChange(false) when Cancel is clicked", () => {
    render(
      <RejectDialog open={true} onOpenChange={onOpenChange} request={makeRequest()} />,
    )
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("calls triageRejectRequest on submit", async () => {
    render(
      <RejectDialog open={true} onOpenChange={onOpenChange} request={makeRequest()} />,
    )
    fireEvent.change(screen.getByLabelText(/reason/i), {
      target: { value: "Not in scope" },
    })
    fireEvent.click(screen.getByRole("button", { name: /reject request/i }))

    await waitFor(() => {
      expect(mockTriageRejectRequest).toHaveBeenCalledWith({
        requestId: "r1",
        clientId: "c1",
        triagedBy: "u1",
        rejectionReason: "Not in scope",
      })
    })
  })

  it("passes null reason when textarea is empty", async () => {
    render(
      <RejectDialog open={true} onOpenChange={onOpenChange} request={makeRequest()} />,
    )
    fireEvent.click(screen.getByRole("button", { name: /reject request/i }))

    await waitFor(() => {
      expect(mockTriageRejectRequest).toHaveBeenCalledWith(
        expect.objectContaining({ rejectionReason: null }),
      )
    })
  })

  it("shows success toast after successful rejection", async () => {
    render(
      <RejectDialog open={true} onOpenChange={onOpenChange} request={makeRequest()} />,
    )
    fireEvent.click(screen.getByRole("button", { name: /reject request/i }))

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith("Request rejected")
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })

  it("shows error toast on failure", async () => {
    mockTriageRejectRequest.mockRejectedValue(new Error("Permission denied"))
    render(
      <RejectDialog open={true} onOpenChange={onOpenChange} request={makeRequest()} />,
    )
    fireEvent.click(screen.getByRole("button", { name: /reject request/i }))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Permission denied")
    })
  })
})
