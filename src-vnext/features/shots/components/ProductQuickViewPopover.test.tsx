/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { Timestamp } from "firebase/firestore"
import type { ProductAssignment, ProductFamily, ProductSku } from "@/shared/types"

// ---------------------------------------------------------------------------
// Mocks — the popover loads a family doc and a sku doc; stub both per-test.
// ---------------------------------------------------------------------------

let mockFamily: Partial<ProductFamily> | null = null
let mockSku: Partial<ProductSku> | null = null
let lastSkuLookupId: string | null = null
let mockSkuLoading = false

vi.mock("@/features/shots/hooks/usePickerData", () => ({
  useProductFamilyDoc: () => ({ data: mockFamily, loading: false }),
  useProductSkuDoc: (_familyId: string | null, skuId: string | null) => {
    lastSkuLookupId = skuId
    return { data: mockSku, loading: mockSkuLoading }
  },
}))

// Echo the path so a resolved image renders as <img src={path}>.
vi.mock("@/shared/hooks/useStorageUrl", () => ({
  useStorageUrl: (src: string | undefined) => src,
}))

import { ProductQuickViewPopover } from "./ProductQuickViewPopover"

// ---------------------------------------------------------------------------
// Helpers — production-shaped fixtures: a family with its own date, plus
// colorway SKUs that may or may not carry a per-SKU override.
// ---------------------------------------------------------------------------

function ts(iso: string): Timestamp {
  return Timestamp.fromDate(new Date(`${iso}T00:00:00Z`))
}

const FAMILY_LAUNCH = "2026-03-10"
const SKU_LAUNCH = "2026-03-25"

function assignment(skuId: string): ProductAssignment {
  return {
    familyId: "fam1",
    familyName: "Women's Merino Scoop Bralette",
    skuId,
    colourName: "Black",
  } as ProductAssignment
}

async function renderPopover(a: ProductAssignment = assignment("sku-black")) {
  const user = userEvent.setup()
  render(
    <MemoryRouter>
      <ProductQuickViewPopover assignment={a}>
        <button type="button">trigger</button>
      </ProductQuickViewPopover>
    </MemoryRouter>,
  )
  // The quick-view content only mounts when the popover is open; open it and
  // wait for the family name to confirm the content has rendered.
  await user.click(screen.getByText("trigger"))
  await screen.findByText("Women's Merino Scoop Bralette")
}

describe("ProductQuickViewPopover launch date resolution", () => {
  beforeEach(() => {
    mockFamily = null
    mockSku = null
    lastSkuLookupId = null
  })

  it("(a) shows the per-SKU launch date when the SKU has its own, with no inherited badge", async () => {
    mockFamily = { id: "fam1", styleName: "Bralette", earliestLaunchDate: ts(FAMILY_LAUNCH) }
    mockSku = { id: "sku-black", name: "Black", launchDate: ts(SKU_LAUNCH) }

    await renderPopover()

    expect(screen.getByText(SKU_LAUNCH)).toBeInTheDocument()
    expect(screen.queryByText(FAMILY_LAUNCH)).not.toBeInTheDocument()
    expect(screen.queryByText("inherited")).not.toBeInTheDocument()
  })

  it("(b) falls back to the family earliestLaunchDate when the SKU has none, and shows the inherited badge", async () => {
    mockFamily = { id: "fam1", styleName: "Bralette", earliestLaunchDate: ts(FAMILY_LAUNCH) }
    mockSku = { id: "sku-black", name: "Black" } // no per-SKU launchDate

    await renderPopover()

    expect(screen.getByText(FAMILY_LAUNCH)).toBeInTheDocument()
    expect(screen.getByText("inherited")).toBeInTheDocument()
  })

  it("(b2) falls back to family.launchDate when earliestLaunchDate is absent", async () => {
    mockFamily = { id: "fam1", styleName: "Bralette", launchDate: ts(FAMILY_LAUNCH) }
    mockSku = { id: "sku-black", name: "Black" }

    await renderPopover()

    expect(screen.getByText(FAMILY_LAUNCH)).toBeInTheDocument()
    expect(screen.getByText("inherited")).toBeInTheDocument()
  })

  it("(c) renders no launch row (and no badge) when neither SKU nor family has a date", async () => {
    mockFamily = { id: "fam1", styleName: "Bralette" }
    mockSku = { id: "sku-black", name: "Black" }

    await renderPopover()

    expect(screen.queryByText("Launch")).not.toBeInTheDocument()
    expect(screen.queryByText("inherited")).not.toBeInTheDocument()
  })

  it("(d) the inherited flag is true ONLY on fallback — explicit SKU date wins and is not marked inherited", async () => {
    mockFamily = { id: "fam1", styleName: "Bralette", earliestLaunchDate: ts(FAMILY_LAUNCH) }
    mockSku = { id: "sku-black", name: "Black", launchDate: ts(SKU_LAUNCH) }

    await renderPopover()

    expect(screen.getByText(SKU_LAUNCH)).toBeInTheDocument()
    expect(screen.queryByText("inherited")).not.toBeInTheDocument()
  })

  it("(e) resolves the SKU via legacy colourId when skuId is absent", async () => {
    mockFamily = { id: "fam1", styleName: "Bralette", earliestLaunchDate: ts(FAMILY_LAUNCH) }
    mockSku = { id: "colour-black", name: "Black", launchDate: ts(SKU_LAUNCH) }
    // Legacy assignment: SKU doc id lives in colourId, no skuId.
    const legacy = { familyId: "fam1", familyName: "Women's Merino Scoop Bralette", colourId: "colour-black", colourName: "Black" } as ProductAssignment

    await renderPopover(legacy)

    expect(lastSkuLookupId).toBe("colour-black")
    expect(screen.getByText(SKU_LAUNCH)).toBeInTheDocument()
    expect(screen.queryByText("inherited")).not.toBeInTheDocument()
  })
})

