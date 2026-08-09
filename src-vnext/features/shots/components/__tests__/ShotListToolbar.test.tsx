import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ShotListToolbar } from "@/features/shots/components/ShotListToolbar"
import { computeInsights, DEFAULT_FIELDS, type ViewMode } from "@/features/shots/lib/shotListFilters"

// ---------------------------------------------------------------------------
// Minimal prop factory — only the fields ShotListToolbar actually reads
// change across these tests; everything else is inert.
// ---------------------------------------------------------------------------

function baseProps(overrides: Partial<React.ComponentProps<typeof ShotListToolbar>> = {}) {
  return {
    queryDraft: "",
    onQueryDraftChange: vi.fn(),
    onClearQuery: vi.fn(),
    sortKey: "custom" as const,
    onSortKeyChange: vi.fn(),
    sortDir: "asc" as const,
    onSortDirToggle: vi.fn(),
    isCustomSort: true,
    isMobile: false,
    viewMode: "card" as ViewMode,
    onViewModeChange: vi.fn(),
    insights: computeInsights([]),
    statusFilter: new Set<never>(),
    toggleStatus: vi.fn(),
    clearStatusFilter: vi.fn(),
    missingFilter: new Set<never>(),
    toggleMissing: vi.fn(),
    clearMissingFilter: vi.fn(),
    canReorder: false,
    hasActiveFilters: false,
    onRenumberOpen: vi.fn(),
    extraFilterCount: 0,
    conditions: [],
    onAddCondition: vi.fn(),
    onUpdateCondition: vi.fn(),
    onRemoveCondition: vi.fn(),
    tagOptions: [],
    talentRecords: [],
    locationRecords: [],
    productFamilies: [],
    projectId: "p1",
    onClearFilters: vi.fn(),
    canRepair: false,
    onRepairOpen: vi.fn(),
    displayCount: 0,
    totalCount: 0,
    fields: DEFAULT_FIELDS,
    onFieldsChange: vi.fn(),
    ...overrides,
  }
}

describe("ShotListToolbar — Display control", () => {
  it("renders a Display trigger in card view", () => {
    render(<ShotListToolbar {...baseProps({ viewMode: "card" })} />)
    expect(screen.getByTestId("display-trigger")).toBeInTheDocument()
  })

  it("does not render the Display trigger in table view (card view only)", () => {
    render(<ShotListToolbar {...baseProps({ viewMode: "table" })} />)
    expect(screen.queryByTestId("display-trigger")).not.toBeInTheDocument()
  })

  it("opens the Display sheet on click", () => {
    render(<ShotListToolbar {...baseProps({ viewMode: "card" })} />)
    expect(screen.queryByText("Cards")).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId("display-trigger"))

    expect(screen.getByRole("heading", { name: "Display" })).toBeInTheDocument()
    expect(screen.getByText("Cards")).toBeInTheDocument()
  })

  it("toggling a field checkbox calls onFieldsChange with that field flipped", () => {
    const onFieldsChange = vi.fn()
    render(
      <ShotListToolbar
        {...baseProps({ viewMode: "card", fields: DEFAULT_FIELDS, onFieldsChange })}
      />,
    )

    fireEvent.click(screen.getByTestId("display-trigger"))
    fireEvent.click(screen.getByRole("checkbox", { name: "Hero thumbnail" }))

    expect(onFieldsChange).toHaveBeenCalledWith({
      ...DEFAULT_FIELDS,
      heroThumb: !DEFAULT_FIELDS.heroThumb,
    })
  })
})
