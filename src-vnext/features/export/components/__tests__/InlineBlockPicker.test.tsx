import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { InlineBlockPicker } from "../InlineBlockPicker"
import { BLOCK_REGISTRY } from "../../lib/blockRegistry"

describe("InlineBlockPicker", () => {
  it("renders all block types when open", () => {
    render(
      <InlineBlockPicker
        open={true}
        onOpenChange={vi.fn()}
        onSelectBlock={vi.fn()}
      />,
    )

    for (const entry of BLOCK_REGISTRY) {
      expect(screen.getByText(entry.label)).toBeInTheDocument()
    }
  })

  it("renders category group headings", () => {
    render(
      <InlineBlockPicker
        open={true}
        onOpenChange={vi.fn()}
        onSelectBlock={vi.fn()}
      />,
    )

    expect(screen.getByText("Content")).toBeInTheDocument()
    expect(screen.getByText("Data")).toBeInTheDocument()
    expect(screen.getByText("Layout")).toBeInTheDocument()
  })

  it("renders the search input", () => {
    render(
      <InlineBlockPicker
        open={true}
        onOpenChange={vi.fn()}
        onSelectBlock={vi.fn()}
      />,
    )

    expect(screen.getByPlaceholderText("Search blocks...")).toBeInTheDocument()
  })

  it("calls onSelectBlock when a block type is selected", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <InlineBlockPicker
        open={true}
        onOpenChange={vi.fn()}
        onSelectBlock={onSelect}
      />,
    )

    await user.click(screen.getByText("Text"))
    expect(onSelect).toHaveBeenCalledWith("text")
  })

  it("calls onOpenChange(false) when a block is selected", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <InlineBlockPicker
        open={true}
        onOpenChange={onOpenChange}
        onSelectBlock={vi.fn()}
      />,
    )

    await user.click(screen.getByText("Shot Grid"))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("does not render when open is false", () => {
    const { container } = render(
      <InlineBlockPicker
        open={false}
        onOpenChange={vi.fn()}
        onSelectBlock={vi.fn()}
      />,
    )

    expect(container.querySelector("[role='dialog']")).not.toBeInTheDocument()
  })

  it("filters blocks by search query", async () => {
    const user = userEvent.setup()

    render(
      <InlineBlockPicker
        open={true}
        onOpenChange={vi.fn()}
        onSelectBlock={vi.fn()}
      />,
    )

    const input = screen.getByPlaceholderText("Search blocks...")
    await user.type(input, "shot")

    expect(screen.getByText("Shot Grid")).toBeInTheDocument()
    expect(screen.getByText("Shot Detail")).toBeInTheDocument()
    expect(screen.queryByText("Divider")).not.toBeInTheDocument()
  })
})
