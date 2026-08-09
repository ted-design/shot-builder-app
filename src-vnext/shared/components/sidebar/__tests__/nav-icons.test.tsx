import { describe, it, expect } from "vitest"
import { render } from "@testing-library/react"
import { NavIcon } from "@/shared/components/sidebar/nav-icons"

// Schedules and Call Sheet sit adjacent in the collapsed icon rail (nav-config
// puts Schedules immediately before Call Sheet). Before this, both resolved
// to "calendar-days" — same glyph, no way to tell them apart when the
// sidebar is collapsed to icons only. Assert the two ICON_MAP entries render
// genuinely different SVGs, not just different string keys.
describe("NavIcon — Schedules vs Call Sheet", () => {
  it("renders different markup for list-checks and calendar-days", () => {
    const { container: schedules } = render(<NavIcon name="list-checks" />)
    const { container: callSheet } = render(<NavIcon name="calendar-days" />)

    const schedulesSvg = schedules.querySelector("svg")
    const callSheetSvg = callSheet.querySelector("svg")

    expect(schedulesSvg).toBeTruthy()
    expect(callSheetSvg).toBeTruthy()
    expect(schedulesSvg?.innerHTML).not.toBe(callSheetSvg?.innerHTML)
  })
})
