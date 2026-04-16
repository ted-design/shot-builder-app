import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { SectionOrderDialog } from "../SectionOrderDialog"
import { DEFAULT_SECTION_ORDER } from "../CallSheetRenderer"

describe("SectionOrderDialog", () => {
  it("renders all section labels when open", () => {
    render(
      <SectionOrderDialog
        open={true}
        onOpenChange={vi.fn()}
        sectionOrder={DEFAULT_SECTION_ORDER}
        onSave={vi.fn()}
      />,
    )

    expect(screen.getByText("Header")).toBeInTheDocument()
    expect(screen.getByText("Day Details")).toBeInTheDocument()
    expect(screen.getByText("Schedule")).toBeInTheDocument()
    expect(screen.getByText("Cast / Talent")).toBeInTheDocument()
    expect(screen.getByText("Crew")).toBeInTheDocument()
    expect(screen.getByText("Production Notes")).toBeInTheDocument()
  })

  it("renders drag handles for each section", () => {
    render(
      <SectionOrderDialog
        open={true}
        onOpenChange={vi.fn()}
        sectionOrder={DEFAULT_SECTION_ORDER}
        onSave={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: /reorder header/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /reorder crew/i })).toBeInTheDocument()
  })

  it("calls onSave with current order when Save is clicked", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()

    render(
      <SectionOrderDialog
        open={true}
        onOpenChange={vi.fn()}
        sectionOrder={DEFAULT_SECTION_ORDER}
        onSave={onSave}
      />,
    )

    await user.click(screen.getByRole("button", { name: /save order/i }))
    expect(onSave).toHaveBeenCalledWith(DEFAULT_SECTION_ORDER)
  })

  it("calls onOpenChange(false) when Cancel is clicked", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <SectionOrderDialog
        open={true}
        onOpenChange={onOpenChange}
        sectionOrder={DEFAULT_SECTION_ORDER}
        onSave={vi.fn()}
      />,
    )

    await user.click(screen.getByRole("button", { name: /cancel/i }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("has a Reset to Default button", () => {
    render(
      <SectionOrderDialog
        open={true}
        onOpenChange={vi.fn()}
        sectionOrder={["notes", "crew", "talent", "schedule", "dayDetails", "header"]}
        onSave={vi.fn()}
      />,
    )

    expect(screen.getByRole("button", { name: /reset to default/i })).toBeInTheDocument()
  })

  it("does not render when open is false", () => {
    const { container } = render(
      <SectionOrderDialog
        open={false}
        onOpenChange={vi.fn()}
        sectionOrder={DEFAULT_SECTION_ORDER}
        onSave={vi.fn()}
      />,
    )

    expect(container.querySelector("[role='dialog']")).not.toBeInTheDocument()
  })
})
