import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import { BulkActionBar } from "@/features/shots/components/BulkActionBar"
import type { Role, Shot } from "@/shared/types"

// useAvailableTags reads Firestore via useShots — stub it so the bar renders standalone.
vi.mock("@/features/shots/hooks/useAvailableTags", () => ({
  useAvailableTags: () => ({ tags: [], loading: false, error: null }),
}))

function makeShot(id: string): Shot {
  return {
    id,
    title: `Shot ${id}`,
    status: "todo",
    talent: [],
    products: [],
    sortOrder: 0,
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
}) {
  const onMergeOpen = opts.onMergeOpen
  render(
    <BulkActionBar
      displayShots={DISPLAY_SHOTS}
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
      onClearSelection={() => {}}
      onGroupSceneOpen={() => {}}
      onMergeOpen={onMergeOpen}
      canShare
      canExport
      locations={[]}
      talent={[]}
    />,
  )
}

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
