/// <reference types="@testing-library/jest-dom" />
// Phase 5a characterization pin (build spec, Test plan 1e).
//
// Pins DescriptionEditor's flush-on-unmount contract, against unchanged
// source — no test existed for this before. A pending debounced save (the
// useAutoSave 1500ms window) MUST flush when the component unmounts (e.g.
// back-button navigation mid-edit), and a clean unmount must not write.
// 5a's autosave invariant: flush-on-blur AND flush-on-unmount preserved;
// no layout branch may remount these editors mid-edit.
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { DescriptionEditor } from "@/features/shots/components/ShotDetailShared"

function enterEditMode(displayText: string) {
  fireEvent.click(screen.getByText(displayText))
  return screen.getByTestId("description-input")
}

describe("DescriptionEditor flush-on-unmount (pre-5a pin)", () => {
  it("flushes a pending debounced save when unmounted before the debounce fires", () => {
    const onSave = vi.fn(() => Promise.resolve())
    const { unmount } = render(
      <DescriptionEditor value="Old description" onSave={onSave} />,
    )

    const input = enterEditMode("Old description")
    fireEvent.change(input, { target: { value: "New description" } })

    // Still inside the debounce window — nothing saved yet.
    expect(onSave).not.toHaveBeenCalled()

    unmount()

    // The unmount cleanup flushes the pending save with the trimmed draft.
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith("New description")
  })

  it("trims the draft before the flushed save", () => {
    const onSave = vi.fn(() => Promise.resolve())
    const { unmount } = render(<DescriptionEditor value="" onSave={onSave} />)

    const input = enterEditMode("Click to add...")
    fireEvent.change(input, { target: { value: "  padded draft  " } })

    unmount()

    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith("padded draft")
  })

  it("does not save on unmount when nothing changed", () => {
    const onSave = vi.fn(() => Promise.resolve())
    const { unmount } = render(
      <DescriptionEditor value="Old description" onSave={onSave} />,
    )

    enterEditMode("Old description")
    unmount()

    expect(onSave).not.toHaveBeenCalled()
  })

  it("does not save on unmount when the draft was reverted to the original value", () => {
    const onSave = vi.fn(() => Promise.resolve())
    const { unmount } = render(
      <DescriptionEditor value="Old description" onSave={onSave} />,
    )

    const input = enterEditMode("Old description")
    fireEvent.change(input, { target: { value: "New description" } })
    // Reverting to the original cancels the pending save (handleChange cancel branch).
    fireEvent.change(input, { target: { value: "Old description" } })

    unmount()

    expect(onSave).not.toHaveBeenCalled()
  })
})
