/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { BulkSelectionBar } from "./BulkSelectionBar"

describe("BulkSelectionBar", () => {
  it("renders when count > 0", () => {
    render(
      <BulkSelectionBar count={3} onAction={vi.fn()} onClear={vi.fn()} />,
    )
    expect(screen.getByTestId("bulk-selection-bar")).toBeInTheDocument()
  })

  it("shows correct item count text (plural)", () => {
    render(
      <BulkSelectionBar count={5} onAction={vi.fn()} onClear={vi.fn()} />,
    )
    expect(screen.getByText("5 items selected")).toBeInTheDocument()
  })

  it("shows singular item count text", () => {
    render(
      <BulkSelectionBar count={1} onAction={vi.fn()} onClear={vi.fn()} />,
    )
    expect(screen.getByText("1 item selected")).toBeInTheDocument()
  })

  it("renders default action label", () => {
    render(
      <BulkSelectionBar count={2} onAction={vi.fn()} onClear={vi.fn()} />,
    )
    expect(screen.getByTestId("bulk-selection-bar-action")).toHaveTextContent(
      "Add to Project",
    )
  })

  it("renders custom action label", () => {
    render(
      <BulkSelectionBar
        count={2}
        onAction={vi.fn()}
        onClear={vi.fn()}
        actionLabel="Assign to Shot"
      />,
    )
    expect(screen.getByTestId("bulk-selection-bar-action")).toHaveTextContent(
      "Assign to Shot",
    )
  })

  it("calls onAction when action button clicked", () => {
    const onAction = vi.fn()
    render(
      <BulkSelectionBar count={2} onAction={onAction} onClear={vi.fn()} />,
    )
    fireEvent.click(screen.getByTestId("bulk-selection-bar-action"))
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it("calls onClear when Clear button clicked", () => {
    const onClear = vi.fn()
    render(
      <BulkSelectionBar count={2} onAction={vi.fn()} onClear={onClear} />,
    )
    fireEvent.click(screen.getByTestId("bulk-selection-bar-clear"))
    expect(onClear).toHaveBeenCalledTimes(1)
  })

  it("is aria-hidden when count is 0", () => {
    render(
      <BulkSelectionBar count={0} onAction={vi.fn()} onClear={vi.fn()} />,
    )
    const bar = screen.getByTestId("bulk-selection-bar")
    expect(bar).toHaveAttribute("aria-hidden", "true")
  })

  it("is not aria-hidden when count > 0", () => {
    render(
      <BulkSelectionBar count={1} onAction={vi.fn()} onClear={vi.fn()} />,
    )
    const bar = screen.getByTestId("bulk-selection-bar")
    expect(bar).toHaveAttribute("aria-hidden", "false")
  })

  it("has pointer-events-none class when count is 0", () => {
    render(
      <BulkSelectionBar count={0} onAction={vi.fn()} onClear={vi.fn()} />,
    )
    const bar = screen.getByTestId("bulk-selection-bar")
    expect(bar.className).toContain("pointer-events-none")
  })
})
