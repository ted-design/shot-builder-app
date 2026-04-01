/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ColumnSettingsPopover } from "@/shared/components/ColumnSettingsPopover"
import type { TableColumnConfig } from "@/shared/types/table"

const COLUMNS: readonly TableColumnConfig[] = [
  { key: "name", label: "Name", defaultLabel: "Name", visible: true, width: 200, order: 0, pinned: true },
  { key: "email", label: "Email", defaultLabel: "Email", visible: true, width: 180, order: 1 },
  { key: "phone", label: "Phone", defaultLabel: "Phone", visible: false, width: 120, order: 2 },
]

function renderPopover(overrides?: {
  readonly columns?: readonly TableColumnConfig[]
  readonly onToggleVisibility?: (key: string) => void
  readonly onReorder?: (keys: readonly string[]) => void
  readonly onReset?: () => void
}) {
  return render(
    <ColumnSettingsPopover
      columns={overrides?.columns ?? COLUMNS}
      onToggleVisibility={overrides?.onToggleVisibility ?? vi.fn()}
      onReorder={overrides?.onReorder ?? vi.fn()}
      onReset={overrides?.onReset ?? vi.fn()}
    >
      <button type="button">Settings</button>
    </ColumnSettingsPopover>,
  )
}

describe("ColumnSettingsPopover", () => {
  it("renders all columns with correct labels when open", async () => {
    renderPopover()
    fireEvent.click(screen.getByText("Settings"))

    expect(await screen.findByText("Name")).toBeInTheDocument()
    expect(screen.getByText("Email")).toBeInTheDocument()
    expect(screen.getByText("Phone")).toBeInTheDocument()
  })

  it("hidden columns have opacity-40", async () => {
    renderPopover()
    fireEvent.click(screen.getByText("Settings"))

    // Phone is hidden (visible: false)
    const hideBtn = await screen.findByLabelText("Show Phone")
    const row = hideBtn.closest("[class*='opacity-40']")
    expect(row).toBeTruthy()
  })

  it("Eye toggle calls onToggleVisibility with correct key", async () => {
    const onToggle = vi.fn()
    renderPopover({ onToggleVisibility: onToggle })
    fireEvent.click(screen.getByText("Settings"))

    const hideEmail = await screen.findByLabelText("Hide Email")
    fireEvent.click(hideEmail)
    expect(onToggle).toHaveBeenCalledWith("email")
  })

  it("Reset button calls onReset", async () => {
    const onReset = vi.fn()
    renderPopover({ onReset })
    fireEvent.click(screen.getByText("Settings"))

    const resetBtn = await screen.findByLabelText("Reset columns to defaults")
    fireEvent.click(resetBtn)
    expect(onReset).toHaveBeenCalledOnce()
  })

  it("pinned columns cannot be toggled", async () => {
    const onToggle = vi.fn()
    renderPopover({ onToggleVisibility: onToggle })
    fireEvent.click(screen.getByText("Settings"))

    // Name is pinned
    const pinnedBtn = await screen.findByLabelText("Name is pinned")
    expect(pinnedBtn).toBeDisabled()
    fireEvent.click(pinnedBtn)
    expect(onToggle).not.toHaveBeenCalled()
  })

  it("renders Columns header", async () => {
    renderPopover()
    fireEvent.click(screen.getByText("Settings"))
    expect(await screen.findByText("Columns")).toBeInTheDocument()
  })
})
