/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import type { Lane } from "@/shared/types"

vi.mock("@/features/shots/lib/laneActions", () => ({
  updateLane: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { updateLane } from "@/features/shots/lib/laneActions"
import { toast } from "sonner"
import { SceneDetailSheet } from "@/features/shots/components/SceneDetailSheet"

const baseLane: Lane = {
  id: "lane-1",
  name: "Beach Lifestyle",
  projectId: "p1",
  clientId: "c1",
  sortOrder: 0,
  color: "teal",
  sceneNumber: 3,
  direction: "Golden hour, warm tones",
  notes: "Bring reflector",
  createdAt: { toDate: () => new Date() } as unknown as Lane["createdAt"],
  updatedAt: { toDate: () => new Date() } as unknown as Lane["updatedAt"],
  createdBy: "u1",
}

describe("SceneDetailSheet", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("renders nothing when lane is null", () => {
    const { container } = render(
      <SceneDetailSheet
        open
        onOpenChange={vi.fn()}
        lane={null}
        projectId="p1"
        clientId="c1"
        canEditScene
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it("renders scene name, number, direction, and notes from the lane", () => {
    render(
      <SceneDetailSheet
        open
        onOpenChange={vi.fn()}
        lane={baseLane}
        projectId="p1"
        clientId="c1"
        shotCount={4}
        canEditScene
      />,
    )

    expect(screen.getByTestId("scene-name-input")).toHaveValue("Beach Lifestyle")
    expect(screen.getByTestId("scene-number-input")).toHaveValue(3)
    expect(screen.getByTestId("scene-direction-textarea")).toHaveValue(
      "Golden hour, warm tones",
    )
    expect(screen.getByTestId("scene-notes-textarea")).toHaveValue("Bring reflector")
    expect(screen.getByText("4")).toBeInTheDocument()
    expect(screen.getByText("shots in this scene")).toBeInTheDocument()
  })

  it("renders all 6 scene color swatches", () => {
    render(
      <SceneDetailSheet
        open
        onOpenChange={vi.fn()}
        lane={baseLane}
        projectId="p1"
        clientId="c1"
        canEditScene
      />,
    )
    expect(screen.getByTestId("scene-color-teal")).toBeInTheDocument()
    expect(screen.getByTestId("scene-color-purple")).toBeInTheDocument()
    expect(screen.getByTestId("scene-color-green")).toBeInTheDocument()
    expect(screen.getByTestId("scene-color-orange")).toBeInTheDocument()
    expect(screen.getByTestId("scene-color-pink")).toBeInTheDocument()
    expect(screen.getByTestId("scene-color-blue")).toBeInTheDocument()
  })

  it("calls updateLane with new name on blur when name changes", async () => {
    render(
      <SceneDetailSheet
        open
        onOpenChange={vi.fn()}
        lane={baseLane}
        projectId="p1"
        clientId="c1"
        canEditScene
      />,
    )

    const nameInput = screen.getByTestId("scene-name-input")
    fireEvent.change(nameInput, { target: { value: "Mountain Vista" } })
    fireEvent.blur(nameInput)

    await waitFor(() => {
      expect(updateLane).toHaveBeenCalledWith({
        laneId: "lane-1",
        projectId: "p1",
        clientId: "c1",
        patch: { name: "Mountain Vista" },
      })
    })
  })

  it("does not call updateLane when name is unchanged on blur", async () => {
    render(
      <SceneDetailSheet
        open
        onOpenChange={vi.fn()}
        lane={baseLane}
        projectId="p1"
        clientId="c1"
        canEditScene
      />,
    )

    const nameInput = screen.getByTestId("scene-name-input")
    fireEvent.blur(nameInput)

    // Flush any pending microtasks
    await Promise.resolve()
    expect(updateLane).not.toHaveBeenCalled()
  })

  it("calls updateLane with new sceneNumber on blur", async () => {
    render(
      <SceneDetailSheet
        open
        onOpenChange={vi.fn()}
        lane={baseLane}
        projectId="p1"
        clientId="c1"
        canEditScene
      />,
    )

    const numberInput = screen.getByTestId("scene-number-input")
    fireEvent.change(numberInput, { target: { value: "7" } })
    fireEvent.blur(numberInput)

    await waitFor(() => {
      expect(updateLane).toHaveBeenCalledWith({
        laneId: "lane-1",
        projectId: "p1",
        clientId: "c1",
        patch: { sceneNumber: 7 },
      })
    })
  })

  it("calls updateLane with new color when a swatch is clicked", async () => {
    render(
      <SceneDetailSheet
        open
        onOpenChange={vi.fn()}
        lane={baseLane}
        projectId="p1"
        clientId="c1"
        canEditScene
      />,
    )

    fireEvent.click(screen.getByTestId("scene-color-purple"))

    await waitFor(() => {
      expect(updateLane).toHaveBeenCalledWith({
        laneId: "lane-1",
        projectId: "p1",
        clientId: "c1",
        patch: { color: "purple" },
      })
    })
  })

  it("calls updateLane with notes on blur", async () => {
    render(
      <SceneDetailSheet
        open
        onOpenChange={vi.fn()}
        lane={baseLane}
        projectId="p1"
        clientId="c1"
        canEditScene
      />,
    )

    const notesTextarea = screen.getByTestId("scene-notes-textarea")
    fireEvent.change(notesTextarea, { target: { value: "New production notes" } })
    fireEvent.blur(notesTextarea)

    await waitFor(() => {
      expect(updateLane).toHaveBeenCalledWith({
        laneId: "lane-1",
        projectId: "p1",
        clientId: "c1",
        patch: { notes: "New production notes" },
      })
    })
  })

  it("shows toast.success after successful update", async () => {
    render(
      <SceneDetailSheet
        open
        onOpenChange={vi.fn()}
        lane={baseLane}
        projectId="p1"
        clientId="c1"
        canEditScene
      />,
    )

    fireEvent.click(screen.getByTestId("scene-color-pink"))

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Scene updated", { id: `scene-update:${baseLane.id}` })
    })
  })

  it("shows toast.error when updateLane throws", async () => {
    ;(updateLane as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("boom"),
    )

    render(
      <SceneDetailSheet
        open
        onOpenChange={vi.fn()}
        lane={baseLane}
        projectId="p1"
        clientId="c1"
        canEditScene
      />,
    )

    fireEvent.click(screen.getByTestId("scene-color-pink"))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update scene", { id: `scene-update:${baseLane.id}` })
    })
  })

  it("does not call updateLane when clientId is null", async () => {
    render(
      <SceneDetailSheet
        open
        onOpenChange={vi.fn()}
        lane={baseLane}
        projectId="p1"
        clientId={null}
        canEditScene
      />,
    )

    fireEvent.click(screen.getByTestId("scene-color-pink"))

    await Promise.resolve()
    expect(updateLane).not.toHaveBeenCalled()
  })

  it("displays singular 'shot' label when count is 1", () => {
    render(
      <SceneDetailSheet
        open
        onOpenChange={vi.fn()}
        lane={baseLane}
        projectId="p1"
        clientId="c1"
        shotCount={1}
        canEditScene
      />,
    )
    expect(screen.getByText("shot in this scene")).toBeInTheDocument()
  })

  it("does NOT clobber in-progress edits when parent re-renders with new lane reference (same id)", async () => {
    // Simulates a Firestore onSnapshot echo: lane.id stays the same but the object ref changes.
    // Without the useRef init gate, the effect would re-sync local state and wipe typing.
    const { rerender } = render(
      <SceneDetailSheet
        open
        onOpenChange={vi.fn()}
        lane={baseLane}
        projectId="p1"
        clientId="c1"
        canEditScene
      />,
    )

    // User types in the direction textarea
    const directionTextarea = screen.getByTestId("scene-direction-textarea") as HTMLTextAreaElement
    fireEvent.change(directionTextarea, { target: { value: "User typed this mid-edit" } })
    expect(directionTextarea.value).toBe("User typed this mid-edit")

    // Simulate snapshot echo: parent passes a new lane object with the same id
    const echoedLane: Lane = { ...baseLane, direction: "Old value from Firestore" }
    rerender(
      <SceneDetailSheet
        open
        onOpenChange={vi.fn()}
        lane={echoedLane}
        projectId="p1"
        clientId="c1"
        canEditScene
      />,
    )

    // User's in-progress text must still be there — NOT reset to "Old value from Firestore"
    expect((screen.getByTestId("scene-direction-textarea") as HTMLTextAreaElement).value).toBe(
      "User typed this mid-edit",
    )
  })

  it("re-initializes when sheet closes and re-opens for a different lane", () => {
    const laneA: Lane = { ...baseLane, id: "lane-a", name: "Lane A", direction: "direction A" }
    const laneB: Lane = { ...baseLane, id: "lane-b", name: "Lane B", direction: "direction B" }

    const onOpenChange = vi.fn()
    const { rerender } = render(
      <SceneDetailSheet open onOpenChange={onOpenChange} lane={laneA} projectId="p1" clientId="c1" canEditScene />,
    )
    expect((screen.getByTestId("scene-direction-textarea") as HTMLTextAreaElement).value).toBe(
      "direction A",
    )

    // Close the sheet
    rerender(
      <SceneDetailSheet open={false} onOpenChange={onOpenChange} lane={laneA} projectId="p1" clientId="c1" canEditScene />,
    )

    // Re-open for a different lane
    rerender(
      <SceneDetailSheet open onOpenChange={onOpenChange} lane={laneB} projectId="p1" clientId="c1" canEditScene />,
    )

    expect((screen.getByTestId("scene-direction-textarea") as HTMLTextAreaElement).value).toBe(
      "direction B",
    )
  })

  describe("canEditScene={false} (read-only, flag-independent 5a fix)", () => {
    it("renders the four fields as display values with no inputs", () => {
      render(
        <SceneDetailSheet
          open
          onOpenChange={vi.fn()}
          lane={baseLane}
          projectId="p1"
          clientId="c1"
          shotCount={4}
          canEditScene={false}
        />,
      )

      // Display values...
      expect(screen.getByTestId("scene-name-readonly")).toHaveTextContent("Beach Lifestyle")
      expect(screen.getByTestId("scene-number-readonly")).toHaveTextContent("3")
      expect(screen.getByTestId("scene-direction-readonly")).toHaveTextContent(
        "Golden hour, warm tones",
      )
      expect(screen.getByTestId("scene-notes-readonly")).toHaveTextContent("Bring reflector")

      // ...and ZERO write affordances: no inputs, no textareas, no color buttons.
      expect(screen.queryByTestId("scene-name-input")).not.toBeInTheDocument()
      expect(screen.queryByTestId("scene-number-input")).not.toBeInTheDocument()
      expect(screen.queryByTestId("scene-direction-textarea")).not.toBeInTheDocument()
      expect(screen.queryByTestId("scene-notes-textarea")).not.toBeInTheDocument()
      expect(screen.queryByTestId("scene-color-picker")).not.toBeInTheDocument()
      expect(screen.queryByTestId("scene-color-teal")).not.toBeInTheDocument()
      expect(screen.getByTestId("scene-color-readonly")).toBeInTheDocument()

      // Shot count footer still renders.
      expect(screen.getByText("shots in this scene")).toBeInTheDocument()
    })

    it("shows 'Not set' for empty direction and notes", () => {
      const bareLane: Lane = { ...baseLane, direction: undefined, notes: undefined }
      render(
        <SceneDetailSheet
          open
          onOpenChange={vi.fn()}
          lane={bareLane}
          projectId="p1"
          clientId="c1"
          canEditScene={false}
        />,
      )
      expect(screen.getByTestId("scene-direction-readonly")).toHaveTextContent("Not set")
      expect(screen.getByTestId("scene-notes-readonly")).toHaveTextContent("Not set")
    })

    it("never calls updateLane in read-only mode", async () => {
      render(
        <SceneDetailSheet
          open
          onOpenChange={vi.fn()}
          lane={baseLane}
          projectId="p1"
          clientId="c1"
          canEditScene={false}
        />,
      )

      // Nothing to type into or click; assert no save path fired on mount or
      // via the static color swatch.
      fireEvent.click(screen.getByTestId("scene-color-readonly"))
      await Promise.resolve()
      expect(updateLane).not.toHaveBeenCalled()
    })
  })
})
