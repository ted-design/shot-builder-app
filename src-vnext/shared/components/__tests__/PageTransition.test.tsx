import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { PageTransition } from "../PageTransition"

function renderWithRouter(ui: React.ReactElement, initialPath = "/") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>{ui}</MemoryRouter>,
  )
}

describe("PageTransition", () => {
  it("renders children", () => {
    renderWithRouter(
      <PageTransition>
        <p>Hello</p>
      </PageTransition>,
    )
    expect(screen.getByText("Hello")).toBeInTheDocument()
  })

  it("applies page-enter class", () => {
    renderWithRouter(
      <PageTransition>
        <p>Content</p>
      </PageTransition>,
    )
    const wrapper = screen.getByText("Content").parentElement
    expect(wrapper).toHaveClass("page-enter")
  })
})
