/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ExpandedFamilySkus } from "./ExpandedFamilySkus"
import type { ProductSku } from "@/shared/types"
import { Timestamp } from "firebase/firestore"

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

let mockSkus: ProductSku[] = []
let mockLoading = false

vi.mock("@/features/products/hooks/useProducts", () => ({
  useProductSkus: () => ({ data: mockSkus, loading: mockLoading }),
}))

vi.mock("@/features/products/hooks/useProductSelection", () => ({
  makeSkuSelectionId: (fId: string, fName: string, skuId: string, skuName: string) =>
    `sku:${fId}|${skuId}|${fName}|${skuName}`,
  useProductSelection: () => ({
    isSelected: () => false,
    toggle: vi.fn(),
    selectedIds: new Set<string>(),
    count: 0,
    clearAll: vi.fn(),
    selectAll: vi.fn(),
    getSelectedFamilies: () => [],
    getSelectedSkus: () => [],
  }),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSku(overrides: Partial<ProductSku> & { id: string; name: string }): ProductSku {
  return {
    colorName: overrides.name,
    ...overrides,
  } as ProductSku
}

const defaultProps = {
  familyId: "f1",
  familyName: "Test Family",
  selectionMode: false,
  selection: {
    isSelected: () => false,
    toggle: vi.fn(),
    selectedIds: new Set<string>(),
    count: 0,
    clearAll: vi.fn(),
    selectAll: vi.fn(),
    getSelectedFamilies: () => [] as Array<{ familyId: string; familyName: string }>,
    getSelectedSkus: () => [] as Array<{ familyId: string; familyName: string; skuId: string; skuName: string }>,
  },
  skuProjectMap: new Map<string, ReadonlySet<string>>(),
  projectNames: new Map<string, string>(),
} as const

function renderComponent(props: Partial<typeof defaultProps> = {}) {
  return render(<ExpandedFamilySkus {...defaultProps} {...props} />)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ExpandedFamilySkus", () => {
  beforeEach(() => {
    mockSkus = []
    mockLoading = false
  })

  describe("without filterByRequirements", () => {
    it("shows all active SKUs when filter is off", () => {
      mockSkus = [
        makeSku({ id: "s1", name: "Black" }),
        makeSku({ id: "s2", name: "White" }),
        makeSku({ id: "s3", name: "Red" }),
      ]
      renderComponent({ filterByRequirements: false })
      expect(screen.getByText("Black")).toBeInTheDocument()
      expect(screen.getByText("White")).toBeInTheDocument()
      expect(screen.getByText("Red")).toBeInTheDocument()
    })

    it("shows all active SKUs when filterByRequirements is undefined", () => {
      mockSkus = [
        makeSku({ id: "s1", name: "Black" }),
        makeSku({ id: "s2", name: "White" }),
      ]
      renderComponent()
      expect(screen.getByText("Black")).toBeInTheDocument()
      expect(screen.getByText("White")).toBeInTheDocument()
    })
  })

  describe("with filterByRequirements", () => {
    it("shows only SKUs with active requirements or launch dates", () => {
      mockSkus = [
        makeSku({
          id: "s1",
          name: "Has Reqs",
          assetRequirements: { hero: "needed" },
        }),
        makeSku({
          id: "s2",
          name: "Has Launch",
          launchDate: Timestamp.fromDate(new Date("2026-06-01")),
        }),
        makeSku({
          id: "s3",
          name: "No Match",
          assetRequirements: null,
          launchDate: null,
        }),
      ]
      renderComponent({ filterByRequirements: true })
      expect(screen.getByText("Has Reqs")).toBeInTheDocument()
      expect(screen.getByText("Has Launch")).toBeInTheDocument()
      expect(screen.queryByText("No Match")).not.toBeInTheDocument()
    })

    it("shows SKU with completed requirements but no launch date as filtered out", () => {
      mockSkus = [
        makeSku({
          id: "s1",
          name: "Done SKU",
          assetRequirements: { hero: "done" },
        }),
        makeSku({
          id: "s2",
          name: "Active SKU",
          assetRequirements: { hero: "needed" },
        }),
      ]
      renderComponent({ filterByRequirements: true })
      expect(screen.queryByText("Done SKU")).not.toBeInTheDocument()
      expect(screen.getByText("Active SKU")).toBeInTheDocument()
    })

    it("shows footer with count and 'Show all' button when some are hidden", () => {
      mockSkus = [
        makeSku({
          id: "s1",
          name: "Qualifying",
          assetRequirements: { hero: "needed" },
        }),
        makeSku({ id: "s2", name: "Hidden A" }),
        makeSku({ id: "s3", name: "Hidden B" }),
      ]
      renderComponent({ filterByRequirements: true })
      expect(screen.getByText("Showing 1 of 3 colorways")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Show all" })).toBeInTheDocument()
    })

    it("reveals all SKUs when 'Show all' is clicked", async () => {
      const user = userEvent.setup()
      mockSkus = [
        makeSku({
          id: "s1",
          name: "Qualifying",
          assetRequirements: { hero: "in_progress" },
        }),
        makeSku({ id: "s2", name: "Hidden One" }),
      ]
      renderComponent({ filterByRequirements: true })
      expect(screen.queryByText("Hidden One")).not.toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Show all" }))

      expect(screen.getByText("Hidden One")).toBeInTheDocument()
      expect(screen.getByText("Qualifying")).toBeInTheDocument()
      expect(screen.queryByText(/Showing/)).not.toBeInTheDocument()
    })

    it("shows empty state when no SKUs qualify", () => {
      mockSkus = [
        makeSku({ id: "s1", name: "No Match A" }),
        makeSku({ id: "s2", name: "No Match B" }),
      ]
      renderComponent({ filterByRequirements: true })
      expect(
        screen.getByText("No colorways match the requirements filter"),
      ).toBeInTheDocument()
      expect(screen.queryByText("No Match A")).not.toBeInTheDocument()
      expect(screen.queryByText("No Match B")).not.toBeInTheDocument()
    })

    it("does not show footer when all SKUs qualify", () => {
      mockSkus = [
        makeSku({
          id: "s1",
          name: "All Match",
          assetRequirements: { hero: "needed" },
          launchDate: Timestamp.fromDate(new Date("2026-06-01")),
        }),
      ]
      renderComponent({ filterByRequirements: true })
      expect(screen.getByText("All Match")).toBeInTheDocument()
      expect(screen.queryByText(/Showing/)).not.toBeInTheDocument()
    })

    it("excludes deleted SKUs regardless of requirements", () => {
      mockSkus = [
        makeSku({
          id: "s1",
          name: "Deleted With Reqs",
          deleted: true,
          assetRequirements: { hero: "needed" },
        }),
        makeSku({
          id: "s2",
          name: "Active With Reqs",
          assetRequirements: { hero: "needed" },
        }),
      ]
      renderComponent({ filterByRequirements: true })
      expect(screen.queryByText("Deleted With Reqs")).not.toBeInTheDocument()
      expect(screen.getByText("Active With Reqs")).toBeInTheDocument()
    })
  })
})
