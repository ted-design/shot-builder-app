import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CallSheetLayoutDialog } from "@/features/schedules/components/CallSheetLayoutDialog"
import type { CallSheetSectionVisibility } from "@/features/schedules/components/CallSheetRenderer"

const STORAGE_KEY = "sb:callsheet-layouts"

afterEach(() => {
  localStorage.removeItem(STORAGE_KEY)
})

const ALL_ON: Required<CallSheetSectionVisibility> = {
  header: true,
  dayDetails: true,
  schedule: true,
  talent: true,
  crew: true,
  notes: true,
}

function renderDialog(
  overrides: Partial<{
    open: boolean
    currentSections: Required<CallSheetSectionVisibility>
    onApplyLayout: (v: Required<CallSheetSectionVisibility>) => void
    onOpenChange: (open: boolean) => void
  }> = {},
) {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    currentSections: ALL_ON,
    onApplyLayout: vi.fn(),
    ...overrides,
  }
  return { ...render(<CallSheetLayoutDialog {...props} />), props }
}

describe("CallSheetLayoutDialog", () => {
  it("renders built-in layouts by default", () => {
    renderDialog()

    expect(screen.getByText("Full")).toBeInTheDocument()
    expect(screen.getByText("Compact")).toBeInTheDocument()
    expect(screen.getByText("Crew Only")).toBeInTheDocument()
  })

  it("loads a built-in layout when Load is clicked", async () => {
    const user = userEvent.setup()
    const { props } = renderDialog()

    // The "Crew Only" row — traverse up to the layout row container
    const crewOnlyText = screen.getByText("Crew Only")
    const crewOnlyRow = crewOnlyText.closest("[class*='justify-between']")!
    const loadBtn = within(crewOnlyRow as HTMLElement).getByRole("button", { name: /Load/ })
    await user.click(loadBtn)

    expect(props.onApplyLayout).toHaveBeenCalledWith(
      expect.objectContaining({
        header: true,
        crew: true,
        dayDetails: false,
        schedule: false,
        talent: false,
        notes: false,
      }),
    )
    expect(props.onOpenChange).toHaveBeenCalledWith(false)
  })

  it("saves and displays a custom layout", async () => {
    const user = userEvent.setup()
    renderDialog()

    // Switch to Saved tab
    await user.click(screen.getByRole("tab", { name: "Saved" }))

    expect(screen.getByText(/No saved layouts yet/)).toBeInTheDocument()

    // Type a name and save
    const input = screen.getByPlaceholderText("Layout name...")
    await user.type(input, "My Custom")
    await user.click(screen.getByRole("button", { name: "Save" }))

    // Now the saved layout should appear
    expect(screen.getByText("My Custom")).toBeInTheDocument()
  })

  it("deletes a saved layout", async () => {
    const user = userEvent.setup()

    // Pre-populate a saved layout via real localStorage
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: "custom-1",
          name: "To Delete",
          sectionVisibility: ALL_ON,
          createdAt: "2026-01-01",
        },
      ]),
    )

    renderDialog()

    // Switch to Saved tab
    await user.click(screen.getByRole("tab", { name: "Saved" }))

    expect(screen.getByText("To Delete")).toBeInTheDocument()

    // Find and click the delete button (Trash2 icon button)
    const layoutRow = screen.getByText("To Delete").closest("[class*='justify-between']")!
    const deleteBtn = within(layoutRow as HTMLElement).getAllByRole("button").find(
      (btn) => !btn.textContent?.includes("Load"),
    )!
    await user.click(deleteBtn)

    expect(screen.queryByText("To Delete")).not.toBeInTheDocument()
  })
})
