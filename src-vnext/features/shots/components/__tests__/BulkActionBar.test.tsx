import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, cleanup, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Role, Shot } from "@/shared/types"

// useAvailableTags reads Firestore via useShots — stub it so the bar renders standalone.
vi.mock("@/features/shots/hooks/useAvailableTags", () => ({
  useAvailableTags: () => ({ tags: [], loading: false, error: null }),
}))

const mockGetDocs = vi.fn()
vi.mock("firebase/firestore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("firebase/firestore")>()
  return {
    ...actual,
    collection: vi.fn((...args: unknown[]) => ({ __col: args.join("/") })),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
    query: vi.fn((...args: unknown[]) => ({ __query: args })),
    where: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  }
})

vi.mock("@/shared/lib/firebase", () => ({ db: {} }))

const mockBulkCopy = vi.fn()
const mockBulkMove = vi.fn()
vi.mock("@/features/shots/lib/shotLifecycleActions", () => ({
  bulkCopyShotsToProject: (...args: unknown[]) => mockBulkCopy(...args),
  bulkMoveShotsToProject: (...args: unknown[]) => mockBulkMove(...args),
}))

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { BulkActionBar } from "@/features/shots/components/BulkActionBar"

function makeShot(id: string, overrides: Partial<Shot> = {}): Shot {
  return {
    id,
    title: overrides.title ?? `Shot ${id}`,
    status: "todo",
    talent: [],
    products: [],
    sortOrder: overrides.sortOrder ?? 0,
    ...overrides,
  } as unknown as Shot
}

const DISPLAY_SHOTS: ReadonlyArray<Shot> = [
  makeShot("a"),
  makeShot("b"),
  makeShot("c"),
]

function renderBar(opts: {
  selectedIds: ReadonlySet<string>
  role: Role
  onMergeOpen?: () => void
  onClearSelection?: () => void
  displayShots?: ReadonlyArray<Shot>
  canTransferAcrossProjects?: boolean
  currentProjectId?: string
}) {
  const onMergeOpen = opts.onMergeOpen
  render(
    <BulkActionBar
      displayShots={opts.displayShots ?? DISPLAY_SHOTS}
      selectedIds={opts.selectedIds}
      onSelectAll={() => {}}
      onDeselectAll={() => {}}
      clientId="client-1"
      user={null}
      role={opts.role}
      onShareOpen={() => {}}
      onExportClick={() => {}}
      onCreatePullOpen={() => {}}
      onBulkDeleteOpen={() => {}}
      onClearSelection={opts.onClearSelection ?? (() => {})}
      onGroupSceneOpen={() => {}}
      onMergeOpen={onMergeOpen}
      canShare
      canExport
      locations={[]}
      talent={[]}
      canTransferAcrossProjects={opts.canTransferAcrossProjects}
      currentProjectId={opts.currentProjectId ?? "current-project"}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockGetDocs.mockResolvedValue({ docs: [] })
})

function mergeButton(): HTMLButtonElement | null {
  return screen
    .queryAllByRole("button")
    .find((b) => b.textContent?.trim() === "Merge") as HTMLButtonElement | null ?? null
}

