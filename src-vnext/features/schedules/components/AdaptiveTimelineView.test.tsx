import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { AdaptiveTimelineView } from "@/features/schedules/components/AdaptiveTimelineView"
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

const removeScheduleEntryMock = vi.fn()
const upsertScheduleEntryMock = vi.fn()

vi.mock("@/features/schedules/lib/scheduleWrites", () => ({
  addScheduleEntryCustom: vi.fn(),
  addScheduleEntryShot: vi.fn(),
  batchUpdateScheduleEntries: vi.fn().mockResolvedValue(undefined),
  removeScheduleEntry: (...args: unknown[]) => removeScheduleEntryMock(...args),
  updateScheduleEntryFields: vi.fn(),
  upsertScheduleEntry: (...args: unknown[]) => upsertScheduleEntryMock(...args),
}))

// Mock the heavy visual sub-components so rendering is cheap.
vi.mock("@/features/schedules/components/AdaptiveBannerSegment", () => ({
  AdaptiveBannerSegment: () => <div data-testid="banner-segment" />,
}))
vi.mock("@/features/schedules/components/AdaptiveGapSegment", () => ({
  AdaptiveGapSegment: () => <div data-testid="gap-segment" />,
}))
vi.mock("@/features/schedules/components/AdaptiveDenseBlock", () => ({
  AdaptiveDenseBlock: () => <div data-testid="dense-block" />,
}))
vi.mock("@/features/schedules/components/TimelineGridView", () => ({
  TimelineGridView: () => <div data-testid="timeline-grid-view" />,
}))
vi.mock("@/features/schedules/components/TimelinePropertiesDrawer", () => ({
  TimelinePropertiesDrawer: () => <div data-testid="properties-drawer" />,
}))
vi.mock("@/features/schedules/components/AdaptiveTimelineHeader", () => ({
  AdaptiveTimelineHeader: () => <div data-testid="timeline-header" />,
  computeTrackCounts: () => new Map<string, number>(),
}))

// The unscheduled tray is the test's click surface — expose
// onClickEntry to the user as a real button that passes the
// target entry id.
vi.mock("@/features/schedules/components/AdaptiveUnscheduledTray", () => ({
  AdaptiveUnscheduledTray: ({
    onClickEntry,
  }: {
    readonly onClickEntry: (entryId: string) => void
  }) => (
    <button
      type="button"
      data-testid="mock-unscheduled-row"
      onClick={() => onClickEntry("entry-42")}
    >
      Open entry-42
    </button>
  ),
}))

vi.mock("@/features/schedules/components/AddShotToScheduleDialog", () => ({
  AddShotToScheduleDialog: () => <div data-testid="add-shot-dialog" />,
}))
vi.mock("@/features/schedules/components/AddCustomEntryDialog", () => ({
  AddCustomEntryDialog: () => <div data-testid="add-custom-dialog" />,
}))

// The edit sheet renders a Remove button when open. handleRemove is
// wired through onRemove.
vi.mock("@/features/schedules/components/ScheduleEntryEditSheet", () => ({
  ScheduleEntryEditSheet: ({
    open,
    onRemove,
  }: {
    readonly open: boolean
    readonly onRemove?: () => void | Promise<void>
  }) =>
    open ? (
      <button
        type="button"
        data-testid="mock-edit-sheet-remove"
        onClick={() => {
          void onRemove?.()
        }}
      >
        Remove entry
      </button>
    ) : null,
}))

