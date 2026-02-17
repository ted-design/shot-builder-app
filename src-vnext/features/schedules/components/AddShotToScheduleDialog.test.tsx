import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Timestamp } from "firebase/firestore"
import { AddShotToScheduleDialog } from "@/features/schedules/components/AddShotToScheduleDialog"
import type { Shot } from "@/shared/types"

function makeShot(patch: Partial<Shot>): Shot {
  return {
    id: "shot-1",
    title: "Merino Overcoat",
    projectId: "project-1",
    clientId: "client-1",
    status: "todo",
    talent: [],
    products: [],
    sortOrder: 0,
    createdAt: Timestamp.fromMillis(0),
    updatedAt: Timestamp.fromMillis(0),
    createdBy: "user-1",
    ...patch,
  }
}

describe("AddShotToScheduleDialog", () => {
  it("shows richer shot context and supports search by talent/tag/description", async () => {
    const user = userEvent.setup()
    const onAdd = vi.fn()

    render(
      <AddShotToScheduleDialog
        open
        onOpenChange={() => {}}
        tracks={[
          { id: "primary", name: "Primary", order: 0 },
          { id: "track-2", name: "Track 2", order: 1 },
        ]}
        shots={[
          makeShot({
            id: "shot-a",
            title: "Merino Overcoat",
            shotNumber: "A10",
            description: "Wide establishing at hospital entrance.",
            talentIds: ["talent-1"],
            locationName: "Downtown Hospital",
            tags: [{ id: "tag-1", label: "Outerwear", color: "#111111" }],
          }),
          makeShot({
            id: "shot-b",
            title: "Transit Sweatpants",
            shotNumber: "B20",
            description: "Parking lot setup.",
          }),
        ]}
        existingEntries={[]}
        talentLookup={[
          { id: "talent-1", name: "Elyse Sanders" },
        ]}
        onAdd={onAdd}
      />,
    )

    expect(screen.getByText("Shot A10")).toBeInTheDocument()
    expect(screen.getByText(/Talent: Elyse Sanders/)).toBeInTheDocument()
    expect(screen.getByText("Downtown Hospital")).toBeInTheDocument()
    expect(screen.getByText("Outerwear")).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText("Search shots..."), "elyse")
    expect(screen.getByText("Merino Overcoat")).toBeInTheDocument()
    expect(screen.queryByText("Transit Sweatpants")).not.toBeInTheDocument()
  })
})
