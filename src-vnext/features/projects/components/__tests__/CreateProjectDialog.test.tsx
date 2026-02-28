/// <reference types="@testing-library/jest-dom" />
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"

// ---- Mocks ----

const mockAddDoc = vi.fn().mockResolvedValue({ id: "new-proj-1" })

vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual<typeof import("firebase/firestore")>("firebase/firestore")
  return {
    ...actual,
    addDoc: (...args: unknown[]) => mockAddDoc(...args),
    collection: vi.fn((_db, ...segments: string[]) => segments.join("/")),
    serverTimestamp: () => "SERVER_TS",
  }
})

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ clientId: "c1", user: { uid: "u1" } }),
}))

vi.mock("@/features/projects/components/ShootDatesField", () => ({
  ShootDatesField: () => <div data-testid="shoot-dates-field">ShootDatesField</div>,
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { CreateProjectDialog } from "@/features/projects/components/CreateProjectDialog"

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

  it("calls addDoc with correct data on valid submit", async () => {
    renderDialog()
    fireEvent.change(screen.getByTestId("project-name-input"), {
      target: { value: "Spring 2026" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create" }))

    await vi.waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalledTimes(1)
    })

    const docData = mockAddDoc.mock.calls[0]![1]
    expect(docData.name).toBe("Spring 2026")
    expect(docData.status).toBe("active")
    expect(docData.clientId).toBe("c1")
  })
})
