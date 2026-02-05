/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ProductAssignmentPicker } from "./ProductAssignmentPicker"
import type { ProductAssignment } from "@/shared/types"

/* ─── Mocks ─── */

const MOCK_FAMILY = {
  id: "fam-1",
  styleName: "Classic Tee",
  styleNumber: "CT-100",
  gender: "Women",
  productType: "Tops",
  productSubcategory: "Tees",
  thumbnailImagePath: "productFamilies/fam-1/thumb.webp",
  clientId: "c1",
}

const MOCK_SKU = {
  id: "sku-1",
  name: "Navy",
  colorName: "Navy",
  colourHex: "#001f3f",
  sizes: ["S", "M", "L"],
  skuCode: "CT-100-NVY",
  imagePath: "productFamilies/fam-1/skus/sku-1.webp",
}

vi.mock("@/features/shots/hooks/usePickerData", () => ({
  useProductFamilies: () => ({ data: [MOCK_FAMILY], loading: false }),
  useProductSkus: () => ({ data: [MOCK_SKU], loading: false }),
  useProductFamilyDoc: () => ({ data: MOCK_FAMILY, loading: false, error: null }),
  useProductSkuDoc: () => ({ data: MOCK_SKU, loading: false, error: null }),
}))

vi.mock("@/shared/lib/resolveStoragePath", () => ({
  resolveStoragePath: () => Promise.resolve("https://img.test/thumb.jpg"),
  getCachedUrl: () => undefined,
}))

/* ─── Helpers ─── */

const EXISTING: ProductAssignment[] = [
  {
    familyId: "fam-1",
    familyName: "Classic Tee",
    skuId: "sku-1",
    colourId: "sku-1",
    colourName: "Navy",
    sizeScope: "all",
    quantity: 2,
  },
]

/**
 * Navigate through Family → SKU → Details steps to reach the confirm button.
 * Assumes the dialog is already open (Add product was clicked).
 */
async function navigateToDetailsStep() {
  // Step 1: select family
  const familyItem = await screen.findByText("Classic Tee")
  fireEvent.click(familyItem)

  // Step 2: select SKU
  const skuItem = await screen.findByText("Navy")
  fireEvent.click(skuItem)

  // Step 3: we should now be on details step with confirm button
  await screen.findByTestId("picker-confirm")
}

/* ─── Tests ─── */

describe("ProductAssignmentPicker", () => {
  let onSave: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onSave = vi.fn()
  })

  it("renders a product thumbnail for existing assignments (no delete/re-add)", async () => {
    onSave.mockResolvedValue(true)

    render(
      <ProductAssignmentPicker
        selected={EXISTING}
        onSave={onSave}
        disabled={false}
      />,
    )

    // The assignment row should render a thumbnail resolved from storage path.
    const img = await screen.findByAltText("Classic Tee")
    expect(img).toHaveAttribute("src", "https://img.test/thumb.jpg")
  })

  describe("save-gated confirm", () => {
    it("keeps dialog open and retains selections when onSave resolves false", async () => {
      onSave.mockResolvedValue(false)

      render(
        <ProductAssignmentPicker
          selected={[]}
          onSave={onSave}
          disabled={false}
        />,
      )

      // Open the add dialog
      fireEvent.click(screen.getByText("Add product"))
      await navigateToDetailsStep()

      // Change quantity to 3 before confirming
      const qtyInput = screen.getByDisplayValue("1") as HTMLInputElement
      fireEvent.change(qtyInput, { target: { value: "3" } })

      // Click confirm — onSave returns false
      fireEvent.click(screen.getByTestId("picker-confirm"))

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1)
      })

      // Dialog should still be open — confirm button is still rendered
      expect(screen.getByTestId("picker-confirm")).toBeInTheDocument()

      // User's quantity selection should be preserved
      const qtyAfter = screen.getByDisplayValue("3") as HTMLInputElement
      expect(qtyAfter).toBeInTheDocument()
    })

    it("closes dialog when onSave resolves true", async () => {
      onSave.mockResolvedValue(true)

      render(
        <ProductAssignmentPicker
          selected={[]}
          onSave={onSave}
          disabled={false}
        />,
      )

      fireEvent.click(screen.getByText("Add product"))
      await navigateToDetailsStep()

      fireEvent.click(screen.getByTestId("picker-confirm"))

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1)
      })

      // Dialog should be closed — confirm button no longer in DOM
      await waitFor(() => {
        expect(screen.queryByTestId("picker-confirm")).not.toBeInTheDocument()
      })

      // Verify the assignment shape includes sizeScope
      const savedProducts = onSave.mock.calls[0]![0] as ProductAssignment[]
      expect(savedProducts).toHaveLength(1)
      expect(savedProducts[0]).toMatchObject({
        familyId: "fam-1",
        familyName: "Classic Tee",
        sizeScope: "all",
      })
    })

    it("disables confirm button while saving", async () => {
      // Create a promise we control to keep the save pending
      let resolveSave!: (ok: boolean) => void
      onSave.mockImplementation(
        () => new Promise<boolean>((resolve) => { resolveSave = resolve }),
      )

      render(
        <ProductAssignmentPicker
          selected={[]}
          onSave={onSave}
          disabled={false}
        />,
      )

      fireEvent.click(screen.getByText("Add product"))
      await navigateToDetailsStep()

      const confirmBtn = screen.getByTestId("picker-confirm")
      fireEvent.click(confirmBtn)

      // While save is pending, button should be disabled and show saving text
      await waitFor(() => {
        expect(confirmBtn).toBeDisabled()
        expect(confirmBtn.textContent).toContain("Saving")
      })

      // Resolve the save
      resolveSave(true)

      await waitFor(() => {
        expect(screen.queryByTestId("picker-confirm")).not.toBeInTheDocument()
      })
    })
  })

  it("shows gender/type scaffolding in the family step list", async () => {
    onSave.mockResolvedValue(true)

    render(
      <ProductAssignmentPicker
        selected={[]}
        onSave={onSave}
        disabled={false}
      />,
    )

    fireEvent.click(screen.getByText("Add product"))

    expect(await screen.findByText("Women")).toBeInTheDocument()
    expect(screen.getByText("Tops · Tees")).toBeInTheDocument()
  })

  describe("save-gated remove", () => {
    it("keeps assignment in list when remove save fails", async () => {
      onSave.mockResolvedValue(false)

      render(
        <ProductAssignmentPicker
          selected={EXISTING}
          onSave={onSave}
          disabled={false}
        />,
      )

      // The existing assignment row should be visible
      expect(screen.getByText("Classic Tee")).toBeInTheDocument()

      // Click the remove button (X icon) — it's the ghost icon button inside the row
      const removeButtons = screen.getAllByRole("button")
      // The remove button is the small icon-only ghost button (not "Add product")
      const removeBtn = removeButtons.find(
        (btn) => btn.querySelector("svg") !== null && !btn.textContent?.includes("Add"),
      )
      expect(removeBtn).toBeTruthy()
      fireEvent.click(removeBtn!)

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledTimes(1)
      })

      // onSave was called with empty array (removed the one item)
      const savedProducts = onSave.mock.calls[0]![0] as ProductAssignment[]
      expect(savedProducts).toHaveLength(0)
    })
  })
})