describe("BulkActionBar — Merge action", () => {
  beforeEach(() => cleanup())

  it("renders the Merge button for canManageShots roles", () => {
    renderBar({ selectedIds: new Set(["a", "b"]), role: "producer", onMergeOpen: () => {} })
    expect(mergeButton()).not.toBeNull()
  })

  it("does NOT render Merge for a viewer (no canManageShots)", () => {
    renderBar({ selectedIds: new Set(["a", "b"]), role: "viewer", onMergeOpen: () => {} })
    expect(mergeButton()).toBeNull()
  })

  it("does NOT render Merge when no onMergeOpen handler is supplied", () => {
    renderBar({ selectedIds: new Set(["a", "b"]), role: "producer" })
    expect(mergeButton()).toBeNull()
  })

  it("enables Merge only at exactly 2 selected", () => {
    // 1 selected -> disabled
    renderBar({ selectedIds: new Set(["a"]), role: "admin", onMergeOpen: () => {} })
    expect(mergeButton()?.disabled).toBe(true)
    cleanup()

    // 2 selected -> enabled
    renderBar({ selectedIds: new Set(["a", "b"]), role: "admin", onMergeOpen: () => {} })
    expect(mergeButton()?.disabled).toBe(false)
    cleanup()

    // 3 selected -> disabled
    renderBar({ selectedIds: new Set(["a", "b", "c"]), role: "admin", onMergeOpen: () => {} })
    expect(mergeButton()?.disabled).toBe(true)
  })

  it("disables Merge at 0 selected", () => {
    renderBar({ selectedIds: new Set(), role: "crew", onMergeOpen: () => {} })
    expect(mergeButton()?.disabled).toBe(true)
  })

  it("fires onMergeOpen when clicked at exactly 2 selected", () => {
    const onMergeOpen = vi.fn()
    renderBar({ selectedIds: new Set(["a", "b"]), role: "crew", onMergeOpen })
    fireEvent.click(mergeButton()!)
    expect(onMergeOpen).toHaveBeenCalledTimes(1)
  })
})

// Radix Select polyfills for JSDOM — used by the destination-project picker.
if (!HTMLElement.prototype.hasPointerCapture) {
  HTMLElement.prototype.hasPointerCapture = () => false
}
if (!HTMLElement.prototype.setPointerCapture) {
  HTMLElement.prototype.setPointerCapture = () => {}
}
if (!HTMLElement.prototype.releasePointerCapture) {
  HTMLElement.prototype.releasePointerCapture = () => {}
}
if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = () => {}
}

function buttonByText(text: string): HTMLButtonElement | null {
  return (
    (screen.queryAllByRole("button").find((b) => b.textContent?.trim() === text) as
      | HTMLButtonElement
      | undefined) ?? null
  )
}

