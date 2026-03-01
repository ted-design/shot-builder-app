/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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
const mockCreateProjectFromRequest = vi.fn()
vi.mock("@/features/requests/lib/requestWrites", () => ({
  triageAbsorbRequest: (...args: unknown[]) => mockTriageAbsorbRequest(...args),
  createProjectFromRequest: (...args: unknown[]) => mockCreateProjectFromRequest(...args),
}))

vi.mock("@/features/projects/components/ShootDatesField", () => ({
  ShootDatesField: ({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) => (
    <input
      data-testid="shoot-dates-field"
      value={value.join(",")}
      onChange={(e) => onChange(e.target.value ? e.target.value.split(",") : [])}
      disabled={disabled}
    />
  ),
}))

vi.mock("@/shared/lib/validation", () => ({
  projectNameSchema: {},
  validateField: (_schema: unknown, value: unknown) => {
    const str = String(value).trim()
    if (str.length === 0) return "Project name is required"
    return null
  },
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
    mockCreateProjectFromRequest.mockResolvedValue({ projectId: "p-new", shotId: "s-new" })
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

describe("AbsorbDialog — Create New Project mode", () => {
  const onOpenChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockTriageAbsorbRequest.mockResolvedValue("shot-new-id")
    mockCreateProjectFromRequest.mockResolvedValue({ projectId: "p-new", shotId: "s-new" })
  })

  it("renders mode toggle tabs", () => {
    render(<AbsorbDialog open={true} onOpenChange={onOpenChange} request={makeRequest()} />)
    expect(screen.getByRole("tab", { name: /existing project/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /new project/i })).toBeInTheDocument()
  })

  it("defaults to Existing Project tab", () => {
    render(<AbsorbDialog open={true} onOpenChange={onOpenChange} request={makeRequest()} />)
    expect(screen.getByRole("tab", { name: /existing project/i })).toHaveAttribute("data-state", "active")
  })

  it("shows project name input when New Project tab is clicked", async () => {
    const user = userEvent.setup()
    render(<AbsorbDialog open={true} onOpenChange={onOpenChange} request={makeRequest()} />)
    await user.click(screen.getByRole("tab", { name: /new project/i }))
    await waitFor(() => {
      expect(screen.getByLabelText(/project name/i)).toBeInTheDocument()
    })
  })

  it("shows Create Project button in create mode", async () => {
    const user = userEvent.setup()
    render(<AbsorbDialog open={true} onOpenChange={onOpenChange} request={makeRequest()} />)
    await user.click(screen.getByRole("tab", { name: /new project/i }))
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /create project/i })).toBeInTheDocument()
    })
  })

  it("Create Project button is disabled when project name is empty", async () => {
    const user = userEvent.setup()
    render(<AbsorbDialog open={true} onOpenChange={onOpenChange} request={makeRequest()} />)
    await user.click(screen.getByRole("tab", { name: /new project/i }))
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /create project/i })).toBeDisabled()
    })
  })

  it("calls createProjectFromRequest on submit in create mode", async () => {
    const user = userEvent.setup()
    render(<AbsorbDialog open={true} onOpenChange={onOpenChange} request={makeRequest()} />)
    await user.click(screen.getByRole("tab", { name: /new project/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/project name/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/project name/i), { target: { value: "New Campaign" } })
    await user.click(screen.getByRole("button", { name: /create project/i }))

    await waitFor(() => {
      expect(mockCreateProjectFromRequest).toHaveBeenCalledWith({
        clientId: "c1",
        requestId: "r1",
        projectName: "New Campaign",
        shootDates: [],
        createdBy: "u1",
      })
    })
  })

  it("shows success toast after creating project", async () => {
    const user = userEvent.setup()
    render(<AbsorbDialog open={true} onOpenChange={onOpenChange} request={makeRequest()} />)
    await user.click(screen.getByRole("tab", { name: /new project/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/project name/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/project name/i), { target: { value: "New Campaign" } })
    await user.click(screen.getByRole("button", { name: /create project/i }))

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith("Project created from request")
    })
  })

  it("shows error toast on failure", async () => {
    mockCreateProjectFromRequest.mockRejectedValue(new Error("Request not found"))

    const user = userEvent.setup()
    render(<AbsorbDialog open={true} onOpenChange={onOpenChange} request={makeRequest()} />)
    await user.click(screen.getByRole("tab", { name: /new project/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/project name/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/project name/i), { target: { value: "New Campaign" } })
    await user.click(screen.getByRole("button", { name: /create project/i }))

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Request not found")
    })
  })

  it("resets form state when switching between tabs", async () => {
    const user = userEvent.setup()
    render(<AbsorbDialog open={true} onOpenChange={onOpenChange} request={makeRequest()} />)

    // Switch to create mode and enter a name
    await user.click(screen.getByRole("tab", { name: /new project/i }))
    await waitFor(() => {
      expect(screen.getByLabelText(/project name/i)).toBeInTheDocument()
    })
    fireEvent.change(screen.getByLabelText(/project name/i), { target: { value: "Draft Name" } })

    // Switch back to existing — button label should revert
    await user.click(screen.getByRole("tab", { name: /existing project/i }))
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /absorb request/i })).toBeInTheDocument()
    })

    // Switch back to create — name should be cleared
    await user.click(screen.getByRole("tab", { name: /new project/i }))
    await waitFor(() => {
      expect(screen.getByLabelText(/project name/i)).toHaveValue("")
    })
  })

  it("closes dialog on successful create", async () => {
    const user = userEvent.setup()
    render(<AbsorbDialog open={true} onOpenChange={onOpenChange} request={makeRequest()} />)
    await user.click(screen.getByRole("tab", { name: /new project/i }))

    await waitFor(() => {
      expect(screen.getByLabelText(/project name/i)).toBeInTheDocument()
    })

    fireEvent.change(screen.getByLabelText(/project name/i), { target: { value: "New Campaign" } })
    await user.click(screen.getByRole("button", { name: /create project/i }))

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false)
    })
  })
})
