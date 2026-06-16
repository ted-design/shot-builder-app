/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import type { TalentRecord } from "@/shared/types"

// Toggle the agency-combobox flag per test; nothing else in the TalentHeroZone
// import chain reads flags, so this mock is isolated to the gated branch.
let agencyComboboxOn = false
vi.mock("@/shared/lib/flags", () => ({
  isFeatureEnabled: (flag: string) =>
    flag === "featureTalentAgencyCombobox" && agencyComboboxOn,
}))

import { TalentHeroZone } from "../TalentHeroZone"

const TALENT = { id: "t1", name: "Alice", agency: "IMG Models" } as TalentRecord

function renderHero() {
  render(
    <TalentHeroZone
      selected={TALENT}
      canEdit
      busy={false}
      selectedHeadshotUrl={null}
      selectedHeadshotPath={null}
      knownAgencies={["Elite", "IMG Models"]}
      savePatch={vi.fn().mockResolvedValue(undefined)}
      onHeadshotFile={vi.fn().mockResolvedValue(undefined)}
      setHeadshotRemoveOpen={vi.fn()}
    />,
  )
}

describe("TalentHeroZone — agency field gating", () => {
  beforeEach(() => {
    agencyComboboxOn = false
  })

  it("flag OFF renders the free-text InlineEdit (no combobox trigger)", () => {
    agencyComboboxOn = false
    renderHero()
    expect(screen.queryByRole("button", { name: "Agency" })).not.toBeInTheDocument()
    expect(screen.getByText("IMG Models")).toBeInTheDocument()
  })

  it("flag ON renders the AgencyCombobox trigger showing the current value", () => {
    agencyComboboxOn = true
    renderHero()
    const trigger = screen.getByRole("button", { name: "Agency" })
    expect(trigger).toHaveTextContent("IMG Models")
  })
})
