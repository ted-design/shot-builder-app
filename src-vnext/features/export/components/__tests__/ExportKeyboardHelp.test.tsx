import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { ExportKeyboardHelp } from "../ExportKeyboardHelp"

describe("ExportKeyboardHelp", () => {
  it("renders all shortcut descriptions when open", () => {
    render(
      <ExportKeyboardHelp open={true} onOpenChange={vi.fn()} />,
    )

    expect(screen.getByText("Insert block at cursor")).toBeInTheDocument()
    expect(screen.getByText("Remove selected block")).toBeInTheDocument()
    expect(screen.getByText("Deselect block")).toBeInTheDocument()
    expect(screen.getByText("Show this help")).toBeInTheDocument()
  })

  it("renders keyboard shortcut keys", () => {
    render(
      <ExportKeyboardHelp open={true} onOpenChange={vi.fn()} />,
    )

    expect(screen.getByText("⌘ /")).toBeInTheDocument()
    expect(screen.getByText("Delete")).toBeInTheDocument()
    expect(screen.getByText("Esc")).toBeInTheDocument()
    expect(screen.getByText("?")).toBeInTheDocument()
  })

  it("has a title", () => {
    render(
      <ExportKeyboardHelp open={true} onOpenChange={vi.fn()} />,
    )

    expect(screen.getByText("Keyboard Shortcuts")).toBeInTheDocument()
  })

  it("does not render when open is false", () => {
    const { container } = render(
      <ExportKeyboardHelp open={false} onOpenChange={vi.fn()} />,
    )

    expect(container.querySelector("[role='dialog']")).not.toBeInTheDocument()
  })
})
