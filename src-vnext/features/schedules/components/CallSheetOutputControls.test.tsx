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
    headerLayout: "legacy" as const,
    onPatchSections: vi.fn(),
    onPatchScheduleFields: vi.fn(),
    onPatchColors: vi.fn(),
    onSetHeaderLayout: vi.fn(),
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

  it("renders a SaveIndicator pill in the Output header when a savedAt timestamp is passed", () => {
    const props = buildProps()
    render(<CallSheetOutputControls {...props} savedAt={Date.now()} />)

    // Pill is mounted and shows the initial "Saved" label (within the
    // 3s recent threshold).
    expect(screen.getByRole("status")).toHaveTextContent("Saved")
  })

  it("does not render the SaveIndicator pill when savedAt is null", () => {
    const props = buildProps()
    render(<CallSheetOutputControls {...props} savedAt={null} />)

    expect(screen.queryByRole("status")).toBeNull()
  })

  it("shows Export Unit selector when 2+ tracks are provided with a callback", () => {
    const props = buildProps()
    const onActiveTrackChange = vi.fn()

    render(
      <CallSheetOutputControls
        {...props}
        tracks={[
          { id: "primary", name: "Primary", order: 0 },
          { id: "track-2", name: "Unit 2", order: 1 },
        ]}
        activeTrackId={null}
        onActiveTrackChange={onActiveTrackChange}
      />,
    )

    expect(screen.getByText("Export Unit")).toBeInTheDocument()
    expect(screen.getByText("All Units")).toBeInTheDocument()
  })

  it("does not show Export Unit selector for single-track schedules", () => {
    const props = buildProps()

    render(
      <CallSheetOutputControls
        {...props}
        tracks={[{ id: "primary", name: "Primary", order: 0 }]}
        activeTrackId={null}
        onActiveTrackChange={vi.fn()}
      />,
    )

    expect(screen.queryByText("Export Unit")).not.toBeInTheDocument()
  })

  it("does not show Export Unit selector when no tracks prop is provided", () => {
    const props = buildProps()

    render(<CallSheetOutputControls {...props} />)

    expect(screen.queryByText("Export Unit")).not.toBeInTheDocument()
  })
})
