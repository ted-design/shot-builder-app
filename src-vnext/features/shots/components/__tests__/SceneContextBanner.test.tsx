/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { SceneContextBanner } from "@/features/shots/components/SceneContextBanner"
import type { Lane } from "@/shared/types"

const mkLane = (overrides: Partial<Lane> = {}): Lane => ({
  id: "lane-1",
  name: "Beach Lifestyle",
  projectId: "p1",
  clientId: "c1",
  sortOrder: 0,
  color: "teal",
  sceneNumber: 2,
  direction: "Warm tones, golden hour",
  notes: "",
  createdAt: { toDate: () => new Date() } as unknown as Lane["createdAt"],
  updatedAt: { toDate: () => new Date() } as unknown as Lane["updatedAt"],
  createdBy: "u1",
  ...overrides,
})

describe("SceneContextBanner", () => {
  it("renders nothing when laneId is null", () => {
    const { container } = render(
      <SceneContextBanner
        laneId={null}
        laneById={new Map()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when laneId is undefined", () => {
    const { container } = render(
      <SceneContextBanner
        laneId={undefined}
        laneById={new Map()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing when lane is not found in laneById", () => {
    const { container } = render(
      <SceneContextBanner
        laneId="missing-lane"
        laneById={new Map()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders scene name and number when lane is present", () => {
    const lane = mkLane()
    const laneById = new Map([[lane.id, lane]])

    render(<SceneContextBanner laneId={lane.id} laneById={laneById} />)

    expect(screen.getByTestId("scene-context-banner")).toBeInTheDocument()
    expect(screen.getByText("#2")).toBeInTheDocument()
    expect(screen.getByText("Beach Lifestyle")).toBeInTheDocument()
  })

  it("renders scene name without number when sceneNumber is missing", () => {
    const lane = mkLane({ sceneNumber: undefined })
    const laneById = new Map([[lane.id, lane]])

    render(<SceneContextBanner laneId={lane.id} laneById={laneById} />)

    expect(screen.getByText("Beach Lifestyle")).toBeInTheDocument()
    expect(screen.queryByText(/^#/)).toBeNull()
  })

  it("renders direction preview when direction exists", () => {
    const lane = mkLane({ direction: "Short direction" })
    const laneById = new Map([[lane.id, lane]])

    render(<SceneContextBanner laneId={lane.id} laneById={laneById} />)

    expect(screen.getByText("Short direction")).toBeInTheDocument()
  })

  it("truncates direction longer than 100 characters with ellipsis", () => {
    const longDirection = "a".repeat(150)
    const lane = mkLane({ direction: longDirection })
    const laneById = new Map([[lane.id, lane]])

    render(<SceneContextBanner laneId={lane.id} laneById={laneById} />)

    const expected = `${"a".repeat(100)}\u2026`
    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it("renders banner without direction text when direction is missing", () => {
    const lane = mkLane({ direction: undefined })
    const laneById = new Map([[lane.id, lane]])

    render(<SceneContextBanner laneId={lane.id} laneById={laneById} />)

    expect(screen.getByTestId("scene-context-banner")).toBeInTheDocument()
    expect(screen.getByText("Beach Lifestyle")).toBeInTheDocument()
  })

  it("renders 'View scene' link when onViewScene is provided", () => {
    const lane = mkLane()
    const laneById = new Map([[lane.id, lane]])
    const onViewScene = vi.fn()

    render(
      <SceneContextBanner
        laneId={lane.id}
        laneById={laneById}
        onViewScene={onViewScene}
      />,
    )

    const link = screen.getByTestId("scene-view-link")
    expect(link).toBeInTheDocument()
    fireEvent.click(link)
    expect(onViewScene).toHaveBeenCalledTimes(1)
  })

  it("does not render 'View scene' link when onViewScene is undefined", () => {
    const lane = mkLane()
    const laneById = new Map([[lane.id, lane]])

    render(<SceneContextBanner laneId={lane.id} laneById={laneById} />)

    expect(screen.queryByTestId("scene-view-link")).toBeNull()
  })
})
