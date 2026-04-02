import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { DocumentPreview } from "../DocumentPreview"
import type { ExportDocument, ExportVariable } from "../../types/exportBuilder"

const VARIABLES: readonly ExportVariable[] = [
  { key: "projectName", label: "Project Name", value: "Test Project", source: "dynamic" },
]

function buildDocument(
  items: ExportDocument["pages"][0]["items"] = [],
): ExportDocument {
  return {
    id: "doc-1",
    name: "Test Doc",
    pages: [{ id: "page-1", items }],
    settings: { layout: "portrait", size: "letter", fontFamily: "Inter" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

describe("DocumentPreview", () => {
  it("renders the empty state when no blocks exist", () => {
    render(
      <DocumentPreview
        document={buildDocument()}
        selectedBlockId={null}
        onSelectBlock={vi.fn()}
        onAddTextBlock={vi.fn()}
        variables={VARIABLES}
      />,
    )
    expect(screen.getByText(/add blocks from the palette/i)).toBeInTheDocument()
  })

  it("renders blocks via BlockRenderer", () => {
    const doc = buildDocument([
      { id: "b1", type: "text", content: "Hello World" },
      { id: "b2", type: "divider", style: "solid" },
    ])

    render(
      <DocumentPreview
        document={doc}
        selectedBlockId={null}
        onSelectBlock={vi.fn()}
        onAddTextBlock={vi.fn()}
        variables={VARIABLES}
      />,
    )

    expect(screen.getByTestId("text-block")).toBeInTheDocument()
    expect(screen.getByTestId("divider-block")).toBeInTheDocument()
  })

  it("splits blocks into visual pages on page-break", () => {
    const doc = buildDocument([
      { id: "b1", type: "text", content: "Page 1 content" },
      { id: "pb", type: "page-break" },
      { id: "b2", type: "text", content: "Page 2 content" },
    ])

    render(
      <DocumentPreview
        document={doc}
        selectedBlockId={null}
        onSelectBlock={vi.fn()}
        onAddTextBlock={vi.fn()}
        variables={VARIABLES}
      />,
    )

    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument()
    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument()
  })

  it("calls onSelectBlock(null) when clicking the background", () => {
    const onSelectBlock = vi.fn()
    render(
      <DocumentPreview
        document={buildDocument()}
        selectedBlockId={null}
        onSelectBlock={onSelectBlock}
        onAddTextBlock={vi.fn()}
        variables={VARIABLES}
      />,
    )
    fireEvent.click(screen.getByTestId("document-preview"))
    expect(onSelectBlock).toHaveBeenCalledWith(null)
  })

  it("renders the Add Text Block button", () => {
    const onAddTextBlock = vi.fn()
    render(
      <DocumentPreview
        document={buildDocument()}
        selectedBlockId={null}
        onSelectBlock={vi.fn()}
        onAddTextBlock={onAddTextBlock}
        variables={VARIABLES}
      />,
    )
    const addBtn = screen.getByText("Add Text Block")
    expect(addBtn).toBeInTheDocument()
    fireEvent.click(addBtn)
    expect(onAddTextBlock).toHaveBeenCalledWith("page-1")
  })

  it("shows page footer with page numbers", () => {
    render(
      <DocumentPreview
        document={buildDocument([{ id: "b1", type: "text", content: "Hi" }])}
        selectedBlockId={null}
        onSelectBlock={vi.fn()}
        onAddTextBlock={vi.fn()}
        variables={VARIABLES}
      />,
    )
    expect(screen.getByText("Page 1 of 1")).toBeInTheDocument()
  })
})
