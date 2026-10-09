/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import type { ProductSku } from "@/shared/types"

vi.mock("@/features/products/lib/productWorkspaceWrites", () => ({
  replaceProductSkuImage: vi.fn(),
  removeProductSkuImage: vi.fn(),
  updateProductSkuLaunchDateWithSync: vi.fn(),
}))

// Echo the path so a resolved image renders as <img src={path}>; a test can
// switch to "still resolving" (undefined) to check the loading state.
const storage = vi.hoisted(() => ({ pending: false }))
vi.mock("@/shared/hooks/useStorageUrl", () => ({
  useStorageUrl: (src: string | undefined) => (storage.pending ? undefined : src),
}))

import { ProductSkuCard } from "./ProductSkuCard"

const OLIVE: ProductSku = { id: "olive", name: "Olive", colorName: "Dark Olive" }

describe("ProductSkuCard image", () => {
  beforeEach(() => {
    storage.pending = false
  })

  it("does not claim 'no photo' while the colourway's photo URL is still resolving", () => {
    storage.pending = true
    render(<ProductSkuCard sku={{ ...OLIVE, imagePath: "skus/olive.webp" }} />)

    expect(screen.queryByText("No photo for this colour")).not.toBeInTheDocument()
    expect(screen.getByRole("img", { name: "Dark Olive" })).toBeInTheDocument() // neutral placeholder
  })

  it("shows a 'No photo for this colour' placeholder when the colourway has no photo", () => {
    render(<ProductSkuCard sku={OLIVE} />)

    expect(screen.getByRole("img", { name: "Dark Olive: No photo for this colour" })).toBeInTheDocument()
    expect(screen.getByText("No photo for this colour")).toBeInTheDocument()
    expect(screen.queryByAltText("Dark Olive")).not.toBeInTheDocument()
  })

  it("shows the colourway's own photo when it has one", () => {
    render(<ProductSkuCard sku={{ ...OLIVE, imagePath: "skus/olive.webp" }} />)

    expect(screen.getByAltText("Dark Olive")).toHaveAttribute("src", "skus/olive.webp")
    expect(screen.queryByText("No photo for this colour")).not.toBeInTheDocument()
  })
})
