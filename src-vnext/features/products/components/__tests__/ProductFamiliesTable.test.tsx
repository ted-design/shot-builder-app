/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import type { ProductFamily } from "@/shared/types"

// Resolve storage paths synchronously (returns the path itself as the "url")
// so <ProductImage> renders its final <img src> on first paint instead of
// needing an async effect flush.
vi.mock("@/shared/lib/resolveStoragePath", () => ({
  isUrl: (value: string) => value.startsWith("https://") || value.startsWith("http://"),
  resolveStoragePath: async (path: string) => path,
  getCachedUrl: (path: string) => path,
}))

import { ProductFamiliesTable } from "@/features/products/components/ProductFamiliesTable"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeTimestamp(date: Date): ProductFamily["updatedAt"] {
  return { toDate: () => date } as unknown as ProductFamily["updatedAt"]
}

function makeFamily(overrides: Partial<ProductFamily> = {}): ProductFamily {
  return {
    id: "fam-1",
    clientId: "c1",
    styleName: "Classic Tee",
    ...overrides,
  }
}

const FULL_FAMILY: ProductFamily = makeFamily({
  id: "fam-1",
  styleName: "Classic Tee",
  styleNumber: "CT-100",
  gender: "men",
  productType: "tops",
  productSubcategory: "t-shirt",
  activeSkuCount: 4,
  skuCount: 9,
  status: "active",
  updatedAt: makeTimestamp(new Date(2026, 0, 5)),
  thumbnailImagePath: "products/fam-1/thumb.jpg",
  headerImagePath: "products/fam-1/header.jpg",
})

const MINIMAL_FAMILY: ProductFamily = makeFamily({
  id: "fam-2",
  styleName: "Unlabeled Style",
  // no styleNumber, gender, productType, productSubcategory, sku counts,
  // status, updatedAt, or images.
})

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderTable(
  families: readonly ProductFamily[],
  initialEntries: readonly string[] = ["/products"],
) {
  return render(
    <MemoryRouter initialEntries={initialEntries as string[]}>
      <ProductFamiliesTable families={families} />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  // Clear persisted column config between tests (useTableColumns persists to
  // localStorage under `sb:products-table`).
  localStorage.removeItem("sb:products-table")
})

/**
 * The preview-image link and the style-name link both target the same href,
 * and because the preview <img>'s alt text equals the style name, BOTH links
 * compute to the same accessible name — `getByRole("link", { name })` alone
 * can't tell them apart. The style link is the one whose actual text content
 * (not just its accessible name) is the style name; the preview link's text
 * content is empty (it wraps an <img>, not a text node).
 */
