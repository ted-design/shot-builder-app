import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { CallSheetOutputControls } from "@/features/schedules/components/CallSheetOutputControls"
import { DEFAULT_CALLSHEET_COLORS } from "@/features/schedules/lib/callSheetConfig"

function buildProps() {
  return {
    sections: {
      header: true,
      dayDetails: true,
      schedule: true,
      talent: true,
      crew: true,
      notes: true,
    },
    scheduleBlockFields: {
      showShotNumber: true,
      showShotName: true,
      showDescription: true,
      showTalent: true,
      showLocation: true,
      showTags: true,
      showNotes: true,
    },
    colors: {
      primary: "#2f2f2f",
      accent: "#10b981",
      text: "#0f172a",
    },
    onPatchSections: vi.fn(),
    onPatchScheduleFields: vi.fn(),
    onPatchColors: vi.fn(),
  }
}

describe("CallSheetOutputControls", () => {
  it("resets all output colors to defaults", async () => {
    const user = userEvent.setup()
    const props = buildProps()

    render(<CallSheetOutputControls {...props} />)

    await user.click(screen.getByRole("button", { name: "Reset Defaults" }))

    expect(props.onPatchColors).toHaveBeenCalledWith(DEFAULT_CALLSHEET_COLORS)
  })

  it("disables reset when colors are already default", () => {
    const props = buildProps()
    props.colors = { ...DEFAULT_CALLSHEET_COLORS }

    render(<CallSheetOutputControls {...props} />)

    expect(screen.getByRole("button", { name: "Reset Defaults" })).toBeDisabled()
  })
})
