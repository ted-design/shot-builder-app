import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ShotDetailSettings } from "../settings/ShotDetailSettings"
import type { ShotDetailBlock } from "../../types/exportBuilder"

vi.mock("../ExportDataProvider", () => ({
  useExportDataContext: () => ({
    project: null,
    shots: [
      { id: "s1", title: "Hero Shot", shotNumber: "1", status: "todo" },
      { id: "s2", title: "Detail Shot", status: "todo" }, // no shotNumber (production allows undefined)
    ],
    productFamilies: [],
    pulls: [],
    crew: [],
    talent: [],
    loading: false,
  }),
}))

function baseBlock(overrides: Partial<ShotDetailBlock> = {}): ShotDetailBlock {
  return { id: "sd1", type: "shot-detail", ...overrides }
}

describe("ShotDetailSettings", () => {
  it("lists every shot plus a placeholder, with the current shotId selected", () => {
    render(<ShotDetailSettings block={baseBlock({ shotId: "s1" })} onUpdate={vi.fn()} />)
    const select = screen.getByTestId("shot-detail-shot-select") as HTMLSelectElement
    expect(select.value).toBe("s1")
    expect(screen.getByRole("option", { name: /Hero Shot/ })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: /Detail Shot/ })).toBeInTheDocument()
    expect(screen.getByRole("option", { name: /select a shot/i })).toBeInTheDocument()
  })

  it("tolerates a shot without a shotNumber (renders an em-dash, no crash)", () => {
    render(<ShotDetailSettings block={baseBlock()} onUpdate={vi.fn()} />)
    const detailOption = screen.getByRole("option", { name: /Detail Shot/ }) as HTMLOptionElement
    expect(detailOption.value).toBe("s2")
    expect(detailOption.textContent).toContain("—")
  })

  it("writes the picked shotId", () => {
    const onUpdate = vi.fn()
    render(<ShotDetailSettings block={baseBlock()} onUpdate={onUpdate} />)
    fireEvent.change(screen.getByTestId("shot-detail-shot-select"), { target: { value: "s2" } })
    expect(onUpdate).toHaveBeenCalledWith({ shotId: "s2" })
  })

  it("clears the shotId when the placeholder is chosen", () => {
    const onUpdate = vi.fn()
    render(<ShotDetailSettings block={baseBlock({ shotId: "s1" })} onUpdate={onUpdate} />)
    fireEvent.change(screen.getByTestId("shot-detail-shot-select"), { target: { value: "" } })
    expect(onUpdate).toHaveBeenCalledWith({ shotId: undefined })
  })

  it("toggles a show flag", () => {
    const onUpdate = vi.fn()
    render(<ShotDetailSettings block={baseBlock({ showNotes: false })} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByTestId("shot-detail-showNotes"))
    expect(onUpdate).toHaveBeenCalledWith({ showNotes: true })
  })
})
