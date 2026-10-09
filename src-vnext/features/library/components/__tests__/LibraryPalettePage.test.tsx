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

  describe("retired swatches", () => {
    const ts = { toMillis: () => 0 }
    // Production shape of a soft-retired duplicate (2026-10-09 colour cleanup):
    // the doc is kept with deleted + retiredIntoSwatchId, and the survivor
    // carries the retired name as an alias.
    const rawDocs: ReadonlyArray<{ id: string; data: Record<string, unknown> }> = [
      {
        id: "ox-blood",
        data: {
          aliases: [],
          colorKey: "ox-blood",
          name: "Ox Blood",
          normalizedName: "ox blood",
          hexColor: "#4a0000",
          deleted: true,
          deletedAt: ts,
          retiredIntoSwatchId: "oxblood",
          updatedAt: ts,
        },
      },
      {
        id: "oxblood",
        data: {
          colorKey: "oxblood",
          name: "Oxblood",
          normalizedName: "oxblood",
          aliases: ["Ox Blood"],
          updatedAt: ts,
        },
      },
      {
        id: "olive",
        data: {
          colorKey: "olive",
          name: "Olive",
          hexColor: "#aabbcc",
          aliases: ["Olive Green"],
          updatedAt: ts,
        },
      },
    ]

    // Run the page's real mapper over raw Firestore data, as the hook does.
    function mockRawSwatches(docs = rawDocs) {
      ;(useFirestoreCollection as unknown as {
        mockImplementation: (fn: (...args: unknown[]) => unknown) => void
      }).mockImplementation((_path: unknown, _constraints: unknown, mapDoc: unknown) => ({
        data: docs.map((d) =>
          (mapDoc as (id: string, data: Record<string, unknown>) => unknown)(d.id, d.data),
        ),
        loading: false,
        error: null,
      }))
    }

    it("does not list deleted swatches by default", () => {
      mockRawSwatches()
      renderPage()

      expect(screen.getByText("Oxblood")).toBeInTheDocument()
      expect(screen.getByText("Olive")).toBeInTheDocument()
      expect(screen.queryByText("Ox Blood")).not.toBeInTheDocument()
      expect(screen.getByText(/^2 swatches · 1 deleted/)).toBeInTheDocument()
    })

    it("shows deleted swatches read-only behind a Show deleted toggle", async () => {
      const user = userEvent.setup()
      authRole = "admin"
      mockRawSwatches()
      renderPage()

      await user.click(screen.getByRole("button", { name: "Show deleted (1)" }))

      expect(screen.getByText("Ox Blood")).toBeInTheDocument()
      expect(screen.getByText("Merged into Oxblood")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "#4A0000" })).toBeDisabled()
      // Only the two live swatches keep a Delete action.
      expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(2)

      await user.click(screen.getByText("Ox Blood"))
      expect(screen.queryByDisplayValue("Ox Blood")).not.toBeInTheDocument()

      await user.click(screen.getByRole("button", { name: "Hide deleted" }))
      expect(screen.queryByText("Ox Blood")).not.toBeInTheDocument()
    })

    it("hides the toggle and deleted swatches on mobile", () => {
      isMobile = true
      mockRawSwatches()
      renderPage()

      expect(screen.queryByRole("button", { name: /Show deleted/ })).not.toBeInTheDocument()
      expect(screen.queryByText("Ox Blood")).not.toBeInTheDocument()
      expect(screen.getByText("Oxblood")).toBeInTheDocument()
    })

    it("hides deleted swatches again after resizing to mobile with the toggle on", async () => {
      const user = userEvent.setup()
      mockRawSwatches()
      const { rerender } = renderPage()

      await user.click(screen.getByRole("button", { name: "Show deleted (1)" }))
      expect(screen.getByText("Ox Blood")).toBeInTheDocument()

      isMobile = true
      rerender(
        <MemoryRouter>
          <LibraryPalettePage />
        </MemoryRouter>,
      )
      expect(screen.queryByText("Ox Blood")).not.toBeInTheDocument()
    })

    it("shows the empty state, not a search miss, when no swatches are left", async () => {
      const user = userEvent.setup()
      mockRawSwatches(rawDocs.filter((d) => d.id === "ox-blood"))
      const { rerender } = renderPage()

      expect(screen.getByText("No swatches yet")).toBeInTheDocument()
      await user.click(screen.getByRole("button", { name: "Show deleted (1)" }))
      expect(screen.getByText("Ox Blood")).toBeInTheDocument()

      mockRawSwatches([])
      rerender(
        <MemoryRouter>
          <LibraryPalettePage />
        </MemoryRouter>,
      )
      expect(screen.getByText("No swatches yet")).toBeInTheDocument()
      expect(screen.queryByText("No matching swatches")).not.toBeInTheDocument()
    })

    it("warns before deleting a swatch that retired duplicates were merged into", async () => {
      const user = userEvent.setup()
      authRole = "admin"
      mockRawSwatches()
      renderPage()

      const row = screen.getByText("oxblood").closest("div.grid") as HTMLElement
      await user.click(within(row).getByRole("button", { name: "Delete" }))

      const dialog = await screen.findByRole("dialog")
      expect(within(dialog).getByText(/"Ox Blood" was merged into it/)).toBeInTheDocument()
    })

    it("finds the surviving swatch when searching a retired name", async () => {
      const user = userEvent.setup()
      mockRawSwatches()
      renderPage()

      await user.type(screen.getByPlaceholderText("Search swatches…"), "ox blood")

      expect(screen.getByText("Oxblood")).toBeInTheDocument()
      expect(screen.queryByText("Olive")).not.toBeInTheDocument()
      expect(screen.queryByText("Ox Blood")).not.toBeInTheDocument()
    })

    it("refuses to create a swatch whose key belongs to a retired swatch", async () => {
      const user = userEvent.setup()
      mockRawSwatches()
      renderPage()

      fireEvent.change(screen.getByPlaceholderText("e.g. Olive"), {
        target: { value: "Ox Blood" },
      })

      expect(screen.getByText(/was merged into Oxblood/)).toBeInTheDocument()
      const create = screen.getByRole("button", { name: "Create" })
      expect(create).toBeDisabled()
      await user.click(create)
      expect(saveColorSwatch).not.toHaveBeenCalled()
    })

    it("refuses to create a swatch whose name is another swatch's alias", () => {
      mockRawSwatches()
      renderPage()

      fireEvent.change(screen.getByPlaceholderText("e.g. Olive"), {
        target: { value: "Olive Green" },
      })

      expect(screen.getByText(/is already a name for Olive/)).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Create" })).toBeDisabled()
    })

    it("keeps the stored hex when Update is used with the hex left blank", async () => {
      const user = userEvent.setup()
      mockRawSwatches()
      ;(saveColorSwatch as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue(
        { id: "olive" },
      )
      renderPage()

      fireEvent.change(screen.getByPlaceholderText("e.g. Olive"), {
        target: { value: "Olive" },
      })
      await user.click(screen.getByRole("button", { name: "Update" }))

      await waitFor(() => {
        expect(saveColorSwatch).toHaveBeenCalledTimes(1)
      })
      const args = (saveColorSwatch as unknown as { mock: { calls: unknown[][] } }).mock.calls[0]![0]
      expect(args).toMatchObject({ swatchId: "olive", name: "Olive", isNew: false })
      expect(args).not.toHaveProperty("hexColor")
    })
  })
})
