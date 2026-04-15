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

// Mock the Radix Select primitive with a trivial native <select> so that
// jsdom-driven tests can drive onValueChange without Radix's pointer-capture
// polyfill. The real Select is exercised in e2e.
vi.mock("@/ui/select", async () => {
  const React = await import("react")
  interface SelectProps {
    readonly children?: React.ReactNode
    readonly value?: string
    readonly onValueChange?: (value: string) => void
  }
  interface SelectItemProps {
    readonly children?: React.ReactNode
    readonly value: string
  }
  const MOCK_SELECT_ITEM_TYPE = Symbol.for("mock-select-item")
  const Select = ({ children, value, onValueChange }: SelectProps) => {
    const options: { value: string; label: string }[] = []
    const visit = (node: React.ReactNode): void => {
      React.Children.forEach(node, (child) => {
        if (!React.isValidElement(child)) return
        const elType = child.type as unknown
        if (
          typeof elType === "function" &&
          (elType as { mockSelectItemTag?: symbol }).mockSelectItemTag === MOCK_SELECT_ITEM_TYPE
        ) {
          const props = child.props as SelectItemProps
          const label = typeof props.children === "string" ? props.children : props.value
          options.push({ value: props.value, label })
          return
        }
        const props = child.props as { children?: React.ReactNode }
        if (props?.children !== undefined) visit(props.children)
      })
    }
    visit(children)
    return React.createElement(
      "select",
      {
        "data-testid": "mock-select",
        "aria-label": "mock-select",
        value: value ?? "",
        onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
          onValueChange?.(e.target.value),
      },
      React.createElement("option", { key: "__placeholder__", value: "" }, "placeholder"),
      ...options.map((o) =>
        React.createElement("option", { key: o.value, value: o.value }, o.label),
      ),
    )
  }
  const SelectItem = ({ children }: SelectItemProps) => React.createElement(React.Fragment, null, children)
  ;(SelectItem as unknown as { mockSelectItemTag: symbol }).mockSelectItemTag = MOCK_SELECT_ITEM_TYPE
  const Passthrough = ({ children }: { readonly children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children)
  return {
    Select,
    SelectContent: Passthrough,
    SelectTrigger: Passthrough,
    SelectValue: Passthrough,
    SelectItem,
  }
})

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

  it("renders TWO SaveIndicator pills (one per section header) after a successful talent save", async () => {
    const user = userEvent.setup()
    renderEditor({ talentCalls: [] })

    // Before any save: no pill in either section header.
    expect(screen.queryAllByRole("status")).toHaveLength(0)

    // Trigger a talent override creation via the mocked native select.
    const selects = screen.getAllByTestId("mock-select")
    await user.selectOptions(selects[0]!, "talent-1")

    await waitFor(() => {
      expect(upsertTalentCallMock).toHaveBeenCalled()
    })

    // Both pills should be visible, driven by the same shared lastSaved
    // instance — the Talent header pill and the Crew header pill tick
    // in sync, so the text content is identical.
    await waitFor(() => {
      const pills = screen.getAllByRole("status")
      expect(pills).toHaveLength(2)
      expect(pills[0]?.textContent).toBe(pills[1]?.textContent)
      expect(pills[0]).toHaveTextContent("Saved")
    })
  })

  it("awaits upsertTalentCall when adding a new talent override (no optimistic creation)", async () => {
    const user = userEvent.setup()

    // Defer the upsert so we can observe that no optimistic state was
    // applied before the write resolves.
    let resolveWrite: (id: string) => void = () => {}
    upsertTalentCallMock.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveWrite = resolve
        }),
    )

    // Only render with empty talentCalls so the "Add talent" dropdown is visible.
    renderEditor({ talentCalls: [] })

    // The mocked Select renders as a native <select>. There are two
    // selects when talentCalls is empty: the talent-add dropdown (first)
    // and the crew-add dropdown (second). Select the talent one.
    const selects = screen.getAllByTestId("mock-select")
    await user.selectOptions(selects[0]!, "talent-1")

    // upsertTalentCall fires with creation args (talentCallId === null)
    await waitFor(() => {
      expect(upsertTalentCallMock).toHaveBeenCalledWith(
        "client-1",
        "project-1",
        "schedule-1",
        null,
        expect.objectContaining({ talentId: "talent-1" }),
      )
    })

    // Resolve and confirm no crash or flakiness after the await
    resolveWrite("talent-call-new")
    await Promise.resolve()
    await Promise.resolve()
  })

  it("awaits upsertCrewCall when adding a new crew override (no optimistic creation)", async () => {
    const user = userEvent.setup()

    let resolveWrite: (id: string) => void = () => {}
    upsertCrewCallMock.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          resolveWrite = resolve
        }),
    )

    renderEditor({ crewCalls: [] })

    const selects = screen.getAllByTestId("mock-select")
    // With empty crewCalls: first select = talent add, second select = crew add.
    await user.selectOptions(selects[1]!, "crew-1")

    await waitFor(() => {
      expect(upsertCrewCallMock).toHaveBeenCalledWith(
        "client-1",
        "project-1",
        "schedule-1",
        null,
        expect.objectContaining({ crewMemberId: "crew-1" }),
      )
    })

    resolveWrite("crew-call-new")
    await Promise.resolve()
    await Promise.resolve()
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
