/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { SceneAssignPopover } from "./SceneAssignPopover"
import type { Lane } from "@/shared/types"
import type { Timestamp } from "firebase/firestore"

const MOCK_TIMESTAMP = { toMillis: () => 0, toDate: () => new Date(0) } as unknown as Timestamp

function makeLane(overrides: Partial<Lane> = {}): Lane {
  return {
    id: overrides.id ?? "lane-1",
    name: overrides.name ?? "Kitchen Scene",
    projectId: "proj-1",
    clientId: "client-1",
    sortOrder: overrides.sortOrder ?? 0,
    color: overrides.color ?? "teal",
    sceneNumber: overrides.sceneNumber ?? 1,
    direction: overrides.direction,
    notes: overrides.notes,
    createdAt: MOCK_TIMESTAMP,
    updatedAt: MOCK_TIMESTAMP,
    createdBy: "user-1",
  }
}

describe("SceneAssignPopover", () => {
  it("renders the trigger children", () => {
    render(
      <SceneAssignPopover
        shot={{ id: "shot-1", laneId: null }}
        lanes={[]}
        onAssign={vi.fn()}
      >
        <button>Click me</button>
      </SceneAssignPopover>,
    )
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument()
  })

  it("shows lane options and ungrouped option when opened", () => {
    const lanes = [
      makeLane({ id: "lane-1", name: "Kitchen Scene", sceneNumber: 1 }),
      makeLane({ id: "lane-2", name: "Living Room", sceneNumber: 2, color: "purple" }),
    ]
    render(
      <SceneAssignPopover
        shot={{ id: "shot-1", laneId: null }}
        lanes={lanes}
        onAssign={vi.fn()}
      >
        <button>Trigger</button>
      </SceneAssignPopover>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Trigger" }))

    expect(screen.getByText("None (ungrouped)")).toBeInTheDocument()
    expect(screen.getByText(/Kitchen Scene/)).toBeInTheDocument()
    expect(screen.getByText(/Living Room/)).toBeInTheDocument()
  })

  it("calls onAssign with laneId when a lane is selected", () => {
    const onAssign = vi.fn()
    const lanes = [makeLane({ id: "lane-1", name: "Kitchen", sceneNumber: 1 })]
    render(
      <SceneAssignPopover
        shot={{ id: "shot-1", laneId: null }}
        lanes={lanes}
        onAssign={onAssign}
      >
        <button>Trigger</button>
      </SceneAssignPopover>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Trigger" }))
    fireEvent.click(screen.getByText(/Kitchen/))

    expect(onAssign).toHaveBeenCalledWith("shot-1", "lane-1")
  })

  it("calls onAssign with null when 'None (ungrouped)' is selected", () => {
    const onAssign = vi.fn()
    const lanes = [makeLane({ id: "lane-1", name: "Kitchen", sceneNumber: 1 })]
    render(
      <SceneAssignPopover
        shot={{ id: "shot-1", laneId: "lane-1" }}
        lanes={lanes}
        onAssign={onAssign}
      >
        <button>Trigger</button>
      </SceneAssignPopover>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Trigger" }))
    fireEvent.click(screen.getByText("None (ungrouped)"))

    expect(onAssign).toHaveBeenCalledWith("shot-1", null)
  })

  it("shows empty state when no lanes exist", () => {
    render(
      <SceneAssignPopover
        shot={{ id: "shot-1", laneId: null }}
        lanes={[]}
        onAssign={vi.fn()}
      >
        <button>Trigger</button>
      </SceneAssignPopover>,
    )

    fireEvent.click(screen.getByRole("button", { name: "Trigger" }))
    expect(screen.getByText("No scenes created yet")).toBeInTheDocument()
  })
})
