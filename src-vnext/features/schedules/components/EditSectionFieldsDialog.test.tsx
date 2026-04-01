import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { EditSectionFieldsDialog } from "@/features/schedules/components/EditSectionFieldsDialog"
import { DEFAULT_CAST_SECTION, type CallSheetSectionFieldConfig } from "@/features/schedules/lib/fieldConfig"

function renderDialog(overrides: Partial<{
  open: boolean
  config: CallSheetSectionFieldConfig
  onSave: (config: CallSheetSectionFieldConfig) => void
  onOpenChange: (open: boolean) => void
}> = {}) {
  const props = {
    open: true,
    onOpenChange: overrides.onOpenChange ?? vi.fn(),
    config: overrides.config ?? DEFAULT_CAST_SECTION,
    onSave: overrides.onSave ?? vi.fn(),
  }
  return { ...render(<EditSectionFieldsDialog {...props} />), props }
}

describe("EditSectionFieldsDialog", () => {
  it("renders all field labels from the config", () => {
    renderDialog()

    for (const field of DEFAULT_CAST_SECTION.fields) {
      expect(screen.getByDisplayValue(field.label)).toBeInTheDocument()
    }
  })

  it("renders the section title input", () => {
    renderDialog()
    expect(screen.getByDisplayValue("Cast")).toBeInTheDocument()
  })

  it("saves renamed label on save", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    renderDialog({ onSave })

    const talentInput = screen.getByDisplayValue("Talent")
    await user.clear(talentInput)
    await user.type(talentInput, "Actor")
    await user.click(screen.getByRole("button", { name: "Save" }))

    expect(onSave).toHaveBeenCalledTimes(1)
    const savedConfig = onSave.mock.calls[0]?.[0] as CallSheetSectionFieldConfig
    const talentField = savedConfig.fields.find((f) => f.key === "talent")
    expect(talentField?.label).toBe("Actor")
  })

  it("toggles field visibility", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    renderDialog({ onSave })

    // Find the hide button for "Talent"
    const hideButton = screen.getByRole("button", { name: "Hide Talent" })
    await user.click(hideButton)

    await user.click(screen.getByRole("button", { name: "Save" }))

    const savedConfig = onSave.mock.calls[0]?.[0] as CallSheetSectionFieldConfig
    const talentField = savedConfig.fields.find((f) => f.key === "talent")
    expect(talentField?.visible).toBe(false)
  })

  it("resets individual field label", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()

    // Start with a modified label
    const modifiedConfig: CallSheetSectionFieldConfig = {
      ...DEFAULT_CAST_SECTION,
      fields: DEFAULT_CAST_SECTION.fields.map((f) =>
        f.key === "talent" ? { ...f, label: "Actor" } : f,
      ),
    }

    renderDialog({ config: modifiedConfig, onSave })

    // A "Reset" link should appear for the modified field
    const resetButton = screen.getByRole("button", { name: "Reset" })
    await user.click(resetButton)

    await user.click(screen.getByRole("button", { name: "Save" }))

    const savedConfig = onSave.mock.calls[0]?.[0] as CallSheetSectionFieldConfig
    const talentField = savedConfig.fields.find((f) => f.key === "talent")
    expect(talentField?.label).toBe("Talent")
  })

  it("resets all fields to defaults", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()

    const modifiedConfig: CallSheetSectionFieldConfig = {
      ...DEFAULT_CAST_SECTION,
      title: "My Cast",
      fields: DEFAULT_CAST_SECTION.fields.map((f) =>
        f.key === "talent" ? { ...f, label: "Actor" } : f,
      ),
    }

    renderDialog({ config: modifiedConfig, onSave })

    await user.click(screen.getByRole("button", { name: /Reset all to default/i }))
    await user.click(screen.getByRole("button", { name: "Save" }))

    const savedConfig = onSave.mock.calls[0]?.[0] as CallSheetSectionFieldConfig
    expect(savedConfig.title).toBe("Cast")
    const talentField = savedConfig.fields.find((f) => f.key === "talent")
    expect(talentField?.label).toBe("Talent")
  })

  it("cancels without saving", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    const onOpenChange = vi.fn()
    renderDialog({ onSave, onOpenChange })

    await user.click(screen.getByRole("button", { name: "Cancel" }))

    expect(onSave).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("renders visibility toggle icons", () => {
    renderDialog()

    const fieldList = screen.getByRole("list", { name: "Field configuration list" })
    const listItems = within(fieldList).getAllByRole("listitem")
    expect(listItems.length).toBe(DEFAULT_CAST_SECTION.fields.length)
  })
})
