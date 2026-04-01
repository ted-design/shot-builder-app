/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ViewModeToggle, type ViewModeOption } from "@/shared/components/ViewModeToggle"

function StubIcon({ className }: { readonly className?: string }) {
  return <svg className={className} data-testid="stub-icon" />
}

const MODES: readonly ViewModeOption[] = [
  { key: "grid", icon: StubIcon, label: "Grid view" },
  { key: "table", icon: StubIcon, label: "Table view" },
]

describe("ViewModeToggle", () => {
  it("renders correct number of buttons", () => {
    render(
      <ViewModeToggle modes={MODES} activeMode="grid" onChange={vi.fn()} />,
    )
    const buttons = screen.getAllByRole("button")
    expect(buttons).toHaveLength(2)
  })

  it("active mode has default variant, others have outline", () => {
    const { container } = render(
      <ViewModeToggle modes={MODES} activeMode="grid" onChange={vi.fn()} />,
    )
    const buttons = container.querySelectorAll("button")
    // active button should have bg-primary (default variant)
    expect(buttons[0]?.className).toContain("bg-primary")
    // inactive button should have border (outline variant)
    expect(buttons[1]?.className).toContain("border")
    expect(buttons[1]?.className).not.toContain("bg-primary")
  })

  it("clicking inactive mode calls onChange with the correct key", () => {
    const onChange = vi.fn()
    render(
      <ViewModeToggle modes={MODES} activeMode="grid" onChange={onChange} />,
    )
    const tableBtn = screen.getByLabelText("Table view")
    fireEvent.click(tableBtn)
    expect(onChange).toHaveBeenCalledWith("table")
  })

  it("aria-labels present on all buttons", () => {
    render(
      <ViewModeToggle modes={MODES} activeMode="grid" onChange={vi.fn()} />,
    )
    expect(screen.getByLabelText("Grid view")).toBeInTheDocument()
    expect(screen.getByLabelText("Table view")).toBeInTheDocument()
  })

  it("renders keyboard hint badge when provided", () => {
    const modes: readonly ViewModeOption[] = [
      { key: "card", icon: StubIcon, label: "Card view", hint: "1" },
      { key: "table", icon: StubIcon, label: "Table view", hint: "2" },
    ]
    const { container } = render(
      <ViewModeToggle modes={modes} activeMode="card" onChange={vi.fn()} />,
    )
    expect(container.textContent).toContain("1")
    expect(container.textContent).toContain("2")
  })

  it("does not render hint badge when hint is not provided", () => {
    const { container } = render(
      <ViewModeToggle modes={MODES} activeMode="grid" onChange={vi.fn()} />,
    )
    const spans = container.querySelectorAll("span.absolute")
    expect(spans).toHaveLength(0)
  })
})
