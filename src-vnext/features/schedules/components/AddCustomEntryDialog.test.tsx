import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AddCustomEntryDialog } from "@/features/schedules/components/AddCustomEntryDialog"

describe("AddCustomEntryDialog", () => {
  it("uses single highlight-block model and submits structured payload", async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()

    render(
      <AddCustomEntryDialog
        open
        onOpenChange={() => {}}
        tracks={[
          { id: "primary", name: "Primary", order: 0 },
          { id: "track-2", name: "Track 2", order: 1 },
        ]}
        defaultTrackId="primary"
        onAdd={onAdd}
      />,
    )

    expect(screen.getByText("Add Highlight Block")).toBeInTheDocument()
    expect(screen.queryByText("Type")).not.toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: "Use emoji 🚚" }))
    await user.type(screen.getByLabelText("Title"), "Company Move")
    await user.type(screen.getByLabelText("Description"), "Load out and move to unit base")
    await user.click(screen.getByRole("button", { name: "Add Highlight" }))

    expect(onAdd).toHaveBeenCalledWith({
      title: "Company Move",
      description: "Load out and move to unit base",
      trackId: "primary",
      highlight: {
        variant: "solid",
        color: "#2563eb",
        emoji: "🚚",
      },
    })
  })
})
