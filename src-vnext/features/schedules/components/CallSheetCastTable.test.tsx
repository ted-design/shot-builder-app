import { describe, expect, it } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { CallSheetCastTable } from "@/features/schedules/components/CallSheetCastTable"
import {
  DEFAULT_CAST_SECTION,
  toggleFieldVisibility,
  updateFieldLabel,
  updateFieldWidth,
} from "@/features/schedules/lib/fieldConfig"
import type { TalentCallSheet, TalentRecord } from "@/shared/types"

const TALENT: TalentRecord[] = [
  { id: "t1", name: "Jane Doe" },
]

const CALLS: TalentCallSheet[] = [
  {
    id: "tc1",
    talentId: "t1",
    callTime: "09:00",
    wrapTime: "17:00",
    role: "Lead",
    notes: "Bring props",
  },
]

/**
 * Fallback table width used by CallSheetCastTable when ResizeObserver
 * is a no-op stub (jsdom).  xs = 6% → 48px at 800px.
 */
const FALLBACK_TABLE_WIDTH = 800

describe("CallSheetCastTable", () => {
  it("renders default columns when no fieldConfig is provided", () => {
    render(
      <CallSheetCastTable
        talentCalls={CALLS}
        talentLookup={TALENT}
        dayDetails={null}
      />,
    )

    expect(screen.getByText("Talent")).toBeInTheDocument()
    expect(screen.getByText("Role")).toBeInTheDocument()
    expect(screen.getByText("Set Call")).toBeInTheDocument()
    expect(screen.getByText("Jane Doe")).toBeInTheDocument()
  })

  it("hides columns when field is toggled invisible", () => {
    const config = toggleFieldVisibility(DEFAULT_CAST_SECTION, "role")

    render(
      <CallSheetCastTable
        talentCalls={CALLS}
        talentLookup={TALENT}
        dayDetails={null}
        fieldConfig={config}
      />,
    )

    expect(screen.queryByText("Role")).not.toBeInTheDocument()
    expect(screen.queryByText("Lead")).not.toBeInTheDocument()
    expect(screen.getByText("Jane Doe")).toBeInTheDocument()
  })

  it("uses custom labels from field config", () => {
    const config = updateFieldLabel(DEFAULT_CAST_SECTION, "talent", "Actor")

    render(
      <CallSheetCastTable
        talentCalls={CALLS}
        talentLookup={TALENT}
        dayDetails={null}
        fieldConfig={config}
      />,
    )

    expect(screen.getByText("Actor")).toBeInTheDocument()
    expect(screen.queryByText("Talent")).not.toBeInTheDocument()
  })

  it("applies width from field config to column headers as pixels", () => {
    const config = updateFieldWidth(DEFAULT_CAST_SECTION, "talent", "xs")

    const { container } = render(
      <CallSheetCastTable
        talentCalls={CALLS}
        talentLookup={TALENT}
        dayDetails={null}
        fieldConfig={config}
      />,
    )

    const headers = container.querySelectorAll("th")
    const talentHeader = Array.from(headers).find((h) => h.textContent === "Talent")
    // xs = 6% of fallback 800px = 48px
    const expectedPx = Math.round((6 / 100) * FALLBACK_TABLE_WIDTH)
    expect(talentHeader?.style.width).toBe(`${expectedPx}px`)
  })

  it("renders resize handles on column headers", () => {
    const { container } = render(
      <CallSheetCastTable
        talentCalls={CALLS}
        talentLookup={TALENT}
        dayDetails={null}
      />,
    )

    const separators = container.querySelectorAll('[role="separator"]')
    // One resize handle per visible field (default 6 visible fields)
    expect(separators.length).toBeGreaterThan(0)
  })

  it("sets tabIndex on the table for keyboard focus", () => {
    const { container } = render(
      <CallSheetCastTable
        talentCalls={CALLS}
        talentLookup={TALENT}
        dayDetails={null}
      />,
    )

    const table = container.querySelector("table")
    expect(table?.getAttribute("tabindex")).toBe("0")
  })

  it("marks active row on ArrowDown keypress", () => {
    const { container } = render(
      <CallSheetCastTable
        talentCalls={CALLS}
        talentLookup={TALENT}
        dayDetails={null}
      />,
    )

    const table = container.querySelector("table")!
    fireEvent.keyDown(table, { key: "ArrowDown" })

    const rows = container.querySelectorAll("tbody tr")
    expect(rows[0]?.getAttribute("data-active-row")).toBe("true")
  })

  it("clears active row on Escape keypress", () => {
    const { container } = render(
      <CallSheetCastTable
        talentCalls={CALLS}
        talentLookup={TALENT}
        dayDetails={null}
      />,
    )

    const table = container.querySelector("table")!
    fireEvent.keyDown(table, { key: "ArrowDown" })
    fireEvent.keyDown(table, { key: "Escape" })

    const rows = container.querySelectorAll("tbody tr")
    expect(rows[0]?.getAttribute("data-active-row")).toBeNull()
  })
})
