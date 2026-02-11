import { describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ScheduleEntryEditSheet } from "@/features/schedules/components/ScheduleEntryEditSheet"
import type { ScheduleEntry } from "@/shared/types"

function makeEntry(patch: Partial<ScheduleEntry>): ScheduleEntry {
  return {
    id: "entry-1",
    type: "setup",
    title: "Highlight",
    order: 0,
    ...patch,
  }
}

describe("ScheduleEntryEditSheet", () => {
  it("allows updating highlight emoji via presets", async () => {
    const user = userEvent.setup()
    const onUpdateHighlight = vi.fn(async () => {})

    render(
      <ScheduleEntryEditSheet
        open
        entry={makeEntry({
          type: "setup",
          highlight: {
            variant: "solid",
            color: "#2563eb",
            emoji: "✨",
          },
        })}
        trackOptions={[{ value: "primary", label: "Primary" }]}
        onOpenChange={() => {}}
        onUpdateTitle={async () => {}}
        onUpdateStartTime={async () => {}}
        onUpdateDuration={async () => {}}
        onUpdateNotes={async () => {}}
        onUpdateHighlight={onUpdateHighlight}
        onMoveToTrack={async () => {}}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Use emoji 🚚" }))

    await waitFor(() => {
      expect(onUpdateHighlight).toHaveBeenCalledWith({
        variant: "solid",
        color: "#2563eb",
        emoji: "🚚",
      })
    })
  })

  it("does not render highlight style controls for shot entries", () => {
    render(
      <ScheduleEntryEditSheet
        open
        entry={makeEntry({
          type: "shot",
          title: "Shot Entry",
          highlight: null,
        })}
        trackOptions={[{ value: "primary", label: "Primary" }]}
        onOpenChange={() => {}}
        onUpdateTitle={async () => {}}
        onUpdateStartTime={async () => {}}
        onUpdateDuration={async () => {}}
        onUpdateNotes={async () => {}}
        onUpdateHighlight={async () => {}}
        onMoveToTrack={async () => {}}
      />,
    )

    expect(screen.queryByText("Highlight Style")).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Use emoji 🚚" })).not.toBeInTheDocument()
  })
})
