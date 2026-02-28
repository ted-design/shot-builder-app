/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Timestamp } from "firebase/firestore"
import type { ShotRequest } from "@/shared/types"

// ---- Mocks ----

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    user: { uid: "u1", displayName: "Test User", email: "test@example.com", photoURL: null },
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

const mockUseShotRequests = vi.fn()
vi.mock("@/features/requests/hooks/useShotRequests", () => ({
  useShotRequests: () => mockUseShotRequests(),
}))

vi.mock("@/features/requests/hooks/useShotRequest", () => ({
  useShotRequest: () => ({ data: null, loading: false, error: null }),
}))

vi.mock("@/features/projects/hooks/useProjects", () => ({
  useProjects: () => ({ data: [], loading: false, error: null }),
}))

const mockSearchParams = new URLSearchParams()
const mockSetSearchParams = vi.fn()
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom")
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
  }
})

import ShotRequestInboxPage from "./ShotRequestInboxPage"

function makeRequest(overrides: Partial<ShotRequest> = {}): ShotRequest {
  return {
    id: "r1",
    clientId: "c1",
    status: "submitted",
    priority: "normal",
    title: "Test Request",
    description: null,
    referenceUrls: null,
    deadline: null,
    notes: null,
    submittedBy: "u1",
    submittedByName: "Alice",
    submittedAt: Timestamp.fromMillis(Date.now() - 3600000),
    updatedAt: Timestamp.fromMillis(Date.now()),
    triagedBy: null,
    triagedAt: null,
    absorbedIntoProjectId: null,
    absorbedAsShotId: null,
    rejectionReason: null,
    ...overrides,
  }
}

describe("ShotRequestInboxPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.delete("filter")
    mockSearchParams.delete("rid")
    mockSearchParams.delete("mine")
  })

  it("renders the page header with Inbox title", () => {
    mockUseShotRequests.mockReturnValue({ data: [], loading: false, error: null })
    render(<ShotRequestInboxPage />)
    expect(screen.getByText("Inbox")).toBeInTheDocument()
  })

  it("renders New Request button", () => {
    mockUseShotRequests.mockReturnValue({ data: [], loading: false, error: null })
    render(<ShotRequestInboxPage />)
    expect(screen.getByRole("button", { name: /new request/i })).toBeInTheDocument()
  })

  it("renders filter tabs", () => {
    mockUseShotRequests.mockReturnValue({ data: [], loading: false, error: null })
    render(<ShotRequestInboxPage />)
    expect(screen.getByText("All")).toBeInTheDocument()
    expect(screen.getByText("Submitted")).toBeInTheDocument()
    expect(screen.getByText("Triaged")).toBeInTheDocument()
    expect(screen.getByText("Done")).toBeInTheDocument()
  })

  it("shows empty message when no requests", () => {
    mockUseShotRequests.mockReturnValue({ data: [], loading: false, error: null })
    render(<ShotRequestInboxPage />)
    expect(screen.getByText("No requests found")).toBeInTheDocument()
  })

  it("renders request cards when data is present", () => {
    mockUseShotRequests.mockReturnValue({
      data: [
        makeRequest({ id: "r1", title: "First Request" }),
        makeRequest({ id: "r2", title: "Second Request" }),
      ],
      loading: false,
      error: null,
    })
    render(<ShotRequestInboxPage />)
    expect(screen.getByText("First Request")).toBeInTheDocument()
    expect(screen.getByText("Second Request")).toBeInTheDocument()
  })

  it("shows pending count when submitted requests exist", () => {
    mockUseShotRequests.mockReturnValue({
      data: [
        makeRequest({ id: "r1", status: "submitted" }),
        makeRequest({ id: "r2", status: "submitted" }),
        makeRequest({ id: "r3", status: "absorbed" }),
      ],
      loading: false,
      error: null,
    })
    render(<ShotRequestInboxPage />)
    expect(screen.getByText("2 pending")).toBeInTheDocument()
  })

  it("renders error message when hook returns error", () => {
    mockUseShotRequests.mockReturnValue({
      data: [],
      loading: false,
      error: { message: "Connection failed", isMissingIndex: false },
    })
    render(<ShotRequestInboxPage />)
    expect(screen.getByText("Connection failed")).toBeInTheDocument()
  })

  it("shows detail placeholder on desktop when no request is selected", () => {
    mockUseShotRequests.mockReturnValue({
      data: [makeRequest()],
      loading: false,
      error: null,
    })
    render(<ShotRequestInboxPage />)
    expect(screen.getByText("Select a request to view details")).toBeInTheDocument()
  })

  it("sorts urgent requests before normal requests", () => {
    const now = Date.now()
    mockUseShotRequests.mockReturnValue({
      data: [
        makeRequest({
          id: "r-normal",
          title: "Normal Request",
          priority: "normal",
          submittedAt: Timestamp.fromMillis(now),
        }),
        makeRequest({
          id: "r-urgent",
          title: "Urgent Request",
          priority: "urgent",
          submittedAt: Timestamp.fromMillis(now - 60000),
        }),
      ],
      loading: false,
      error: null,
    })
    render(<ShotRequestInboxPage />)

    const cardButtons = screen.getAllByRole("button").filter(
      (btn) =>
        btn.textContent?.includes("Urgent Request") ||
        btn.textContent?.includes("Normal Request"),
    )
    expect(cardButtons[0]?.textContent).toContain("Urgent Request")
    expect(cardButtons[1]?.textContent).toContain("Normal Request")
  })
})
