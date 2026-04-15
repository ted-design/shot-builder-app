import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { CallOverridesEditor } from "@/features/schedules/components/CallOverridesEditor"
import type { UseUndoStackResult } from "@/shared/hooks/useUndoStack"
import type { UndoSnapshot } from "@/features/schedules/lib/undoSnapshots"
import type {
  CrewCallSheet,
  CrewRecord,
  DayDetails,
  TalentCallSheet,
  TalentRecord,
} from "@/shared/types"

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

const removeCrewCallMock = vi.fn()
const removeTalentCallMock = vi.fn()
const upsertCrewCallMock = vi.fn()
const upsertTalentCallMock = vi.fn()

vi.mock("@/features/schedules/lib/scheduleWrites", () => ({
  removeCrewCall: (...args: unknown[]) => removeCrewCallMock(...args),
  removeTalentCall: (...args: unknown[]) => removeTalentCallMock(...args),
  upsertCrewCall: (...args: unknown[]) => upsertCrewCallMock(...args),
  upsertTalentCall: (...args: unknown[]) => upsertTalentCallMock(...args),
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

const talentLibrary: readonly TalentRecord[] = [
  { id: "talent-1", name: "Jane Doe" } as TalentRecord,
  { id: "talent-2", name: "John Smith" } as TalentRecord,
]

const crewLibrary: readonly CrewRecord[] = [
  { id: "crew-1", name: "Camille DP", department: "Camera", position: "DP" } as CrewRecord,
  { id: "crew-2", name: "Sam Sound", department: "Sound", position: "Mixer" } as CrewRecord,
]

const baseTalentCall: TalentCallSheet = {
  id: "talent-call-1",
  talentId: "talent-1",
  callTime: "07:00",
  role: "Lead",
  status: "confirmed",
}

const baseCrewCall: CrewCallSheet = {
  id: "crew-call-1",
  crewMemberId: "crew-1",
  callTime: "06:30",
  department: "Camera",
  position: "DP",
}

const dayDetails: DayDetails = {
  id: "day-details-1",
  scheduleId: "schedule-1",
  crewCallTime: "06:00",
  shootingCallTime: "07:00",
  estimatedWrap: "19:00",
}

function renderEditor(overrides: Partial<Parameters<typeof CallOverridesEditor>[0]> = {}) {
  const undoStack = overrides.undoStack ?? buildFakeUndoStack()
  const result = render(
    <CallOverridesEditor
      scheduleId="schedule-1"
      dayDetails={dayDetails}
      talentCalls={[baseTalentCall]}
      crewCalls={[baseCrewCall]}
      talentLibrary={talentLibrary}
      crewLibrary={crewLibrary}
      undoStack={undoStack}
      {...overrides}
    />,
  )
  return { ...result, undoStack }
}

describe("CallOverridesEditor — destructive undo wiring", () => {
  beforeEach(() => {
    toastMock.mockReset()
    toastErrorMock.mockReset()
    toastSuccessMock.mockReset()
    toastInfoMock.mockReset()
    removeCrewCallMock.mockReset()
    removeTalentCallMock.mockReset()
    upsertCrewCallMock.mockReset()
    upsertTalentCallMock.mockReset()

    removeCrewCallMock.mockResolvedValue(undefined)
    removeTalentCallMock.mockResolvedValue(undefined)
    upsertCrewCallMock.mockResolvedValue("crew-call-1")
    upsertTalentCallMock.mockResolvedValue("talent-call-1")
  })

  it("calls removeCrewCall when the crew row X button is clicked", async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole("button", { name: "Remove override for Camille DP" }))

    await waitFor(() => {
      expect(removeCrewCallMock).toHaveBeenCalledWith(
        "client-1",
        "project-1",
        "schedule-1",
        "crew-call-1",
      )
    })
  })

  it("pushes a crewCallRemoved snapshot onto the undo stack with the full CrewCallSheet payload", async () => {
    const user = userEvent.setup()
    const { undoStack } = renderEditor()

    await user.click(screen.getByRole("button", { name: "Remove override for Camille DP" }))

    await waitFor(() => {
      expect(undoStack.push).toHaveBeenCalledTimes(1)
    })

    const pushArg = (undoStack.push as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      readonly label: string
      readonly snapshot: UndoSnapshot
    }
    expect(pushArg.snapshot.kind).toBe("crewCallRemoved")
    if (pushArg.snapshot.kind === "crewCallRemoved") {
      expect(pushArg.snapshot.payload).toEqual(baseCrewCall)
    }
  })

  it("pushes a talentCallRemoved snapshot with the full TalentCallSheet payload", async () => {
    const user = userEvent.setup()
    const { undoStack } = renderEditor()

    await user.click(screen.getByRole("button", { name: "Remove override for Jane Doe" }))

    await waitFor(() => {
      expect(undoStack.push).toHaveBeenCalledTimes(1)
    })

    const pushArg = (undoStack.push as unknown as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      readonly label: string
      readonly snapshot: UndoSnapshot
    }
    expect(pushArg.snapshot.kind).toBe("talentCallRemoved")
    if (pushArg.snapshot.kind === "talentCallRemoved") {
      expect(pushArg.snapshot.payload).toEqual(baseTalentCall)
    }
  })

  it("shows a toast with a 5000ms duration and a labeled Undo action button", async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole("button", { name: "Remove override for Camille DP" }))

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledTimes(1)
    })

    expect(toastMock).toHaveBeenCalledWith(
      "Removed Camille DP override",
      expect.objectContaining({
        duration: 5000,
        action: expect.objectContaining({
          label: "Undo",
          onClick: expect.any(Function),
        }),
      }),
    )
  })

  it("invokes upsertCrewCall on Undo click to re-create the removed crew call", async () => {
    const user = userEvent.setup()
    renderEditor()

    await user.click(screen.getByRole("button", { name: "Remove override for Camille DP" }))

    await waitFor(() => {
      expect(toastMock).toHaveBeenCalledTimes(1)
    })

    const lastCall = toastMock.mock.calls[toastMock.mock.calls.length - 1]
    const onClick = (lastCall?.[1] as { action: { onClick: () => void } }).action.onClick
    onClick()
    await Promise.resolve()
    await Promise.resolve()

    await waitFor(() => {
      expect(upsertCrewCallMock).toHaveBeenCalledWith(
        "client-1",
        "project-1",
        "schedule-1",
        "crew-call-1",
        expect.objectContaining({
          crewMemberId: "crew-1",
          callTime: "06:30",
          department: "Camera",
          position: "DP",
        }),
      )
    })
  })
})
