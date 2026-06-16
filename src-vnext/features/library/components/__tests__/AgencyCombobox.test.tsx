/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { AgencyCombobox } from "../AgencyCombobox"

const AGENCIES = ["B&M Models", "Elite", "IMG Models"]

function renderCombobox(props: Partial<Parameters<typeof AgencyCombobox>[0]> = {}) {
  const onChange = vi.fn()
  render(
    <AgencyCombobox
      value={null}
      knownAgencies={AGENCIES}
      onChange={onChange}
      {...props}
    />,
  )
  return { onChange }
}

/** Opens the popover (the trigger is the button labelled "Agency"). */
async function openCombobox(): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: "Agency" }))
  await screen.findByPlaceholderText("Search or add agency…")
}

function type(text: string): void {
  fireEvent.change(screen.getByPlaceholderText("Search or add agency…"), {
    target: { value: text },
  })
}

function itemFor(name: string): HTMLElement {
  const el = screen
    .getAllByText(name)
    .map((node) => node.closest("[cmdk-item]"))
    .find((item) => item !== null)
  if (!el) throw new Error(`No cmdk item for ${name}`)
  return el as HTMLElement
}

describe("AgencyCombobox", () => {
  it("shows the placeholder when there is no value", () => {
    renderCombobox({ placeholder: "Add agency" })
    expect(screen.getByRole("button", { name: "Agency" })).toHaveTextContent("Add agency")
  })

  it("shows the current value on the trigger", () => {
    renderCombobox({ value: "Elite" })
    expect(screen.getByRole("button", { name: "Agency" })).toHaveTextContent("Elite")
  })

  it("lists known agencies and selecting one emits it + closes", async () => {
    const { onChange } = renderCombobox()
    await openCombobox()
    expect(screen.getByText("IMG Models")).toBeInTheDocument()

    fireEvent.click(itemFor("Elite"))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith("Elite")
  })

  it("re-selecting the current value does NOT emit (no redundant write)", async () => {
    const { onChange } = renderCombobox({ value: "Elite" })
    await openCombobox()
    fireEvent.click(itemFor("Elite"))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("filters the list as you type", async () => {
    renderCombobox()
    await openCombobox()
    type("img")
    expect(screen.getByText("IMG Models")).toBeInTheDocument()
    expect(screen.queryByText("Elite")).not.toBeInTheDocument()
  })

  it("offers an Add row for a new name and emits the trimmed value", async () => {
    const { onChange } = renderCombobox()
    await openCombobox()
    type("  Next Models  ")
    fireEvent.click(screen.getByTestId("agency-add-new"))
    expect(onChange).toHaveBeenCalledWith("Next Models")
  })

  it("does NOT offer an Add row when the query matches an existing agency (case-insensitive)", async () => {
    renderCombobox()
    await openCombobox()
    type("elite")
    expect(screen.queryByTestId("agency-add-new")).not.toBeInTheDocument()
  })

  it("collapses internal whitespace before emitting a new value", async () => {
    const { onChange } = renderCombobox()
    await openCombobox()
    type("Next   Models")
    fireEvent.click(screen.getByTestId("agency-add-new"))
    expect(onChange).toHaveBeenCalledWith("Next Models")
  })

  it("treats an internal-whitespace variant of a known agency as a match (no Add row)", async () => {
    renderCombobox()
    await openCombobox()
    type("IMG  Models")
    expect(screen.queryByTestId("agency-add-new")).not.toBeInTheDocument()
  })

  it("offers Clear only when a value is set, and clearing emits null", async () => {
    const { onChange } = renderCombobox({ value: "Elite" })
    await openCombobox()
    fireEvent.click(screen.getByTestId("agency-clear"))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it("has no Clear row when there is no value", async () => {
    renderCombobox({ value: null })
    await openCombobox()
    expect(screen.queryByTestId("agency-clear")).not.toBeInTheDocument()
  })

  it("hides the Clear row while searching (avoids an accidental clear)", async () => {
    renderCombobox({ value: "Elite" })
    await openCombobox()
    expect(screen.getByTestId("agency-clear")).toBeInTheDocument()
    type("img")
    expect(screen.queryByTestId("agency-clear")).not.toBeInTheDocument()
  })

  it("keeps a double-spaced known agency selectable for a collapsed query", async () => {
    const onChange = vi.fn()
    render(
      <AgencyCombobox value={null} knownAgencies={["IMG  Models"]} onChange={onChange} />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Agency" }))
    await screen.findByPlaceholderText("Search or add agency…")
    type("img models")
    expect(screen.queryByTestId("agency-add-new")).not.toBeInTheDocument()
    // Testing Library collapses the rendered double-space, so match the single-space form.
    fireEvent.click(itemFor("IMG Models"))
    expect(onChange).toHaveBeenCalledWith("IMG Models")
  })

  it("does not open when disabled", () => {
    renderCombobox({ disabled: true })
    fireEvent.click(screen.getByRole("button", { name: "Agency" }))
    expect(screen.queryByPlaceholderText("Search or add agency…")).not.toBeInTheDocument()
  })
})
