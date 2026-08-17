/// <reference types="@testing-library/jest-dom" />
// 0.3 — row memoization (Phase 0 build plan, G4 A3).
//
// RowCells and SortableRow are wrapped in React.memo with a comparator over
// {shot, visibleColumns, isSelected, ctx} so that toggling ONE row's
// selection doesn't force every row's cells to re-render. This test proves
// it by spying on renderShotCell (called once per visible column per row)
// and confirming only the toggled row re-invokes it.
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { useState } from "react"
import { Timestamp } from "firebase/firestore"
import { ShotsTable } from "../ShotsTable"
import type { Shot } from "@/shared/types"

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ clientId: "c1", user: { uid: "u1" }, role: "producer" }),
}))

vi.mock("@/features/shots/lib/updateShotWithVersion", () => ({
  updateShotWithVersion: vi.fn().mockResolvedValue(undefined),
}))

// Render-counter: records which shot id renderShotCell was invoked for on
// each render pass, so the test can assert unaffected rows never re-invoke
// it after an unrelated selection toggle.
const renderShotCellCalls = vi.hoisted(() => ({ ids: [] as string[] }))

vi.mock("@/features/shots/lib/shotColumnRenderers", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/features/shots/lib/shotColumnRenderers")>()
  return {
    ...actual,
    renderShotCell: (
      shot: Shot,
      columnKey: string,
      ctx: Parameters<typeof actual.renderShotCell>[2],
    ) => {
      renderShotCellCalls.ids.push(shot.id)
      return actual.renderShotCell(shot, columnKey, ctx)
    },
  }
})

function makeShot(overrides: Partial<Shot>): Shot {
  const now = Timestamp.fromMillis(Date.now())
  return {
    id: overrides.id ?? "s1",
    title: overrides.title ?? "Shot",
    projectId: overrides.projectId ?? "p1",
    clientId: overrides.clientId ?? "c1",
    status: overrides.status ?? "todo",
    talent: overrides.talent ?? [],
    talentIds: overrides.talentIds,
    products: overrides.products ?? [],
    locationId: overrides.locationId,
    locationName: overrides.locationName,
    laneId: overrides.laneId,
    sortOrder: overrides.sortOrder ?? 0,
    shotNumber: overrides.shotNumber,
    notes: overrides.notes,
    notesAddendum: overrides.notesAddendum,
    referenceLinks: overrides.referenceLinks,
    date: overrides.date,
    heroImage: overrides.heroImage,
    tags: overrides.tags,
    deleted: overrides.deleted,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    createdBy: overrides.createdBy ?? "u1",
  }
}

const SHOTS: readonly Shot[] = [
  makeShot({ id: "a", title: "Alpha", shotNumber: "1", sortOrder: 0 }),
  makeShot({ id: "b", title: "Bravo", shotNumber: "2", sortOrder: 1 }),
  makeShot({ id: "c", title: "Charlie", shotNumber: "3", sortOrder: 2 }),
]

function SelectableTable({ reorderEnabled }: { readonly reorderEnabled: boolean }) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set())
  return (
    <ShotsTable
      clientId="c1"
      projectId="p1"
      shots={SHOTS}
      onOpenShot={() => {}}
      reorderEnabled={reorderEnabled}
      selection={{
        enabled: true,
        selectedIds,
        onToggle: (id) => {
          setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
          })
        },
        onToggleAll: () => {},
      }}
    />
  )
}

// Toggles a boolean that changes the row's own <td> count (selectionEnabled
// or showLifecycleActions) via a button, without touching `shots` — isolates
// the memo-comparator bug from any data/ctx change that would legitimately
// force a re-render on its own.
function ToggleColumnCountTable({
  toggle,
}: {
  readonly toggle: "selectionEnabled" | "showLifecycleActions"
}) {
  const [on, setOn] = useState(true)
  return (
    <>
      <button type="button" onClick={() => setOn((v) => !v)}>
        toggle
      </button>
      <ShotsTable
        clientId="c1"
        projectId="p1"
        shots={SHOTS}
        onOpenShot={() => {}}
        reorderEnabled={false}
        selection={
          toggle === "selectionEnabled"
            ? { enabled: on, selectedIds: new Set(), onToggle: () => {}, onToggleAll: () => {} }
            : { enabled: true, selectedIds: new Set(), onToggle: () => {}, onToggleAll: () => {} }
        }
        showLifecycleActions={toggle === "showLifecycleActions" ? on : false}
        renderLifecycleAction={() => <button type="button">Actions</button>}
      />
    </>
  )
}

function expectEveryRowTdCountMatchesTheadThCount() {
  const theadThCount = document.querySelectorAll("thead th").length
  const rows = document.querySelectorAll("tbody tr")
  expect(rows.length).toBeGreaterThan(0)
  rows.forEach((row, i) => {
    expect(row.querySelectorAll(":scope > td").length, `row ${i} <td> count`).toBe(theadThCount)
  })
}

describe("ShotsTable row memoization", () => {
  it("keeps every row's <td> count in sync with <thead> after selectionEnabled toggles off", () => {
    render(<ToggleColumnCountTable toggle="selectionEnabled" />)
    expectEveryRowTdCountMatchesTheadThCount()
    fireEvent.click(screen.getByText("toggle"))
    expectEveryRowTdCountMatchesTheadThCount()
  })

  it("keeps every row's <td> count in sync with <thead> after showLifecycleActions toggles on", () => {
    render(<ToggleColumnCountTable toggle="showLifecycleActions" />)
    expectEveryRowTdCountMatchesTheadThCount()
    fireEvent.click(screen.getByText("toggle"))
    expectEveryRowTdCountMatchesTheadThCount()
  })

  it("toggling one row's selection does not re-render other rows' cells (plain <tr> path)", () => {
    render(<SelectableTable reorderEnabled={false} />)
    renderShotCellCalls.ids = [] // discard the initial-mount render

    const checkboxes = screen.getAllByRole("checkbox", { name: /select shot/i })
    expect(checkboxes).toHaveLength(3)
    fireEvent.click(checkboxes[0]!) // toggle row "a"

    expect(renderShotCellCalls.ids).toContain("a")
    expect(renderShotCellCalls.ids).not.toContain("b")
    expect(renderShotCellCalls.ids).not.toContain("c")
  })

  it("toggling one row's selection does not re-render other rows' cells (SortableRow/DnD path)", () => {
    render(<SelectableTable reorderEnabled={true} />)
    renderShotCellCalls.ids = [] // discard the initial-mount render

    const checkboxes = screen.getAllByRole("checkbox", { name: /select shot/i })
    expect(checkboxes).toHaveLength(3)
    fireEvent.click(checkboxes[1]!) // toggle row "b" this time

    expect(renderShotCellCalls.ids).toContain("b")
    expect(renderShotCellCalls.ids).not.toContain("a")
    expect(renderShotCellCalls.ids).not.toContain("c")
  })
})
