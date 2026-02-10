import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DayDetailsEditor } from "@/features/schedules/components/DayDetailsEditor"

const updateDayDetailsMock = vi.fn()
const createLocationAndAssignToProjectMock = vi.fn()
const ensureLocationAssignedToProjectMock = vi.fn()

vi.mock("@/app/providers/AuthProvider", () => ({
  useAuth: () => ({
    clientId: "client-1",
  }),
}))

vi.mock("@/app/providers/ProjectScopeProvider", () => ({
  useProjectScope: () => ({
    projectId: "project-1",
  }),
}))

vi.mock("@/features/schedules/hooks/useLocations", () => ({
  useLocations: () => ({
    data: [
      { id: "loc-lib-1", name: "City Hospital", address: "100 Main St", projectIds: ["project-1"] },
      { id: "loc-lib-2", name: "North Lot", address: "2 Basecamp Ave", projectIds: [] },
    ],
  }),
}))

vi.mock("@/features/schedules/components/TypedTimeInput", () => ({
  TypedTimeInput: ({
    value,
    placeholder,
  }: {
    readonly value: string
    readonly placeholder: string
  }) => (
    <div data-testid="typed-time-input">{value || placeholder}</div>
  ),
}))

vi.mock("@/features/schedules/lib/scheduleWrites", () => ({
  updateDayDetails: (...args: unknown[]) => updateDayDetailsMock(...args),
  createLocationAndAssignToProject: (...args: unknown[]) => createLocationAndAssignToProjectMock(...args),
  ensureLocationAssignedToProject: (...args: unknown[]) => ensureLocationAssignedToProjectMock(...args),
}))

describe("DayDetailsEditor location module", () => {
  beforeEach(() => {
    updateDayDetailsMock.mockReset()
    createLocationAndAssignToProjectMock.mockReset()
    ensureLocationAssignedToProjectMock.mockReset()

    updateDayDetailsMock.mockResolvedValue("day-details-1")
    createLocationAndAssignToProjectMock.mockResolvedValue({
      id: "loc-new-1",
      name: "New Hospital",
      address: "55 Health Way",
    })
    ensureLocationAssignedToProjectMock.mockResolvedValue(undefined)
  })

  it("adds a modular location block and persists dayDetails.locations", async () => {
    const user = userEvent.setup()

    render(
      <DayDetailsEditor
        scheduleId="schedule-1"
        scheduleName="Shoot Day"
        dateStr="Thursday"
        dayDetails={{
          id: "day-details-1",
          scheduleId: "schedule-1",
          crewCallTime: "06:00",
          shootingCallTime: "07:00",
          estimatedWrap: "19:00",
        }}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Add Location" }))

    await waitFor(() => {
      expect(updateDayDetailsMock).toHaveBeenCalled()
    })

    const [, , , , patch] = updateDayDetailsMock.mock.calls.at(-1) as unknown[]
    const typedPatch = patch as { readonly locations?: readonly { readonly title: string }[] | null }
    expect(typedPatch.locations).toBeTruthy()
    expect(typedPatch.locations?.[0]?.title).toBe("Basecamp")
  })

  it("creates a new location and links it to the target block", async () => {
    const user = userEvent.setup()

    render(
      <DayDetailsEditor
        scheduleId="schedule-1"
        scheduleName="Shoot Day"
        dateStr="Thursday"
        dayDetails={{
          id: "day-details-1",
          scheduleId: "schedule-1",
          crewCallTime: "06:00",
          shootingCallTime: "07:00",
          estimatedWrap: "19:00",
          locations: [
            {
              id: "block-1",
              title: "Hospital",
              ref: null,
              showName: true,
              showPhone: false,
            },
          ],
        }}
      />,
    )

    await user.click(screen.getByRole("button", { name: "New" }))
    await user.type(screen.getByLabelText("Name"), "New Hospital")
    await user.type(screen.getByLabelText("Address"), "55 Health Way")
    await user.click(screen.getByRole("button", { name: "Create Location" }))

    await waitFor(() => {
      expect(createLocationAndAssignToProjectMock).toHaveBeenCalledWith(
        "client-1",
        "project-1",
        {
          name: "New Hospital",
          address: "55 Health Way",
          notes: "",
        },
      )
    })

    await waitFor(() => {
      const [, , , , patch] = updateDayDetailsMock.mock.calls.at(-1) as unknown[]
      const typedPatch = patch as {
        readonly locations?: readonly {
          readonly title: string
          readonly ref: { readonly locationId?: string | null; readonly label?: string | null; readonly notes?: string | null } | null
        }[]
      }
      expect(typedPatch.locations?.[0]?.title).toBe("Hospital")
      expect(typedPatch.locations?.[0]?.ref?.locationId).toBe("loc-new-1")
      expect(typedPatch.locations?.[0]?.ref?.label).toBe("New Hospital")
      expect(typedPatch.locations?.[0]?.ref?.notes).toBe("55 Health Way")
    })
  })
})
