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
})
