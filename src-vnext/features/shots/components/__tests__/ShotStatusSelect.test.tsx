import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ShotStatusSelect } from "../ShotStatusSelect"
import type { Shot } from "@/shared/types"

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ clientId: "c1", user: { uid: "u1" }, role: "producer" }),
}))

vi.mock("@/features/shots/lib/updateShotWithVersion", () => ({
  updateShotWithVersion: vi.fn().mockResolvedValue(undefined),
}))

const baseShot = {
  id: "shot-1",
  projectId: "p1",
  clientId: "c1",
  title: "Test Shot",
  status: "todo" as const,
  talent: [],
  products: [],
  sortOrder: 1,
  deleted: false,
} as unknown as Shot

describe("ShotStatusSelect variants", () => {
  it("default variant renders the legacy fixed-width trigger with the status badge", () => {
    render(<ShotStatusSelect shotId="shot-1" currentStatus="todo" shot={baseShot} />)
    const trigger = screen.getByTestId("shot-status-select-trigger")
    expect(trigger).toHaveClass("w-[128px]")
    expect(screen.getByText("Draft")).toBeInTheDocument()
  })

  it('"badge" variant restyles the trigger borderless while keeping the testid and label', () => {
    render(
      <ShotStatusSelect shotId="shot-1" currentStatus="in_progress" shot={baseShot} variant="badge" />,
    )
    const trigger = screen.getByTestId("shot-status-select-trigger")
    expect(trigger).toHaveClass("border-0", "bg-transparent", "w-auto")
    expect(trigger).not.toHaveClass("w-[128px]")
    expect(screen.getByText("In Progress")).toBeInTheDocument()
  })

  it('"badge" variant still respects the disabled capability prop', () => {
    render(
      <ShotStatusSelect
        shotId="shot-1"
        currentStatus="todo"
        shot={baseShot}
        variant="badge"
        disabled={true}
      />,
    )
    expect(screen.getByTestId("shot-status-select-trigger")).toBeDisabled()
  })
})
