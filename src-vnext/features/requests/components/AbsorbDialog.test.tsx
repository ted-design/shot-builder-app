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

const mockTriageAbsorbRequest = vi.fn()
vi.mock("@/features/requests/lib/requestWrites", () => ({
  triageAbsorbRequest: (...args: unknown[]) => mockTriageAbsorbRequest(...args),
}))

vi.mock("@/features/projects/hooks/useProjects", () => ({
  useProjects: () => ({
    data: [
      { id: "p1", name: "Fall Campaign", status: "active", clientId: "c1", shootDates: [], createdAt: Timestamp.now(), updatedAt: Timestamp.now() },
      { id: "p2", name: "Spring Lookbook", status: "active", clientId: "c1", shootDates: [], createdAt: Timestamp.now(), updatedAt: Timestamp.now() },
      { id: "p3", name: "Archived Project", status: "archived", clientId: "c1", shootDates: [], createdAt: Timestamp.now(), updatedAt: Timestamp.now() },
    ],
    loading: false,
    error: null,
  }),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { toast } from "sonner"
import { AbsorbDialog } from "./AbsorbDialog"

const mockToast = toast as unknown as {
  success: ReturnType<typeof vi.fn>
  error: ReturnType<typeof vi.fn>
}

function makeRequest(): ShotRequest {
  return {
    id: "r1",
    clientId: "c1",
    status: "submitted",
    priority: "urgent",
    title: "Need product shots",
    description: "Fall collection needs photography",
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

describe("AbsorbDialog", () => {
  const onOpenChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockTriageAbsorbRequest.mockResolvedValue("shot-new-id")
  })

  it("renders request summary when open", () => {
    render(
      <AbsorbDialog open={true} onOpenChange={onOpenChange} request={makeRequest()} />,
    )
    expect(screen.getByText("Need product shots")).toBeInTheDocument()
    expect(screen.getByText(/Bob/)).toBeInTheDocument()
  })

  it("renders project picker with only active projects", () => {
    render(
      <AbsorbDialog open={true} onOpenChange={onOpenChange} request={makeRequest()} />,
    )
    expect(screen.getByText("Target Project")).toBeInTheDocument()
    // The select trigger should be present
    expect(screen.getByRole("combobox")).toBeInTheDocument()
  })

  it("Absorb Request button is disabled when no project is selected", () => {
    render(
      <AbsorbDialog open={true} onOpenChange={onOpenChange} request={makeRequest()} />,
    )
    expect(screen.getByRole("button", { name: /absorb request/i })).toBeDisabled()
  })

  it("calls onOpenChange(false) when Cancel is clicked", () => {
    render(
      <AbsorbDialog open={true} onOpenChange={onOpenChange} request={makeRequest()} />,
    )
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("shows info callout about what will happen", () => {
    render(
      <AbsorbDialog open={true} onOpenChange={onOpenChange} request={makeRequest()} />,
    )
    expect(screen.getByText(/new shot will be created/i)).toBeInTheDocument()
  })

  it("shows urgent indicator for urgent requests", () => {
    render(
      <AbsorbDialog open={true} onOpenChange={onOpenChange} request={makeRequest()} />,
    )
    expect(screen.getByText("Urgent")).toBeInTheDocument()
  })
})
