import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { BlockRenderer } from "../BlockRenderer"
import type { ExportVariable } from "../../types/exportBuilder"

vi.mock("../ExportDataProvider", () => ({
  useExportDataContext: () => ({
    project: null,
    shots: [],
    productFamilies: [],
    pulls: [],
    crew: [],
    talent: [],
    loading: false,
  }),
}))

const VARIABLES: readonly ExportVariable[] = []

describe("BlockRenderer", () => {
  it("renders a text block", () => {
    render(
      <BlockRenderer
        block={{ id: "b1", type: "text", content: "Hello" }}
        selected={false}
        onSelect={vi.fn()}
        variables={VARIABLES}
      />,
    )
    expect(screen.getByTestId("text-block")).toBeInTheDocument()
    expect(screen.getByText("Hello")).toBeInTheDocument()
  })

  it("renders a divider block", () => {
    render(
      <BlockRenderer
        block={{ id: "b2", type: "divider", style: "solid" }}
        selected={false}
        onSelect={vi.fn()}
        variables={VARIABLES}
      />,
    )
    expect(screen.getByTestId("divider-block")).toBeInTheDocument()
  })

  it("renders a shot-grid block", () => {
    render(
      <BlockRenderer
        block={{
          id: "b3",
          type: "shot-grid",
          columns: [
            { key: "shotNumber", label: "#", visible: true, width: "xs" },
            { key: "title", label: "Title", visible: true, width: "md" },
          ],
          tableStyle: { showBorders: true, showHeaderBg: true, stripeRows: false },
        }}
        selected={false}
        onSelect={vi.fn()}
        variables={VARIABLES}
      />,
    )
    expect(screen.getByTestId("shot-grid-block")).toBeInTheDocument()
  })

  it("renders an image block placeholder", () => {
    render(
      <BlockRenderer
        block={{ id: "b4", type: "image", width: 100, alignment: "center" }}
        selected={false}
        onSelect={vi.fn()}
        variables={VARIABLES}
      />,
    )
    expect(screen.getByTestId("image-block")).toBeInTheDocument()
  })

  it("renders placeholder for shot-detail block", () => {
    render(
      <BlockRenderer
        block={{
          id: "b5",
          type: "shot-detail",
          showHeroImage: true,
          showDescription: true,
          showNotes: false,
          showProducts: true,
        }}
        selected={false}
        onSelect={vi.fn()}
        variables={VARIABLES}
      />,
    )
    expect(screen.getByTestId("shot-detail-block")).toBeInTheDocument()
  })

  it("returns null for page-break blocks", () => {
    const { container } = render(
      <BlockRenderer
        block={{ id: "pb1", type: "page-break" }}
        selected={false}
        onSelect={vi.fn()}
        variables={VARIABLES}
      />,
    )
    expect(container.innerHTML).toBe("")
  })

  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn()
    render(
      <BlockRenderer
        block={{ id: "b1", type: "text", content: "Click me" }}
        selected={false}
        onSelect={onSelect}
        variables={VARIABLES}
      />,
    )
    fireEvent.click(screen.getByTestId("block-b1"))
    expect(onSelect).toHaveBeenCalledOnce()
  })

  it("applies selection ring when selected", () => {
    render(
      <BlockRenderer
        block={{ id: "b1", type: "text", content: "Selected" }}
        selected={true}
        onSelect={vi.fn()}
        variables={VARIABLES}
      />,
    )
    const wrapper = screen.getByTestId("block-b1")
    expect(wrapper.className).toContain("ring-2")
    expect(wrapper.className).toContain("ring-blue-500")
  })
})