// Stub useAdaptiveSegments so no segments render; we test via the
// unscheduled tray click path which the mock exposes.
vi.mock("@/features/schedules/hooks/useAdaptiveSegments", () => ({
  useAdaptiveSegments: () => ({
    segments: [],
    unscheduledRows: [],
  }),
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
  tracks: [{ id: "primary", name: "Primary", order: 0 }],
  settings: {
    cascadeChanges: true,
    dayStartTime: "06:00",
    defaultEntryDurationMinutes: 15,
  },
  createdAt: { toDate: () => new Date(0) } as unknown as Schedule["createdAt"],
  updatedAt: { toDate: () => new Date(0) } as unknown as Schedule["updatedAt"],
}

const targetEntry: ScheduleEntry = {
  id: "entry-42",
  type: "shot",
  title: "Hero Shot",
  shotId: "shot-xyz",
  startTime: "07:30",
  duration: 15,
  order: 2,
  trackId: "primary",
  notes: "bring the good lens",
}

const entries: ReadonlyArray<ScheduleEntry> = [
  { id: "entry-other", type: "shot", title: "Other", order: 0, trackId: "primary" },
  targetEntry,
]

async function openAndRemove(user: ReturnType<typeof userEvent.setup>, undoStack: UseUndoStackResult<UndoSnapshot>) {
  render(
    <AdaptiveTimelineView
      scheduleId="schedule-1"
      schedule={schedule}
      entries={entries}
      shots={[]}
      undoStack={undoStack}
    />,
  )

  await user.click(screen.getByTestId("mock-unscheduled-row"))
  await user.click(await screen.findByTestId("mock-edit-sheet-remove"))
}

describe("AdaptiveTimelineView — timeline entry delete undo", () => {
  beforeEach(() => {
    toastMock.mockReset()
    toastErrorMock.mockReset()
    toastSuccessMock.mockReset()
    toastInfoMock.mockReset()
    removeScheduleEntryMock.mockReset()
    upsertScheduleEntryMock.mockReset()

    removeScheduleEntryMock.mockResolvedValue(undefined)
    upsertScheduleEntryMock.mockResolvedValue({ id: "entry-42" })
  })

  it("calls removeScheduleEntry when the edit sheet's Remove button fires", async () => {
    const user = userEvent.setup()
    await openAndRemove(user, buildFakeUndoStack())

    await waitFor(() => {
      expect(removeScheduleEntryMock).toHaveBeenCalledWith(
        "client-1",
        "project-1",
        "schedule-1",
        "entry-42",
      )
    })
  })

  it("pushes a scheduleEntryRemoved snapshot with the full ScheduleEntry payload", async () => {
    const user = userEvent.setup()
    const undoStack = buildFakeUndoStack()
    await openAndRemove(user, undoStack)

    await waitFor(() => {
      expect(undoStack.push).toHaveBeenCalledTimes(1)
    })

    const pushArg = (undoStack.push as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      readonly label: string
      readonly snapshot: UndoSnapshot
    }
    expect(pushArg.label).toBe("Removed Hero Shot")
    expect(pushArg.snapshot.kind).toBe("scheduleEntryRemoved")
    if (pushArg.snapshot.kind === "scheduleEntryRemoved") {
      expect(pushArg.snapshot.payload).toEqual(targetEntry)
    }
  })

  it("clicking Undo fires upsertScheduleEntry with the original entry id and a patch shaped from the snapshot", async () => {
    const user = userEvent.setup()
    const undoStack = buildFakeUndoStack()
    await openAndRemove(user, undoStack)

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledTimes(1)
    })

    const toastOptions = toastMock.mock.calls[0]?.[1] as { action: { onClick: () => void } }
    toastOptions.action.onClick()
    await Promise.resolve()
    await Promise.resolve()

    await waitFor(() => {
      expect(upsertScheduleEntryMock).toHaveBeenCalled()
    })

    expect(upsertScheduleEntryMock).toHaveBeenCalledWith(
      "client-1",
      "project-1",
      "schedule-1",
      "entry-42",
      expect.objectContaining({
        type: "shot",
        title: "Hero Shot",
        shotId: "shot-xyz",
        startTime: "07:30",
        duration: 15,
        order: 2,
        trackId: "primary",
        notes: "bring the good lens",
      }),
    )
  })
})