function getStyleLink(name: string): HTMLElement {
  const links = screen.getAllByRole("link", { name })
  const match = links.find((l) => l.textContent === name)
  if (!match) throw new Error(`No style-name link found with text "${name}"`)
  return match
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ProductFamiliesTable", () => {
  it("renders all default column headers", () => {
    renderTable([FULL_FAMILY])

    expect(screen.getByText("Preview")).toBeInTheDocument()
    expect(screen.getByText("Style")).toBeInTheDocument()
    expect(screen.getByText("Style #")).toBeInTheDocument()
    expect(screen.getByText("Category")).toBeInTheDocument()
    expect(screen.getByText("Colorways")).toBeInTheDocument()
    expect(screen.getByText("Status")).toBeInTheDocument()
    expect(screen.getByText("Updated")).toBeInTheDocument()
  })

  it("renders one row per family", () => {
    renderTable([FULL_FAMILY, MINIMAL_FAMILY])

    expect(screen.getByText("Classic Tee")).toBeInTheDocument()
    expect(screen.getByText("Unlabeled Style")).toBeInTheDocument()
  })

  it("renders an empty tbody with no crash and no data rows when families is empty", () => {
    const { container } = renderTable([])

    // Headers still render.
    expect(screen.getByText("Style")).toBeInTheDocument()
    // No data rows.
    expect(container.querySelectorAll("tbody tr").length).toBe(0)
  })

  it("shows the style number, or a dash when absent", () => {
    renderTable([FULL_FAMILY, MINIMAL_FAMILY])

    expect(screen.getByText("CT-100")).toBeInTheDocument()

    const rows = screen.getAllByRole("row")
    // Cell order: preview(0), style(1), styleNumber(2), category(3), colorways(4), status(5), updated(6).
    const styleNumberCell = within(rows[2]!).getAllByRole("cell")[2]!
    expect(styleNumberCell.textContent).toBe("—")
  })

  it("joins gender / productType / productSubcategory into a category path", () => {
    renderTable([FULL_FAMILY])

    expect(screen.getByText("Men · Tops · T Shirt")).toBeInTheDocument()
  })

  it("shows a dash for category when gender/productType/productSubcategory are all absent", () => {
    renderTable([MINIMAL_FAMILY])

    const rows = screen.getAllByRole("row")
    const row = within(rows[1]!)
    // styleNumber, category, colorways, and status(none) all render "—" for
    // this minimal fixture — assert at least one exists in the category cell
    // specifically via cell order (styleNumber, category are cells 2 and 3).
    const cells = row.getAllByRole("cell")
    expect(cells[3]!.textContent).toBe("—") // category cell
  })

  it("prefers activeSkuCount over skuCount for the colorways cell", () => {
    renderTable([FULL_FAMILY])

    expect(screen.getByText("4 active")).toBeInTheDocument()
    expect(screen.queryByText("9")).not.toBeInTheDocument()
  })

  it("falls back to a bare skuCount when activeSkuCount is absent", () => {
    renderTable([makeFamily({ id: "fam-3", styleName: "SKU Only", skuCount: 7 })])

    expect(screen.getByText("7")).toBeInTheDocument()
  })

  it("shows a dash for colorways when neither activeSkuCount nor skuCount is set", () => {
    renderTable([MINIMAL_FAMILY])

    const rows = screen.getAllByRole("row")
    const cells = within(rows[1]!).getAllByRole("cell")
    expect(cells[4]!.textContent).toBe("—") // colorways cell
  })

  it('defaults status to "Active" when no status/deleted/archived flags are set', () => {
    renderTable([MINIMAL_FAMILY])

    expect(screen.getByText("Active")).toBeInTheDocument()
  })

  it("combines deleted, archived, and a non-active status into one status cell", () => {
    renderTable([
      makeFamily({
        id: "fam-4",
        styleName: "Everything Wrong",
        deleted: true,
        archived: true,
        status: "in_review",
      }),
    ])

    expect(screen.getByText("Deleted · Archived · in review")).toBeInTheDocument()
  })

  it("formats updatedAt using the family's Timestamp", () => {
    const date = new Date(2026, 0, 5)
    renderTable([FULL_FAMILY])

    const expected = date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    expect(screen.getByText(expected)).toBeInTheDocument()
  })

  it("shows a dash for updated when updatedAt is absent", () => {
    renderTable([MINIMAL_FAMILY])

    const rows = screen.getAllByRole("row")
    const cells = within(rows[1]!).getAllByRole("cell")
    expect(cells[6]!.textContent).toBe("—") // updated cell
  })

  it("prefers thumbnailImagePath over headerImagePath for the preview image", () => {
    renderTable([FULL_FAMILY])

    const img = screen.getByAltText("Classic Tee")
    expect(img).toHaveAttribute("src", "products/fam-1/thumb.jpg")
  })

  it("falls back to headerImagePath when thumbnailImagePath is absent", () => {
    renderTable([
      makeFamily({
        id: "fam-5",
        styleName: "Header Only",
        thumbnailImagePath: undefined,
        headerImagePath: "products/fam-5/header.jpg",
      }),
    ])

    const img = screen.getByAltText("Header Only")
    expect(img).toHaveAttribute("src", "products/fam-5/header.jpg")
  })

  it("shows a placeholder (not an <img>) when neither image path is set", () => {
    renderTable([MINIMAL_FAMILY])

    // ProductImage falls back to a role="img" placeholder div, so the
    // accessible name still resolves via getByRole even without a real <img>.
    const placeholder = screen.getByRole("img", { name: "Unlabeled Style" })
    expect(placeholder.tagName).not.toBe("IMG")
  })

  it("links the preview and style cells to the product detail page with a returnTo param", () => {
    renderTable([FULL_FAMILY], ["/products?view=table&q=blue"])

    const expectedHref = `/products/fam-1?returnTo=${encodeURIComponent("/products?view=table&q=blue")}`
    const links = screen.getAllByRole("link")
    const matching = links.filter((l) => l.getAttribute("href") === expectedHref)
    // Both the preview image link and the style-name link point at the same href.
    expect(matching.length).toBe(2)
  })

  it("derives returnTo from the current location with no search params", () => {
    renderTable([FULL_FAMILY], ["/products"])

    const expectedHref = `/products/fam-1?returnTo=${encodeURIComponent("/products")}`
    const styleLink = getStyleLink("Classic Tee")
    expect(styleLink).toHaveAttribute("href", expectedHref)
  })

  it("dims the style link when the family is deleted", () => {
    renderTable([makeFamily({ id: "fam-6", styleName: "Gone Style", deleted: true })])

    const link = getStyleLink("Gone Style")
    expect(link.className).toContain("opacity-70")
  })

  it("does not dim the style link when the family is not deleted", () => {
    renderTable([FULL_FAMILY])

    const link = getStyleLink("Classic Tee")
    expect(link.className).not.toContain("opacity-70")
  })

  it("activates the first row's data-active-row attribute on ArrowDown", () => {
    const { container } = renderTable([FULL_FAMILY, MINIMAL_FAMILY])

    const table = screen.getByRole("table")
    fireEvent.keyDown(table, { key: "ArrowDown" })

    const rows = container.querySelectorAll("tbody tr")
    expect(rows[0]).toHaveAttribute("data-active-row", "")
    expect(rows[1]?.hasAttribute("data-active-row")).toBe(false)
  })

  it("renders the table with a tabIndex so keyboard nav can receive focus", () => {
    renderTable([FULL_FAMILY])

    const table = screen.getByRole("table")
    expect(table).toHaveAttribute("tabIndex", "0")
  })

  it("renders a labeled column settings button", () => {
    renderTable([FULL_FAMILY])

    expect(screen.getByRole("button", { name: "Column settings" })).toBeInTheDocument()
  })

  it("renders one resizable header separator and colgroup <col> per default visible column", () => {
    const { container } = renderTable([FULL_FAMILY])

    const separators = container.querySelectorAll('[role="separator"]')
    expect(separators.length).toBe(7)

    const cols = container.querySelectorAll("col")
    expect(cols.length).toBe(7)
    expect(cols[0]?.style.width).toBe("56px")
  })
})
