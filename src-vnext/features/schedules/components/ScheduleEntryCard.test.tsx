import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ScheduleEntryCard } from "@/features/schedules/components/ScheduleEntryCard"
import type { ScheduleEntry } from "@/shared/types"

function makeEntry(patch: Partial<ScheduleEntry>): ScheduleEntry {
  return {
    id: "entry-1",
    type: "setup",
    title: "Old Title",
    order: 0,
    ...patch,
  }
}

describe("ScheduleEntryCard", () => {
  it("allows inline title editing and saves updates", async () => {
    const user = userEvent.setup()
    const onUpdateTitle = vi.fn()

    render(
      <ScheduleEntryCard
        entry={makeEntry({ title: "Old Title" })}
        isFirst
        isLast
        onRemove={() => {}}
        onUpdateTitle={onUpdateTitle}
        onUpdateStartTime={() => {}}
        onUpdateDuration={() => {}}
        onUpdateNotes={() => {}}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Old Title" }))
    const input = screen.getByDisplayValue("Old Title")
    await user.clear(input)
    await user.type(input, "New Title")
    await user.tab()

    expect(onUpdateTitle).toHaveBeenCalledWith("New Title")
  })

  it("shows explicit edit action and invokes callback", async () => {
    const user = userEvent.setup()
    const onEdit = vi.fn()

    render(
      <ScheduleEntryCard
        entry={makeEntry({ title: "Needs Edit" })}
        isFirst
        isLast
        onRemove={() => {}}
        onEdit={onEdit}
        onUpdateTitle={() => {}}
        onUpdateStartTime={() => {}}
        onUpdateDuration={() => {}}
        onUpdateNotes={() => {}}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Edit entry" }))
    expect(onEdit).toHaveBeenCalledTimes(1)
  })

  it("renders passive track badge instead of a dropdown selector", () => {
    render(
      <ScheduleEntryCard
        entry={makeEntry({ title: "Track Badge", trackId: "track-2" })}
        isFirst
        isLast
        trackSelect={{
          value: "track-2",
          options: [
            { value: "primary", label: "Primary" },
            { value: "track-2", label: "Track 2" },
          ],
        }}
        onRemove={() => {}}
        onUpdateTitle={() => {}}
        onUpdateStartTime={() => {}}
        onUpdateDuration={() => {}}
        onUpdateNotes={() => {}}
      />,
    )

    expect(screen.getByText("Track 2")).toBeInTheDocument()
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument()
  })
})
