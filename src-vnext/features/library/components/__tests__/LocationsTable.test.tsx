/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { LocationRecord } from "@/shared/types"

let isMobile = false

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => isMobile,
}))

import { LocationsTable } from "@/features/library/components/LocationsTable"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeLocation(overrides: Partial<LocationRecord> = {}): LocationRecord {
  return {
    id: "loc-1",
    name: "Studio Alpha",
    address: "123 Main St",
    city: "Toronto",
    phone: "416-555-1234",
    projectIds: ["p1", "p2"],
    ...overrides,
  }
}

const locations: readonly LocationRecord[] = [
  makeLocation({ id: "loc-1", name: "Studio Alpha", city: "Toronto", address: "123 Main St", phone: "416-555-1234", projectIds: ["p1", "p2"] }),
  makeLocation({ id: "loc-2", name: "Beach House", city: "Vancouver", address: "456 Ocean Dr", phone: null, projectIds: [] }),
  makeLocation({ id: "loc-3", name: "Warehouse B", city: null, address: undefined, phone: undefined, projectIds: undefined }),
]

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("LocationsTable", () => {
  beforeEach(() => {
    isMobile = false
  })

  it("renders all column headers on desktop", () => {
    const onSelect = vi.fn()
    render(<LocationsTable locations={locations} onSelect={onSelect} />)

    expect(screen.getByText("Name")).toBeInTheDocument()
    expect(screen.getByText("Address")).toBeInTheDocument()
    expect(screen.getByText("City")).toBeInTheDocument()
    expect(screen.getByText("Contact")).toBeInTheDocument()
    expect(screen.getByText("Projects")).toBeInTheDocument()
  })

  it("renders one row per location", () => {
    const onSelect = vi.fn()
    render(<LocationsTable locations={locations} onSelect={onSelect} />)

    expect(screen.getByText("Studio Alpha")).toBeInTheDocument()
    expect(screen.getByText("Beach House")).toBeInTheDocument()
    expect(screen.getByText("Warehouse B")).toBeInTheDocument()
  })

  it("shows address and city values", () => {
    const onSelect = vi.fn()
    render(<LocationsTable locations={locations} onSelect={onSelect} />)

    expect(screen.getByText("123 Main St")).toBeInTheDocument()
    expect(screen.getByText("Toronto")).toBeInTheDocument()
    expect(screen.getByText("456 Ocean Dr")).toBeInTheDocument()
    expect(screen.getByText("Vancouver")).toBeInTheDocument()
  })

  it("shows project count badge", () => {
    const onSelect = vi.fn()
    render(<LocationsTable locations={locations} onSelect={onSelect} />)

    expect(screen.getByText("2")).toBeInTheDocument()
  })

  it("calls onSelect when row is clicked", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<LocationsTable locations={locations} onSelect={onSelect} />)

    const row = screen.getByTestId("location-row-loc-2")
    await user.click(row)

    expect(onSelect).toHaveBeenCalledWith("loc-2")
  })

  it("hides Address column on mobile", () => {
    isMobile = true
    const onSelect = vi.fn()
    render(<LocationsTable locations={locations} onSelect={onSelect} />)

    expect(screen.queryByText("Address")).not.toBeInTheDocument()
    // Name should still be visible
    expect(screen.getByText("Name")).toBeInTheDocument()
  })

  it("shows dash for missing phone/city", () => {
    const onSelect = vi.fn()
    render(
      <LocationsTable
        locations={[makeLocation({ id: "loc-x", name: "Empty", phone: null, city: null })]}
        onSelect={onSelect}
      />,
    )

    // Two dashes: one for city, one for contact
    const dashes = screen.getAllByText("\u2014")
    expect(dashes.length).toBeGreaterThanOrEqual(2)
  })

  it("sorts by name when header is clicked", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<LocationsTable locations={locations} onSelect={onSelect} />)

    // Default sort is name asc — first row should be Beach House
    const rows = screen.getAllByRole("row")
    // rows[0] is header, rows[1..3] are data rows
    expect(within(rows[1]).getByText("Beach House")).toBeInTheDocument()

    // Click Name header to toggle to desc
    await user.click(screen.getByText("Name"))
    const rowsAfter = screen.getAllByRole("row")
    expect(within(rowsAfter[1]).getByText("Warehouse B")).toBeInTheDocument()
  })
})
