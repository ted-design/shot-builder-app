/// <reference types="@testing-library/jest-dom" />
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { RouteBoundary } from "@/app/routes/RouteBoundary"

function Boom(): never {
  throw new Error("boom")
}

describe("RouteBoundary", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("renders children when there is no error", () => {
    render(
      <MemoryRouter>
        <RouteBoundary featureName="Shots">
          <div>OK</div>
        </RouteBoundary>
      </MemoryRouter>,
    )
    expect(screen.getByText("OK")).toBeInTheDocument()
  })

  it("catches errors and shows the feature-aware fallback", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    render(
      <MemoryRouter>
        <RouteBoundary featureName="Shots">
          <Boom />
        </RouteBoundary>
      </MemoryRouter>,
    )
    expect(
      screen.getByText("Something went wrong in Shots"),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Go to Projects" }),
    ).toBeInTheDocument()
  })

  it("links 'Go to Projects' to /projects", () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    render(
      <MemoryRouter>
        <RouteBoundary featureName="Shots">
          <Boom />
        </RouteBoundary>
      </MemoryRouter>,
    )
    const link = screen.getByRole("link", { name: "Go to Projects" })
    expect(link).toHaveAttribute("href", "/projects")
  })
})
