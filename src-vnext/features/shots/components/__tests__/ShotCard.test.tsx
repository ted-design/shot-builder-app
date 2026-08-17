import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { ShotCard } from "../ShotCard"
import type { Shot } from "@/shared/types"

vi.mock("@/app/providers/ProjectScopeProvider", () => ({
  useProjectScope: () => ({ projectId: "p1", projectName: "Project 1" }),
}))

vi.mock("@/shared/hooks/useStorageUrl", () => ({
  useStorageUrl: () => undefined,
}))

vi.mock("@/features/shots/components/ShotStatusSelect", () => ({
  ShotStatusSelect: () => <div data-testid="status-select-stub" />,
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
  createdAt: { toDate: () => new Date() },
  updatedAt: { toDate: () => new Date() },
}

function renderCard(onOpenShot = vi.fn()) {
  render(
    <MemoryRouter>
      <ShotCard shot={baseShot as unknown as Shot} onOpenShot={onOpenShot} />
    </MemoryRouter>,
  )
  return onOpenShot
}

describe("ShotCard keyboard activation", () => {
  it("calls onOpenShot with shot.id when Enter is pressed", () => {
    const onOpenShot = renderCard()
    fireEvent.keyDown(screen.getByTestId("shot-card"), { key: "Enter" })
    expect(onOpenShot).toHaveBeenCalledWith("shot-1")
  })

  it("calls onOpenShot with shot.id when Space is pressed", () => {
    const onOpenShot = renderCard()
    fireEvent.keyDown(screen.getByTestId("shot-card"), { key: " " })
    expect(onOpenShot).toHaveBeenCalledWith("shot-1")
  })

  it("has tabindex 0", () => {
    renderCard()
    expect(screen.getByTestId("shot-card")).toHaveAttribute("tabindex", "0")
  })
})
