import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { FilterValuePicker } from "../FilterValuePicker"
import type { FilterCondition, FilterValue } from "../../lib/filterConditions"

const flagMock = vi.hoisted(() => ({ on: false }))

vi.mock("@/shared/lib/flags", () => ({
  isFeatureEnabled: (flag: string) => (flag === "featureShotFilterTalentScope" ? flagMock.on : false),
}))

const TALENT = [
  { id: "t1", name: "Anna", projectIds: ["p1"] },
  { id: "t2", name: "Bob", projectIds: [] as string[] },
  { id: "t3", name: "Cara", projectIds: ["pX"] },
]

function renderTalentPicker(opts?: { value?: FilterValue; projectId?: string }) {
  const onChange = vi.fn()
  const condition: FilterCondition = {
    id: "c1",
    field: "talent",
    operator: "in",
    value: opts?.value ?? [],
  }
  render(
    <FilterValuePicker
      condition={condition}
      onChange={onChange}
      statusOptions={[]}
      tagOptions={[]}
      talentRecords={TALENT}
      locationRecords={[]}
      productFamilies={[]}
      projectId={opts?.projectId ?? "p1"}
    />,
  )
  return { onChange }
}

describe("FilterValuePicker talent picker — flag OFF (trunk)", () => {
  beforeEach(() => {
    flagMock.on = false
  })

  it("lists the whole library with no search box (byte-identical trunk behavior)", () => {
    renderTalentPicker()
    expect(screen.getByText("Anna")).toBeInTheDocument()
    expect(screen.getByText("Bob")).toBeInTheDocument()
    expect(screen.getByText("Cara")).toBeInTheDocument()
    expect(screen.queryByLabelText("Search talent")).not.toBeInTheDocument()
  })
})

describe("FilterValuePicker talent picker — flag ON (scoped + searchable)", () => {
  beforeEach(() => {
    flagMock.on = true
  })

  it("scopes to project-attached talent and shows a search box by default", () => {
    renderTalentPicker()
    expect(screen.getByLabelText("Search talent")).toBeInTheDocument()
    expect(screen.getByText("Anna")).toBeInTheDocument() // projectIds includes p1
    expect(screen.queryByText("Bob")).not.toBeInTheDocument() // no project
    expect(screen.queryByText("Cara")).not.toBeInTheDocument() // different project
    expect(screen.getByText(/Search to filter by other talent/i)).toBeInTheDocument()
  })

  it("reveals matching non-project talent only when searching", () => {
    renderTalentPicker()
    fireEvent.change(screen.getByLabelText("Search talent"), { target: { value: "a" } })
    expect(screen.getByText("Anna")).toBeInTheDocument() // project talent, matches
    expect(screen.getByText("Cara")).toBeInTheDocument() // other talent, matches "a"
    expect(screen.queryByText("Bob")).not.toBeInTheDocument() // no "a"
    expect(screen.queryByText(/Search to filter by other talent/i)).not.toBeInTheDocument()
  })

  it("shows an empty hint when the project has no attached talent", () => {
    renderTalentPicker({ projectId: "pZZZ" })
    expect(screen.getByText(/No talent assigned to this project/i)).toBeInTheDocument()
    expect(screen.queryByText("Anna")).not.toBeInTheDocument()
  })

  it("toggles a talent id through onChange", () => {
    const { onChange } = renderTalentPicker()
    fireEvent.click(screen.getByRole("checkbox", { name: "Anna" }))
    expect(onChange).toHaveBeenCalledWith(["t1"])
  })

  it("deselects an already-selected talent", () => {
    const { onChange } = renderTalentPicker({ value: ["t1"] })
    fireEvent.click(screen.getByRole("checkbox", { name: "Anna" }))
    expect(onChange).toHaveBeenCalledWith([])
  })

  it("keeps a selected off-project talent visible with an empty query", () => {
    renderTalentPicker({ value: ["t3"] }) // Cara: projectIds ['pX'], not in p1
    expect(screen.getByText("Cara")).toBeInTheDocument()
    expect(screen.getByText("Anna")).toBeInTheDocument() // project talent
    expect(screen.queryByText("Bob")).not.toBeInTheDocument() // unselected off-project, empty query
  })
})
