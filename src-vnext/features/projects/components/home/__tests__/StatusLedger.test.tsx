/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

import { StatusLedger } from "../StatusLedger"
import type { LedgerRowViewModel } from "../LedgerRow"
import { buildLedgerRows } from "../lib/ledgerData"
import type { ShotStatusCounts } from "../lib/ledgerData"

// ---------------------------------------------------------------------------
// Fixtures — build real view-models via the ledgerData adapters, then attach
// the presentational extras the parent would derive.
// ---------------------------------------------------------------------------

const statusCounts: ShotStatusCounts = {
  todo: 22,
  in_progress: 14,
  on_hold: 3,
  complete: 9,
}

function buildRows(): readonly LedgerRowViewModel[] {
  const [shots, casting, pulls, callsheet, exportRow] = buildLedgerRows({
    statusCounts,
    sceneCount: 6,
    castingEntries: [],
    pulls: [],
    schedules: [],
    scheduleEntries: [],
  })

  return [
    { row: shots, index: "i.", tag: { label: "Building list", tone: "info" }, to: "/projects/p1/shots", linkLabel: "Open list" },
    { row: casting, index: "ii.", tag: { label: "4 roles unbooked", tone: "crit" }, flagged: true, to: "/projects/p1/casting", linkLabel: "Open board" },
    { row: pulls, index: "iii.", tag: { label: "No samples", tone: "todo" }, to: "/projects/p1/pulls", linkLabel: "Open pulls" },
    { row: callsheet, index: "iv.", tag: { label: "Not started", tone: "todo" }, to: "/projects/p1/callsheet", linkLabel: "Open call sheet" },
    // export row is gated (no complete>0 fixture would gate; here complete=9 so enabled)
    { row: exportRow, index: "v.", tag: { label: "Ready", tone: "ok" }, to: "/projects/p1/export", linkLabel: "Preview export" },
  ]
}

function renderLedger(rows = buildRows(), subline?: string) {
  return render(
    <MemoryRouter>
      <StatusLedger rows={rows} subline={subline} />
    </MemoryRouter>,
  )
}

describe("StatusLedger", () => {
  it("renders the section heading and optional subline", () => {
    renderLedger(buildRows(), "This project only · live")
    expect(
      screen.getByRole("heading", { name: /where the shoot stands/i }),
    ).toBeInTheDocument()
    expect(screen.getByText("This project only · live")).toBeInTheDocument()
  })

  it("renders every stage row label and roman index", () => {
    renderLedger()
    expect(screen.getByText("Shot list")).toBeInTheDocument()
    expect(screen.getByText("Casting")).toBeInTheDocument()
    expect(screen.getByText("Pulls & samples")).toBeInTheDocument()
    expect(screen.getByText("Call sheet")).toBeInTheDocument()
    expect(screen.getByText("Export & share")).toBeInTheDocument()
    expect(screen.getByText("i.")).toBeInTheDocument()
    expect(screen.getByText("v.")).toBeInTheDocument()
  })

  it("renders the shot-row detail and segment legend counts from the view-model", () => {
    renderLedger()
    // detail line: "48 shots · 6 scenes"
    expect(screen.getByText("48 shots · 6 scenes")).toBeInTheDocument()
    // legend labels for the 4-segment shot bar
    expect(screen.getByText("In progress")).toBeInTheDocument()
    expect(screen.getByText("On hold")).toBeInTheDocument()
    // the in-progress count (14) appears as a legend value (unique across rows)
    expect(screen.getByText("14")).toBeInTheDocument()
  })

  it("renders status tags including the critical casting tag", () => {
    renderLedger()
    expect(screen.getByText("4 roles unbooked")).toBeInTheDocument()
    expect(screen.getByText("Building list")).toBeInTheDocument()
  })

  it("renders deep links for enabled rows pointing at the project routes", () => {
    renderLedger()
    const shotLink = screen.getByRole("link", { name: /open list/i })
    expect(shotLink).toHaveAttribute("href", "/projects/p1/shots")
    const castingLink = screen.getByRole("link", { name: /open board/i })
    expect(castingLink).toHaveAttribute("href", "/projects/p1/casting")
  })

  it("flags the casting row for attention", () => {
    const { container } = renderLedger()
    const flagged = container.querySelector('[data-flagged="true"]')
    expect(flagged).not.toBeNull()
    expect(within(flagged as HTMLElement).getByText("Casting")).toBeInTheDocument()
  })

  it("renders a gated export row as a non-interactive link when disabled", () => {
    const gatedCounts: ShotStatusCounts = { todo: 5, in_progress: 0, on_hold: 0, complete: 0 }
    const [, , , , gatedExport] = buildLedgerRows({
      statusCounts: gatedCounts,
      castingEntries: [],
      pulls: [],
      schedules: [],
    })
    expect(gatedExport.enabled).toBe(false)
    renderLedger([
      { row: gatedExport, index: "v.", to: "/projects/p1/export", linkLabel: "Preview export" },
    ])
    // gated → rendered as a span, not an anchor
    expect(screen.queryByRole("link", { name: /preview export/i })).not.toBeInTheDocument()
    const gatedLabel = screen.getByText("Preview export")
    expect(gatedLabel).toHaveAttribute("aria-disabled", "true")
  })
})
