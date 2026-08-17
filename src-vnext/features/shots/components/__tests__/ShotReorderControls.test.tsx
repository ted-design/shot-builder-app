import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ShotReorderControls } from "../ShotReorderControls"
import type { Shot } from "@/shared/types"

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ clientId: "c1" }),
}))

vi.mock("@/features/shots/lib/reorderShots", () => ({
  persistShotOrder: vi.fn().mockResolvedValue(undefined),
}))

const shots = [
  { id: "shot-1" },
  { id: "shot-2" },
  { id: "shot-3" },
] as unknown as Shot[]

describe("ShotReorderControls aria-labels", () => {
  it("resolves the up chevron by its aria-label", () => {
    render(
      <ShotReorderControls
        shot={shots[1]!}
        shots={shots}
        index={1}
        onOptimisticReorder={vi.fn()}
        onReorderComplete={vi.fn()}
      />,
    )
    expect(screen.getByRole("button", { name: /move shot up/i })).toBeInTheDocument()
  })

  it("resolves the down chevron by its aria-label", () => {
    render(
      <ShotReorderControls
        shot={shots[1]!}
        shots={shots}
        index={1}
        onOptimisticReorder={vi.fn()}
        onReorderComplete={vi.fn()}
      />,
    )
    expect(screen.getByRole("button", { name: /move shot down/i })).toBeInTheDocument()
  })
})