describe("BulkActionBar — bulk Copy/Move to project", () => {
  beforeEach(() => cleanup())

  it("hides Copy/Move buttons when canTransferAcrossProjects is false (default)", () => {
    renderBar({ selectedIds: new Set(["a"]), role: "producer" })
    expect(buttonByText("Copy to project…")).toBeNull()
    expect(buttonByText("Move to project…")).toBeNull()
  })

  it("shows Copy/Move buttons when canTransferAcrossProjects is true", () => {
    renderBar({ selectedIds: new Set(["a"]), role: "producer", canTransferAcrossProjects: true })
    expect(buttonByText("Copy to project…")).not.toBeNull()
    expect(buttonByText("Move to project…")).not.toBeNull()
  })

  it("disables Copy/Move at 0 selected", () => {
    renderBar({ selectedIds: new Set(), role: "producer", canTransferAcrossProjects: true })
    expect(buttonByText("Copy to project…")?.disabled).toBe(true)
    expect(buttonByText("Move to project…")?.disabled).toBe(true)
  })

  it("opening the dialog lazy-loads the project list exactly once", async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [{ id: "target-1", data: () => ({ name: "Q4 Ecomm", status: "active" }) }],
    })
    const user = userEvent.setup()
    renderBar({
      selectedIds: new Set(["a", "b"]),
      role: "producer",
      canTransferAcrossProjects: true,
      currentProjectId: "current-project",
    })

    await user.click(buttonByText("Copy to project…")!)
    const dialog = await screen.findByRole("dialog")
    await waitFor(() => expect(within(dialog).getByText("Select project")).toBeInTheDocument())
    await user.click(within(dialog).getByRole("combobox"))
    await waitFor(() => expect(screen.getByRole("option", { name: "Q4 Ecomm" })).toBeInTheDocument())
    expect(mockGetDocs).toHaveBeenCalledTimes(1)
  })

  it("excludes the current project and archived projects from the destination picker", async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [
        { id: "current-project", data: () => ({ name: "Current", status: "active" }) },
        { id: "archived-1", data: () => ({ name: "Archived Job", status: "archived" }) },
        { id: "target-1", data: () => ({ name: "Q4 Ecomm", status: "active" }) },
      ],
    })
    const user = userEvent.setup()
    renderBar({
      selectedIds: new Set(["a", "b"]),
      role: "producer",
      canTransferAcrossProjects: true,
      currentProjectId: "current-project",
    })

    await user.click(buttonByText("Copy to project…")!)
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("combobox"))
    await waitFor(() => expect(screen.getByRole("option", { name: "Q4 Ecomm" })).toBeInTheDocument())
    expect(screen.queryByRole("option", { name: "Current" })).not.toBeInTheDocument()
    expect(screen.queryByRole("option", { name: "Archived Job" })).not.toBeInTheDocument()
  })

  it("copy: fetches target titles, calls bulkCopyShotsToProject with the selected shots, toasts, clears selection", async () => {
    mockGetDocs
      .mockResolvedValueOnce({ docs: [{ id: "target-1", data: () => ({ name: "Q4 Ecomm", status: "active" }) }] }) // projects list
      .mockResolvedValueOnce({ docs: [{ id: "x", data: () => ({ title: "Existing" }) }] }) // target titles
    mockBulkCopy.mockResolvedValue({ copiedCount: 2 })
    const onClearSelection = vi.fn()
    const user = userEvent.setup()
    renderBar({
      selectedIds: new Set(["a", "b"]),
      role: "producer",
      canTransferAcrossProjects: true,
      onClearSelection,
    })

    await user.click(buttonByText("Copy to project…")!)
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("combobox"))
    await waitFor(() => expect(screen.getByRole("option", { name: "Q4 Ecomm" })).toBeInTheDocument())
    await user.click(screen.getByRole("option", { name: "Q4 Ecomm" }))
    await user.click(buttonByText("Copy shots")!)

    await waitFor(() => expect(mockBulkCopy).toHaveBeenCalledTimes(1))
    const call = mockBulkCopy.mock.calls[0]![0] as {
      targetProjectId: string
      shots: ReadonlyArray<Shot>
      targetTitles: ReadonlySet<string>
    }
    expect(call.targetProjectId).toBe("target-1")
    expect(call.shots.map((s) => s.id).sort()).toEqual(["a", "b"])
    expect(Array.from(call.targetTitles)).toEqual(["Existing"])
    expect(onClearSelection).toHaveBeenCalledTimes(1)
  })

  it("move: calls bulkMoveShotsToProject with the selected shots and target, clears selection", async () => {
    mockGetDocs.mockResolvedValueOnce({
      docs: [{ id: "target-1", data: () => ({ name: "Q4 Ecomm", status: "active" }) }],
    })
    mockBulkMove.mockResolvedValue({ movedCount: 2 })
    const onClearSelection = vi.fn()
    const user = userEvent.setup()
    renderBar({
      selectedIds: new Set(["a", "b"]),
      role: "producer",
      canTransferAcrossProjects: true,
      onClearSelection,
    })

    await user.click(buttonByText("Move to project…")!)
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("combobox"))
    await waitFor(() => expect(screen.getByRole("option", { name: "Q4 Ecomm" })).toBeInTheDocument())
    await user.click(screen.getByRole("option", { name: "Q4 Ecomm" }))
    await user.click(buttonByText("Move shots")!)

    await waitFor(() => expect(mockBulkMove).toHaveBeenCalledTimes(1))
    const call = mockBulkMove.mock.calls[0]![0] as { targetProjectId: string; shots: ReadonlyArray<Shot> }
    expect(call.targetProjectId).toBe("target-1")
    expect(call.shots.map((s) => s.id).sort()).toEqual(["a", "b"])
    // bulkMoveShotsToProject never touches title dedup — only copy does.
    expect(mockGetDocs).toHaveBeenCalledTimes(1) // projects list only, no target-titles fetch
    expect(onClearSelection).toHaveBeenCalledTimes(1)
  })
})
