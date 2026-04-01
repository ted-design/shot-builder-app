import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ShotGridBlockView } from "../blocks/ShotGridBlockView"
import type { ShotGridBlock } from "../../types/exportBuilder"

function buildBlock(
  overrides: Partial<ShotGridBlock> = {},
): ShotGridBlock {
  return {
    id: "sg-1",
    type: "shot-grid",
    columns: [
      { key: "shotNumber", label: "#", visible: true, width: "xs" },
      { key: "title", label: "Title", visible: true, width: "md" },
      { key: "status", label: "Status", visible: true, width: "sm" },
      { key: "talent", label: "Talent", visible: true, width: "sm" },
      { key: "location", label: "Location", visible: true, width: "sm" },
      { key: "description", label: "Description", visible: false, width: "lg" },
    ],
    tableStyle: {
      showBorders: true,
      showHeaderBg: true,
      stripeRows: false,
    },
    ...overrides,
  }
}

describe("ShotGridBlockView", () => {
  it("renders only visible columns as table headers", () => {
    render(<ShotGridBlockView block={buildBlock()} />)

    expect(screen.getByText("#")).toBeInTheDocument()
    expect(screen.getByText("Title")).toBeInTheDocument()
    expect(screen.getByText("Status")).toBeInTheDocument()
    expect(screen.getByText("Talent")).toBeInTheDocument()
    expect(screen.getByText("Location")).toBeInTheDocument()
    // Description is not visible
    expect(screen.queryByText("Description")).not.toBeInTheDocument()
  })

  it("renders all 5 preview shot rows", () => {
    render(<ShotGridBlockView block={buildBlock()} />)

    expect(screen.getByText("001")).toBeInTheDocument()
    expect(screen.getByText("002")).toBeInTheDocument()
    expect(screen.getByText("003")).toBeInTheDocument()
    expect(screen.getByText("004")).toBeInTheDocument()
    expect(screen.getByText("005")).toBeInTheDocument()
  })

  it("renders status badges with correct text", () => {
    render(<ShotGridBlockView block={buildBlock()} />)

    // "Draft" appears twice (shots 001 and 003)
    expect(screen.getAllByText("Draft")).toHaveLength(2)
    expect(screen.getByText("In Progress")).toBeInTheDocument()
    expect(screen.getByText("Shot")).toBeInTheDocument()
    expect(screen.getByText("On Hold")).toBeInTheDocument()
  })

  it("hides columns that are not visible", () => {
    const block = buildBlock({
      columns: [
        { key: "shotNumber", label: "#", visible: true, width: "xs" },
        { key: "title", label: "Title", visible: false, width: "md" },
        { key: "status", label: "Status", visible: false, width: "sm" },
      ],
    })
    render(<ShotGridBlockView block={block} />)

    // Only # column should be present
    expect(screen.getByText("#")).toBeInTheDocument()
    // Title header should not appear
    const headers = screen.getAllByRole("columnheader")
    expect(headers).toHaveLength(1)
  })

  it("renders shot titles when title column is visible", () => {
    render(<ShotGridBlockView block={buildBlock()} />)

    expect(screen.getByText("LS Merino Crew - Hero")).toBeInTheDocument()
    expect(screen.getByText("Travel Pants - Detail")).toBeInTheDocument()
  })
})
