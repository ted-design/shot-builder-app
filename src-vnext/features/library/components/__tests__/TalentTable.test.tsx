/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import type { TalentRecord } from "@/shared/types"

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => false,
  useIsDesktop: () => true,
}))

vi.mock("@/shared/lib/resolveStoragePath", () => ({
  isUrl: (value: string) => value.startsWith("https://") || value.startsWith("http://"),
  resolveStoragePath: async (path: string) => path,
  getCachedUrl: () => undefined,
}))

import { TalentTable } from "@/features/library/components/TalentTable"

function makeTalent(overrides: Partial<TalentRecord> & { id: string; name: string }): TalentRecord {
  return {
    agency: undefined,
    email: null,
    phone: null,
    url: null,
    gender: null,
    measurements: null,
    notes: undefined,
    headshotPath: null,
    galleryImages: [],
    castingSessions: [],
    projectIds: [],
    ...overrides,
  }
}

const TALENT: readonly TalentRecord[] = [
  makeTalent({
    id: "t1",
    name: "Alex Rivera",
    gender: "male",
    agency: "IMG Models",
    measurements: { height: `5'11"`, bust: "38", waist: "30", hips: "36" },
    projectIds: ["p1", "p2"],
  }),
  makeTalent({
    id: "t2",
    name: "Jordan Blake",
    gender: "female",
    agency: "Elite",
    measurements: { height: `5'7"`, bust: "34", waist: "26", hips: "35" },
    projectIds: ["p1"],
  }),
  makeTalent({
    id: "t3",
    name: "Casey Morgan",
    gender: "non-binary",
    measurements: null,
    projectIds: [],
  }),
]

describe("TalentTable", () => {
  it("renders all column headers", () => {
    render(<TalentTable talent={TALENT} onSelect={vi.fn()} />)

    expect(screen.getByText("Name")).toBeInTheDocument()
    expect(screen.getByText("Gender")).toBeInTheDocument()
    expect(screen.getByText("Agency")).toBeInTheDocument()
    expect(screen.getByText("Height")).toBeInTheDocument()
    expect(screen.getByText("Bust")).toBeInTheDocument()
    expect(screen.getByText("Waist")).toBeInTheDocument()
    expect(screen.getByText("Hips")).toBeInTheDocument()
    expect(screen.getByText("Projects")).toBeInTheDocument()
  })

  it("renders talent rows with correct data", () => {
    render(<TalentTable talent={TALENT} onSelect={vi.fn()} />)

    expect(screen.getByText("Alex Rivera")).toBeInTheDocument()
    expect(screen.getByText("Jordan Blake")).toBeInTheDocument()
    expect(screen.getByText("Casey Morgan")).toBeInTheDocument()

    expect(screen.getByText("Male")).toBeInTheDocument()
    expect(screen.getByText("Female")).toBeInTheDocument()
    expect(screen.getByText("Non-Binary")).toBeInTheDocument()

    expect(screen.getByText("IMG Models")).toBeInTheDocument()
    expect(screen.getByText("Elite")).toBeInTheDocument()

    expect(screen.getByText(`5'11"`)).toBeInTheDocument()
    expect(screen.getByText(`5'7"`)).toBeInTheDocument()

    // Individual measurement columns for Alex Rivera
    expect(screen.getByText("38")).toBeInTheDocument()
    expect(screen.getByText("30")).toBeInTheDocument()
    expect(screen.getByText("36")).toBeInTheDocument()
    // Individual measurement columns for Jordan Blake
    expect(screen.getByText("34")).toBeInTheDocument()
    expect(screen.getByText("26")).toBeInTheDocument()
    expect(screen.getByText("35")).toBeInTheDocument()

    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("1")).toBeInTheDocument()
  })

  it("calls onSelect when a row is clicked", () => {
    const onSelect = vi.fn()
    render(<TalentTable talent={TALENT} onSelect={onSelect} />)

    const rows = screen.getAllByRole("row")
    // rows[0] is the header row; default sort is name asc: Alex(t1), Casey(t3), Jordan(t2)
    fireEvent.click(rows[1])
    expect(onSelect).toHaveBeenCalledWith("t1")

    fireEvent.click(rows[3])
    // Third data row is Jordan (t2) after alphabetical sort
    expect(onSelect).toHaveBeenCalledWith("t2")
  })

  it("toggles sort direction when clicking a column header", () => {
    render(<TalentTable talent={TALENT} onSelect={vi.fn()} />)

    const nameButton = screen.getByRole("button", { name: "Sort by Name" })

    // Default is name asc: Alex, Casey, Jordan
    const rowsBefore = screen.getAllByRole("row")
    const firstCell = within(rowsBefore[1]).getByText("Alex Rivera")
    expect(firstCell).toBeInTheDocument()

    // Click name again to toggle to desc
    fireEvent.click(nameButton)
    const rowsAfter = screen.getAllByRole("row")
    expect(within(rowsAfter[1]).getByText("Jordan Blake")).toBeInTheDocument()
  })

  it("sorts by a different field when a new column header is clicked", () => {
    render(<TalentTable talent={TALENT} onSelect={vi.fn()} />)

    // Click Projects header to sort by project count ascending
    fireEvent.click(screen.getByRole("button", { name: "Sort by Projects" }))

    const rows = screen.getAllByRole("row")
    // Casey has 0 projects, Jordan has 1, Alex has 2
    expect(within(rows[1]).getByText("Casey Morgan")).toBeInTheDocument()
    expect(within(rows[2]).getByText("Jordan Blake")).toBeInTheDocument()
    expect(within(rows[3]).getByText("Alex Rivera")).toBeInTheDocument()
  })

  it("highlights the selected row", () => {
    const { container } = render(
      <TalentTable talent={TALENT} onSelect={vi.fn()} selectedId="t2" />,
    )

    const rows = container.querySelectorAll("tbody tr")
    // t2 is Jordan Blake — after default name-asc sort: [Alex(t1), Casey(t3), Jordan(t2)]
    // Jordan is index 2 (0-based)
    expect(rows[2]?.className).toContain("bg-[var(--color-primary)]")
  })

  it("shows initials fallback when no headshot", () => {
    render(<TalentTable talent={[makeTalent({ id: "t9", name: "Jane Doe" })]} onSelect={vi.fn()} />)
    expect(screen.getByText("JD")).toBeInTheDocument()
  })
})
