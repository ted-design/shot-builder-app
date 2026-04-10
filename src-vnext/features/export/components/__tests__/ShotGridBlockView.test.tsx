import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ShotGridBlockView } from "../blocks/ShotGridBlockView"
import type { ShotGridBlock } from "../../types/exportBuilder"
import type { Shot, TalentRecord } from "@/shared/types"
import { Timestamp } from "firebase/firestore"

const MOCK_TALENT: readonly TalentRecord[] = [
  { id: "t1", name: "Stefan L." } as TalentRecord,
  { id: "t2", name: "Jessica M." } as TalentRecord,
]

const now = Timestamp.now()

const MOCK_SHOTS: readonly Shot[] = [
  {
    id: "s1",
    title: "LS Merino Crew - Hero",
    shotNumber: "1",
    status: "todo",
    products: [{ familyId: "f1", familyName: "LS Merino Crew" }, { familyId: "f2", familyName: "Travel Pants" }],
    talent: ["Stefan L."],
    talentIds: ["t1"],
    locationName: "Stackt Market",
    description: "Hero shot description",
    tags: [{ id: "tag1", label: "Hero", color: "#000" }],
    notes: "Handle with care",
    projectId: "p1",
    clientId: "c1",
    sortOrder: 1,
    createdAt: now,
    updatedAt: now,
    createdBy: "u1",
  },
  {
    id: "s2",
    title: "Travel Pants - Detail",
    shotNumber: "2",
    status: "in_progress",
    products: [{ familyId: "f2", familyName: "Travel Pants" }],
    talent: ["Jessica M."],
    talentIds: ["t2"],
    locationName: "Distillery",
    projectId: "p1",
    clientId: "c1",
    sortOrder: 2,
    createdAt: now,
    updatedAt: now,
    createdBy: "u1",
  },
  {
    id: "s3",
    title: "V-Neck Tee - Lifestyle",
    shotNumber: "3",
    status: "todo",
    products: [],
    talent: [],
    locationName: "Bellwoods",
    projectId: "p1",
    clientId: "c1",
    sortOrder: 3,
    createdAt: now,
    updatedAt: now,
    createdBy: "u1",
  },
  {
    id: "s4",
    title: "Hoodie - On Model",
    shotNumber: "4",
    status: "complete",
    products: [{ familyId: "f3", familyName: "Hoodie" }],
    talent: [],
    projectId: "p1",
    clientId: "c1",
    sortOrder: 4,
    createdAt: now,
    updatedAt: now,
    createdBy: "u1",
  },
  {
    id: "s5",
    title: "Boxer Brief - Flat Lay",
    shotNumber: "5",
    status: "on_hold",
    products: [{ familyId: "f4", familyName: "Boxer Brief" }],
    talent: [],
    locationName: "Studio A",
    projectId: "p1",
    clientId: "c1",
    sortOrder: 5,
    createdAt: now,
    updatedAt: now,
    createdBy: "u1",
  },
]

vi.mock("../ExportDataProvider", () => ({
  useExportDataContext: () => ({
    project: null,
    shots: MOCK_SHOTS,
    productFamilies: [],
    pulls: [],
    crew: [],
    talent: MOCK_TALENT,
    loading: false,
  }),
}))

function buildBlock(overrides: Partial<ShotGridBlock> = {}): ShotGridBlock {
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
    expect(screen.queryByText("Description")).not.toBeInTheDocument()
  })

  it("renders all 5 shot rows with shot numbers", () => {
    render(<ShotGridBlockView block={buildBlock()} />)

    expect(screen.getByText("1")).toBeInTheDocument()
    expect(screen.getByText("2")).toBeInTheDocument()
    expect(screen.getByText("3")).toBeInTheDocument()
    expect(screen.getByText("4")).toBeInTheDocument()
    expect(screen.getByText("5")).toBeInTheDocument()
  })

  it("renders status badges with correct labels", () => {
    render(<ShotGridBlockView block={buildBlock()} />)

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

    expect(screen.getByText("#")).toBeInTheDocument()
    const headers = screen.getAllByRole("columnheader")
    expect(headers).toHaveLength(1)
  })

  it("renders shot titles when title column is visible", () => {
    render(<ShotGridBlockView block={buildBlock()} />)

    expect(screen.getByText("LS Merino Crew - Hero")).toBeInTheDocument()
    expect(screen.getByText("Travel Pants - Detail")).toBeInTheDocument()
  })

  it("resolves talent names from talentIds", () => {
    render(<ShotGridBlockView block={buildBlock()} />)

    expect(screen.getByText("Stefan L.")).toBeInTheDocument()
    expect(screen.getByText("Jessica M.")).toBeInTheDocument()
  })

  it("shows shot count at the bottom", () => {
    render(<ShotGridBlockView block={buildBlock()} />)

    expect(screen.getByText("Showing 5 shots")).toBeInTheDocument()
  })

  it("filters shots by status", () => {
    const block = buildBlock({ filter: { status: ["todo"] } })
    render(<ShotGridBlockView block={block} />)

    expect(screen.getByText("Showing 2 shots")).toBeInTheDocument()
    expect(screen.getByText("LS Merino Crew - Hero")).toBeInTheDocument()
    expect(screen.getByText("V-Neck Tee - Lifestyle")).toBeInTheDocument()
    expect(screen.queryByText("Travel Pants - Detail")).not.toBeInTheDocument()
  })

  it("filters shots by tag IDs", () => {
    const block = buildBlock({ filter: { tagIds: ["tag1"] } })
    render(<ShotGridBlockView block={block} />)

    expect(screen.getByText("Showing 1 shot")).toBeInTheDocument()
    expect(screen.getByText("LS Merino Crew - Hero")).toBeInTheDocument()
  })
})
