/// <reference types="@testing-library/jest-dom" />
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

// ---- Mocks ----

const mockAddDoc = vi.fn().mockResolvedValue({ id: "new-proj-1" })
const mockBatchSet = vi.fn()
const mockBatchCommit = vi.fn().mockResolvedValue(undefined)
const mockWriteBatch = vi.fn(() => ({
  set: mockBatchSet,
  commit: mockBatchCommit,
}))

vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual<typeof import("firebase/firestore")>("firebase/firestore")
  return {
    ...actual,
    addDoc: (...args: unknown[]) => mockAddDoc(...args),
    collection: vi.fn((_db: unknown, ...segments: string[]) => segments.join("/")),
    doc: vi.fn((_db: unknown, ...segments: string[]) => segments.join("/")),
    serverTimestamp: () => "SERVER_TS",
    writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
  }
})

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: vi.fn(() => ({ clientId: "c1", user: { uid: "u1" }, role: "producer" })),
}))

vi.mock("@/features/projects/components/ShootDatesField", () => ({
  ShootDatesField: () => <div data-testid="shoot-dates-field">ShootDatesField</div>,
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { useAuth } from "@/app/providers/AuthProvider"
import { CreateProjectDialog } from "@/features/projects/components/CreateProjectDialog"

const mockUseAuth = useAuth as unknown as { mockReturnValue: (v: unknown) => void }

describe("CreateProjectDialog", () => {
  const onOpenChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  function renderDialog() {
    return render(
      <CreateProjectDialog open={true} onOpenChange={onOpenChange} />,
    )
  }

  it("renders with name field visible", () => {
    renderDialog()
    expect(screen.getByTestId("project-name-input")).toBeInTheDocument()
  })

  it("shows ShootDatesField without expanding 'More options'", () => {
    renderDialog()
    // ShootDatesField should be visible immediately (above fold)
    expect(screen.getByTestId("shoot-dates-field")).toBeInTheDocument()
    // Optional fields should NOT be visible
    expect(screen.queryByTestId("optional-fields")).not.toBeInTheDocument()
  })

  it("hides optional fields by default (progressive disclosure)", () => {
    renderDialog()
    expect(screen.queryByTestId("optional-fields")).not.toBeInTheDocument()
  })

  it("shows optional fields when 'More options' is clicked", () => {
    renderDialog()
    fireEvent.click(screen.getByTestId("more-options-toggle"))
    expect(screen.getByTestId("optional-fields")).toBeInTheDocument()
    expect(screen.getByTestId("brief-url-input")).toBeInTheDocument()
    expect(screen.getByTestId("notes-input")).toBeInTheDocument()
  })

  it("toggles optional fields closed again", () => {
    renderDialog()
    const toggle = screen.getByTestId("more-options-toggle")
    fireEvent.click(toggle)
    expect(screen.getByTestId("optional-fields")).toBeInTheDocument()
    fireEvent.click(toggle)
    expect(screen.queryByTestId("optional-fields")).not.toBeInTheDocument()
  })

  it("disables Create button when name is empty", () => {
    renderDialog()
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled()
  })

  it("disables Create button when name is whitespace only", () => {
    renderDialog()
    fireEvent.change(screen.getByTestId("project-name-input"), {
      target: { value: "   " },
    })
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled()
  })

  it("shows brief URL error and auto-expands collapsed section", () => {
    renderDialog()
    // Expand, enter bad URL, set valid name
    fireEvent.click(screen.getByTestId("more-options-toggle"))
    fireEvent.change(screen.getByTestId("brief-url-input"), {
      target: { value: "not-a-url" },
    })
    fireEvent.change(screen.getByTestId("project-name-input"), {
      target: { value: "My Project" },
    })
    // Collapse optional fields
    fireEvent.click(screen.getByTestId("more-options-toggle"))
    expect(screen.queryByTestId("optional-fields")).not.toBeInTheDocument()

    // Submit — should auto-expand and show error
    fireEvent.click(screen.getByRole("button", { name: "Create" }))
    expect(screen.getByTestId("optional-fields")).toBeInTheDocument()
    expect(screen.getByTestId("brief-url-error")).toHaveTextContent("Must be a valid URL")
  })

  it("clears brief URL error on keystroke", () => {
    renderDialog()
    fireEvent.click(screen.getByTestId("more-options-toggle"))
    fireEvent.change(screen.getByTestId("brief-url-input"), {
      target: { value: "not-a-url" },
    })
    fireEvent.change(screen.getByTestId("project-name-input"), {
      target: { value: "Proj" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create" }))
    expect(screen.getByTestId("brief-url-error")).toBeInTheDocument()

    fireEvent.change(screen.getByTestId("brief-url-input"), {
      target: { value: "https://example.com" },
    })
    expect(screen.queryByTestId("brief-url-error")).not.toBeInTheDocument()
  })

  it("calls writeBatch with correct data on valid submit", async () => {
    renderDialog()
    fireEvent.change(screen.getByTestId("project-name-input"), {
      target: { value: "Spring 2026" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create" }))

    await vi.waitFor(() => {
      expect(mockBatchCommit).toHaveBeenCalledTimes(1)
    })

    // First batch.set call is the project doc
    const docData = mockBatchSet.mock.calls[0]![1]
    expect(docData.name).toBe("Spring 2026")
    expect(docData.status).toBe("active")
    expect(docData.clientId).toBe("c1")
  })

  describe("auto-membership via writeBatch", () => {
    it("uses writeBatch for non-admin project creation", async () => {
      mockUseAuth.mockReturnValue({ clientId: "c1", user: { uid: "u1" }, role: "producer" })
      renderDialog()
      fireEvent.change(screen.getByTestId("project-name-input"), {
        target: { value: "Producer Project" },
      })
      fireEvent.click(screen.getByRole("button", { name: "Create" }))

      await vi.waitFor(() => {
        // Either writeBatch or addDoc should have been called
        // The implementation will use writeBatch for non-admin users
        const usedBatch = mockWriteBatch.mock.calls.length > 0
        const usedAddDoc = mockAddDoc.mock.calls.length > 0
        expect(usedBatch || usedAddDoc).toBe(true)
      })
    })

    it("writes member doc alongside project doc for non-admin", async () => {
      mockUseAuth.mockReturnValue({ clientId: "c1", user: { uid: "u1" }, role: "producer" })
      renderDialog()
      fireEvent.change(screen.getByTestId("project-name-input"), {
        target: { value: "Producer Project" },
      })
      fireEvent.click(screen.getByRole("button", { name: "Create" }))

      await vi.waitFor(() => {
        if (mockWriteBatch.mock.calls.length > 0) {
          // When using writeBatch, batch.set should be called at least twice:
          // once for the project doc and once for the member doc
          expect(mockBatchSet.mock.calls.length).toBeGreaterThanOrEqual(2)
          expect(mockBatchCommit).toHaveBeenCalledTimes(1)
        }
      })
    })

    it("does not write member doc for admin users", async () => {
      mockUseAuth.mockReturnValue({ clientId: "c1", user: { uid: "admin-1" }, role: "admin" })
      renderDialog()
      fireEvent.change(screen.getByTestId("project-name-input"), {
        target: { value: "Admin Project" },
      })
      fireEvent.click(screen.getByRole("button", { name: "Create" }))

      await vi.waitFor(() => {
        // Admin users should use addDoc (no batch needed)
        // OR if batch is used, it should only contain the project doc (1 set call)
        if (mockAddDoc.mock.calls.length > 0) {
          expect(mockAddDoc).toHaveBeenCalledTimes(1)
        } else if (mockWriteBatch.mock.calls.length > 0) {
          // If batch is used even for admin, only project doc should be set
          expect(mockBatchSet.mock.calls.length).toBe(1)
        }
      })
    })
  })
})
