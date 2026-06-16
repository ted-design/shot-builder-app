/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

// Toggle the agency-combobox flag per test; the dialog only reads this one flag.
let agencyComboboxOn = false
vi.mock("@/shared/lib/flags", () => ({
  isFeatureEnabled: (flag: string) =>
    flag === "featureTalentAgencyCombobox" && agencyComboboxOn,
}))

import { CreateTalentDialog } from "../CreateTalentDialog"

function renderDialog() {
  render(
    <CreateTalentDialog
      open
      onOpenChange={vi.fn()}
      busy={false}
      knownAgencies={["Elite", "IMG Models"]}
      onSubmit={vi.fn().mockResolvedValue(true)}
    />,
  )
}

describe("CreateTalentDialog — agency field gating", () => {
  beforeEach(() => {
    agencyComboboxOn = false
  })

  it("flag OFF renders the free-text agency Input (no combobox trigger)", () => {
    agencyComboboxOn = false
    renderDialog()
    expect(screen.queryByRole("button", { name: "Agency" })).not.toBeInTheDocument()
    // The free-text Input shares the "Optional" placeholder with email/phone/url.
    expect(screen.getAllByPlaceholderText("Optional").length).toBeGreaterThan(0)
  })

  it("flag ON renders the AgencyCombobox trigger", () => {
    agencyComboboxOn = true
    renderDialog()
    expect(screen.getByRole("button", { name: "Agency" })).toBeInTheDocument()
  })
})
