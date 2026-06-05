/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import type { ProductAssignment, Shot } from "@/shared/types"
import {
  ProductsInShoot,
  aggregateProducts,
} from "@/features/projects/components/home/ProductsInShoot"

function makeProduct(overrides: Partial<ProductAssignment>): ProductAssignment {
  return {
    familyId: overrides.familyId ?? "f1",
    familyName: overrides.familyName,
    skuId: overrides.skuId,
    skuName: overrides.skuName,
    colourId: overrides.colourId,
    colourName: overrides.colourName,
    size: overrides.size,
    quantity: overrides.quantity,
    thumbUrl: overrides.thumbUrl,
  }
}

function makeShot(id: string, products: ProductAssignment[]): Shot {
  return {
    id,
    title: `Shot ${id}`,
    projectId: "p1",
    clientId: "c1",
    status: "todo",
    talent: [],
    products,
    sortOrder: 0,
  } as unknown as Shot
}

function renderComponent(shots: ReadonlyArray<Shot>) {
  return render(
    <MemoryRouter>
      <ProductsInShoot shots={shots} />
    </MemoryRouter>,
  )
}

describe("aggregateProducts", () => {
  it("returns distinct families across shots", () => {
    const shots = [
      makeShot("s1", [makeProduct({ familyId: "tee", familyName: "Merino Tee" })]),
      makeShot("s2", [makeProduct({ familyId: "tee", familyName: "Merino Tee" })]),
      makeShot("s3", [makeProduct({ familyId: "hoodie", familyName: "Merino Hoodie" })]),
    ]
    const result = aggregateProducts(shots)
    expect(result.map((p) => p.key).sort()).toEqual(["hoodie", "tee"])
  })

  it("collects distinct colourways per family in first-seen order", () => {
    const shots = [
      makeShot("s1", [
        makeProduct({ familyId: "tee", familyName: "Merino Tee", colourName: "Black" }),
      ]),
      makeShot("s2", [
        makeProduct({ familyId: "tee", familyName: "Merino Tee", colourName: "Navy" }),
        makeProduct({ familyId: "tee", familyName: "Merino Tee", colourName: "Black" }),
      ]),
    ]
    const [tee] = aggregateProducts(shots)
    expect(tee!.colours).toEqual(["Black", "Navy"])
  })

  it("counts each shot once per family even with duplicate assignments", () => {
    const shots = [
      makeShot("s1", [
        makeProduct({ familyId: "tee", familyName: "Tee", colourName: "Black", size: "S" }),
        makeProduct({ familyId: "tee", familyName: "Tee", colourName: "Black", size: "M" }),
      ]),
    ]
    const [tee] = aggregateProducts(shots)
    expect(tee!.shotCount).toBe(1)
  })

  it("falls back to normalized name when familyId is missing", () => {
    const shots = [
      makeShot("s1", [makeProduct({ familyId: "", skuName: "Crew Socks" })]),
    ]
    const [p] = aggregateProducts(shots)
    expect(p!.key).toBe("crew socks")
    expect(p!.name).toBe("Crew Socks")
  })

  it("skips assignments with no resolvable identity", () => {
    const shots = [makeShot("s1", [makeProduct({ familyId: "" })])]
    expect(aggregateProducts(shots)).toHaveLength(0)
  })
})

describe("ProductsInShoot", () => {
  it("renders an empty state when no shots reference products", () => {
    renderComponent([makeShot("s1", [])])
    expect(screen.getByText(/no products yet/i)).toBeInTheDocument()
  })

  it("renders distinct product chips with colourways", () => {
    const shots = [
      makeShot("s1", [
        makeProduct({ familyId: "tee", familyName: "Merino Tee", colourName: "Black" }),
      ]),
      makeShot("s2", [
        makeProduct({ familyId: "hoodie", familyName: "Merino Hoodie", colourName: "Charcoal" }),
      ]),
    ]
    renderComponent(shots)
    expect(screen.getByText("Merino Tee")).toBeInTheDocument()
    expect(screen.getByText("Merino Hoodie")).toBeInTheDocument()
    expect(screen.getByText("Black")).toBeInTheDocument()
    expect(screen.getByText("Charcoal")).toBeInTheDocument()
    expect(screen.queryByText(/no products yet/i)).not.toBeInTheDocument()
  })

  it("falls back to a shot count when a family has no colourway", () => {
    const shots = [
      makeShot("s1", [makeProduct({ familyId: "tee", familyName: "Merino Tee" })]),
    ]
    renderComponent(shots)
    expect(screen.getByText("1 shot")).toBeInTheDocument()
  })
})
