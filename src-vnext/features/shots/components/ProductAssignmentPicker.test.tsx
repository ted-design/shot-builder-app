/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import { ProductAssignmentPicker } from "./ProductAssignmentPicker"
import type { ProductAssignment } from "@/shared/types"
import { resolveAssignmentImage } from "@/shared/lib/colourwayImage"
import { mapShot } from "@/features/shots/lib/mapShot"

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

// Swappable per test; reset in the colourway-image describe.
let mockSku: Record<string, unknown> | null = MOCK_SKU
let mockSkuLoading = false
// When set, the colourway list (useProductSkus) returns these instead of [mockSku].
let mockSkuList: Record<string, unknown>[] | null = null
const storageMode = vi.hoisted(() => ({ pending: false }))

vi.mock("@/features/shots/hooks/usePickerData", () => ({
  useProductFamilies: () => ({ data: [MOCK_FAMILY], loading: false }),
  useProductSkus: () => ({ data: mockSkuList ?? [mockSku], loading: false }),
  useProductFamilyDoc: () => ({ data: MOCK_FAMILY, loading: false, error: null }),
  useProductSkuDoc: () => ({ data: mockSku, loading: mockSkuLoading, error: null }),
}))

vi.mock("@/shared/lib/resolveStoragePath", () => ({
  // Echo the path so a test can tell WHICH image resolved (live SKU vs family).
  resolveStoragePath: (path: string) =>
    storageMode.pending ? new Promise<string>(() => {}) : Promise.resolve(`https://img.test/${path}`),
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
    expect(img).toHaveAttribute("src", `https://img.test/${MOCK_SKU.imagePath}`)
  })

  describe("hero star", () => {
    it("does not render the star when onToggleHero is omitted", () => {
      render(<ProductAssignmentPicker selected={EXISTING} onSave={vi.fn()} />)
      expect(
        screen.queryByRole("button", { name: /hero product/i }),
      ).not.toBeInTheDocument()
    })

    it("renders a pressed star for hero indices and toggles by index on click", () => {
      const onToggleHero = vi.fn()
      render(
        <ProductAssignmentPicker
          selected={EXISTING}
          onSave={vi.fn()}
          heroIndexes={new Set([0])}
          onToggleHero={onToggleHero}
        />,
      )
      const star = screen.getByRole("button", { name: "Unmark hero product" })
      expect(star).toHaveAttribute("aria-pressed", "true")
      fireEvent.click(star)
      expect(onToggleHero).toHaveBeenCalledWith(0)
    })

    it("renders an unpressed star for non-hero rows", () => {
      render(
        <ProductAssignmentPicker
          selected={EXISTING}
          onSave={vi.fn()}
          heroIndexes={new Set()}
          onToggleHero={vi.fn()}
        />,
      )
      expect(
        screen.getByRole("button", { name: "Mark as hero product" }),
      ).toHaveAttribute("aria-pressed", "false")
    })

    it("disables the star when the picker is read-only", () => {
      render(
        <ProductAssignmentPicker
          selected={EXISTING}
          onSave={vi.fn()}
          disabled
          heroIndexes={new Set([0])}
          onToggleHero={vi.fn()}
        />,
      )
      expect(screen.getByRole("button", { name: "Unmark hero product" })).toBeDisabled()
    })
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

  it("keeps modal open in edit mode when navigating back to change product selection", async () => {
    onSave.mockResolvedValue(true)

    render(
      <ProductAssignmentPicker
        selected={EXISTING}
        onSave={onSave}
        disabled={false}
      />,
    )

    fireEvent.click(screen.getByText("Classic Tee"))
    await screen.findByTestId("picker-confirm")

    const dialog = screen.getByRole("dialog")
    const firstBackButton = dialog.querySelector("button.h-7.w-7") as HTMLButtonElement | null
    expect(firstBackButton).toBeTruthy()
    fireEvent.click(firstBackButton!)

    // Back from details should go to SKU step (not close dialog).
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(await screen.findByText("Skip — no specific colorway")).toBeInTheDocument()

    const dialogAfterFirstBack = screen.getByRole("dialog")
    const secondBackButton = dialogAfterFirstBack.querySelector("button.h-7.w-7") as HTMLButtonElement | null
    expect(secondBackButton).toBeTruthy()
    fireEvent.click(secondBackButton!)

    // Back from SKU should return to family selection.
    expect(await screen.findByPlaceholderText("Search product families...")).toBeInTheDocument()
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

    expect((await screen.findAllByText("Women")).length).toBeGreaterThan(0)
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

describe("ProductAssignmentPicker — a colourway with no photo never shows the family image", () => {
  const NAVY_NO_PHOTO = { ...MOCK_SKU, imagePath: undefined }
  // Picker-written shape when Navy had no photo: thumbUrl = familyImageUrl.
  const FROZEN_FAMILY_FALLBACK: ProductAssignment[] = [
    { ...EXISTING[0]!, thumbUrl: "https://img.test/family.jpg", familyImageUrl: "https://img.test/family.jpg" },
  ]

  beforeEach(() => {
    mockSku = MOCK_SKU
    mockSkuLoading = false
    storageMode.pending = false
  })

  it("assignment row: no 'no photo' claim while the live colourway is still loading", async () => {
    mockSku = null
    mockSkuLoading = true
    render(<ProductAssignmentPicker selected={FROZEN_FAMILY_FALLBACK} onSave={vi.fn()} />)
    await act(async () => {})

    expect(screen.queryByRole("img", { name: /No photo for this colour/ })).not.toBeInTheDocument()
    expect(screen.queryByAltText("Classic Tee")).not.toBeInTheDocument()
  })

  it("assignment row: ignores a SKU doc carried over from a different colourway", async () => {
    mockSku = { ...MOCK_SKU, id: "sku-OTHER" } // has a photo, but not this assignment's colourway
    render(<ProductAssignmentPicker selected={FROZEN_FAMILY_FALLBACK} onSave={vi.fn()} />)
    await act(async () => {})

    expect(screen.getByRole("img", { name: "Classic Tee: No photo for this colour" })).toBeInTheDocument()
    expect(screen.queryByAltText("Classic Tee")).not.toBeInTheDocument()
  })

  it("colourway step: a colourway WITH a photo never shows the 'no photo' label while its URL resolves", async () => {
    storageMode.pending = true
    render(<ProductAssignmentPicker selected={[]} onSave={vi.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: /add product/i }))
    fireEvent.click(await screen.findByText("Classic Tee"))
    await screen.findByText("Navy")
    await act(async () => {})

    expect(screen.queryByRole("img", { name: /No photo for this colour/ })).not.toBeInTheDocument()
  })

  it("assignment row: shows the placeholder instead of the frozen family image", async () => {
    mockSku = NAVY_NO_PHOTO
    render(<ProductAssignmentPicker selected={FROZEN_FAMILY_FALLBACK} onSave={vi.fn()} />)
    // Let any async storage-URL resolution settle so the negative check can't pass early.
    await act(async () => {})

    expect(screen.getByRole("img", { name: "Classic Tee: No photo for this colour" })).toBeInTheDocument()
    expect(screen.queryByAltText("Classic Tee")).not.toBeInTheDocument()
  })

  it("assignment row: shows the colourway's live photo once it has one", async () => {
    render(<ProductAssignmentPicker selected={FROZEN_FAMILY_FALLBACK} onSave={vi.fn()} />)

    // The live SKU photo, not the frozen family image.
    expect(await screen.findByAltText("Classic Tee")).toHaveAttribute("src", `https://img.test/${MOCK_SKU.imagePath}`)
    expect(screen.queryByRole("img", { name: /No photo for this colour/ })).not.toBeInTheDocument()
  })

  it("colourway step: lists a colourway with no photo with the placeholder, not the family image", async () => {
    mockSku = NAVY_NO_PHOTO
    render(<ProductAssignmentPicker selected={[]} onSave={vi.fn()} />)

    fireEvent.click(screen.getByRole("button", { name: /add product/i }))
    fireEvent.click(await screen.findByText("Classic Tee"))
    await screen.findByText("Navy")
    await act(async () => {})

    expect(screen.getByRole("img", { name: "Navy: No photo for this colour" })).toBeInTheDocument()
    expect(screen.queryByAltText("Navy")).not.toBeInTheDocument()
  })
})

describe("ProductAssignmentPicker — editing an assignment's colourway replaces its photo fields", () => {
  const PHOTO_A = "https://img.test/productFamilies/fam-1/skus/sku-1.webp"
  const FAMILY_URL = "https://img.test/productFamilies/fam-1/thumb.webp"
  const NAVY_WITH_PHOTO: ProductAssignment = {
    familyId: "fam-1",
    familyName: "Classic Tee",
    skuId: "sku-1",
    colourId: "sku-1",
    skuName: "Navy",
    colourName: "Navy",
    sizeScope: "all",
    quantity: 1,
    thumbUrl: PHOTO_A,
    skuImageUrl: PHOTO_A,
    familyImageUrl: FAMILY_URL,
  }
  // Legacy shape after mapShot: colourId only; colourImagePath surfaced as skuImageUrl.
  const LEGACY_NAVY: ProductAssignment = {
    familyId: "fam-1",
    familyName: "Classic Tee",
    colourId: "sku-1",
    colourName: "Navy",
    sizeScope: "all",
    quantity: 1,
    thumbUrl: FAMILY_URL,
    skuImageUrl: PHOTO_A,
    familyImageUrl: FAMILY_URL,
  }
  const OLIVE_NO_PHOTO = { id: "sku-2", name: "Olive", colorName: "Olive", sizes: ["S"], skuCode: "CT-100-OLV" }

  beforeEach(() => {
    mockSku = MOCK_SKU
    mockSkuLoading = false
    mockSkuList = [MOCK_SKU, OLIVE_NO_PHOTO]
  })
  afterEach(() => {
    mockSkuList = null
  })

  async function confirmEdit(selected: ProductAssignment[], change: () => Promise<void>) {
    const save = vi.fn().mockResolvedValue(true)
    render(<ProductAssignmentPicker selected={selected} onSave={save} />)
    fireEvent.click(screen.getByText("Classic Tee")) // open the row in edit mode (details step)
    await change()
    fireEvent.click(await screen.findByTestId("picker-confirm"))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    return (save.mock.calls[0]![0] as ProductAssignment[])[0]!
  }

  const pickOlive = async () => {
    fireEvent.click(await screen.findByRole("button", { name: "Back to colorways" }))
    fireEvent.click(await screen.findByText("Olive"))
  }

  it("A (with photo) → B (no photo): no trace of A survives and the cover falls to the placeholder", async () => {
    const saved = await confirmEdit([NAVY_WITH_PHOTO], pickOlive)

    expect(saved).toMatchObject({ skuId: "sku-2", colourId: "sku-2", skuName: "Olive", colourName: "Olive" })
    expect(JSON.stringify(saved)).not.toContain("sku-1")
    expect(JSON.stringify(saved)).not.toContain("Navy")
    expect(saved.familyImageUrl).toBe(FAMILY_URL) // family-level field kept
    expect(resolveAssignmentImage(saved)).toEqual({ src: null, colourwayPhotoMissing: true })
    const shot = mapShot("s1", {
      title: "T", projectId: "p1", clientId: "c1", activeLookId: "l1",
      looks: [{ id: "l1", heroProductId: "sku-2", products: [saved] }],
    })
    expect(shot.heroImage).toBeUndefined()
  })

  it("legacy colourId-only assignment with a stored colour photo → B: the legacy photo is dropped", async () => {
    const saved = await confirmEdit([LEGACY_NAVY], pickOlive)

    expect(saved).toMatchObject({ skuId: "sku-2", colourId: "sku-2", colourName: "Olive" })
    expect(JSON.stringify(saved)).not.toContain("sku-1")
    expect(resolveAssignmentImage(saved).colourwayPhotoMissing).toBe(true)
  })

  it("skipping the colourway makes the assignment family-level: the old colourway and its photo are gone", async () => {
    const saved = await confirmEdit([NAVY_WITH_PHOTO], async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Back to colorways" }))
      fireEvent.click(await screen.findByText("Skip — no specific colorway"))
    })

    for (const key of ["skuId", "colourId", "skuName", "colourName", "skuImageUrl"] as const) {
      expect(saved[key]).toBeUndefined()
    }
    expect(JSON.stringify(saved)).not.toContain("sku-1")
    expect(resolveAssignmentImage(saved)).toEqual({ src: FAMILY_URL, colourwayPhotoMissing: false })
  })

  it("re-picking the same colourway from the catalog after its photo was removed drops the stale URL", async () => {
    mockSkuList = [{ ...MOCK_SKU, imagePath: undefined }, OLIVE_NO_PHOTO] // Navy's photo has since been removed
    const saved = await confirmEdit([NAVY_WITH_PHOTO], async () => {
      fireEvent.click(await screen.findByRole("button", { name: "Back to colorways" }))
      fireEvent.click(await within(screen.getByRole("dialog")).findByText("Navy"))
    })

    expect(saved).toMatchObject({ skuId: "sku-1", colourName: "Navy", familyImageUrl: FAMILY_URL })
    expect(saved.skuImageUrl).toBeUndefined()
    expect(saved.thumbUrl).toBeUndefined()
  })

  it("an edit that keeps the colourway keeps its stored photo", async () => {
    const saved = await confirmEdit([NAVY_WITH_PHOTO], async () => {})
    expect(saved).toMatchObject({ skuId: "sku-1", colourName: "Navy", skuImageUrl: PHOTO_A, thumbUrl: PHOTO_A })
  })

  it("a legacy colourId-only assignment confirmed unchanged keeps its colourway", async () => {
    const saved = await confirmEdit([LEGACY_NAVY], async () => {})
    expect(saved).toMatchObject({ colourId: "sku-1", colourName: "Navy", skuImageUrl: PHOTO_A })
  })
})
