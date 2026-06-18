import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { DocumentPreview } from "../DocumentPreview"
import type { ExportDocument, ExportVariable } from "../../types/exportBuilder"

const VARIABLES: readonly ExportVariable[] = [
  { key: "projectName", label: "Project Name", value: "Test Project", source: "dynamic" },
]

function buildDocument(
  items: ExportDocument["pages"][0]["items"] = [],
  settings: Partial<ExportDocument["settings"]> = {},
): ExportDocument {
  return {
    id: "doc-1",
    name: "Test Doc",
    pages: [{ id: "page-1", items }],
    settings: { layout: "portrait", size: "letter", fontFamily: "Inter", ...settings },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function renderPreview(doc: ExportDocument): HTMLElement {
  const { container } = render(
    <DocumentPreview
      document={doc}
      selectedBlockId={null}
      onSelectBlock={vi.fn()}
      onAddTextBlock={vi.fn()}
      variables={VARIABLES}
    />,
  )
  const page = container.querySelector(".doc-page")
  if (!(page instanceof HTMLElement)) throw new Error("no .doc-page rendered")
  return page
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

  describe("page orientation & size (P0-1)", () => {
    it("keeps portrait Letter at its historical ~960×1242 frame", () => {
      const page = renderPreview(buildDocument([], { layout: "portrait", size: "letter" }))
      expect(page.style.maxWidth).toBe("960px")
      // 960 * 792/612 ≈ 1242
      expect(page.style.minHeight).toBe("1242px")
    })

    it("makes a landscape page shorter than its portrait counterpart", () => {
      const portrait = renderPreview(buildDocument([], { layout: "portrait", size: "letter" }))
      const portraitMinH = parseInt(portrait.style.minHeight, 10)

      const landscape = renderPreview(buildDocument([], { layout: "landscape", size: "letter" }))
      const landscapeMinH = parseInt(landscape.style.minHeight, 10)

      // Same fit-to-width canvas width, but landscape is wider-than-tall → shorter frame.
      expect(landscape.style.maxWidth).toBe("960px")
      expect(landscapeMinH).toBeLessThan(portraitMinH)
      // 960 * 612/792 ≈ 742
      expect(landscape.style.minHeight).toBe("742px")
    })

    it("renders A4 and Legal with distinct aspect ratios", () => {
      const a4 = renderPreview(buildDocument([], { layout: "portrait", size: "a4" }))
      const legal = renderPreview(buildDocument([], { layout: "portrait", size: "legal" }))
      expect(a4.style.minHeight).not.toBe(legal.style.minHeight)
      // 960 * 841.89/595.28 ≈ 1358 ; 960 * 1008/612 ≈ 1581
      expect(a4.style.minHeight).toBe("1358px")
      expect(legal.style.minHeight).toBe("1581px")
    })

    it("falls back to Letter portrait when size/layout are absent", () => {
      // Legacy docs may omit size/layout; mirror the PDF's defensive defaulting.
      const doc = buildDocument([])
      const loose = {
        ...doc,
        settings: { ...doc.settings, layout: undefined, size: undefined },
      } as unknown as ExportDocument
      const page = renderPreview(loose)
      expect(page.style.maxWidth).toBe("960px")
      expect(page.style.minHeight).toBe("1242px")
    })
  })
})
