/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { TalentSearchFilterSheet, TalentFilterToolbar } from "@/features/library/components/TalentSearchFilters"
import { EMPTY_TALENT_FILTERS } from "@/features/library/lib/talentFilters"
import type { TalentSearchFilters } from "@/features/library/lib/talentFilters"
import type { TalentRecord } from "@/shared/types"

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => false,
  useIsDesktop: () => true,
  useIsTablet: () => false,
  useMediaQuery: () => true,
}))

const TALENT: readonly TalentRecord[] = [
  { id: "t1", name: "Alice", agency: "IMG Models", gender: "female", measurements: { height: 68 } },
  { id: "t2", name: "Bob", agency: "Elite", gender: "male", measurements: { height: 72 } },
  { id: "t3", name: "Carol", agency: "IMG Models", gender: "female" },
]

describe("TalentSearchFilterSheet", () => {
  let onFiltersChange: ReturnType<typeof vi.fn>
  let onOpenChange: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onFiltersChange = vi.fn()
    onOpenChange = vi.fn()
  })

  it("renders gender radio options", () => {
    render(
      <TalentSearchFilterSheet
        open
        onOpenChange={onOpenChange}
        filters={EMPTY_TALENT_FILTERS}
        onFiltersChange={onFiltersChange}
        talent={TALENT}
      />,
    )

    expect(screen.getByText("All")).toBeInTheDocument()
    expect(screen.getByText("Men")).toBeInTheDocument()
    expect(screen.getByText("Women")).toBeInTheDocument()
    expect(screen.getByText("Other")).toBeInTheDocument()
  })

  it("renders measurement fields for gender", () => {
    render(
      <TalentSearchFilterSheet
        open
        onOpenChange={onOpenChange}
        filters={{ ...EMPTY_TALENT_FILTERS, gender: "women" }}
        onFiltersChange={onFiltersChange}
        talent={TALENT}
      />,
    )

    expect(screen.getByText("Height")).toBeInTheDocument()
    expect(screen.getByText("Waist")).toBeInTheDocument()
    expect(screen.getByText("Hips")).toBeInTheDocument()
    expect(screen.getByText("Bust")).toBeInTheDocument()
  })

  it("renders agency list extracted from talent", () => {
    render(
      <TalentSearchFilterSheet
        open
        onOpenChange={onOpenChange}
        filters={EMPTY_TALENT_FILTERS}
        onFiltersChange={onFiltersChange}
        talent={TALENT}
      />,
    )

    expect(screen.getByText("IMG Models")).toBeInTheDocument()
    expect(screen.getByText("Elite")).toBeInTheDocument()
  })

  it("renders casting history checkbox", () => {
    render(
      <TalentSearchFilterSheet
        open
        onOpenChange={onOpenChange}
        filters={EMPTY_TALENT_FILTERS}
        onFiltersChange={onFiltersChange}
        talent={TALENT}
      />,
    )

    expect(screen.getByText("Has casting sessions")).toBeInTheDocument()
  })

  it("calls onFiltersChange when gender is selected", () => {
    render(
      <TalentSearchFilterSheet
        open
        onOpenChange={onOpenChange}
        filters={EMPTY_TALENT_FILTERS}
        onFiltersChange={onFiltersChange}
        talent={TALENT}
      />,
    )

    fireEvent.click(screen.getByText("Women"))
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ gender: "women" }),
    )
  })

  it("has a clear all button", () => {
    render(
      <TalentSearchFilterSheet
        open
        onOpenChange={onOpenChange}
        filters={{ ...EMPTY_TALENT_FILTERS, gender: "men" }}
        onFiltersChange={onFiltersChange}
        talent={TALENT}
      />,
    )

    const clearBtn = screen.getByRole("button", { name: "Clear all" })
    expect(clearBtn).toBeInTheDocument()
    expect(clearBtn).not.toBeDisabled()
  })
})

describe("TalentFilterToolbar", () => {
  let onFiltersChange: ReturnType<typeof vi.fn>
  let onOpenSheet: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onFiltersChange = vi.fn()
    onOpenSheet = vi.fn()
  })

  it("shows filter button", () => {
    render(
      <TalentFilterToolbar
        filters={EMPTY_TALENT_FILTERS}
        onFiltersChange={onFiltersChange}
        onOpenSheet={onOpenSheet}
      />,
    )

    expect(screen.getByRole("button", { name: /filters/i })).toBeInTheDocument()
  })

  it("shows active filter count badge", () => {
    const active: TalentSearchFilters = {
      ...EMPTY_TALENT_FILTERS,
      gender: "women",
      agency: "IMG",
    }

    render(
      <TalentFilterToolbar
        filters={active}
        onFiltersChange={onFiltersChange}
        onOpenSheet={onOpenSheet}
      />,
    )

    expect(screen.getByText("2")).toBeInTheDocument()
  })

  it("shows filter chips when filters are active", () => {
    const active: TalentSearchFilters = {
      ...EMPTY_TALENT_FILTERS,
      gender: "women",
    }

    render(
      <TalentFilterToolbar
        filters={active}
        onFiltersChange={onFiltersChange}
        onOpenSheet={onOpenSheet}
      />,
    )

    expect(screen.getByText("Gender: Women")).toBeInTheDocument()
  })

  it("calls onOpenSheet when filter button is clicked", () => {
    render(
      <TalentFilterToolbar
        filters={EMPTY_TALENT_FILTERS}
        onFiltersChange={onFiltersChange}
        onOpenSheet={onOpenSheet}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: /filters/i }))
    expect(onOpenSheet).toHaveBeenCalledTimes(1)
  })

  it("removes chip when dismiss is clicked", () => {
    const active: TalentSearchFilters = {
      ...EMPTY_TALENT_FILTERS,
      gender: "women",
    }

    render(
      <TalentFilterToolbar
        filters={active}
        onFiltersChange={onFiltersChange}
        onOpenSheet={onOpenSheet}
      />,
    )

    fireEvent.click(screen.getByRole("button", { name: "Remove Gender: Women" }))
    expect(onFiltersChange).toHaveBeenCalledWith(
      expect.objectContaining({ gender: null }),
    )
  })
})
