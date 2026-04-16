import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ScheduleTrackControls } from "@/features/schedules/components/ScheduleTrackControls"
import type { UseUndoStackResult } from "@/shared/hooks/useUndoStack"
import type { UndoSnapshot } from "@/features/schedules/lib/undoSnapshots"
import type { Schedule, ScheduleEntry } from "@/shared/types"

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

vi.mock("@/features/schedules/components/TypedTimeInput", () => ({
  TypedTimeInput: ({ value, placeholder }: { readonly value: string; readonly placeholder: string }) => (
    <div data-testid="typed-time-input">{value || placeholder}</div>
  ),
}))

const updateScheduleFieldsMock = vi.fn()
const batchUpdateScheduleAndEntriesMock = vi.fn()

vi.mock("@/features/schedules/lib/scheduleWrites", () => ({
  updateScheduleFields: (...args: unknown[]) => updateScheduleFieldsMock(...args),
  batchUpdateScheduleAndEntries: (...args: unknown[]) => batchUpdateScheduleAndEntriesMock(...args),
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

const schedule: Schedule = {
  id: "schedule-1",
  projectId: "project-1",
  name: "Shoot Day",
  date: null,
  tracks: [
    { id: "primary", name: "Primary", order: 0 },
    { id: "track-b", name: "Unit 2", order: 1 },
    { id: "track-c", name: "Unit 3", order: 2 },
  ],
  settings: {
    cascadeChanges: true,
    dayStartTime: "06:00",
    defaultEntryDurationMinutes: 15,
  },
  createdAt: { toDate: () => new Date(0) } as unknown as Schedule["createdAt"],
  updatedAt: { toDate: () => new Date(0) } as unknown as Schedule["updatedAt"],
}

const entries: ReadonlyArray<ScheduleEntry> = [
  { id: "entry-1", type: "shot", title: "Shot A", order: 0, trackId: "primary", startTime: "07:00", duration: 15 },
  { id: "entry-2", type: "shot", title: "Shot B", order: 0, trackId: "track-b", startTime: "07:30", duration: 15 },
  { id: "entry-3", type: "shot", title: "Shot C", order: 1, trackId: "track-c", startTime: "08:00", duration: 15 },
]

describe("ScheduleTrackControls — collapse undo wiring", () => {
  beforeEach(() => {
    toastMock.mockReset()
    toastErrorMock.mockReset()
    toastSuccessMock.mockReset()
    toastInfoMock.mockReset()
    updateScheduleFieldsMock.mockReset()
    batchUpdateScheduleAndEntriesMock.mockReset()

    updateScheduleFieldsMock.mockResolvedValue(undefined)
    batchUpdateScheduleAndEntriesMock.mockResolvedValue(undefined)
  })

  it("pushes a tracksCollapsed snapshot with the current tracks + per-entry trackId mapping", async () => {
    const user = userEvent.setup()
    const undoStack = buildFakeUndoStack()

    render(
      <ScheduleTrackControls
        scheduleId="schedule-1"
        schedule={schedule}
        entries={entries}
        undoStack={undoStack}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Collapse" }))
    // ConfirmDialog confirm button label is also "Collapse"; click it.
    const confirmButtons = screen.getAllByRole("button", { name: "Collapse" })
    const dialogConfirm = confirmButtons[confirmButtons.length - 1]!
    await user.click(dialogConfirm)

    await waitFor(() => {
      expect(batchUpdateScheduleAndEntriesMock).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(undoStack.push).toHaveBeenCalledTimes(1)
    })

    const pushArg = (undoStack.push as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      readonly label: string
      readonly snapshot: UndoSnapshot
    }
    expect(pushArg.snapshot.kind).toBe("tracksCollapsed")
    if (pushArg.snapshot.kind === "tracksCollapsed") {
      expect(pushArg.snapshot.payload.tracks.map((t) => t.id)).toEqual(["primary", "track-b", "track-c"])
      expect(pushArg.snapshot.payload.entryTrackIds).toEqual([
        { entryId: "entry-1", trackId: "primary" },
        { entryId: "entry-2", trackId: "track-b" },
        { entryId: "entry-3", trackId: "track-c" },
      ])
    }
  })

  it("shows a toast with a labeled Undo action button after collapse", async () => {
    const user = userEvent.setup()
    const undoStack = buildFakeUndoStack()

    render(
      <ScheduleTrackControls
        scheduleId="schedule-1"
        schedule={schedule}
        entries={entries}
        undoStack={undoStack}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Collapse" }))
    const confirmButtons = screen.getAllByRole("button", { name: "Collapse" })
    await user.click(confirmButtons[confirmButtons.length - 1]!)

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledTimes(1)
    })

    expect(toastMock).toHaveBeenCalledWith(
      "Collapsed tracks to single",
      expect.objectContaining({
        duration: 5000,
        action: expect.objectContaining({
          label: "Undo",
          onClick: expect.any(Function),
        }),
      }),
    )
  })

  it("clicking Undo fires batchUpdateScheduleAndEntries with the restored tracks + per-entry patches", async () => {
    const user = userEvent.setup()
    const undoStack = buildFakeUndoStack()

    render(
      <ScheduleTrackControls
        scheduleId="schedule-1"
        schedule={schedule}
        entries={entries}
        undoStack={undoStack}
      />,
    )

    await user.click(screen.getByRole("button", { name: "Collapse" }))
    const confirmButtons = screen.getAllByRole("button", { name: "Collapse" })
    await user.click(confirmButtons[confirmButtons.length - 1]!)

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledTimes(1)
    })

    batchUpdateScheduleAndEntriesMock.mockClear()

    const toastOptions = toastMock.mock.calls[0]?.[1] as { action: { onClick: () => void } }
    toastOptions.action.onClick()
    await Promise.resolve()
    await Promise.resolve()

    await waitFor(() => {
      expect(batchUpdateScheduleAndEntriesMock).toHaveBeenCalled()
    })

    const undoCallArgs = batchUpdateScheduleAndEntriesMock.mock.calls[0] as unknown[]
    const [, , , payload] = undoCallArgs
    const typedPayload = payload as {
      readonly schedulePatch?: { readonly tracks?: ReadonlyArray<{ readonly id: string }> }
      readonly entryUpdates?: ReadonlyArray<{ readonly entryId: string; readonly patch: { readonly trackId: string | null } }>
    }
    expect(typedPayload.schedulePatch?.tracks?.map((t) => t.id)).toEqual(["primary", "track-b", "track-c"])
    expect(typedPayload.entryUpdates).toEqual([
      { entryId: "entry-1", patch: { trackId: "primary" } },
      { entryId: "entry-2", patch: { trackId: "track-b" } },
      { entryId: "entry-3", patch: { trackId: "track-c" } },
    ])
  })
})
