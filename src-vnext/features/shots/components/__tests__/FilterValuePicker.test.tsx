import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { FilterValuePicker } from "../FilterValuePicker"
import type { FilterCondition, FilterValue } from "../../lib/filterConditions"

const flagMock = vi.hoisted(() => ({ on: false }))

vi.mock("@/shared/lib/flags", () => ({
  isFeatureEnabled: (flag: string) => (flag === "featureShotFilterTalentScope" ? flagMock.on : false),
}))

const TALENT = [
  { id: "t1", name: "Anna" },
  { id: "t2", name: "Bob" },
  { id: "t3", name: "Cara" },
]

// Anna is project talent (on a shot or linked via projectIds — see collectProjectTalentIds).
const PROJECT_TALENT: ReadonlySet<string> = new Set(["t1"])

function renderTalentPicker(opts?: { value?: FilterValue; projectTalentIds?: ReadonlySet<string> }) {
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
      projectTalentIds={opts?.projectTalentIds ?? PROJECT_TALENT}
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

  it("scopes to project talent and shows a search box by default", () => {
    renderTalentPicker()
    expect(screen.getByLabelText("Search talent")).toBeInTheDocument()
    expect(screen.getByText("Anna")).toBeInTheDocument() // project talent
    expect(screen.queryByText("Bob")).not.toBeInTheDocument() // not project talent
    expect(screen.queryByText("Cara")).not.toBeInTheDocument() // not project talent
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

  it("shows an empty hint when the project has no talent", () => {
    renderTalentPicker({ projectTalentIds: new Set() })
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
    renderTalentPicker({ value: ["t3"] }) // Cara: not project talent
    expect(screen.getByText("Cara")).toBeInTheDocument()
    expect(screen.getByText("Anna")).toBeInTheDocument() // project talent
    expect(screen.queryByText("Bob")).not.toBeInTheDocument() // unselected off-project, empty query
  })
})

// ---------------------------------------------------------------------------
// Status picker — regression coverage for the fix in this PR: StatusPicker
// previously ignored its `statusOptions` prop and built its own hardcoded
// list; it now renders exactly what the caller passes. Mirrors the real
// caller (ShotListFilterContent.tsx's STATUS_OPTIONS, derived from
// SHOT_STATUS_CYCLE/STATUS_LABELS) rather than an arbitrary fixture, so this
// test would catch that prop being dropped or renamed again.
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = [
  { value: "todo", label: "Draft" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "complete", label: "Shot" },
]

function renderStatusPicker(opts?: { value?: FilterValue }) {
  const onChange = vi.fn()
  const condition: FilterCondition = {
    id: "c1",
    field: "status",
    operator: "in",
    value: opts?.value ?? [],
  }
  render(
    <FilterValuePicker
      condition={condition}
      onChange={onChange}
      statusOptions={STATUS_OPTIONS}
      tagOptions={[]}
      talentRecords={[]}
      locationRecords={[]}
      productFamilies={[]}
      projectTalentIds={new Set()}
    />,
  )
  return { onChange }
}

describe("FilterValuePicker status picker", () => {
  it("renders every option the caller passes via statusOptions — not a hardcoded list", () => {
    renderStatusPicker()
    expect(screen.getByText("Draft")).toBeInTheDocument()
    expect(screen.getByText("In Progress")).toBeInTheDocument()
    expect(screen.getByText("On Hold")).toBeInTheDocument()
    expect(screen.getByText("Shot")).toBeInTheDocument()
  })

  it("shows the empty-options fallback when statusOptions is empty (proves it isn't self-sourcing)", () => {
    const onChange = vi.fn()
    const condition: FilterCondition = { id: "c1", field: "status", operator: "in", value: [] }
    render(
      <FilterValuePicker
        condition={condition}
        onChange={onChange}
        statusOptions={[]}
        tagOptions={[]}
        talentRecords={[]}
        locationRecords={[]}
        productFamilies={[]}
        projectTalentIds={new Set()}
      />,
    )
    expect(screen.getByText("No options available")).toBeInTheDocument()
    expect(screen.queryByText("Draft")).not.toBeInTheDocument()
  })

  it("toggles a status value through onChange", () => {
    const { onChange } = renderStatusPicker()
    fireEvent.click(screen.getByRole("checkbox", { name: "On Hold" }))
    expect(onChange).toHaveBeenCalledWith(["on_hold"])
  })

  it("deselects an already-selected status", () => {
    const { onChange } = renderStatusPicker({ value: ["on_hold"] })
    fireEvent.click(screen.getByRole("checkbox", { name: "On Hold" }))
    expect(onChange).toHaveBeenCalledWith([])
  })
})