describe("ProductQuickViewPopover image — a colourway never borrows the family image", () => {
  const FAMILY_THUMB = "productFamilies/fam1/skus/black.webp" // = the first colourway's photo
  const OLIVE_PHOTO = "productFamilies/fam1/skus/olive.webp"
  // Radix hides popover content from role queries in jsdom; the <img> alt is the family name.
  const FAMILY_NAME = "Women's Merino Scoop Bralette"

  beforeEach(() => {
    mockFamily = { id: "fam1", styleName: "Bralette", thumbnailImagePath: FAMILY_THUMB }
    mockSku = null
    mockSkuLoading = false
  })

  it("does not claim 'no photo for this colour' while the live colourway is still loading", async () => {
    mockSkuLoading = true
    await renderPopover({ ...assignment("sku-olive"), thumbUrl: FAMILY_THUMB, familyImageUrl: FAMILY_THUMB })

    expect(screen.queryByText("No photo for this colour")).not.toBeInTheDocument()
    expect(screen.getByText("No image")).toBeInTheDocument()
    expect(screen.queryByAltText(FAMILY_NAME)).not.toBeInTheDocument()
  })

  it("ignores a SKU doc carried over from a different colourway", async () => {
    mockSku = { id: "sku-black", name: "Black", imagePath: "productFamilies/fam1/skus/black-own.webp" }
    await renderPopover({ ...assignment("sku-olive"), thumbUrl: FAMILY_THUMB, familyImageUrl: FAMILY_THUMB })

    expect(screen.getByText("No photo for this colour")).toBeInTheDocument()
    expect(screen.queryByAltText(FAMILY_NAME)).not.toBeInTheDocument()
  })

  it("shows 'No photo for this colour' instead of the frozen family image", async () => {
    mockSku = { id: "sku-olive", name: "Olive" } // no imagePath
    await renderPopover({ ...assignment("sku-olive"), thumbUrl: FAMILY_THUMB, familyImageUrl: FAMILY_THUMB })

    expect(screen.getByText("No photo for this colour")).toBeInTheDocument()
    expect(screen.queryByAltText(FAMILY_NAME)).not.toBeInTheDocument()
  })

  it("shows the colourway's live photo when it has one", async () => {
    mockSku = { id: "sku-olive", name: "Olive", imagePath: OLIVE_PHOTO }
    await renderPopover({ ...assignment("sku-olive"), thumbUrl: FAMILY_THUMB, familyImageUrl: FAMILY_THUMB })

    expect(screen.getByAltText(FAMILY_NAME)).toHaveAttribute("src", OLIVE_PHOTO)
  })

  it("keeps the family image for a family-level assignment (no colourway chosen)", async () => {
    const familyLevel = { familyId: "fam1", familyName: "Women's Merino Scoop Bralette" } as ProductAssignment
    await renderPopover(familyLevel)

    expect(screen.getByAltText(FAMILY_NAME)).toHaveAttribute("src", FAMILY_THUMB)
  })
})
