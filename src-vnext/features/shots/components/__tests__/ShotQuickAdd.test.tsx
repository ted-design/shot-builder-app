/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { Timestamp } from "firebase/firestore"
import type { Shot } from "@/shared/types"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAddDoc = vi.fn()

vi.mock("firebase/firestore", async () => {
  const actual = await vi.importActual<typeof import("firebase/firestore")>("firebase/firestore")
  return {
    ...actual,
    addDoc: (...args: unknown[]) => mockAddDoc(...args),
    collection: vi.fn((_db: unknown, ...segments: string[]) => segments.join("/")),
    serverTimestamp: () => "SERVER_TS",
  }
})

vi.mock("@/shared/lib/firebase", () => ({
  db: {},
}))

vi.mock("@/shared/lib/paths", () => ({
  shotsPath: (clientId: string) => ["clients", clientId, "shots"],
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ clientId: "c1", user: { uid: "u1" } }),
}))

vi.mock("@/app/providers/ProjectScopeProvider", () => ({
  useProjectScope: () => ({ projectId: "p1" }),
}))

vi.mock("@/features/shots/lib/shotVersioning", () => ({
  createShotVersionSnapshot: vi.fn(() => Promise.resolve()),
}))

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

import { ShotQuickAdd } from "@/features/shots/components/ShotQuickAdd"
import { toast } from "sonner"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeShot(overrides: Partial<Shot> = {}): Shot {
  const now = Timestamp.fromMillis(Date.now())
  return {
    id: overrides.id ?? "s1",
    title: overrides.title ?? "Shot",
    projectId: "p1",
    clientId: "c1",
    status: overrides.status ?? "todo",
    talent: [],
    products: [],
    sortOrder: 0,
    shotNumber: overrides.shotNumber,
    createdAt: now,
    updatedAt: now,
    createdBy: "u1",
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ShotQuickAdd", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAddDoc.mockResolvedValue({ id: "new-shot-id" })
  })

  it("renders the input with placeholder", () => {
    render(<ShotQuickAdd shots={[]} />)
    expect(screen.getByPlaceholderText(/New shot title/i)).toBeInTheDocument()
  })

  it("renders the N keyboard shortcut hint", () => {
    render(<ShotQuickAdd shots={[]} />)
    expect(screen.getByText("N")).toBeInTheDocument()
    expect(screen.getByText("to focus")).toBeInTheDocument()
  })

  it("creates a shot on Enter with correct data", async () => {
    const onCreated = vi.fn()
    render(<ShotQuickAdd shots={[]} onCreated={onCreated} />)

    const input = screen.getByPlaceholderText(/New shot title/i)
    fireEvent.change(input, { target: { value: "Hero — Red Dress" } })
    fireEvent.keyDown(input, { key: "Enter" })

    await waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalledTimes(1)
    })

    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(data.title).toBe("Hero — Red Dress")
    expect(data.status).toBe("todo")
    expect(data.projectId).toBe("p1")
    expect(data.clientId).toBe("c1")
    expect(data.shotNumber).toBe("SH-001")
    expect(data.deleted).toBe(false)
  })

  it("calls onCreated callback after successful creation", async () => {
    const onCreated = vi.fn()
    render(<ShotQuickAdd shots={[]} onCreated={onCreated} />)

    const input = screen.getByPlaceholderText(/New shot title/i)
    fireEvent.change(input, { target: { value: "Test Shot" } })
    fireEvent.keyDown(input, { key: "Enter" })

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith("new-shot-id", "Test Shot")
    })
  })

  it("clears the input after successful creation", async () => {
    render(<ShotQuickAdd shots={[]} />)

    const input = screen.getByPlaceholderText(/New shot title/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: "Test Shot" } })
    fireEvent.keyDown(input, { key: "Enter" })

    await waitFor(() => {
      expect(input.value).toBe("")
    })
  })

  it("does not create when input is empty or whitespace", () => {
    render(<ShotQuickAdd shots={[]} />)

    const input = screen.getByPlaceholderText(/New shot title/i)
    fireEvent.change(input, { target: { value: "   " } })
    fireEvent.keyDown(input, { key: "Enter" })

    expect(mockAddDoc).not.toHaveBeenCalled()
  })

  it("clears input on Escape", () => {
    render(<ShotQuickAdd shots={[]} />)

    const input = screen.getByPlaceholderText(/New shot title/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: "Some text" } })
    expect(input.value).toBe("Some text")

    fireEvent.keyDown(input, { key: "Escape" })
    expect(input.value).toBe("")
  })

  it("computes next shot number from existing shots", async () => {
    const shots = [
      makeShot({ id: "s1", shotNumber: "SH-005" }),
      makeShot({ id: "s2", shotNumber: "SH-012" }),
      makeShot({ id: "s3" }), // no shot number
    ]

    render(<ShotQuickAdd shots={shots} />)

    const input = screen.getByPlaceholderText(/New shot title/i)
    fireEvent.change(input, { target: { value: "New Shot" } })
    fireEvent.keyDown(input, { key: "Enter" })

    await waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalledTimes(1)
    })

    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(data.shotNumber).toBe("SH-013")
  })

  it("handles mixed shot number formats", async () => {
    const shots = [
      makeShot({ id: "s1", shotNumber: "S-03" }),
      makeShot({ id: "s2", shotNumber: "QA-20" }),
      makeShot({ id: "s3", shotNumber: "7" }),
    ]

    render(<ShotQuickAdd shots={shots} />)

    const input = screen.getByPlaceholderText(/New shot title/i)
    fireEvent.change(input, { target: { value: "New Shot" } })
    fireEvent.keyDown(input, { key: "Enter" })

    await waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalledTimes(1)
    })

    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(data.shotNumber).toBe("SH-021")
  })

  it("shows error toast on Firestore failure", async () => {
    mockAddDoc.mockRejectedValueOnce(new Error("Permission denied"))

    render(<ShotQuickAdd shots={[]} />)

    const input = screen.getByPlaceholderText(/New shot title/i)
    fireEvent.change(input, { target: { value: "Failing Shot" } })
    fireEvent.keyDown(input, { key: "Enter" })

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to create shot", {
        description: "Permission denied",
      })
    })
  })

  it("disables input while creating", async () => {
    // Make addDoc hang
    let resolveAddDoc: (value: { id: string }) => void = () => {}
    mockAddDoc.mockReturnValueOnce(
      new Promise<{ id: string }>((resolve) => { resolveAddDoc = resolve }),
    )

    render(<ShotQuickAdd shots={[]} />)

    const input = screen.getByPlaceholderText(/New shot title/i) as HTMLInputElement
    fireEvent.change(input, { target: { value: "Test" } })
    fireEvent.keyDown(input, { key: "Enter" })

    await waitFor(() => {
      expect(input.disabled).toBe(true)
    })

    // Resolve to re-enable
    resolveAddDoc({ id: "new-id" })

    await waitFor(() => {
      expect(input.disabled).toBe(false)
    })
  })

  it("trims whitespace from title before creating", async () => {
    render(<ShotQuickAdd shots={[]} />)

    const input = screen.getByPlaceholderText(/New shot title/i)
    fireEvent.change(input, { target: { value: "  Spaced Title  " } })
    fireEvent.keyDown(input, { key: "Enter" })

    await waitFor(() => {
      expect(mockAddDoc).toHaveBeenCalledTimes(1)
    })

    const [, data] = mockAddDoc.mock.calls[0] as [unknown, Record<string, unknown>]
    expect(data.title).toBe("Spaced Title")
  })

  // -------------------------------------------------------------------------
  // Batch create integration
  // -------------------------------------------------------------------------

  describe("batch create", () => {
    it("renders Batch paste trigger button", () => {
      render(<ShotQuickAdd shots={[]} />)
      expect(screen.getByRole("button", { name: /batch paste/i })).toBeInTheDocument()
    })

    it("opens batch popover on trigger click", async () => {
      render(<ShotQuickAdd shots={[]} />)
      fireEvent.click(screen.getByRole("button", { name: /batch paste/i }))

      await waitFor(() => {
        expect(screen.getByText("Batch create shots")).toBeInTheDocument()
      })
    })

    it("creates multiple shots on batch create", async () => {
      const onCreated = vi.fn()
      render(<ShotQuickAdd shots={[]} onCreated={onCreated} />)

      // Open the batch popover
      fireEvent.click(screen.getByRole("button", { name: /batch paste/i }))

      await waitFor(() => {
        expect(screen.getByText("Batch create shots")).toBeInTheDocument()
      })

      // Type titles into the batch textarea (not the quick-add input)
      const textarea = screen.getByPlaceholderText(/Hero/)
      fireEvent.change(textarea, {
        target: { value: "Shot Alpha\nShot Beta\nShot Gamma" },
      })

      // Click Create all
      fireEvent.click(screen.getByRole("button", { name: /create all/i }))

      await waitFor(() => {
        expect(mockAddDoc).toHaveBeenCalledTimes(3)
      })

      // Verify titles
      const titles = mockAddDoc.mock.calls.map(
        (call: [unknown, Record<string, unknown>]) => call[1].title,
      )
      expect(titles).toEqual(["Shot Alpha", "Shot Beta", "Shot Gamma"])

      // Verify shot numbers increment
      const numbers = mockAddDoc.mock.calls.map(
        (call: [unknown, Record<string, unknown>]) => call[1].shotNumber,
      )
      expect(numbers).toEqual(["SH-001", "SH-002", "SH-003"])

      // Verify onCreated called for each
      await waitFor(() => {
        expect(onCreated).toHaveBeenCalledTimes(3)
      })
    })

    it("shows summary toast after batch create", async () => {
      render(<ShotQuickAdd shots={[]} />)

      fireEvent.click(screen.getByRole("button", { name: /batch paste/i }))

      await waitFor(() => {
        expect(screen.getByText("Batch create shots")).toBeInTheDocument()
      })

      const textarea = screen.getByPlaceholderText(/Hero/)
      fireEvent.change(textarea, {
        target: { value: "Shot A\nShot B" },
      })

      fireEvent.click(screen.getByRole("button", { name: /create all/i }))

      await waitFor(() => {
        expect(toast.success).toHaveBeenCalledWith("Created 2 shots")
      })
    })
  })
})
