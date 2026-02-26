/// <reference types="@testing-library/jest-dom" />
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import type { Shot } from "@/shared/types"

// ---- Mocks ----

const mockAddDoc = vi.fn().mockResolvedValue({ id: "new-shot-1" })

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

vi.mock("@/app/providers/ProjectScopeProvider", () => ({
  useProjectScope: () => ({ projectId: "proj-1" }),
}))

vi.mock("@/features/shots/lib/shotVersioning", () => ({
  createShotVersionSnapshot: vi.fn().mockResolvedValue(undefined),
}))

const mockNextShotNumber = vi.fn().mockReturnValue("SH-008")

vi.mock("@/features/shots/lib/shotNumbering", () => ({
  nextShotNumber: (...args: unknown[]) => mockNextShotNumber(...args),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { CreateShotDialog } from "@/features/shots/components/CreateShotDialog"

function makeShot(overrides: Partial<Shot> = {}): Shot {
  return {
    id: "shot-1",
    title: "Test",
    description: null,
    projectId: "proj-1",
    clientId: "c1",
    status: "todo",
    talent: [],
    products: [],
    sortOrder: 1,
    shotNumber: null,
    date: null,
    deleted: false,
    notes: null,
    referenceLinks: [],
    createdAt: null,
    updatedAt: null,
    createdBy: "u1",
  } as Shot
}

describe("CreateShotDialog", () => {
  const onOpenChange = vi.fn()
  const onCreated = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockNextShotNumber.mockReturnValue("SH-008")
  })

  function renderDialog(shots: Shot[] = []) {
    return render(
      <CreateShotDialog
        open={true}
        onOpenChange={onOpenChange}
        onCreated={onCreated}
        shots={shots}
      />,
    )
  }

  it("renders title input", () => {
    renderDialog()
    expect(screen.getByTestId("shot-title-input")).toBeInTheDocument()
  })

  it("disables Create button when title is empty", () => {
    renderDialog()
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled()
  })

  it("disables Create button for whitespace-only title", () => {
    renderDialog()
    const input = screen.getByTestId("shot-title-input")
    fireEvent.change(input, { target: { value: "  " } })
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled()
  })

  it("enables Create button when valid title is entered", () => {
    renderDialog()
    const input = screen.getByTestId("shot-title-input")
    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled()
    fireEvent.change(input, { target: { value: "Hero Shot" } })
    expect(screen.getByRole("button", { name: "Create" })).not.toBeDisabled()
  })

  it("includes auto-generated shot number in Firestore write", async () => {
    const existingShots = [
      makeShot({ id: "s1", shotNumber: "SH-003" }),
      makeShot({ id: "s2", shotNumber: "SH-007" }),
    ]
    renderDialog(existingShots)

    fireEvent.change(screen.getByTestId("shot-title-input"), {
      target: { value: "New Shot" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create" }))

    await vi.waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalledTimes(1)
    })

    // Verify nextShotNumber was called with the shots array
    expect(mockNextShotNumber).toHaveBeenCalledWith(existingShots)

    const docData = mockAddDoc.mock.calls[0]![1]
    expect(docData.shotNumber).toBe("SH-008")
    expect(docData.title).toBe("New Shot")
    expect(docData.status).toBe("todo")
  })

  it("generates SH-001 for empty project", async () => {
    mockNextShotNumber.mockReturnValue("SH-001")
    renderDialog([])

    fireEvent.change(screen.getByTestId("shot-title-input"), {
      target: { value: "First Shot" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create" }))

    await vi.waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalledTimes(1)
    })

    const docData = mockAddDoc.mock.calls[0]![1]
    expect(docData.shotNumber).toBe("SH-001")
  })

  it("calls onCreated callback after successful create", async () => {
    renderDialog()

    fireEvent.change(screen.getByTestId("shot-title-input"), {
      target: { value: "My Shot" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create" }))

    await vi.waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith("new-shot-1", "My Shot")
    })
  })
})
