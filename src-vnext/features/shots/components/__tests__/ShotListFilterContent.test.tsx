import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { ShotListFilterContent } from "../ShotListFilterContent"
import { deserializeFilters, serializeFilters } from "../../lib/filterSerializer"
import type { FilterCondition } from "../../lib/filterConditions"

vi.mock("@/shared/lib/flags", () => ({
  isFeatureEnabled: (flag: string) => flag === "featureShotFilterTalentScope",
}))

const TALENT = [
  { id: "t1", name: "Jada" },
  { id: "t2", name: "Miles" },
  { id: "t3", name: "Cara" },
]

function renderContent(conditions: readonly FilterCondition[], onUpdateCondition = vi.fn()) {
  return (
    <ShotListFilterContent
      conditions={conditions}
      onAddCondition={vi.fn()}
      onUpdateCondition={onUpdateCondition}
      onRemoveCondition={vi.fn()}
      tagOptions={[]}
      talentRecords={TALENT}
      locationRecords={[]}
      productFamilies={[]}
      projectTalentIds={new Set(["t1", "t2"])}
      hasActiveFilters
      onClearFilters={vi.fn()}
      canRepair={false}
      onRepairOpen={vi.fn()}
    />
  )
}

describe("ShotListFilterContent — talent search survives a toggle", () => {
  it("keeps the search query after ticking a talent (conditions re-read from the URL)", () => {
    // Mirrors useShotListState: conditions come from deserializeFilters(url);
    // a toggle writes serializeFilters(next) and the page re-deserializes.
    let conditions = deserializeFilters("talent.in:")
    let url = ""
    const onUpdate = vi.fn((id: string, updates: Partial<FilterCondition>) => {
      url = serializeFilters(conditions.map((c) => (c.id === id ? { ...c, ...updates } : c)))
    })
    const { rerender } = render(renderContent(conditions, onUpdate))

    fireEvent.change(screen.getByLabelText("Search talent"), { target: { value: "ja" } })
    fireEvent.click(screen.getByRole("checkbox", { name: "Jada" }))
    expect(url).toBe("talent.in:t1")

    conditions = deserializeFilters(url)
    rerender(renderContent(conditions, onUpdate))
    expect(screen.getByLabelText("Search talent")).toHaveValue("ja")
    expect(screen.getByRole("checkbox", { name: "Jada" })).toBeChecked()
  })
})
