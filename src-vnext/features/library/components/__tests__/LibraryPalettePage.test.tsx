/// <reference types="@testing-library/jest-dom" />
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"

let authRole: "admin" | "producer" = "producer"
let isMobile = false

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({ clientId: "c1", role: authRole }),
}))

vi.mock("@/shared/hooks/useMediaQuery", () => ({
  useIsMobile: () => isMobile,
}))

vi.mock("@/shared/hooks/useFirestoreCollection", () => ({
  useFirestoreCollection: vi.fn(),
}))

vi.mock("@/features/library/lib/colorSwatchWrites", () => ({
  saveColorSwatch: vi.fn(),
  deleteColorSwatch: vi.fn(),
}))

import { useFirestoreCollection } from "@/shared/hooks/useFirestoreCollection"
import {
  deleteColorSwatch,
  saveColorSwatch,
} from "@/features/library/lib/colorSwatchWrites"
import LibraryPalettePage from "@/features/library/components/LibraryPalettePage"

function renderPage() {
  return render(
    <MemoryRouter>
      <LibraryPalettePage />
    </MemoryRouter>,
  )
}

describe("LibraryPalettePage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authRole = "producer"
    isMobile = false
  })

  it("creates a new swatch from the New swatch card", async () => {
    const user = userEvent.setup()
    ;(useFirestoreCollection as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [],
      loading: false,
      error: null,
    })

    ;(saveColorSwatch as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(
      { id: "olive" },
    )

    renderPage()

    fireEvent.change(screen.getByPlaceholderText("e.g. Olive"), {
      target: { value: "Olive" },
    })
    fireEvent.change(screen.getByPlaceholderText("#AABBCC"), {
      target: { value: "aabbcc" },
    })
    await user.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() => {
      expect(saveColorSwatch).toHaveBeenCalledTimes(1)
    })

    expect(saveColorSwatch).toHaveBeenCalledWith({
      clientId: "c1",
      swatchId: "olive",
      name: "Olive",
      hexColor: "#AABBCC",
      isNew: true,
    })
  })

  it("edits swatch name inline and persists", async () => {
    const user = userEvent.setup()
    ;(useFirestoreCollection as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [{ id: "olive", name: "Olive", hexColor: "#AABBCC" }],
      loading: false,
      error: null,
    })

    ;(saveColorSwatch as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(
      { id: "olive" },
    )

    renderPage()

    await user.click(screen.getByText("Olive"))
    const input = screen.getByDisplayValue("Olive")
    fireEvent.change(input, { target: { value: "Olive Green" } })
    fireEvent.blur(input)

    await waitFor(() => {
      expect(saveColorSwatch).toHaveBeenCalledTimes(1)
    })

    expect(saveColorSwatch).toHaveBeenCalledWith({
      clientId: "c1",
      swatchId: "olive",
      name: "Olive Green",
      hexColor: "#AABBCC",
      isNew: false,
    })
  })

  it("allows admin to delete a swatch", async () => {
    const user = userEvent.setup()
    authRole = "admin"

    ;(useFirestoreCollection as unknown as { mockReturnValue: (v: unknown) => void }).mockReturnValue({
      data: [{ id: "olive", name: "Olive", hexColor: "#AABBCC" }],
      loading: false,
      error: null,
    })

    ;(deleteColorSwatch as unknown as { mockResolvedValue: () => void }).mockResolvedValue()

    renderPage()

    await user.click(screen.getAllByRole("button", { name: "Delete" })[0]!)

    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: "Delete" }))

    await waitFor(() => {
      expect(deleteColorSwatch).toHaveBeenCalledTimes(1)
    })

    expect(deleteColorSwatch).toHaveBeenCalledWith({ clientId: "c1", swatchId: "olive" })
  })
})
