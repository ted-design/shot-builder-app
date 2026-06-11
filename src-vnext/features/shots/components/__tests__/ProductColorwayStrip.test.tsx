/// <reference types="@testing-library/jest-dom" />
// Phase 5e-I extraction pin (build spec, PR partition 5e-I).
//
// ProductColorwayStrip moved out of ShotDetailPageUnified into its own file
// so the Shoot shell (5e-II) and the Review surface (5f) can reuse it. These
// tests pin the extracted component's rendering contract — same testids, same
// markup as the private original — so the extraction stays behavior-free.
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ProductColorwayStrip } from "@/features/shots/components/ProductColorwayStrip"
import type { ShotLook } from "@/shared/types"

const looks: ShotLook[] = [
  {
    id: "look-2",
    label: "Look B",
    order: 2,
    products: [
      {
        familyId: "fam-2",
        familyName: "Merino Hoodie",
        colourId: "col-2",
        colourName: "Charcoal",
        size: "L",
        skuId: "sku-2",
        skuName: "MH-CHAR-L",
      },
    ],
  },
  {
    id: "look-1",
    label: "Look A",
    order: 1,
    products: [
      { familyId: "fam-1", familyName: "Merino Tee" },
      { familyId: "fam-3" },
    ],
  },
]

describe("ProductColorwayStrip", () => {
  it("renders looks sorted by order with item/look counts and marks the active look", () => {
    render(<ProductColorwayStrip looks={looks} activeLookId="look-2" />)

    expect(screen.getByTestId("product-colorway-strip")).toBeInTheDocument()
    expect(screen.getByText("3 items · 2 looks")).toBeInTheDocument()

    // Sorted by `order`: Look A (order 1) before Look B (order 2).
    const labels = screen
      .getAllByText(/^Look [AB]/)
      .map((el) => el.textContent)
    expect(labels).toEqual(["Look A", "Look B · Active"])
  })

  it("falls back to the first sorted look when activeLookId does not match any look", () => {
    render(<ProductColorwayStrip looks={looks} activeLookId="look-gone" />)

    // Look A is first after sorting, so it inherits the Active marker.
    expect(screen.getByText("Look A · Active")).toBeInTheDocument()
    expect(screen.getByText("Look B")).toBeInTheDocument()
  })

  it("renders the empty state when there are no looks", () => {
    render(<ProductColorwayStrip looks={[]} activeLookId={null} />)

    expect(screen.getByTestId("product-colorway-strip")).toBeInTheDocument()
    expect(
      screen.getByText("No products yet. Add a look in the rail."),
    ).toBeInTheDocument()
    expect(screen.queryByText(/items ·/)).not.toBeInTheDocument()
  })

  it("drops the producer rail hint from the empty state when readOnly (Shoot shell / Review)", () => {
    render(<ProductColorwayStrip looks={[]} activeLookId={null} readOnly />)

    expect(screen.getByText("No products yet.")).toBeInTheDocument()
    expect(screen.queryByText(/Add a look in the rail/)).not.toBeInTheDocument()
  })

  it("renders product line fields: family, colour, size, and sku", () => {
    render(<ProductColorwayStrip looks={looks} activeLookId="look-2" />)

    // Full product line (Look B).
    expect(screen.getByText("Merino Hoodie")).toBeInTheDocument()
    expect(screen.getByText("Charcoal")).toBeInTheDocument()
    expect(screen.getByText(/· L/)).toBeInTheDocument()
    expect(screen.getByText("MH-CHAR-L")).toBeInTheDocument()

    // Sparse lines (Look A): name-only product, and familyId fallback when
    // familyName is missing.
    expect(screen.getByText("Merino Tee")).toBeInTheDocument()
    expect(screen.getByText("fam-3")).toBeInTheDocument()
  })

  it("renders the per-look empty message when a look has no products", () => {
    const emptyLook: ShotLook[] = [{ id: "look-empty", label: "Bare", products: [] }]
    render(<ProductColorwayStrip looks={emptyLook} activeLookId={null} />)

    expect(screen.getByText("0 items · 1 look")).toBeInTheDocument()
    expect(screen.getByText("No products in this look.")).toBeInTheDocument()
  })
})
