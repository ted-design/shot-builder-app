/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest"
import { render, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import ProductListPage from "../ProductListPage"

/**
 * Regression guard for axe-core `button-name` violation H-1 on /products.
 *
 * The Playwright a11y spec (tests/a11y.spec.ts:32) exercises the full rendered
 * tree via axe-core. This unit-level guard asserts the equivalent invariant
 * without the Firebase emulator + build + serve harness: every `<button>` in
 * the ProductListPage render must expose an accessible name (visible text
 * content, aria-label, or aria-labelledby).
 *
 * If this fails, an icon-only button somewhere under ProductListPage lost its
 * label — the same class of bug axe would flag as `button-name`.
 */

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    role: "admin",
    clientId: "c1",
    user: { uid: "u1", email: "u1@test.com", displayName: "Test User", photoURL: null },
  }),
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => false,
}))

vi.mock("@/features/products/hooks/useProducts", () => ({
  useProductFamilies: () => ({
    data: [
      {
        id: "fam-1",
        clientId: "c1",
        styleName: "Classic Tee",
        styleNumber: "CT-100",
        gender: "men",
        productType: "tops",
        productSubcategory: "t-shirt",
        archived: false,
        status: "active",
      },
      {
        id: "fam-2",
        clientId: "c1",
        styleName: "Running Shorts",
        styleNumber: "RS-200",
        gender: "women",
        productType: "bottoms",
        productSubcategory: "shorts",
        archived: false,
        status: "active",
      },
    ],
    loading: false,
    error: null,
  }),
}))

function renderPage(initialPath = "/products") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/products" element={<ProductListPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

/**
 * Minimal implementation of the WAI-ARIA accessible-name algorithm sufficient
 * for axe-core's `button-name` check. We deliberately avoid adding a new dep
 * (axe-core/jest-axe not installed) and instead mirror the three naming
 * sources axe consults: aria-labelledby -> aria-label -> text content. Title
 * is intentionally NOT treated as a valid accessible name because axe-core's
 * button-name rule also excludes it by default (per WCAG 4.1.2).
 */
function getAccessibleName(el: Element): string {
  const labelledBy = el.getAttribute("aria-labelledby")
  if (labelledBy) {
    const doc = el.ownerDocument
    const parts = labelledBy
      .split(/\s+/)
      .map((id) => doc.getElementById(id)?.textContent?.trim() ?? "")
      .filter(Boolean)
    if (parts.length > 0) return parts.join(" ")
  }

  const ariaLabel = el.getAttribute("aria-label")
  if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim()

  const text = (el.textContent ?? "").trim()
  if (text) return text

  return ""
}

function assertAllButtonsHaveAccessibleName(container: HTMLElement): void {
  const buttons = Array.from(container.querySelectorAll("button"))
  expect(buttons.length).toBeGreaterThan(0)

  const offenders: string[] = []
  for (const btn of buttons) {
    const name = getAccessibleName(btn)
    if (!name) {
      offenders.push(btn.outerHTML.slice(0, 200))
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      `Found ${offenders.length} button(s) without an accessible name ` +
        `(axe-core button-name equivalent). Add aria-label or visible text:\n` +
        offenders.map((html, i) => `  [${i}] ${html}`).join("\n"),
    )
  }
}

describe("ProductListPage a11y — button-name (H-1 regression)", () => {
  it("every button in the default view has an accessible name", () => {
    const { container } = renderPage("/products")
    assertAllButtonsHaveAccessibleName(container)
  })

  it("view-mode toggle buttons expose accessible names", () => {
    const { container } = renderPage("/products")
    // The gallery/table toggle group is icon-only and is the specific
    // source of the H-1 violation. Assert both toggles have labels.
    const galleryBtn = within(container).getByRole("button", { name: /gallery view/i })
    const tableBtn = within(container).getByRole("button", { name: /table view/i })
    expect(galleryBtn).toBeInTheDocument()
    expect(tableBtn).toBeInTheDocument()
  })

  it("every button in table view has an accessible name", () => {
    // Table view also renders ProductFamiliesTable, which adds a
    // column-settings icon button. Validate that path too.
    const { container } = renderPage("/products?view=table")
    assertAllButtonsHaveAccessibleName(container)
  })

  it("every button with filter chips visible has an accessible name", () => {
    // Apply a few filters via URL to render all the filter-chip buttons
    // and the "Clear filters" button.
    const { container } = renderPage(
      "/products?status=active&gender=men&arch=1&del=1&sort=updatedDesc",
    )
    assertAllButtonsHaveAccessibleName(container)
  })
})
