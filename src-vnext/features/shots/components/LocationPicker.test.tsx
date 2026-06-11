/// <reference types="@testing-library/jest-dom" />
// Phase 5e-II banked fix (build spec, §PR partition 5e-II "Bundled banked
// fixes"): LocationPicker was the only shot-detail popover missing the 5d
// Escape guard — Escape inside it must dismiss the popover WITHOUT reaching
// the page's window-level Escape -> navigate(-1) shortcut. Mirrors
// TalentPicker.test.tsx test (10).
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

let mockLocations: Array<{ id: string; name: string; projectIds?: string[] }> = []

vi.mock("@/features/shots/hooks/usePickerData", () => ({
  useLocations: () => ({ data: mockLocations, loading: false, error: null }),
}))

import { LocationPicker } from "./LocationPicker"

const LOCATIONS = [
  { id: "loc-1", name: "Studio A", projectIds: ["p1"] },
  { id: "loc-2", name: "Rooftop", projectIds: [] },
]

function renderPicker(props: Partial<Parameters<typeof LocationPicker>[0]> = {}) {
  return render(
    <LocationPicker
      selectedId={undefined}
      selectedName={undefined}
      onSave={vi.fn()}
      projectId="p1"
      {...props}
    />,
  )
}

/** Opens the popover (trigger is the first button) and waits for content. */
async function openPicker(): Promise<HTMLElement> {
  const trigger = screen.getAllByRole("button")[0]
  if (!trigger) throw new Error("No trigger button rendered")
  fireEvent.click(trigger)
  await screen.findByPlaceholderText("Search locations...")
  return trigger
}

function itemFor(name: string): HTMLElement {
  const el = screen
    .getAllByText(name)
    .map((node) => node.closest("[cmdk-item]"))
    .find((item) => item !== null)
  if (!el) throw new Error(`No cmdk item for ${name}`)
  return el as HTMLElement
}

describe("LocationPicker", () => {
  beforeEach(() => {
    mockLocations = [...LOCATIONS]
    vi.clearAllMocks()
  })

  it("selecting a location calls onSave with id + name and closes the popover", async () => {
    const onSave = vi.fn()
    renderPicker({ onSave })
    await openPicker()

    fireEvent.click(itemFor("Studio A"))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave).toHaveBeenCalledWith("loc-1", "Studio A")
    expect(screen.queryByPlaceholderText("Search locations...")).not.toBeInTheDocument()
  })

  it("Escape inside the open picker never propagates to window — the page's Escape -> navigate(-1) shortcut must not fire", async () => {
    const onSave = vi.fn()
    renderPicker({ onSave })
    await openPicker()

    const windowEscape = vi.fn()
    const listener = (event: KeyboardEvent) => {
      if (event.key === "Escape") windowEscape(event)
    }
    window.addEventListener("keydown", listener)
    try {
      fireEvent.keyDown(itemFor("Studio A"), { key: "Escape" })
      // Popover dismissed (content unmounts) without a save…
      expect(screen.queryByPlaceholderText("Search locations...")).not.toBeInTheDocument()
      expect(onSave).not.toHaveBeenCalled()
      // …and the window-level shortcut listener never saw the key.
      expect(windowEscape).not.toHaveBeenCalled()
    } finally {
      window.removeEventListener("keydown", listener)
    }
  })
})
