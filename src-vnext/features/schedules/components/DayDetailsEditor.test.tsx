import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DayDetailsEditor } from "@/features/schedules/components/DayDetailsEditor"
import type { UseUndoStackResult } from "@/shared/hooks/useUndoStack"
import type { UndoSnapshot } from "@/features/schedules/lib/undoSnapshots"

const { toastMock, toastErrorMock, toastSuccessMock, toastInfoMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  toastErrorMock: vi.fn(),
  toastSuccessMock: vi.fn(),
  toastInfoMock: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: Object.assign(toastMock, {
    error: toastErrorMock,
    success: toastSuccessMock,
    info: toastInfoMock,
  }),
}))

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
  useOptionalProjectScope: () => null,
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

function buildFakeUndoStack(): UseUndoStackResult<UndoSnapshot> {
  const pushMock = vi.fn((input: {
    readonly label: string
    readonly snapshot: UndoSnapshot
    readonly undo: (snapshot: UndoSnapshot) => Promise<void>
  }) => ({
    id: "fake-action-id",
    label: input.label,
    snapshot: input.snapshot,
    undo: input.undo,
    createdAt: 123,
  }))
  return {
    actions: [],
    push: pushMock,
    pop: vi.fn(() => null),
    remove: vi.fn(),
    clear: vi.fn(),
  }
}

describe("DayDetailsEditor location module", () => {
  beforeEach(() => {
    updateDayDetailsMock.mockReset()
    createLocationAndAssignToProjectMock.mockReset()
    ensureLocationAssignedToProjectMock.mockReset()
    toastMock.mockReset()
    toastErrorMock.mockReset()
    toastSuccessMock.mockReset()
    toastInfoMock.mockReset()

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
        undoStack={buildFakeUndoStack()}
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

  it("awaits the Firestore write before the new location appears in local state", async () => {
    const user = userEvent.setup()

    // Defer the updateDayDetails resolution so we can observe ordering:
    // setLocationDrafts must NOT fire until the Firestore write settles.
    let resolveWrite: (id: string) => void = () => {}
    updateDayDetailsMock.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveWrite = resolve
        }),
    )

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
        undoStack={buildFakeUndoStack()}
      />,
    )

    // Click Add Location. The async handler fires updateDayDetails but
    // must NOT yet update local state (we control when the promise resolves).
    await user.click(screen.getByRole("button", { name: "Add Location" }))

    await waitFor(() => {
      expect(updateDayDetailsMock).toHaveBeenCalled()
    })

    // Before the write resolves: no "Basecamp" location block in the UI.
    // The empty-state copy still shows.
    expect(
      screen.getByText(/No location blocks yet/i),
    ).toBeInTheDocument()

    // Resolve the write and assert the local state caught up.
    resolveWrite("day-details-1")

    await waitFor(() => {
      expect(
        screen.queryByText(/No location blocks yet/i),
      ).toBeNull()
    })
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
        undoStack={buildFakeUndoStack()}
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

  it("removing a location block fires destructiveActionWithUndo and pushes a locationRemoved snapshot", async () => {
    const user = userEvent.setup()
    const undoStack = buildFakeUndoStack()

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
              id: "block-keep",
              title: "Basecamp",
              ref: null,
              showName: true,
              showPhone: false,
            },
            {
              id: "block-remove",
              title: "Hospital",
              ref: { locationId: "loc-lib-1", label: "City Hospital", notes: "100 Main St" },
              showName: true,
              showPhone: false,
            },
            {
              id: "block-keep-2",
              title: "Parking",
              ref: null,
              showName: true,
              showPhone: false,
            },
          ],
        }}
        undoStack={undoStack}
      />,
    )

    const [, removeButton] = screen.getAllByRole("button", { name: "Remove location block" })
    await user.click(removeButton!)

    await waitFor(() => {
      expect(updateDayDetailsMock).toHaveBeenCalled()
    })

    // Assert the filtered payload was written (no longer contains Hospital)
    const lastRemovalCall = updateDayDetailsMock.mock.calls.at(-1) as unknown[]
    const lastPatch = lastRemovalCall[4] as { readonly locations?: ReadonlyArray<{ readonly id: string }> | null }
    expect(lastPatch.locations).toBeTruthy()
    expect(lastPatch.locations?.map((l) => l.id)).toEqual(["block-keep", "block-keep-2"])

    // Assert the undo stack received a locationRemoved snapshot
    await waitFor(() => {
      expect(undoStack.push).toHaveBeenCalledTimes(1)
    })
    const pushArg = (undoStack.push as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      readonly label: string
      readonly snapshot: UndoSnapshot
    }
    expect(pushArg.snapshot.kind).toBe("locationRemoved")
    if (pushArg.snapshot.kind === "locationRemoved") {
      expect(pushArg.snapshot.payload.index).toBe(1)
      expect(pushArg.snapshot.payload.block.id).toBe("block-remove")
      expect(pushArg.snapshot.payload.block.title).toBe("Hospital")
      expect(pushArg.snapshot.payload.block.ref?.locationId).toBe("loc-lib-1")
    }
  })

  it("clicking Undo reinserts the block at its original index against the current dayDetails.locations", async () => {
    const user = userEvent.setup()
    const undoStack = buildFakeUndoStack()

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
              id: "block-a",
              title: "Basecamp",
              ref: null,
              showName: true,
              showPhone: false,
            },
            {
              id: "block-b",
              title: "Hospital",
              ref: null,
              showName: true,
              showPhone: false,
            },
          ],
        }}
        undoStack={undoStack}
      />,
    )

    const [, removeSecond] = screen.getAllByRole("button", { name: "Remove location block" })
    await user.click(removeSecond!)

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledTimes(1)
    })

    const toastOptions = toastMock.mock.calls[0]?.[1] as { action: { onClick: () => void } }
    updateDayDetailsMock.mockClear()

    toastOptions.action.onClick()
    await Promise.resolve()
    await Promise.resolve()

    await waitFor(() => {
      expect(updateDayDetailsMock).toHaveBeenCalled()
    })

    const undoCall = updateDayDetailsMock.mock.calls.at(-1) as unknown[]
    const undoPatch = undoCall[4] as { readonly locations?: ReadonlyArray<{ readonly id: string }> | null }
    expect(undoPatch.locations?.map((l) => l.id)).toEqual(["block-a", "block-b"])
  })
})
