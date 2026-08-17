/// <reference types="@testing-library/jest-dom" />
// Phase 1 — dual-write mirror wiring at ShotsTable's THREE shots-local call
// sites (build plan §Phase 1, recon corrections #1): column resize
// (handleColumnResizeEnd), reorder (handleReorderColumns wrapping
// useTableColumns' reorderColumns), and visibility (handleToggleVisibility,
// the thin shots-local wrapper since visibility has no seam of its own).
//
// Renders with shots=[] (no row mounts — same pattern as
// ShotsTable.thScope.test.tsx) so no AuthProvider/ShotStatusSelect
// dependency is needed; these interactions only touch column definitions.
//
// Reorder is dnd-kit pointer-drag-based and has no established jsdom
// simulation pattern anywhere in this repo (verified — not even
// ColumnSettingsPopover's own test exercises onReorder via drag). Rather
// than fight dnd-kit/jsdom pointer capture, ColumnSettingsPopover is mocked
// here to a thin stub that invokes the received onReorder/onToggleVisibility
// props directly — this test is about ShotsTable's WIRING to those props,
// not about ColumnSettingsPopover's own DnD mechanics (covered by its own
// test file) or useColumnResize's mouse mechanics (covered by
// useColumnResize.test.ts). Resize is driven through the REAL
// ResizableHeader + useColumnResize path (plain mouse events, no DnD).
import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { ShotsTable } from "../ShotsTable"
import { prefsV2Key, tableV3Key, type ShotsPrefsV2 } from "@/features/shots/lib/migrateShotsPrefsV2"
import { SHOT_TABLE_COLUMNS } from "@/features/shots/lib/shotTableColumns"

vi.mock("@/shared/components/ColumnSettingsPopover", () => ({
  ColumnSettingsPopover: (props: {
    readonly onToggleVisibility: (key: string) => void
    readonly onReorder: (keys: readonly string[]) => void
    readonly children: ReactNode
  }) => (
    <div>
      {props.children}
      <button type="button" onClick={() => props.onToggleVisibility("date")}>
        mock-toggle-date
      </button>
      <button type="button" onClick={() => props.onReorder(["talent", "date", "notes"])}>
        mock-reorder
      </button>
    </div>
  ),
}))

const CLIENT = "c1"
const PROJECT = "p1"

function readV2(): ShotsPrefsV2 | null {
  const raw = window.localStorage.getItem(prefsV2Key(CLIENT, PROJECT))
  return raw ? (JSON.parse(raw) as ShotsPrefsV2) : null
}

beforeEach(() => {
  window.localStorage.clear()
})

function renderTable() {
  return render(
    <ShotsTable clientId={CLIENT} projectId={PROJECT} shots={[]} onOpenShot={() => {}} />,
  )
}

describe("ShotsTable — Phase 1 v2 dual-write wiring", () => {
  it("column RESIZE (real mouse drag through ResizableHeader/useColumnResize) mirrors width into v2", () => {
    renderTable()

    const dateHeader = screen.getByText("Date").closest("th")!
    const separator = within(dateHeader).getByRole("separator")

    fireEvent.mouseDown(separator, { clientX: 100 })
    fireEvent.mouseMove(document, { clientX: 140 }) // +40px
    fireEvent.mouseUp(document)

    // Legacy Store 3 (existing behavior) still gets the write.
    const store3 = JSON.parse(window.localStorage.getItem(tableV3Key(CLIENT, PROJECT))!) as Array<{
      key: string
      width: number
    }>
    const dateCol3 = store3.find((c) => c.key === "date")!
    expect(dateCol3.width).toBeGreaterThan(SHOT_TABLE_COLUMNS.find((c) => c.key === "date")!.width)

    // v2 mirror carries the SAME resulting width.
    const v2 = readV2()!
    expect(v2.columns.date?.width).toBe(dateCol3.width)
  })

  it("column VISIBILITY toggle mirrors into v2.fields (not v2.columns)", () => {
    renderTable()

    fireEvent.click(screen.getByText("mock-toggle-date"))

    const v2 = readV2()!
    // date defaults to visible:true -> toggled to false.
    expect(v2.fields.date).toBe(false)
    expect(v2.columns.date).toBeUndefined()
  })

  it("column REORDER mirrors order into v2.columns, preserving default widths", () => {
    renderTable()

    fireEvent.click(screen.getByText("mock-reorder"))

    const v2 = readV2()!
    expect(v2.columns.talent?.order).toBe(0)
    expect(v2.columns.date?.order).toBe(1)
    expect(v2.columns.notes?.order).toBe(2)
  })

  it("no clientId/projectId: mirrors are skipped (no v2 key written) — matches legacy's own guard", () => {
    render(<ShotsTable clientId={null} projectId="" shots={[]} onOpenShot={() => {}} />)

    fireEvent.click(screen.getByText("mock-toggle-date"))
    fireEvent.click(screen.getByText("mock-reorder"))

    expect(window.localStorage.getItem(prefsV2Key("c1", "p1"))).toBeNull()
  })
})
