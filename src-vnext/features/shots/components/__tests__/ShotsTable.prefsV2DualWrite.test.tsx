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
import {
  prefsV2Key,
  tableV3Key,
  mirrorFieldsPatchToV2,
  type ShotsPrefsV2,
} from "@/features/shots/lib/migrateShotsPrefsV2"
import { SHOT_TABLE_COLUMNS } from "@/features/shots/lib/shotTableColumns"
import { DEFAULT_FIELDS } from "@/features/shots/lib/shotListFilters"

vi.mock("@/shared/components/ColumnSettingsPopover", () => ({
  ColumnSettingsPopover: (props: {
    readonly onToggleVisibility: (key: string) => void
    readonly onReorder: (keys: readonly string[]) => void
    readonly onReset: () => void
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
      <button type="button" onClick={() => props.onReset()}>
        mock-reset
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

/** Legacy Store 3, parsed. The dual-write's legacy half is load-bearing: this
 *  phase flips NO reads, so a mirror that quietly replaced the legacy write
 *  instead of extending it would break every surface while leaving v2 green. */
function readStore3(): ReadonlyArray<{ key: string; visible: boolean; width: number; order: number }> {
  const raw = window.localStorage.getItem(tableV3Key(CLIENT, PROJECT))
  return raw ? (JSON.parse(raw) as Array<{ key: string; visible: boolean; width: number; order: number }>) : []
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

  it("column VISIBILITY toggle writes BOTH halves: legacy Store 3 and v2.fields", () => {
    renderTable()

    fireEvent.click(screen.getByText("mock-toggle-date"))

    // Legacy half — deleting `toggleVisibility(key)` from the wrapper must redden here.
    const store3 = readStore3()
    expect(store3.length).toBeGreaterThan(0) // the legacy write happened at all
    expect(store3.find((c) => c.key === "date")!.visible).toBe(false)

    const v2 = readV2()!
    // date defaults to visible:true -> toggled to false.
    expect(v2.fields.date).toBe(false)
    expect(v2.columns.date).toBeUndefined()
  })

  it("column REORDER writes BOTH halves: legacy Store 3 order and v2.columns order", () => {
    renderTable()

    fireEvent.click(screen.getByText("mock-reorder"))

    // Legacy half — deleting `reorderColumns(orderedKeys)` must redden here.
    const store3 = readStore3()
    expect(store3.find((c) => c.key === "talent")!.order).toBe(0)
    expect(store3.find((c) => c.key === "date")!.order).toBe(1)
    expect(store3.find((c) => c.key === "notes")!.order).toBe(2)

    const v2 = readV2()!
    expect(v2.columns.talent?.order).toBe(0)
    expect(v2.columns.date?.order).toBe(1)
    expect(v2.columns.notes?.order).toBe(2)
  })

  it("no clientId: NO v2 key of any shape is written, while the legacy no-client key still is", () => {
    render(<ShotsTable clientId={null} projectId="" shots={[]} onOpenShot={() => {}} />)

    fireEvent.click(screen.getByText("mock-toggle-date"))
    fireEvent.click(screen.getByText("mock-reorder"))

    // Positive control: the interactions really ran, and landed in the
    // clientId-less legacy key ShotsTable falls back to. Without this the
    // negative below could pass on a component that did nothing at all.
    const legacyNoClient = JSON.parse(window.localStorage.getItem("sb:shots-table:")!) as Array<{
      key: string
      visible: boolean
    }>
    expect(legacyNoClient.find((c) => c.key === "date")!.visible).toBe(false)

    // F5 — the clientId-less surface is deliberately OUT of v2's scope this
    // phase. Assert on the KEY SPACE, not one guessed key: `prefsV2Key("c1","p1")`
    // is a key nothing in this render could ever write, so asserting it is null
    // stays green even with every clientId guard deleted.
    const v2Keys = Object.keys(window.localStorage).filter((k) => /^sb:shots:prefs:v2:/.test(k))
    expect(v2Keys).toEqual([])
  })

  it("column RESET clears v2 geometry and returns column-domain fields to column defaults", () => {
    renderTable()

    // Establish non-default v2 state on both halves of the blob.
    fireEvent.click(screen.getByText("mock-toggle-date")) // fields.date -> false
    fireEvent.click(screen.getByText("mock-reorder")) // columns.{talent,date,notes}
    expect(readV2()!.fields.date).toBe(false)
    expect(Object.keys(readV2()!.columns).length).toBeGreaterThan(0)

    fireEvent.click(screen.getByText("mock-reset"))

    // Legacy half: useTableColumns' reset removes the Store 3 key outright.
    expect(window.localStorage.getItem(tableV3Key(CLIENT, PROJECT))).toBeNull()

    const v2 = readV2()!
    expect(v2.columns).toEqual({})
    // Column-domain keys return to the COLUMN defaults (which differ from
    // DEFAULT_FIELDS on notes/links/updated — Store 3 is what reset restores).
    expect(v2.fields.date).toBe(true)
    expect(v2.fields.notes).toBe(true)
    expect(v2.fields.links).toBe(true)
    expect(v2.fields.updated).toBe(true)
    // Card-only fields have no column counterpart — a COLUMN reset must not
    // touch them.
    expect(v2.fields.description).toBe(DEFAULT_FIELDS.description)
    expect(v2.fields.readiness).toBe(DEFAULT_FIELDS.readiness)
  })

  it("column RESET leaves a card-only field edit intact", () => {
    renderTable()
    mirrorFieldsPatchToV2(CLIENT, PROJECT, { description: false })

    fireEvent.click(screen.getByText("mock-reset"))

    expect(readV2()!.fields.description).toBe(false)
  })
})
