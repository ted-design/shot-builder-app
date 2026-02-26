import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ShotStatusTapRow } from "../ShotStatusTapRow"
import type { Shot } from "@/shared/types"

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ clientId: "c1", user: { uid: "u1" }, role: "producer" }),
}))

vi.mock("@/features/shots/lib/updateShotWithVersion", () => ({
  updateShotWithVersion: vi.fn().mockResolvedValue(undefined),
}))

const baseShotData = {
  id: "shot-1",
  projectId: "p1",
  clientId: "c1",
  title: "Test Shot",
  status: "todo" as const,
  talent: [],
  products: [],
  sortOrder: 1,
  deleted: false,
  createdAt: { toDate: () => new Date() },
  updatedAt: { toDate: () => new Date() },
}

describe("ShotStatusTapRow", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders 4 status buttons", () => {
    render(<ShotStatusTapRow shot={baseShotData as unknown as Shot} />)
    const row = screen.getByTestId("status-tap-row")
    expect(row).toBeInTheDocument()

    expect(screen.getByTestId("status-tap-todo")).toBeInTheDocument()
    expect(screen.getByTestId("status-tap-in_progress")).toBeInTheDocument()
    expect(screen.getByTestId("status-tap-on_hold")).toBeInTheDocument()
    expect(screen.getByTestId("status-tap-complete")).toBeInTheDocument()
  })

  it("marks current status as active (aria-pressed)", () => {
    render(<ShotStatusTapRow shot={baseShotData as unknown as Shot} />)
    const draftBtn = screen.getByTestId("status-tap-todo")
    expect(draftBtn).toHaveAttribute("aria-pressed", "true")

    const inProgressBtn = screen.getByTestId("status-tap-in_progress")
    expect(inProgressBtn).toHaveAttribute("aria-pressed", "false")
  })

  it("calls updateShotWithVersion on tap", async () => {
    const { updateShotWithVersion } = await import("@/features/shots/lib/updateShotWithVersion")
    render(<ShotStatusTapRow shot={baseShotData as unknown as Shot} />)

    fireEvent.click(screen.getByTestId("status-tap-in_progress"))

    expect(updateShotWithVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        shotId: "shot-1",
        patch: { status: "in_progress" },
      }),
    )
  })

  it("all buttons have min-h-[44px] for touch target", () => {
    render(<ShotStatusTapRow shot={baseShotData as unknown as Shot} />)
    const buttons = screen.getAllByRole("button")
    for (const btn of buttons) {
      expect(btn.className).toContain("min-h-[44px]")
    }
  })

  it("disables all buttons when disabled prop is true", () => {
    render(<ShotStatusTapRow shot={baseShotData as unknown as Shot} disabled />)
    const buttons = screen.getAllByRole("button")
    for (const btn of buttons) {
      expect(btn).toBeDisabled()
    }
  })
})
