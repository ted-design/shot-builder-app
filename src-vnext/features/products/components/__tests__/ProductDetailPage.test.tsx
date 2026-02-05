/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import ProductDetailPage from "../ProductDetailPage"

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    role: "producer",
    clientId: "c1",
    user: { uid: "u1", email: "u1@test.com", displayName: "Test User", photoURL: null },
  }),
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => false,
}))

vi.mock("@/features/products/hooks/useProducts", () => ({
  useProductFamily: () => ({
    data: {
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
    loading: false,
    error: null,
  }),
  useProductSkus: () => ({
    data: [
      {
        id: "sku-1",
        name: "Black",
        colorName: "Black",
        sizes: ["S", "M"],
      },
    ],
    loading: false,
    error: null,
  }),
}))

vi.mock("@/features/products/hooks/useProductWorkspace", () => ({
  useProductSamples: () => ({ data: [], loading: false, error: null }),
  useProductComments: () => ({ data: [], loading: false, error: null }),
  useProductDocuments: () => ({ data: [], loading: false, error: null }),
}))

describe("ProductDetailPage", () => {
  it("navigates to the product editor page when Edit is clicked", async () => {
    render(
      <MemoryRouter initialEntries={["/products/fam-1"]}>
        <Routes>
          <Route path="/products/:fid" element={<ProductDetailPage />} />
          <Route path="/products/:fid/edit" element={<div>Editor Page</div>} />
        </Routes>
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole("button", { name: /edit/i }))
    expect(await screen.findByText("Editor Page")).toBeInTheDocument()
  })

  it("renders the Samples section without crashing", () => {
    render(
      <MemoryRouter initialEntries={["/products/fam-1?section=samples"]}>
        <Routes>
          <Route path="/products/:fid" element={<ProductDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole("heading", { name: "Samples" })).toBeInTheDocument()
  })
})
