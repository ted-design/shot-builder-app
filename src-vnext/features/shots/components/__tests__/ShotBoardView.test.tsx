/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Timestamp } from "firebase/firestore"
import type { Shot, ShotFirestoreStatus } from "@/shared/types"
import { ShotBoardView } from "@/features/shots/components/ShotBoardView"

// Mock dnd-kit core
const mockUseDraggable = vi.fn()
const mockUseDroppable = vi.fn()
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children, onDragEnd }: { children: React.ReactNode; onDragEnd?: (event: unknown) => void }) => (
    <div data-testid="dnd-context" data-ondragend={onDragEnd ? "bound" : "none"}>
      {children}
    </div>
  ),
  DragOverlay: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="drag-overlay">{children}</div>
  ),
  useDraggable: (args: { id: string }) => {
    mockUseDraggable(args)
    return {
      attributes: { "data-draggable-id": args.id },
      listeners: {},
      setNodeRef: vi.fn(),
      isDragging: false,
    }
  },
  useDroppable: (args: { id: string }) => {
    mockUseDroppable(args)
    return { setNodeRef: vi.fn(), isOver: false }
  },
  PointerSensor: vi.fn(),
  KeyboardSensor: vi.fn(),
  closestCenter: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}))

vi.mock("@/shared/hooks/useStorageUrl", () => ({
  useStorageUrl: (candidate: string | undefined) => candidate ?? null,
}))

function makeShot(overrides: Partial<Shot> = {}): Shot {
  const now = Timestamp.fromMillis(Date.now())
  return {
    id: overrides.id ?? "s1",
    title: overrides.title ?? "Shot",
    projectId: "p1",
    clientId: "c1",
    status: overrides.status ?? "todo",
    talent: overrides.talent ?? [],
    talentIds: overrides.talentIds,
    products: overrides.products ?? [],
    locationId: overrides.locationId,
    locationName: overrides.locationName,
    sortOrder: 0,
    shotNumber: overrides.shotNumber,
    date: overrides.date,
    heroImage: overrides.heroImage,
    tags: overrides.tags,
    deleted: overrides.deleted,
    createdAt: now,
    updatedAt: now,
    createdBy: "u1",
  }
}

function renderBoard(
  shots: ReadonlyArray<Shot>,
  overrides: Partial<{
    onStatusChange: (shotId: string, newStatus: ShotFirestoreStatus, shot: Shot) => void
    onOpenShot: (shotId: string) => void
  }> = {},
) {
  const props = {
    shots,
    onStatusChange: overrides.onStatusChange ?? vi.fn(),
    onOpenShot: overrides.onOpenShot ?? vi.fn(),
  }
  return render(<ShotBoardView {...props} />)
}

describe("ShotBoardView", () => {
  it("renders all 4 status columns", () => {
    renderBoard([])
    expect(screen.getByTestId("board-column-todo")).toBeInTheDocument()
    expect(screen.getByTestId("board-column-in_progress")).toBeInTheDocument()
    expect(screen.getByTestId("board-column-on_hold")).toBeInTheDocument()
    expect(screen.getByTestId("board-column-complete")).toBeInTheDocument()
  })

  it("renders column headers with status labels", () => {
    renderBoard([])
    expect(screen.getByText("Draft")).toBeInTheDocument()
    expect(screen.getByText("In Progress")).toBeInTheDocument()
    expect(screen.getByText("On Hold")).toBeInTheDocument()
    expect(screen.getByText("Shot")).toBeInTheDocument()
  })

  it("distributes shots into correct columns", () => {
    const shots = [
      makeShot({ id: "a", title: "Alpha", status: "todo" }),
      makeShot({ id: "b", title: "Bravo", status: "in_progress" }),
      makeShot({ id: "c", title: "Charlie", status: "complete" }),
    ]
    renderBoard(shots)

    const todoCol = screen.getByTestId("board-column-todo")
    const ipCol = screen.getByTestId("board-column-in_progress")
    const completeCol = screen.getByTestId("board-column-complete")

    expect(todoCol).toHaveTextContent("Alpha")
    expect(ipCol).toHaveTextContent("Bravo")
    expect(completeCol).toHaveTextContent("Charlie")
  })

  it("shows 'No shots' for empty columns", () => {
    renderBoard([makeShot({ status: "todo" })])
    // in_progress, on_hold, complete columns should show "No shots"
    const noShotsTexts = screen.getAllByText("No shots")
    expect(noShotsTexts.length).toBe(3)
  })

  it("shows correct count in column headers", () => {
    const shots = [
      makeShot({ id: "a", status: "todo" }),
      makeShot({ id: "b", status: "todo" }),
      makeShot({ id: "c", status: "complete" }),
    ]
    renderBoard(shots)

    const todoCol = screen.getByTestId("board-column-todo")
    const completeCol = screen.getByTestId("board-column-complete")
    // Column header shows count
    expect(todoCol).toHaveTextContent("2")
    expect(completeCol).toHaveTextContent("1")
  })

  it("calls onOpenShot when a card is clicked", () => {
    const onOpenShot = vi.fn()
    const shots = [makeShot({ id: "shot-x", title: "Click Me" })]
    renderBoard(shots, { onOpenShot })

    fireEvent.click(screen.getByText("Click Me"))
    expect(onOpenShot).toHaveBeenCalledWith("shot-x")
  })

  it("renders DndContext wrapper", () => {
    renderBoard([])
    expect(screen.getByTestId("dnd-context")).toBeInTheDocument()
  })

  it("renders DragOverlay", () => {
    renderBoard([])
    expect(screen.getByTestId("drag-overlay")).toBeInTheDocument()
  })

  it("creates droppable zones for each status", () => {
    renderBoard([])
    // useDroppable should be called for each of the 4 columns
    const droppableIds = mockUseDroppable.mock.calls.map((c: [{ id: string }]) => c[0].id)
    expect(droppableIds).toContain("todo")
    expect(droppableIds).toContain("in_progress")
    expect(droppableIds).toContain("on_hold")
    expect(droppableIds).toContain("complete")
  })

  it("creates draggable for each shot card", () => {
    const shots = [
      makeShot({ id: "a", status: "todo" }),
      makeShot({ id: "b", status: "in_progress" }),
    ]
    renderBoard(shots)
    const draggableIds = mockUseDraggable.mock.calls.map((c: [{ id: string }]) => c[0].id)
    expect(draggableIds).toContain("a")
    expect(draggableIds).toContain("b")
  })

  it("renders grid with 4 columns", () => {
    const { container } = renderBoard([])
    const grid = container.querySelector("[data-testid='dnd-context'] > div")
    expect(grid).toBeInTheDocument()
    expect(grid?.className).toMatch(/grid/)
  })
})
