import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"
import { CallSheetCastTable } from "@/features/schedules/components/CallSheetCastTable"
import {
  DEFAULT_CAST_SECTION,
  toggleFieldVisibility,
  updateFieldLabel,
  updateFieldWidth,
  type CallSheetSectionFieldConfig,
} from "@/features/schedules/lib/fieldConfig"
import type { TalentCallSheet, TalentRecord } from "@/shared/types"

const TALENT: TalentRecord[] = [
  { id: "t1", name: "Jane Doe", clientId: "c1" },
]

const CALLS: TalentCallSheet[] = [
  {
    id: "tc1",
    talentId: "t1",
    callTime: "09:00",
    wrapTime: "17:00",
    role: "Lead",
    notes: "Bring props",
  },
]

describe("CallSheetCastTable", () => {
  it("renders default columns when no fieldConfig is provided", () => {
    render(
      <CallSheetCastTable
        talentCalls={CALLS}
        talentLookup={TALENT}
        dayDetails={null}
      />,
    )

    expect(screen.getByText("Talent")).toBeInTheDocument()
    expect(screen.getByText("Role")).toBeInTheDocument()
    expect(screen.getByText("Set Call")).toBeInTheDocument()
    expect(screen.getByText("Jane Doe")).toBeInTheDocument()
  })

  it("hides columns when field is toggled invisible", () => {
    const config = toggleFieldVisibility(DEFAULT_CAST_SECTION, "role")

    render(
      <CallSheetCastTable
        talentCalls={CALLS}
        talentLookup={TALENT}
        dayDetails={null}
        fieldConfig={config}
      />,
    )

    expect(screen.queryByText("Role")).not.toBeInTheDocument()
    expect(screen.queryByText("Lead")).not.toBeInTheDocument()
    expect(screen.getByText("Jane Doe")).toBeInTheDocument()
  })

  it("uses custom labels from field config", () => {
    const config = updateFieldLabel(DEFAULT_CAST_SECTION, "talent", "Actor")

    render(
      <CallSheetCastTable
        talentCalls={CALLS}
        talentLookup={TALENT}
        dayDetails={null}
        fieldConfig={config}
      />,
    )

    expect(screen.getByText("Actor")).toBeInTheDocument()
    expect(screen.queryByText("Talent")).not.toBeInTheDocument()
  })

  it("applies width from field config to column headers", () => {
    const config = updateFieldWidth(DEFAULT_CAST_SECTION, "talent", "xs")

    const { container } = render(
      <CallSheetCastTable
        talentCalls={CALLS}
        talentLookup={TALENT}
        dayDetails={null}
        fieldConfig={config}
      />,
    )

    const headers = container.querySelectorAll("th")
    // Find the talent header — it should have "xs" width (6%)
    const talentHeader = Array.from(headers).find((h) => h.textContent === "Talent")
    expect(talentHeader?.style.width).toBe("6%")
  })
})
