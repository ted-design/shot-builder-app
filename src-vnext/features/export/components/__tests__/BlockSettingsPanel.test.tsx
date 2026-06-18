import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { BlockSettingsPanel } from "../BlockSettingsPanel"
import type {
  TextBlock,
  ShotGridBlock,
  ShotDetailBlock,
  PullSheetBlock,
  DividerBlock,
} from "../../types/exportBuilder"

// ShotDetailSettings / PullSheetSettings read the export data context; provide it.
vi.mock("../ExportDataProvider", () => ({
  useExportDataContext: () => ({
    project: null,
    shots: [
      { id: "s1", title: "Hero Shot", shotNumber: "1", status: "todo" },
      { id: "s2", title: "Detail Shot", status: "todo" }, // no shotNumber (production allows undefined)
    ],
    productFamilies: [],
    pulls: [{ id: "pl1", name: "Day 1 Pull", items: [] }],
    crew: [],
    talent: [],
    loading: false,
  }),
}))

describe("BlockSettingsPanel", () => {
  it("shows empty state when no block is selected", () => {
    render(
      <BlockSettingsPanel
        block={null}
        onUpdateBlock={vi.fn()}
        onDeleteBlock={vi.fn()}
      />,
    )
    expect(
      screen.getByText(/select a block to edit its settings/i),
    ).toBeInTheDocument()
  })

  it("shows text block controls for text blocks", () => {
    const textBlock: TextBlock = {
      id: "t1",
      type: "text",
      content: "Hello",
      typography: { fontSize: 16, textAlign: "left" },
    }
    render(
      <BlockSettingsPanel
        block={textBlock}
        onUpdateBlock={vi.fn()}
        onDeleteBlock={vi.fn()}
      />,
    )
    expect(screen.getByText("Text Block")).toBeInTheDocument()
    expect(screen.getByText("Font Size (px)")).toBeInTheDocument()
    expect(screen.getByText("Text Align")).toBeInTheDocument()
    expect(screen.getByText("Content")).toBeInTheDocument()
    expect(screen.getByTestId("align-left")).toBeInTheDocument()
    expect(screen.getByTestId("align-center")).toBeInTheDocument()
    expect(screen.getByTestId("align-right")).toBeInTheDocument()
  })

  it("shows shot-grid controls for shot-grid blocks", () => {
    const gridBlock: ShotGridBlock = {
      id: "sg1",
      type: "shot-grid",
      columns: [
        { key: "shotNumber", label: "#", visible: true, width: "xs" },
        { key: "title", label: "Title", visible: true, width: "md" },
      ],
      tableStyle: { showBorders: true, showHeaderBg: true, stripeRows: false },
      sortBy: "shotNumber",
    }
    render(
      <BlockSettingsPanel
        block={gridBlock}
        onUpdateBlock={vi.fn()}
        onDeleteBlock={vi.fn()}
      />,
    )
    expect(screen.getByText("Shot Grid")).toBeInTheDocument()
    expect(screen.getByText("Columns")).toBeInTheDocument()
    expect(screen.getByText("Table Style")).toBeInTheDocument()
    expect(screen.getByText("Sort By")).toBeInTheDocument()
    expect(screen.getByTestId("col-toggle-shotNumber")).toBeInTheDocument()
    expect(screen.getByTestId("col-toggle-title")).toBeInTheDocument()
  })

  it("shows divider controls for divider blocks", () => {
    const dividerBlock: DividerBlock = {
      id: "d1",
      type: "divider",
      style: "solid",
    }
    render(
      <BlockSettingsPanel
        block={dividerBlock}
        onUpdateBlock={vi.fn()}
        onDeleteBlock={vi.fn()}
      />,
    )
    expect(screen.getByText("Divider")).toBeInTheDocument()
    expect(screen.getByTestId("divider-style-select")).toBeInTheDocument()
  })

  it("calls onDeleteBlock when delete button is clicked", () => {
    const onDeleteBlock = vi.fn()
    const textBlock: TextBlock = {
      id: "t1",
      type: "text",
      content: "Hello",
    }
    render(
      <BlockSettingsPanel
        block={textBlock}
        onUpdateBlock={vi.fn()}
        onDeleteBlock={onDeleteBlock}
      />,
    )
    fireEvent.click(screen.getByTestId("delete-block-btn"))
    expect(onDeleteBlock).toHaveBeenCalledWith("t1")
  })

  it("calls onUpdateBlock when text align is changed", () => {
    const onUpdateBlock = vi.fn()
    const textBlock: TextBlock = {
      id: "t1",
      type: "text",
      content: "Hello",
      typography: { fontSize: 14, textAlign: "left" },
    }
    render(
      <BlockSettingsPanel
        block={textBlock}
        onUpdateBlock={onUpdateBlock}
        onDeleteBlock={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId("align-center"))
    expect(onUpdateBlock).toHaveBeenCalledWith("t1", {
      typography: { fontSize: 14, textAlign: "center" },
    })
  })

  it("shows a shot picker for shot-detail blocks (no longer a dead block)", () => {
    const block: ShotDetailBlock = {
      id: "sd1",
      type: "shot-detail",
      showHeroImage: true,
      showDescription: true,
      showNotes: false,
      showProducts: true,
    }
    render(
      <BlockSettingsPanel
        block={block}
        onUpdateBlock={vi.fn()}
        onDeleteBlock={vi.fn()}
      />,
    )
    expect(screen.getByText("Shot Detail")).toBeInTheDocument()
    expect(screen.getByTestId("shot-detail-shot-select")).toBeInTheDocument()
    expect(
      screen.queryByText(/no additional settings for this block type/i),
    ).not.toBeInTheDocument()
  })

  it("writes shotId when a shot is picked", () => {
    const onUpdateBlock = vi.fn()
    const block: ShotDetailBlock = { id: "sd1", type: "shot-detail" }
    render(
      <BlockSettingsPanel
        block={block}
        onUpdateBlock={onUpdateBlock}
        onDeleteBlock={vi.fn()}
      />,
    )
    fireEvent.change(screen.getByTestId("shot-detail-shot-select"), {
      target: { value: "s2" },
    })
    expect(onUpdateBlock).toHaveBeenCalledWith("sd1", { shotId: "s2" })
  })

  it("shows a pull picker for pull-sheet blocks", () => {
    const block: PullSheetBlock = { id: "ps1", type: "pull-sheet" }
    render(
      <BlockSettingsPanel
        block={block}
        onUpdateBlock={vi.fn()}
        onDeleteBlock={vi.fn()}
      />,
    )
    expect(screen.getByText("Pull Sheet")).toBeInTheDocument()
    expect(screen.getByTestId("pull-sheet-pull-select")).toBeInTheDocument()
    expect(
      screen.queryByText(/no additional settings for this block type/i),
    ).not.toBeInTheDocument()
  })

  it("shows image settings for image block type", () => {
    const imageBlock = {
      id: "img1",
      type: "image" as const,
      width: 100,
      alignment: "center" as const,
    }
    render(
      <BlockSettingsPanel
        block={imageBlock}
        onUpdateBlock={vi.fn()}
        onDeleteBlock={vi.fn()}
        clientId="test-client"
        projectId="test-project"
      />,
    )
    expect(screen.getByText("Image Block")).toBeInTheDocument()
    expect(screen.getByTestId("image-upload-btn")).toBeInTheDocument()
    expect(screen.getByTestId("image-width-input")).toBeInTheDocument()
    expect(screen.getByTestId("image-alt-input")).toBeInTheDocument()
  })
})
